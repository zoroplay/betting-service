import { Injectable } from "@nestjs/common";
import { EntityManager, Repository } from "typeorm";

import * as dayjs from 'dayjs';
import { IdentityService } from "src/identity/identity.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Bet } from "src/entity/bet.entity";
import { BetSlip } from "src/entity/betslip.entity";
import { BET_LOST, BET_PENDING, BET_WON } from "src/constants";
var customParseFormat = require('dayjs/plugin/customParseFormat')

dayjs.extend(customParseFormat)


@Injectable()
export class RetailService {
    constructor(
        private readonly entityManager: EntityManager,
        private readonly identityService: IdentityService,
        @InjectRepository(Bet)
        private readonly betRepository: Repository<Bet>,
        @InjectRepository(BetSlip)
        private readonly betSlipRepository: Repository<BetSlip>
    ) {}

    
    async getShopUserReport (data) {
        const {from, to, productType, role, userId, clientId} = data;

        // fetch agent users
        const usersRes = await this.identityService.getAgentUser({
            clientId, 
            userId
        });

        let userIds = [], bets = [], vBets = [];

        if (usersRes.success) {
            userIds = usersRes.data.map(user => user.id);
        }


        if (userIds.length > 0) {

            // get all bets
            const betsQuery = `SELECT IFNULL(SUM(CASE WHEN b.status = ? THEN 1 ELSE 0 END), 0) as running_bets,
            IFNULL(SUM(CASE WHEN b.status IN (?, ?) THEN 1 ELSE 0 END), 0) as settled_bets, COUNT(*) as no_of_bets,
            IFNULL(SUM(b.stake), 0) as stake, IFNULL(SUM(w.winning_after_tax), 0) as winnings, IFNULL(SUM(b.commission), 0) as commission FROM bet b
            LEFT JOIN winning w ON w.bet_id = b.id WHERE b.client_id = ? AND DATE(b.created) BETWEEN ? AND ? AND b.user_id IN (?)`;

            bets  = await this.entityManager.query(betsQuery, [BET_PENDING, BET_WON, BET_LOST, clientId, from, to, userIds]);
            // console.log(bets.getSql())
            // get all virtual bets
            const vBetQuery = `SELECT IFNULL(SUM(CASE WHEN virtual_bets.status = 0 THEN 1 ELSE 0 END), 0) as running_bets,
                    IFNULL(SUM(CASE WHEN virtual_bets.status IN (1, 2) THEN 1 ELSE 0 END), 0) as settled_bets,
                    COUNT(*) as no_of_bets, IFNULL(SUM(virtual_bets.stake), 0) as stake, IFNULL(SUM(virtual_bets.winnings), 0) as winnings,
                    IFNULL(SUM(virtual_bets.commission), 0) as commission FROM virtual_bets WHERE client_id = ? AND user_id IN (?)`;

            vBets  = await this.entityManager.query(vBetQuery, [clientId, userIds]);

        }

        return {
            success: true,
            message: 'Shop Sales Report',
            data: {
                retail_sports: bets[0],
                retail_virtual: vBets[0],
                grand_total: {
                    running_bets: parseFloat(bets.length ? bets[0].running_bets : 0) + parseFloat(vBets.length ? vBets[0].running_bets : 0),
                    settled_bets: parseFloat(bets.length ? bets[0].settled_bets : 0) + parseFloat(vBets.length ? vBets[0].settled_bets : 0),
                    no_of_bets: parseFloat(bets.length ? bets[0].no_of_bets : 0) + parseFloat(vBets.length ? vBets[0].no_of_bets : 0),
                    stake: parseFloat(bets.length ? bets[0].stake : 0) + parseFloat(vBets.length ? vBets[0].stake : 0),
                    winnings: parseFloat(bets.length ? bets[0].winnings : 0) + parseFloat(vBets.length ? vBets[0].winnings : 0),
                    commission: parseFloat(bets.length ? bets[0].commission : 0) + parseFloat(vBets.length ? vBets[0].commission : 0),
                }
            }
        }
    }

    async getAgentReport (data) {
        const {from, to, productType, role, userId, clientId} = data;

        // fetch agent users
        const usersRes = await this.identityService.getAgentUser({
            clientId, 
            userId
        });

        let userIds = [], bets = [], vBets = [];

        if (usersRes.success) {
            userIds = usersRes.data.map(user => user.id);
        }

        if (userIds.length > 0) {
        }

        return {
            success: true,
            message: 'Agent Sales Report',
            data: {
                retail_sports: bets[0],
                retail_virtual: vBets[0],
                grand_total: {
                    running_bets: parseFloat(bets.length ? bets[0].running_bets : 0) + parseFloat(vBets.length ? vBets[0].running_bets : 0),
                    settled_bets: parseFloat(bets.length ? bets[0].settled_bets : 0) + parseFloat(vBets.length ? vBets[0].settled_bets : 0),
                    no_of_bets: parseFloat(bets.length ? bets[0].no_of_bets : 0) + parseFloat(vBets.length ? vBets[0].no_of_bets : 0),
                    stake: parseFloat(bets.length ? bets[0].stake : 0) + parseFloat(vBets.length ? vBets[0].stake : 0),
                    winnings: parseFloat(bets.length ? bets[0].winnings : 0) + parseFloat(vBets.length ? vBets[0].winnings : 0),
                    commission: parseFloat(bets.length ? bets[0].commission : 0) + parseFloat(vBets.length ? vBets[0].commission : 0),
                }
            }
        }
    }

    async getMasterAgentReport (data) {
        const {from, to, productType, role, userId, clientId} = data;

        // fetch agent users
        const usersRes = await this.identityService.getAgentUser({
            clientId, 
            userId
        });

        let userIds = [], bets = [], vBets = [];

        if (usersRes.success) {
            userIds = usersRes.data.map(user => user.id);
        }


        if (userIds.length > 0) {
        }

        return {
            success: true,
            message: 'Master Agent Sales Report',
            data: {
                retail_sports: bets[0],
                retail_virtual: vBets[0],
                grand_total: {
                    running_bets: parseFloat(bets.length ? bets[0].running_bets : 0) + parseFloat(vBets.length ? vBets[0].running_bets : 0),
                    settled_bets: parseFloat(bets.length ? bets[0].settled_bets : 0) + parseFloat(vBets.length ? vBets[0].settled_bets : 0),
                    no_of_bets: parseFloat(bets.length ? bets[0].no_of_bets : 0) + parseFloat(vBets.length ? vBets[0].no_of_bets : 0),
                    stake: parseFloat(bets.length ? bets[0].stake : 0) + parseFloat(vBets.length ? vBets[0].stake : 0),
                    winnings: parseFloat(bets.length ? bets[0].winnings : 0) + parseFloat(vBets.length ? vBets[0].winnings : 0),
                    commission: parseFloat(bets.length ? bets[0].commission : 0) + parseFloat(vBets.length ? vBets[0].commission : 0),
                }
            }
        }
    }

    async getSuperAgentReport (data) {
        const {from, to, productType, role, userId, clientId} = data;

        // fetch agent users
        const usersRes = await this.identityService.getAgentUser({
            clientId, 
            userId
        });

        let userIds = [], bets = [], vBets = [];

        if (usersRes.success) {
            userIds = usersRes.data.map(user => user.id);
        }


        if (userIds.length > 0) {
        }

        return {
            success: true,
            message: 'Agent Sales Report',
            data: {
                retail_sports: bets[0],
                retail_virtual: vBets[0],
                grand_total: {
                    running_bets: parseFloat(bets.length ? bets[0].running_bets : 0) + parseFloat(vBets.length ? vBets[0].running_bets : 0),
                    settled_bets: parseFloat(bets.length ? bets[0].settled_bets : 0) + parseFloat(vBets.length ? vBets[0].settled_bets : 0),
                    no_of_bets: parseFloat(bets.length ? bets[0].no_of_bets : 0) + parseFloat(vBets.length ? vBets[0].no_of_bets : 0),
                    stake: parseFloat(bets.length ? bets[0].stake : 0) + parseFloat(vBets.length ? vBets[0].stake : 0),
                    winnings: parseFloat(bets.length ? bets[0].winnings : 0) + parseFloat(vBets.length ? vBets[0].winnings : 0),
                    commission: parseFloat(bets.length ? bets[0].commission : 0) + parseFloat(vBets.length ? vBets[0].commission : 0),
                }
            }
        }
    }

}