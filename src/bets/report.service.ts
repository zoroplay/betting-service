import { HttpStatus, Injectable } from "@nestjs/common";
import { EntityManager, Repository } from "typeorm";

import * as dayjs from 'dayjs';
import { BET_CANCELLED, BET_CASHOUT, BET_LOST, BET_PENDING, BET_VOIDED, BET_WON, STATUS_LOST, STATUS_NOT_LOST_OR_WON, STATUS_WON} from "src/constants";
import { IdentityService } from "src/identity/identity.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Bet } from "src/entity/bet.entity";
import { BetSlip } from "src/entity/betslip.entity";
import { RetailService } from "./retail.service";
import { GamingActivityRequest, GamingActivityResponse, GetTicketsRequest } from "src/proto/betting.pb";
import { paginateResponse } from "src/commons/helper";
import { VirtualBet } from "src/entity/virtual-bet.entity";
import { CasinoBet } from "src/entity/casino-bet.entity";
import { JsonLogger, LoggerFactory } from "json-logger-service";
var customParseFormat = require('dayjs/plugin/customParseFormat')

dayjs.extend(customParseFormat)


@Injectable()
export class ReportService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(
        ReportService.name,
    );

    constructor(
        private readonly entityManager: EntityManager,
        private readonly identityService: IdentityService,
        private readonly retailsService: RetailService,
        @InjectRepository(Bet)
        private readonly betRepository: Repository<Bet>,
        @InjectRepository(BetSlip)
        private readonly betSlipRepository: Repository<BetSlip>,
        @InjectRepository(VirtualBet)
        private readonly virtualBetRepo: Repository<VirtualBet>,
        @InjectRepository(CasinoBet)
        private readonly casinoBetRepo: Repository<CasinoBet>,
    ) {}

    async gamingActivity(data: GamingActivityRequest): Promise<GamingActivityResponse> {

        const {groupBy, productType, from, to, username, clientID, betType, source, eventType, displayType, userId} = data;
        let table = 'bet';

        try {
            let totalWinnings = 0;
            let totalStake = 0;
            let totalTickets = 0;
            let bets = [];

            let group_by;
            const startDate = dayjs(from, 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
            const endDate = dayjs(to, 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
            const voidStatus = `(${BET_CANCELLED},${BET_VOIDED})`;
            let params = [];
            params.push(clientID);
            params.push(startDate)
            params.push(endDate)
            // params.push(voidStatus)

            if (productType === 'virtual') {
                table = 'virtual_bets';
            }

            switch (groupBy){
                case 'day':
                    group_by = `DATE(${table}.created)`;
                    break;
                case 'month':
                    group_by = `MONTH(${table}.created)`;
                    break;
                default:
                    group_by = table+'.'+ groupBy;
                    break;
            }

            let sql = `SELECT MONTH(${table}.created) AS month, DATE(${table}.created) as date, SUM(${table}.stake) AS turnover, COUNT(*) as total`;

            if (productType === 'sports') {
                sql += ', avg(bet.stake) as average, SUM(w.winning_after_tax) as winnings, bet.source, bet.bet_type';
            }

            if (productType === 'virtual') {
                sql += `, SUM(${table}.amount_won) as winnings`;
            }


            // if(groupBy === 'user_id'){
            //     sql += `, t.amount as total_deposit, users.username, users.id`;
            // }

            if(productType === 'sports ' && (groupBy == 'sport' || groupBy == 'tournament' || groupBy == 'market')){
                sql += ', bet_slip.market_name, bet_slip.sport_name, bet_slip.tournament_name';
            }

            sql += ` FROM ${table} LEFT JOIN winning w ON w.bet_id = bet.id`;

            if(productType === 'sports ' && (groupBy == 'sport' || groupBy == 'tournament' || groupBy == 'market')){
                sql = ' JOIN bet_slip ON bet_slip.bet_id = bet.id';
            }

            sql += ` WHERE bet.is_booked = 0 AND bet.client_id = ? AND ${table}.created BETWEEN ? AND ? AND bet.status NOT IN (${BET_CANCELLED}, ${BET_VOIDED}) `;


            if(username && username !== ''){
                sql += `AND ${table}.username = ? `;
                params.push(username);
            }

            if(betType && betType !== ''){
                sql += `AND ${table}.bet_type = ? `;
                params.push(betType);
            }

            if(source && source !== ''){
                sql += `AND ${table}.source = ? `;
                params.push(source);
            }

            if(eventType && eventType !== ''){
                sql += `AND ${table}.event_type = ? `;
                params.push(eventType);
            }

            if(displayType === 'real') {
                sql += `AND ${table}.bonus_id IS NULL `;
                
            } else {
                sql += `AND ${table}.bonus_id != 0 `;
            }

            if (userId) {
                const userIds = await this.retailsService.fetchUserIds(userId, clientID);
                
                sql += `AND ${table}.user_id IN (?) `;
                params.push(userIds);
            }

            console.log(sql);

            let resSum = await this.entityManager.query(sql, params)

            if (resSum) {
                let result = resSum[0];
                totalStake = result.turnover || 0;
                totalWinnings = result.winnings || 0;
                totalTickets = result.total || 0;
            }

            sql += ` GROUP BY ${group_by}`;
            
            let mainQuery  = await this.entityManager.query(sql, params);
            if (mainQuery) bets = mainQuery;
            // if(!empty($input['product_type'])){
            //     $bets = $bets->where('bets.product_type', $input['product_type']);
            // }

            // $bets = $bets->groupBy($group_by)->paginate(100);
            return {
                success: true, 
                status: HttpStatus.OK, 
                message: 'Data fetched', 
                data: {bets, totalStake, totalWinnings, totalTickets},
                error: null
            };
        } catch(e) {
            return {success: false, status: HttpStatus.BAD_REQUEST, message: 'Unable to fetch data', error: e.message};
        }
    }

    async salesReport(data) {
        try {
            const {from, to, productType, role, userId, clientId} = data;
            // const startDate = dayjs(from, 'DD/MM/YYYY').format('YYYY-MM-DD');
            // const endDate = dayjs(to, 'DD/MM/YYYY').format('YYYY-MM-DD');

            if (role === 'Cashier') {
                // get all bets
                const betsQuery = `SELECT IFNULL(SUM(CASE WHEN b.status = ? THEN 1 ELSE 0 END), 0) as running_bets,
                    IFNULL(SUM(CASE WHEN b.status IN (?, ?) THEN 1 ELSE 0 END), 0) as settled_bets, COUNT(*) as no_of_bets,
                    IFNULL(SUM(b.stake), 0) as stake, IFNULL(SUM(w.winning_after_tax), 0) as winnings, IFNULL(SUM(b.commission), 0) as commission FROM bet b
                    LEFT JOIN winning w ON w.bet_id = b.id WHERE b.client_id = ? AND DATE(b.created) BETWEEN ? AND ? AND b.user_id = ?`;

                let bets  = await this.entityManager.query(betsQuery, [BET_PENDING, BET_WON, BET_LOST, clientId, from, to, userId]);
                // console.log(bets.getSql())
                // get all virtual bets
                const vBetQuery = `SELECT IFNULL(SUM(CASE WHEN virtual_bets.status = 0 THEN 1 ELSE 0 END), 0) as running_bets,
                    IFNULL(SUM(CASE WHEN virtual_bets.status IN (1, 2) THEN 1 ELSE 0 END), 0) as settled_bets,
                    COUNT(*) as no_of_bets, IFNULL(SUM(virtual_bets.stake), 0) as stake, IFNULL(SUM(virtual_bets.winnings), 0) as winnings,
                    IFNULL(SUM(virtual_bets.commission), 0) as commission FROM virtual_bets WHERE client_id = ? AND user_id = ?`;

                let vBets  = await this.entityManager.query(vBetQuery, [clientId, userId]);

                return {
                    success: true,
                    message: 'Sales Cashier Report',
                    data: {
                        retail_sports: bets[0],
                        retail_virtual: vBets[0],
                        grand_total: {
                            running_bets: parseFloat(bets[0].running_bets) + parseFloat(vBets[0].running_bets),
                            settled_bets: parseFloat(bets[0].settled_bets) + parseFloat(vBets[0].settled_bets),
                            no_of_bets: parseFloat(bets[0].no_of_bets) + parseFloat(vBets[0].no_of_bets),
                            stake: parseFloat(bets[0].stake) + parseFloat(vBets[0].stake),
                            winnings: parseFloat(bets[0].winnings) + parseFloat(vBets[0].winnings),
                            commission: parseFloat(bets[0].commission) + parseFloat(vBets[0].commission),
                        }
                    }
                }
            } else {
                switch (role) {
                    case 'Shop':
                        return await this.retailsService.getShopUserReport(data);
                    case 'Agent':
                        return await this.retailsService.getAgentReport(data);
                    case 'Master Agent':
                        return await this.retailsService.getMasterAgentReport(data);
                    case 'Super Agent':
                        return await this.retailsService.getSuperAgentReport(data);
                    default:
                        return {success: false, status: HttpStatus.BAD_REQUEST, message: 'No data found', data: {}}
                }
            }

        } catch (e) {
            console.log(e.message);
            return {
                success: false, 
                status: HttpStatus.INTERNAL_SERVER_ERROR, 
                message: 'Something went wrong'
            }
        }
    }

    async getShopUserReport (data) {
        const {from, to, productType, role, userId, clientId} = data;

        // fetch agent users
        const usersRes = await this.identityService.getAgentUser({
            clientId, 
            userId
        });

        let userIds = [];

        if (usersRes.success) {
            userIds = usersRes.data.map(user => user.id);
        }


        if (userIds.length > 0) {
        }
    }

    async deletePlayerData(id) {
        const sql = `DELETE b, bs FROM bet b JOIN bet_slip bs ON bs.bet_id = b.id WHERE b.user_id = ?`;

        await this.entityManager.query(sql, [id]);

        return {success: true, message: 'Successful'}
    }

    async ticketsReport(data: GetTicketsRequest) {
        // console.log(data)
        try {
            switch (data.ticketType) {
                case 'virtual':
                    return await this.getVirtualTickets(data);
                case 'casino':
                    return await this.getCasinoBets(data);
                default:
                    return await this.getSportsTickets(data);
            }

        } catch (e) {
            return {
                success: false, 
                status: HttpStatus.INTERNAL_SERVER_ERROR, 
                message: 'Something went wrong'
            }
        }
    }

    async getSportsTickets ({
        userId,
        status,
        to,
        from,
        clientId,
        perPage,
        page,
        betslipId,
        username,
    }: GetTicketsRequest) {
        try {
            let response: any = {};
            let bets: any = [];
            let total = 0;
            let last_page = 0;
            let start = 0;
            let left_records = 0;
            let totalStake = 0;
            let totalWinnings = 0;
            let current_page = page - 1;
            let noPerPage = perPage || 50;

            try {
                let params = [];
                params.push(clientId);
                let where = [];

                if (userId > 0) {
                    where.push('b.user_id = ? ');
                    params.push(userId);
                }

                if (status === 'settled') {
                    where.push('b.status != ? ');
                    params.push(0);
                } else if (status !== '') {
                    where.push(`b.status = ?`);
                    params.push(status);
                }

                if (from && from !== '') {
                    where.push('b.created >= ? ');
                    params.push(from);
                }

                if (to && to !== '') {
                    where.push('b.created <= ? ');
                    params.push(to);
                }

                if (betslipId && betslipId !== '') {
                    where.push('b.betslip_id = ?');
                    params.push(betslipId);
                }

                if (username && username !== '') {
                    where.push('b.username = ?');
                    params.push(username);
                }

                // count games

                let queryCount = `SELECT count(id) as total FROM bet b WHERE is_booked = 0 AND client_id = ? AND ${where.join(
                    ' AND ',
                )} `;

                let res = await this.entityManager.query(queryCount, params);

                if (res) {
                    let result = res[0];
                    total = result.total;
                }

                // console.log('total | ' + total);

                let sumQuery = `SELECT SUM(stake) as total_stake, SUM(w.winning_after_tax) as winnings FROM bet b LEFT JOIN winning w ON w.bet_id = b.id WHERE is_booked = 0 AND b.client_id = ? AND ${where.join(
                    ' AND ',
                )} `;

                let resSum = await this.entityManager.query(sumQuery, params);

                if (resSum) {
                    let result = resSum[0];
                    totalStake = result.total_stake;
                    totalWinnings = result.winnings;
                }
                // calculate offset

                if (total <= noPerPage) {
                    last_page = 1;
                } else {
                    let totalPages = Math.ceil(total / noPerPage);

                    if (total > noPerPage && total % noPerPage > 0) {
                    totalPages++;
                    }

                    last_page = totalPages;
                }

                let offset = 0;

                if (current_page > 0) {
                    offset = noPerPage * current_page;
                } else {
                    current_page = 0;
                    offset = 0;
                }

                if (offset > total) {
                    let a = current_page * noPerPage;

                    if (a > total) {
                    offset = (current_page - 1) * noPerPage;
                    } else {
                    offset = total - a;
                    }
                }

                start = offset + 1;

                current_page++;
                left_records = total - offset;
                let off = offset - 1;

                if (off > 0) {
                    offset = off;
                }

                let limit = ` LIMIT ${offset},${noPerPage}`;

                let queryString = `SELECT b.id,b.user_id,b.username,b.betslip_id,b.stake,b.currency,b.bet_type,b.bet_category,b.total_odd,b.possible_win,b.source,b.total_bets,
                    b.won,b.status,b.created,w.winning_after_tax as winnings, b.sports, b.tournaments, b.events, b.markets, b.event_type, b.bet_category_desc, b.probability, b.settled_at
                    FROM bet b LEFT JOIN winning w ON w.bet_id = b.id WHERE is_booked = 0 AND b.client_id = ? AND  ${where.join(
                    ' AND ',
                    )} ORDER BY b.created DESC ${limit}`;

                bets = await this.entityManager.query(queryString, params);
            } catch (e) {
                this.logger.error(' error retrieving bets ' + e.toString());
                throw e;
            }

            let myBets = [];

            for (let bet of bets) {
                let slips: any;
                // let settled: any;

                try {
                    const slipQuery = `SELECT * FROM bet_slip WHERE bet_id =? `;
                    slips = await this.entityManager.query(slipQuery, [bet.id]);

                } catch (e) {
                    this.logger.error(' error retrieving bet slips ' + e.toString());
                    continue;
                }

                if (bet.status == BET_PENDING) {
                    bet.statusDescription = 'Pending';
                    bet.statusCode = 0;
                }

                if (bet.status == BET_LOST) {
                    bet.statusDescription = 'Lost';
                    bet.statusCode = 2;
                }

                if (bet.status == BET_WON) {
                    bet.statusDescription = 'Won';
                    bet.statusCode = 1;
                }

                if (bet.status == BET_CASHOUT) {
                    bet.statusDescription = 'Cashout';
                    bet.statusCode = 1;
                }

                if (bet.status == BET_VOIDED) {
                    bet.statusDescription = 'Void';
                    bet.statusCode = 3;
                }

                if (bet.status == BET_CANCELLED) {
                    bet.statusDescription = 'Cancelled';
                    bet.statusCode = 4;
                }

                bet.selections = [];
                let cashOutAmount = 0;

                if (slips.length > 0) {
                    for (const slip of slips) {

                        let slipStatusDesc, slipStatus;
                        switch (slip.won) {
                            case STATUS_NOT_LOST_OR_WON:
                                slipStatusDesc = 'Pending';
                                slipStatus = 0;
                                break;
                            case STATUS_LOST:
                                slipStatusDesc = 'Lost';
                                slipStatus = 2;
                                break;
                            case STATUS_WON:
                                slipStatusDesc = 'Won';
                                slipStatus = 1;
                                break;
                            default:
                                slipStatusDesc = 'Void';
                                slipStatus = 3;
                                break;
                        }


                        bet.selections.push({
                            eventName: slip.event_name,
                            eventDate: slip.event_date,
                            eventType: slip.event_type,
                            eventPrefix: slip.event_prefix,
                            eventId: slip.event_id,
                            matchId: slip.match_id,
                            marketName: slip.market_name,
                            specifier: slip.specifier,
                            outcomeName: slip.outcome_name,
                            odds: slip.odds,
                            sport: slip.sport_name,
                            category: slip.category_name,
                            tournament: slip.tournament_name,
                            type: slip.is_live === 1 ? 'live' : 'pre',
                            statusDescription: slipStatusDesc,
                            status: slipStatus,
                            score: slip.score,
                            htScore: slip.ht_score,
                            id: slip.id,
                            settledAt: slip.settled_at,
                            settlementType: slip.settlement_type
                        });
                    }
                }

                bet.id = bet.id;
                bet.userId = bet.user_id;
                bet.username = bet.username;
                bet.betslipId = bet.betslip_id;
                bet.totalOdd = bet.total_odd;
                bet.possibleWin = bet.possible_win;
                bet.betType = bet.bet_type;
                bet.eventType = bet.event_type;
                bet.betCategory = bet.bet_category;
                bet.totalSelections = bet.total_bets;
                bet.winnings = bet.winnings;
                bet.sports = bet.sports;
                bet.tournaments = bet.tournaments;
                bet.events = bet.events;
                bet.markets = bet.markets;
                bet.betCategoryDesc = bet.bet_category_desc;
                bet.cashOutAmount = cashOutAmount;
                bet.settledAt = bet.settled_at;

                myBets.push(bet);
            }
            const pager = paginateResponse([myBets, total], page, 100);
            response = {...pager};

            response.data = JSON.parse(response.data);
            response.totals = {
                totalStake,
                totalWinnings
            }
            
            return {
                success: true,
                message: 'Sports Bets retreived',
                data: response,
                status: HttpStatus.OK
            }

        } catch (e) {
            return {
                success: false, 
                status: HttpStatus.INTERNAL_SERVER_ERROR, 
                message: 'Something went wrong'
            }
        }
    }

    async getVirtualTickets (data) {
        const {clientId, username, from, to, status, page} = data;
        try {
        
            let query = this.virtualBetRepo.createQueryBuilder('vb').where('client_id = :clientId', {clientId})
                            .andWhere('created_at >= :from', {from})
                            .andWhere('created_at <= :to', {to});
            
            if (username && username !== '')
                query.andWhere('username like :username', {username: `%${username}%`})

            if (status && status !== 'settled')
                query.andWhere('status = :status', {status});
            
            const total = await query.clone().getCount();
            const sum = await query.clone().addSelect('SUM(stake)', 'totalStake').addSelect('SUM(winnings)', 'totalWinnings').getRawOne();

            let offset = (page - 1) * 100
            offset = offset + 1;

            const results = await query.limit(100).offset(offset).orderBy('created_at', 'DESC').getMany();

            const pager = paginateResponse([results, total], page, 100);
            const response: any = {...pager};

            response.data = JSON.parse(response.data);
            response.totals = {
                totalStake: sum.totalStake || 0,
                totalWinnings: sum.totalWinnings || 0
            }
            
            return {
                success: true,
                message: 'Virtual Bets retreived',
                data: response,
                status: HttpStatus.OK
            }
        } catch(e) {
            console.log(e.message);
            return {
                success: false,
                message: 'Unable to fetch betlist, something went wrong',
                data: {},
                status: HttpStatus.INTERNAL_SERVER_ERROR
            }
        }
    }

    async getCasinoBets (data) {
        const {clientId, username, from, to, status, page} = data;
        try {
        
            let query = this.casinoBetRepo.createQueryBuilder('cb').where('client_id = :clientId', {clientId})
                            .andWhere('created_at >= :from', {from})
                            .andWhere('created_at <= :to', {to});
            
            if (username && username !== '')
                query.andWhere('username like :username', {username: `%${username}%`})

            if (status && status !== 'settled')
                query.andWhere('status = :status', {status});
            
            const total = await query.clone().getCount();
            const sum = await query.clone().addSelect('SUM(stake)', 'totalStake').addSelect('SUM(winnings)', 'totalWinnings').getRawOne();

            let offset = (page - 1) * 100
            offset = offset + 1;

            const results = await query.limit(100).offset(offset).orderBy('created_at', 'DESC').getMany();

            const pager = paginateResponse([results, total], page, 100);
            const response: any = {...pager};

            response.data = JSON.parse(response.data);
            response.totals = {
                totalStake: sum.totalStake || 0,
                totalWinnings: sum.totalWinnings || 0
            }
            
            return {
                success: true,
                message: 'Casino Bets retreived',
                data: response,
                status: HttpStatus.OK
            }
        } catch(e) {
            console.log(e.message);
            return {
                success: false,
                message: 'Unable to fetch betlist, something went wrong',
                data: {},
                status: HttpStatus.INTERNAL_SERVER_ERROR
            }
        }
    }
}