import { HttpStatus, Injectable } from "@nestjs/common";
import { GamingActivityRequest, GamingActivityResponse } from "./interfaces/report.interface";
import { EntityManager, Repository } from "typeorm";

import * as dayjs from 'dayjs';
import { BET_CANCELLED, BET_LOST, BET_PENDING, BET_VOIDED, BET_WON, STATUS_LOST, STATUS_NOT_LOST_OR_WON, STATUS_WON } from "src/constants";
import { IdentityService } from "src/identity/identity.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Bet } from "src/entity/bet.entity";
import { BetSlip } from "src/entity/betslip.entity";
import { paginateResponse } from "src/commons/helper";
import { BetHistoryRequest } from "./interfaces/bet.history.request.interface";
import { RetailService } from "./retail.service";
var customParseFormat = require('dayjs/plugin/customParseFormat')

dayjs.extend(customParseFormat)


@Injectable()
export class ReportService {
    constructor(
        private readonly entityManager: EntityManager,
        private readonly identityService: IdentityService,
        private readonly retailsService: RetailService,
        @InjectRepository(Bet)
        private readonly betRepository: Repository<Bet>,
        @InjectRepository(BetSlip)
        private readonly betSlipRepository: Repository<BetSlip>,

    ) {}

    async gamingActivity(data: GamingActivityRequest): Promise<GamingActivityResponse> {

        const {groupBy, productType, from, to, username, clientID, betType, source, eventType, displayType} = data;
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
            return {success: true, status: HttpStatus.OK, message: 'Data fetched', data: {bets, totalStake, totalWinnings, totalTickets}};
        } catch(e) {
            return {success: false, status: HttpStatus.BAD_REQUEST, message: 'Unable to fetch data', error: e.message};
        }
    }

    async agentBets(data: BetHistoryRequest) {
        const {clientId, userId, from, to, status, betslipId, page, perPage} = data;
        const limit = perPage || 50;
        try {
            const respData = {
                tickets: [], 
                totalSales: 0, 
                totalWon: 0, 
                totalCancelled: 0,
                totalSalesNo: 0, 
                totalCancelledNo: 0, 
                totalWonNo: 0, 
                totalRunningNo: 0,
                meta: null
            }
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
                let betQuery = this.betRepository.createQueryBuilder('bet')
                    .select(["bet.id", "bet.user_id", "bet.username", "bet.stake", "bet.possible_win", "bet.bet_category", 
                        "bet.bet_category_desc", "bet.betslip_id", "bet.created", "bet.status", "w.winning_after_tax",
                        "bet.total_odd", "bet.total_bets", "bet.sports", "bet.tournaments", "bet.events"])
                    .leftJoin("winning", "w", "bet.id = w.bet_id")
                    .where("bet.client_id = :clientId", {clientId: clientId})
                    .andWhere("bet.user_id IN (:...userIds)", {userIds})
                    .andWhere("is_booked = :booking", {booking: 0})
                    .andWhere("bet.created BETWEEN :from AND :to", {from, to})
                // filter by status if available
                if (status && status != 'all') {
                    betQuery.andWhere("status = :status", {status})
                }
                //filter by betslip if set
                if(betslipId && betslipId !== "")
                    betQuery.andWhere("betslip_id = :betslipId", {betslipId})

                const total = await betQuery.clone().getCount();
                //get total no of won tickets
                respData.totalWonNo = await betQuery.clone().andWhere("won = :won", {won: BET_WON}).getCount();
                //get total running tickets
                respData.totalRunningNo = await betQuery.clone().andWhere("status = :status", {status: BET_PENDING}).getCount();
                
                const sum = await betQuery.clone().addSelect('SUM(stake)', 'totalStake').addSelect('SUM(w.winning_after_tax)', 'totalWinnings').getRawOne();

                respData.totalSales = sum.totalStake;
                respData.totalWon = sum.totalWinnings

                let offset = 0;

                if (page > 1) {
                    offset = (page - 1) * limit;
                    offset = offset + 1;
                }

                const results: any = await betQuery.limit(limit).offset(offset).orderBy('bet.created', 'DESC').getMany();

                const bets = [];

                if(results.length > 0) {
                    for (let bet of results) {
                        let slips: any;
                        // let settled: any;

                        try {
                            const slipQuery = `SELECT id,event_id,event_type,event_prefix,event_name,event_date,market_name, market_id,specifier,outcome_name,outcome_id,odds,won,
                                    status,sport_name,category_name,tournament_name,match_id, producer_id, probability FROM bet_slip WHERE bet_id =? `;
                            slips = await this.entityManager.query(slipQuery, [bet.id]);

                        } catch (e) {
                            console.log(' error retrieving bet slips ' + e.toString());
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

                        if (bet.status == BET_VOIDED) {
                            bet.statusDescription = 'Void';
                            bet.statusCode = 3;
                        }

                        if (bet.status == BET_CANCELLED) {
                            bet.statusDescription = 'Cancelled';
                            bet.statusCode = 4;
                        }

                        bet.selections = [];
                        let currentProbability = 1;
                        let totalOdds = 1;
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

                                default:
                                slipStatus = 'Void';
                                slipStatus = 3;
                                break;
                            }

                            // if (bet.status === BET_PENDING) {
                            //     // get probability for selection
                            //     let selectionProbability = await this.cashoutService.getProbability(
                            //     slip.producer_id,
                            //     slip.event_prefix,
                            //     slip.event_type,
                            //     slip.match_id,
                            //     slip.market_id,
                            //     slip.specifier,
                            //     slip.outcome_id,
                            //     );

                            //     totalOdds = totalOdds * slip.odds;

                            //     // if (selectionProbability)
                            //     currentProbability = currentProbability * selectionProbability;
                            // }

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
                            });
                            }
                        }

                        // if (!bet.bonus_id && bet.status === BET_PENDING)
                        //     cashOutAmount = await this.cashoutService.calculateCashout(currentProbability, bet.probability, bet.stake, totalOdds);
                        
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
                        bet.winnings = bet.winning_after_tax;
                        bet.sports = bet.sports;
                        bet.tournaments = bet.tournaments;
                        bet.events = bet.events;
                        bet.markets = bet.markets;
                        bet.betCategoryDesc = bet.bet_category_desc;
                        bet.cashOutAmount = cashOutAmount;

                        bets.push(bet);
                    }
                }

                const pager = paginateResponse([bets, total], page, 100);
                respData.meta = {
                    page,
                    perPage: limit,
                    total,
                    lastPage: pager.lastPage,
                    nextPage: pager.nextPage,
                    prevPage: pager.prevPage
                }

                respData.tickets = JSON.parse(pager.data);
            }

            return {
                success: true,
                message: 'Bets retreived',
                data: respData
            }
        } catch (e) {
            console.log(e.message);
            return {
                success: false,
                message: 'Unable to fetch betlist, something went wrong',
                data: {}
            }
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

}