import { Injectable } from "@nestjs/common";
import { EntityManager, Repository } from "typeorm";

import * as dayjs from 'dayjs';
import { IdentityService } from "src/identity/identity.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Bet } from "src/entity/bet.entity";
import { BetSlip } from "src/entity/betslip.entity";
import { BET_CANCELLED, BET_CASHOUT, BET_LOST, BET_PENDING, BET_VOIDED, BET_WON, STATUS_LOST, STATUS_NOT_LOST_OR_WON, STATUS_WON } from "src/constants";
import { paginateResponse } from "src/commons/helper";
import { BetHistoryRequest } from "./interfaces/bet.history.request.interface";
import { GetVirtualBetRequest, GetVirtualBetsRequest } from "src/proto/betting.pb";
import { VirtualBet } from "src/entity/virtual-bet.entity";
import { CasinoBetService } from "./casino-bet.service";
import { VirtualBetService } from "./virtual-bet.service";
import { BetsService } from "./bets.service";
import { Winning } from "src/entity/winning.entity";
var customParseFormat = require('dayjs/plugin/customParseFormat')

dayjs.extend(customParseFormat)


@Injectable()
export class RetailService {
    constructor(
        private readonly entityManager: EntityManager,
        private readonly identityService: IdentityService,
        private casinoBetService: CasinoBetService,
        private virtualBetService: VirtualBetService,
        private sportsBetService: BetsService,

        @InjectRepository(Bet)
        private readonly betRepository: Repository<Bet>,
        @InjectRepository(BetSlip)
        private readonly betSlipRepository: Repository<BetSlip>,
        @InjectRepository(VirtualBet)
        private readonly virtualBetRepo: Repository<VirtualBet>
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
            const userIds = await this.fetchUserIds(userId, clientId);


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
                if (status && status != 'all' && status !== 'settled') {
                    betQuery.andWhere("status = :status", {status: parseInt(status)})
                } else if (status === 'settled') {
                    betQuery.andWhere("status != :status", {status: 0})
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
                        let pendingGames: any;

                        try {
                            const slipQuery = `SELECT * FROM bet_slip WHERE bet_id =? `;
                            slips = await this.entityManager.query(slipQuery, [bet.id]);

                            const pendingGamesQry = `SELECT count(*) as pending FROM bet_slip WHERE bet_id =? AND status =?`;
                            pendingGames = await this.entityManager.query(pendingGamesQry, [bet.id, BET_PENDING]);

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
                                break;
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
                                score: slip.score,
                                htScore: slip.ht_score,
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
                        bet.pendingGames = pendingGames[0].pending;

                        bets.push(bet);
                    }
                }

                const pager = paginateResponse([bets, total], page, perPage);
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

    async agentVBets (data: GetVirtualBetsRequest) {
        const {clientId, username, from, to, perPage, userId, page} = data;
        try {

            // fetch agent users
            const userIds = await this.fetchUserIds(userId, clientId);

            const startDate = dayjs(from, 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
            const endDate = dayjs(to, 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');

            let query = this.virtualBetRepo.createQueryBuilder('vb').where('client_id = :clientId', {clientId})
                            .andWhere('created_at >= :startDate', {startDate})
                            .andWhere('created_at <= :endDate', {endDate})
                            .andWhere("user_id IN (:...userIds)", {userIds});
            
            if (username && username !== '')
                query.andWhere('username like :username', {username: `%${username}%`})

            
            const total = await query.clone().getCount();
            const sum = await query.clone().addSelect('SUM(stake)', 'totalStake').addSelect('SUM(winnings)', 'totalWinnings').getRawOne();

            let offset = (page - 1) * 100
            offset = offset + 1;

            const results = await query.limit(100).offset(offset).orderBy('created_at', 'DESC').getMany();

            const pager = paginateResponse([results, total], page, perPage);
            const response: any = {...pager};

            response.data = JSON.parse(response.data);

            response.totals = {
                totalStake: sum.totalStake || 0,
                totalWinnings: sum.totalWinnings || 0
            }

            return {
                success: true,
                message: 'Virtual Bets retreived',
                data: response
            }
        } catch(e) {
            console.log(e.message);
            return {
                success: false,
                message: 'Unable to fetch betlist, something went wrong',
                data: {}
            }
        }
    }

    async fetchUserIds(userId, clientId) {
        // fetch agent users
        const usersRes = await this.identityService.getAgentUser({
            clientId, 
            userId
        });

        let userIds = [];

        if (usersRes.success) {
            userIds = usersRes.data.map(user => user.id);
        }

        return userIds;
    }

    async getCommissions (data) {
        const {clientId, provider, from, to} = data;
        try {
            // Get commission profiles from identity service
            const profiles = await this.identityService.getCommissionProfileUsers({
                clientId,
                provider
            });

            // console.log(profiles);
            const data = {
                current_week: {
                    total_weeks: 0,
                    current_week: 0,
                    no_of_tickets: 0,
                    played: 0, 
                    won: 0,
                    net: 0,
                    commission: 0
                },
                current_month: 0,
                commissions: []
            };

            if (profiles.success && profiles.data) {
                for (const agent of profiles.data) {
                    let res;
                    // console.log(agent.users)
                    if (agent.users.length) {
                        switch (provider) {
                            case 'casino':
                                res = await this.casinoBetService.getCommissionReport(from, to, agent.users);
                                break;
                                case 'virtual':
                                res = await this.virtualBetService.getCommissionReport(from, to, agent.users);
                                break;
                            default:
                                res = await this.getCommissionReport(from, to, agent.users);
                                break;
                        }
                    }
                    const totalSales = res?.totalSales || 0;
                    const totalWinnings = res?.totalWinnings || 0;
                    const commission = res?.totalCommissions || 0;
                    const net = totalSales - totalWinnings;

                    data.commissions.push({
                        user_id: agent.userId,
                        username: agent.username,
                        profile: agent.commissionName,
                        profile_id: agent.commissionId,
                        total_tickets: res?.totalTickets || 0,
                        total_sales: res?.totalSales || 0,
                        total_won: res?.totalWinnings || 0,
                        net,
                        is_paid: 0,
                        commission: res?.totalCommissions || 0,
                        profit: net - commission
                    })
                }
            }

            return {
                success: true,
                message: 'Commission retrieved',
                data
            };
        } catch (e) {
            console.log(e.message);
            return {
                success: false, 
                message: 'Error while fetching commission', 
                data: null
            };
        }
    }

    async getTotalSales(payload) {
        const {product, from, to} = payload;
        const userIds = payload.userIds.split(',');
        let data;
        const startDate = dayjs(from, 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
        const endDate = dayjs(to, 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');

        try {
            if (product === 'sports') {
                // get all bets
                const betsQuery = `SELECT IFNULL(SUM(CASE WHEN b.status = ? THEN 1 ELSE 0 END), 0) as running_bets,
                IFNULL(SUM(CASE WHEN b.status IN (?, ?) THEN 1 ELSE 0 END), 0) as settledBets, COUNT(*) as noOfBets,
                IFNULL(SUM(b.stake), 0) as totalStake, IFNULL(SUM(w.winning_after_tax), 0) as totalWinnings, IFNULL(SUM(b.commission), 0) as commission FROM bet b
                LEFT JOIN winning w ON w.bet_id = b.id WHERE DATE(b.created) BETWEEN ? AND ? AND b.user_id IN (?)`;

                const bets  = await this.entityManager.query(betsQuery, [BET_PENDING, BET_WON, BET_LOST, startDate, endDate, userIds]);
                data = bets[0];
            } else if (product === 'virtual') {
                // console.log(bets.getSql())
                // get all virtual bets
                const vBetQuery = `SELECT IFNULL(SUM(CASE WHEN virtual_bets.status = 0 THEN 1 ELSE 0 END), 0) as running_bets,
                        IFNULL(SUM(CASE WHEN virtual_bets.status IN (1, 2) THEN 1 ELSE 0 END), 0) as settled_bets,
                        COUNT(*) as noOfBets, IFNULL(SUM(virtual_bets.stake), 0) as totalStake, IFNULL(SUM(virtual_bets.winnings), 0) as winnings,
                        IFNULL(SUM(virtual_bets.commission), 0) as commission FROM virtual_bets WHERE DATE(b.created) BETWEEN ? AND ? user_id IN (?)`;

                const bets  = await this.entityManager.query(vBetQuery, [startDate, endDate, userIds]);
                data = bets[0];
            }

            return {success: true, message: 'Data retreived', data};
        } catch (e) {
            console.log(e.message);
            return {
                success: false, 
                message: 'Something went wrong',
                data: null
            }
        }

    }

    async getCommissionReport (from, to, userIds) {
        const startDate = dayjs(from, 'DD-MM-YYYY').format('YYYY-MM-DD');
        const endDate = dayjs(to, 'DD-MM-YYYY').format('YYYY-MM-DD');
    
        return await this.betRepository.createQueryBuilder('b')
                        .addSelect('COUNT(*)', 'totalTickets')
                        .addSelect('SUM(stake)', 'totalSales')
                        .addSelect('SUM(w.winning_after_tax)', 'totalWinnings')
                        .addSelect('SUM(b.commission)', 'totalCommissions')
                        .leftJoin(Winning, 'w', 'b.id = w.bet_id')
                        .where('b.user_id IN (:...userIds)', {userIds})
                        .andWhere('b.created >= :startDate', {startDate})
                        .andWhere('b.created <= :endDate', {endDate})
                        .andWhere("status IN (:...status)", {status: [BET_WON, BET_LOST]})
                        .getRawOne();
    
      }

}