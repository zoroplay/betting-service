import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {BetSlip} from "../../entity/betslip.entity";
import {SettlementRollback} from "../../entity/settlementrollback.entity";
import {BET_LOST, BET_PENDING, BET_WON, TRANSACTION_TYPE_BET_ROLLBACK} from "../../constants";
import axios from "axios";
import { Setting } from "src/entity/setting.entity";
import { WalletService } from "src/wallet/wallet.service";

@Injectable()
export class SettlementRollbackService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(SettlementRollbackService.name);

    constructor(
        //private transactionRunner: DbTransactionFactory,
        @InjectRepository(BetSlip)
        private betslipRepository: Repository<BetSlip>,
        @InjectRepository(SettlementRollback)
        private settlementRollbackRepository: Repository<SettlementRollback>,
        @InjectRepository(Setting)
        private settingRepository: Repository<Setting>,
        
        private readonly entityManager: EntityManager,

        private readonly walletService: WalletService
    ) {

    }

    /*
        {
          "match_id": 43429091,
          "event_id": "sr:match:43429091",
          "timestamp": 0,
          "markets": [
            {
              "id": 156,
              "specifier": "",
            }
          ]
        }
         */
    async createSettlementRollback(data: any): Promise<number> {

        data = JSON.parse(JSON.stringify(data))
        this.logger.info("processBetCancelMessage match_id "+data.match_id)
        this.logger.info("processBetCancelMessage event_id "+data.event_id)

        let matchID = data.match_id
        let markets = data.markets;

        let counts = 0

        for (const market of markets) {

            let marketID = market.id
            let specifier = market.specifier
            let settlementIDs = []

            // check if settlement exists
            let rows = await this.entityManager.query("SELECT id FROM settlement WHERE specifier = ? AND market_id = ? AND event_id = ?  ",
                [specifier, marketID, matchID])

            for (const row of rows) {

                settlementIDs.push(row.id)
            }

            if (settlementIDs.length == 0) {

                continue
            }

            // delete settlement
            await this.entityManager.query("DELETE FROM settlement WHERE specifier = ? AND market_id = ? AND event_id = ?  ",
                [specifier, marketID, matchID])

            // count affected slips
            let slipCounts = await this.entityManager.query("SELECT COUNT(id) as total FROM bet_slip WHERE specifier = ? AND market_id = ? AND match_id = ?  ",
                [specifier, marketID, matchID])

            if (!slipCounts || slipCounts.total == 0) {

                continue
            }


            let settlementRollback = new SettlementRollback();
            settlementRollback.event_id = matchID
            settlementRollback.market_id = marketID
            settlementRollback.specifier = specifier
            await this.settlementRollbackRepository.save(settlementRollback)

            //2. ############## get all bet_slips that were settled
            let settledSlips = await this.entityManager.query("SELECT id,bet_id,won FROM bet_slip WHERE  match_id = ? AND market_id = ? AND specifier = ? ", [matchID, marketID, specifier])

            // reset all bet slips
            // update bet slip status query
            await this.entityManager.query("UPDATE bet_slip SET status = " + BET_PENDING + ", won = -1,settlement_id = 0  WHERE  match_id = ? AND market_id = ? AND specifier = ? ", [matchID, marketID, specifier])

            let settledData = []
            let betIDs = []

            for (const slip of settledSlips) {

                let id = slip.id;
                let betID = slip.bet_id;
                let won = slip.won;

                settledData.push({
                    id: id,
                    bet_id: betID,
                    won: won
                })

                betIDs.push(betID)
            }

            // update bets to pending
            await this.entityManager.query("UPDATE bet SET status = " + BET_PENDING + ", won = -1  WHERE  bet_id IN (" + betIDs.join(',') + ") AND status IN (" + BET_WON + "," + BET_LOST + ") ")

            // select bets that had already won or lost due to this settlement
            let settledBets = await this.entityManager.query("SELECT id,user_id,client_id,currency,winning_after_tax,won,status FROM bet WHERE  id IN (" + betIDs.join(',') + ") AND status = " + BET_WON + " ")
            if (!settledBets || settledBets.length == 0) {

                continue
            }

            // process settled bets (won and lost)
            for (const settledBet of settledBets) {

                // delete winner query
                await this.entityManager.query("DELETE FROM winning WHERE bet_id = " + settledBets.id + " LIMIT 1 ")

                let creditPayload = {
                    amount: settledBet.winning_after_tax,
                    userId: settledBet.user_id,
                    clientId: settledBet.client_id,
                    username: settledBet.username,
                    description: "BetID " + settledBet.betslip_id + " was rolled back",
                    source: settledBet.source,
                    wallet: 'sport',
                    channel: 'Internal',
                    subject: 'Rollback Winnings'
                }

                if(settledBet.bonus_id)
                    creditPayload.wallet= 'sport-bonus'


                await this.walletService.debit(creditPayload).toPromise();

                // send debit payload to wallet service
                 // get client settings
                // var clientSettings = await this.settingRepository.findOne({
                //     where: {
                //         client_id: settledBet.client_id // add client id to bets
                //     }
                // });


                // axios.post(clientSettings.url + '/api/wallet/credit', debitPayload);

            }

        }

        return counts;
    }

    /*
    {
      "event_id": "43429091",
      "event_type": "tournament",
      "event_prefix": "sr",
      "timestamp": 0,
      "markets": [
        {
          "id": 156,
          "specifier": "",
        }
      ]
    }
     */
    async createOutrightSettlementRollback(data: any): Promise<number> {

        data = JSON.parse(JSON.stringify(data))

        let eventType = data.event_type;
        let eventPrefix = data.event_prefix;
        let eventID = data.event_id;

        let markets = data.markets;


        let counts = 0

        for (const market of markets) {

            let marketID = market.id
            let specifier = market.specifier
            let settlementIDs = []

            // check if settlement exists
            let rows = await this.entityManager.query("SELECT id FROM settlement WHERE specifier = ? AND market_id = ? " +
                "AND event_prefix  = ? AND event_type = ? AND event_id = ?  ",
                [specifier, marketID, eventPrefix, eventType, eventID])

            for (const row of rows) {

                settlementIDs.push(row.id)
            }

            if (settlementIDs.length == 0) {

                continue
            }

            // delete settlement
            await this.entityManager.query("DELETE FROM settlement WHERE specifier = ? AND market_id = ? " +
                "AND event_prefix  = ? AND event_type = ? AND event_id = ?   ",
                [specifier, marketID, eventPrefix, eventType, eventID])

            // count affected slips
            let slipCounts = await this.entityManager.query("SELECT COUNT(id) as total FROM bet_slip " +
                "WHERE specifier = ? AND market_id = ? AND event_prefix  = ? AND event_type = ? AND match_id = ?  ",
                [specifier, marketID, eventPrefix, eventType, eventID])

            if (!slipCounts || slipCounts.total == 0) {

                continue
            }


            let settlementRollback = new SettlementRollback();
            settlementRollback.event_id = eventID
            settlementRollback.event_type = eventType
            settlementRollback.event_prefix = eventPrefix
            settlementRollback.market_id = marketID
            settlementRollback.specifier = specifier
            await this.settlementRollbackRepository.save(settlementRollback)

            //2. ############## get all bet_slips that were settled
            let settledSlips = await this.entityManager.query("SELECT id,bet_id,won FROM bet_slip WHERE " +
                "event_prefix  = ? AND event_type = ? AND match_id = ? AND market_id = ? AND specifier = ? ",
                [eventPrefix, eventType, eventID, marketID, specifier])

            // reset all bet slips
            // update bet slip status query
            await this.entityManager.query("UPDATE bet_slip SET status = " + BET_PENDING + ", won = -1,settlement_id = 0  " +
                " WHERE  event_prefix  = ? AND event_type = ? AND match_id = ? AND market_id = ? AND specifier = ? ",
                [eventPrefix, eventType, eventID, marketID, specifier])

            let settledData = []
            let betIDs = []

            for (const slip of settledSlips) {

                let id = slip.id;
                let betID = slip.bet_id;
                let won = slip.won;

                settledData.push({
                    id: id,
                    bet_id: betID,
                    won: won
                })

                betIDs.push(betID)
            }

            // update bets to pending
            await this.entityManager.query("UPDATE bet SET status = " + BET_PENDING + ", won = -1  " +
                "WHERE  bet_id IN (" + betIDs.join(',') + ") " +
                "AND status IN (" + BET_WON + "," + BET_LOST + ") ")

            // select bets that had already won or lost due to this settlement
            let settledBets = await this.entityManager.query("SELECT id,user_id,client_id,currency,winning_after_tax,won,status " +
                "FROM bet WHERE  id IN (" + betIDs.join(',') + ") AND status = " + BET_WON + " ")
            if (!settledBets || settledBets.length == 0) {

                continue
            }

            // process settled bets (won and lost)
            for (const settledBet of settledBets) {

                // delete winner query
                await this.entityManager.query("DELETE FROM winning WHERE bet_id = " + settledBets.id + " LIMIT 1 ")

                let creditPayload = {
                    amount: settledBet.winning_after_tax,
                    userId: settledBet.user_id,
                    username: settledBet.username,
                    clientId: settledBet.client_id,
                    description: "BetID " + settledBet.betslip_id + " was rolled back",
                    subject: 'Rollback Winnings',
                    source: settledBet.source,
                    wallet: 'sport',
                    channel: 'Internal'
                }

                if(settledBet.bonus_id)
                    creditPayload.wallet= 'sport-bonus'

                await this.walletService.debit(creditPayload).toPromise();

                // send debit payload to wallet service
                // get client settings
                // var clientSettings = await this.settingRepository.findOne({
                //     where: {
                //         client_id: settledBet.client_id // add client id to bets
                //     }
                // });


                // axios.post(clientSettings.url + '/api/wallet/credit', debitPayload);

            }

        }

        return counts;
    }


}