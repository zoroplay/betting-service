import { HttpStatus, Injectable } from "@nestjs/common";
import { EntityManager, Repository } from "typeorm";

import * as dayjs from 'dayjs';
import { BET_CANCELLED, BET_LOST, BET_PENDING, BET_VOIDED, BET_WON} from "src/constants";
import { IdentityService } from "src/identity/identity.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Bet } from "src/entity/bet.entity";
import { BetSlip } from "src/entity/betslip.entity";
import { RetailService } from "./retail.service";
import { GamingActivityRequest, GamingActivityResponse } from "src/proto/betting.pb";
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
}