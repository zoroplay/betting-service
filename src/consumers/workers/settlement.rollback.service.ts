import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {BetSlip} from "../../entity/betslip.entity";
import {SettlementRollback} from "../../entity/settlementrollback.entity";
import {BET_LOST, BET_PENDING, BET_WON, TRANSACTION_TYPE_BET_ROLLBACK} from "../../constants";

@Injectable()
export class SettlementRollbackService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(SettlementRollbackService.name);

    constructor(
        //private transactionRunner: DbTransactionFactory,
        @InjectRepository(BetSlip)
        private betslipRepository: Repository<BetSlip>,
        @InjectRepository(SettlementRollback)
        private settlementRollbackRepository: Repository<SettlementRollback>,
        private readonly entityManager: EntityManager,
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
        this.logger.info("createSettlementRollback "+JSON.stringify(data))

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
            let slipCounts = await this.entityManager.query("SELECT COUNT(id) as total FROM bet_slip WHERE specifier = ? AND market_id = ? AND event_id = ?  ",
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
            let settledSlips = await this.entityManager.query("SELECT id,bet_id,won FROM bet_slip WHERE  event_id = ? AND market_id = ? AND specifier = ? ", [matchID, marketID, specifier])

            // reset all bet slips
            // update bet slip status query
            await this.entityManager.query("UPDATE bet_slip SET status = " + BET_PENDING + ", won = -1,settlement_id = 0  WHERE  event_id = ? AND market_id = ? AND specifier = ? ", [matchID, marketID, specifier])

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

                let debitPayload = {
                    currency: settledBet.currency,
                    amount: settledBet.winning_after_tax,
                    user_id: settledBet.user_id,
                    client_id: settledBet.client_id,
                    description: "BetID " + settledBet.id + " was rolled back",
                    transaction_id: settledBet.id,
                    transaction_type: TRANSACTION_TYPE_BET_ROLLBACK
                }

                // send debit payload to wallet service

            }

        }

        return counts;
    }

}