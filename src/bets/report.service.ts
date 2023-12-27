import { HttpStatus, Injectable } from "@nestjs/common";
import { GamingActivityRequest, GamingActivityResponse } from "./interfaces/report.interface";
import * as dayjs from 'dayjs';

import { EntityManager } from "typeorm";

@Injectable()
export class ReportService {
    constructor(
        private readonly entityManager: EntityManager,
    ) {}

    async gamingActivity(data: GamingActivityRequest): Promise<GamingActivityResponse> {
        const {groupBy, productType, from, to, username, clientID, betType, source, eventType} = data;
        let table = 'bet';

        try {
            let totalWinnings = 0;
            let totalStake = 0;
            let totalTickets = 0;
            let bets = [];

            let group_by;
            const startDate = dayjs(from).format('YYYY-MM-DD HH:mm');
            const endDate = dayjs(to).format('YYYY-MM-DD HH:mm');
            const voidStatus = '(3,4)';
            let params = [];
            params.push(clientID);
            params.push(startDate)
            params.push(endDate)
            params.push(voidStatus)

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

            sql += ` WHERE client_id = ? AND ${table}.created BETWEEN ? AND ? AND bet.status NOT IN ? `;


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

            let resSum = await this.entityManager.query(sql, params)

            if (resSum) {
                let result = resSum[0]
                totalStake = result.turnover;
                totalWinnings = result.winnings;
                totalTickets = result.total;
            }

            sql += ` GROUP BY ${group_by}`;

            console.log(sql)
            bets = await this.entityManager.query(sql, params);

            // if(!empty($input['product_type'])){
            //     $bets = $bets->where('bets.product_type', $input['product_type']);
            // }

            // $bets = $bets->groupBy($group_by)->paginate(100);
            return {success: true, status: HttpStatus.OK, message: 'Data fetched', data: {bets, totalStake, totalWinnings, totalTickets}};
        } catch(e) {
            return {success: false, status: HttpStatus.BAD_REQUEST, message: 'Unable to fetch data', error: e.message};
        }
    }
}