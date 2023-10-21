import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {BetCancel} from "../../entity/betcancel.entity";
import {BET_CANCELLED, BET_PENDING, TRANSACTION_TYPE_BET_CANCEL} from "../../constants";

@Injectable()
export class BetCancelService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(BetCancelService.name);

    constructor(
        @InjectRepository(BetCancel)
        private betCancelRepository: Repository<BetCancel>,
        private readonly entityManager: EntityManager,
    ) {

    }

    /*
        {
          "match_id": 43429091,
          "event_id": "sr:match:43429091",
          "timestamp": 0,
          "end_time":"",
          "start_time":"",
          "markets": [
            {
              "id": 156,
              "specifier": "",
            }
          ]
        }
         */
    async processBetCancelMessage(data: any): Promise<number> {

        data = JSON.parse(JSON.stringify(data))
        this.logger.info("processBetCancelMessage event_id "+JSON.stringify(data))

        let parts = data.event_id.split(':')
        let matchID = parts[parts.length - 1 ];

        let eventType = "match"
        let startTime = data.start_time || ""
        let endTime = data.end_time || ""

        // create bet_cancel
        for (const market of data.markets) {

            let betIDs = []

            let marketID = market.id
            let specifier = market.specifier

            if (startTime.length > 0 && endTime.length > 0) { // if bet cancel has start and end time

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND event_id = ? AND status = 0 AND created BETWEEN ? AND ? ",
                    [specifier, marketID, matchID, startTime, endTime])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status = " + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND event_id = ? AND status = 0 AND created BETWEEN ? AND ? ",
                    [specifier, marketID, matchID, startTime, endTime])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            } else if (startTime.length == 0 && endTime.length > 0) { //  if bet cancel has end time only

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND event_id = ? AND status = 0 AND created < ? ",
                    [specifier, marketID, matchID, endTime])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status =" + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND event_id = ? AND status = 0 AND created < ? ",
                    [specifier, marketID, matchID, endTime])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            } else if (startTime.length > 0 && endTime.length == 0) { //  if bet cancel has start time only

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND event_id = ? AND status = 0 AND created > ? ",
                    [specifier, marketID, matchID, startTime])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status = " + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND event_id = ? AND status = 0 AND created > ? ",
                    [specifier, marketID, matchID, startTime])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            } else { //  if bet cancel has no time

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND event_id = ? AND status = 0  ",
                    [specifier, marketID, matchID])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status = " + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND event_id = ? AND status = 0  ",
                    [specifier, marketID, matchID])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            }

            if (betIDs.length == 0) {

                continue
            }

            let betCancel = new BetCancel();
            betCancel.event_id = matchID
            betCancel.event_type = "match"
            betCancel.market_id = marketID
            betCancel.specifier = specifier
            betCancel.start_time = startTime
            await this.betCancelRepository.save(betCancel)

            // cancel affected bets
            await this.entityManager.query("UPDATE bet SET status = ? WHERE id IN (" + betIDs.join(',') + ")  ",
                [BET_CANCELLED])

            // get all cancelled bets
            let cancelledBets = await this.entityManager.query("SELECT id,client_id, currency,user_id,tax_on_stake,stake_after_tax FROM bet WHERE status = " + BET_PENDING + " AND id IN (" + betIDs.join(',') + ") ")

            if (cancelledBets == undefined || cancelledBets == false || cancelledBets.length === 0) {

                continue
            }

            for (const cancelledBet of cancelledBets) {

                let creditPayload = {
                    currency: cancelledBet.currency,
                    amount: cancelledBet.stake_after_tax,
                    user_id: cancelledBet.user_id,
                    client_id: cancelledBet.client_id,
                    description: "Bet betID " + cancelledBet.id + " was cancelled",
                    transaction_id: cancelledBet.id,
                    transaction_type: TRANSACTION_TYPE_BET_CANCEL
                }

                // send credit payload to wallet service
            }

        }

        return 1
    }

}