import { HttpStatus, Injectable } from "@nestjs/common";
import { EntityManager, Repository } from "typeorm";

import * as dayjs from 'dayjs';
import { GetVirtualBetRequest, GetVirtualBetResponse, PlaceVirtualBetRequest, PlaceVirtualBetResponse, SettleVirtualBetRequest, SettleVirtualBetResponse } from "./interfaces/placebet.interface";
import { InjectRepository } from "@nestjs/typeorm";
import { VirtualBet } from "src/entity/virtual-bet.entity";
import { GetVirtualBetsRequest } from "./interfaces/report.interface";
import { paginateResponse } from "src/commons/helper";
var customParseFormat = require('dayjs/plugin/customParseFormat')

dayjs.extend(customParseFormat)


@Injectable()
export class VirtualBetService {
    constructor(
        @InjectRepository(VirtualBet)
        private readonly virtualBetRepo: Repository<VirtualBet>,

    ) {}

    async placeVirtualBet(data: PlaceVirtualBetRequest): Promise<PlaceVirtualBetResponse> {
        try {
            const betData = new VirtualBet();
            betData.client_id = data.clientId;
            betData.game_id = data.gameId;
            betData.round_id = data.roundId;
            betData.transaction_category = data.transactionCategory;
            betData.transaction_id = data.transactionId;
            betData.stake = data.stake;
            betData.user_id = data.userId;
            betData.username = data.username;

            const bet = await this.virtualBetRepo.save(betData);

            return {
                success: true,
                status: HttpStatus.OK,
                message: 'Bet savede',
                data: {
                    betId: bet.id,
                    userId: bet.user_id,
                    clientId: bet.client_id,
                    roundId: bet.round_id,
                    transactionId: bet.transaction_id,
                    transactionCategory: bet.transaction_category,
                    gameId: bet.game_id,
                    stake: bet.stake,
                    gameCycleClosed: bet.game_cycle_closed,
                    username: bet.username
                }
            }

        } catch (e) {
            return {
                success: false,
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                message: 'Something went wrong: ' + e.message,
                data: null
            }
        }
    }

    async getVirtualTicket(data: GetVirtualBetRequest): Promise<GetVirtualBetResponse> {
        try {
            let success = false, gameId = false, transactionId = false;
            let betData;

            const checkGameId = await this.virtualBetRepo.findOne({
                where: {
                    client_id: data.clientId,
                    round_id: data.gameId,
                }
            });

            const checkTranxId = await this.virtualBetRepo.findOne({
                where: {
                    client_id: data.clientId,
                    transaction_id: data.transactionId,
                }
            });

            if (checkGameId) {
                success = true,
                gameId = true,
                betData = {
                    betId: checkGameId.id,
                    userId: checkGameId.user_id,
                    clientId: checkGameId.client_id,
                    roundId: checkGameId.round_id,
                    transactionId: checkGameId.transaction_id,
                    transactionCategory: checkGameId.transaction_category,
                    gameId: checkGameId.game_id,
                    stake: checkGameId.stake,
                    gameCycleClosed: checkGameId.game_cycle_closed,
                    username: checkGameId.username,

                }
            } 
            if (checkTranxId) {
                success = true;
                transactionId = true
                betData = {
                    betId: checkTranxId.id,
                    userId: checkTranxId.user_id,
                    clientId: checkTranxId.client_id,
                    roundId: checkTranxId.round_id,
                    transactionId: checkTranxId.transaction_id,
                    transactionCategory: checkTranxId.transaction_category,
                    gameId: checkTranxId.game_id,
                    stake: checkTranxId.stake,
                    gameCycleClosed: checkTranxId.game_cycle_closed,
                    username: checkTranxId.username,
                }
            }
            
            return {
                success,
                gameId,
                transactionId,
                data: betData,
            }
            

        } catch (e) {
            return {
                success: false,
                gameId: false,
                transactionId: false,
                data: null
            }
        }
    }

    async settleBet(data: SettleVirtualBetRequest): Promise<SettleVirtualBetResponse> {
        try {
            const {amount, jackpot, roundId, category, gameCycleClosed} = data;

            let status = 0;
            if (amount > 0) {
                status = 1;
            } else {
                status = 2;
            }
            await this.virtualBetRepo.update(
                {round_id: roundId},
                {
                    winnings: amount,
                    jackpot_amount: jackpot,
                    game_cycle_closed: gameCycleClosed,
                    transaction_category: category,
                    status
                }  
            )
            return {
                success: false,
                message: 'Success'
            }
        } catch (e) {
            return {
                success: false,
                message: 'Something went wrong '+ e.message,
            }
        }
    }

    async getTickets (data: GetVirtualBetsRequest) {
        const {clientId, username, from, to, betType, page} = data;
        try {

            const startDate = dayjs(from, 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
            const endDate = dayjs(to, 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');

            let query = this.virtualBetRepo.createQueryBuilder('vb').where('client_id = :clientId', {clientId})
                            .andWhere('created_at >= :startDate', {startDate})
                            .andWhere('created_at <= :endDate', {endDate});
            
            if (username && username !== '')
                query.andWhere('username like :username', {username: `%${username}%`})

            if (betType && betType !== 0)
                query.andWhere('status = :betType', {betType});
            
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
                data: response
            }
        } catch(e) {
            return {
                success: false,
                message: 'Unable to fetch betlist, something went wrong',
                data: {}
            }
        }
    }

    async getCommissionReport (from, to, userIds) {
        try {
        const startDate = dayjs(from, 'DD-MM-YYYY').format('YYYY-MM-DD');
        const endDate = dayjs(to, 'DD-MM-YYYY').format('YYYY-MM-DD');

        return await this.virtualBetRepo.createQueryBuilder('vb')
                        .addSelect('COUNT(*)', 'totalTickets')
                        .addSelect('SUM(stake)', 'totalSales')
                        .addSelect('SUM(winnings)', 'totalWinnings')
                        .addSelect('SUM(commission)', 'totalCommissions')
                        .where('user_id IN (:...userIds)', {userIds})
                        .andWhere('created_at >= :startDate', {startDate})
                        .andWhere('created_at <= :endDate', {endDate})
                        .andWhere("status IN (:...status)", {status: [1, 2]})
                        .getRawOne();
        } catch (e) {
            return {
                totalTickets: 0,
                totalSales: 0,
                totalWinnings: 0,
                totalCommissions: 0
            }
        }

    }
}