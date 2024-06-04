import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {BetCancel} from "../../entity/betcancel.entity";
import {BET_CANCELLED, BET_PENDING} from "../../constants";
// import { Setting } from "src/entity/setting.entity";
import { WalletService } from "src/wallet/wallet.service";
import { BonusService } from "src/bonus/bonus.service";

@Injectable()
export class BetCancelService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(BetCancelService.name);

    constructor(
        @InjectRepository(BetCancel)
        private betCancelRepository: Repository<BetCancel>,
        // @InjectRepository(Setting)
        // private settingRepository: Repository<Setting>,

        private readonly entityManager: EntityManager,

        private readonly walletService: WalletService,

        private readonly bonusService: BonusService
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

        let matchID = data.match_id;

        let eventType = "match"
        let startTime = data.start_time || ""
        let endTime = data.end_time || ""

        // create bet_cancel
        for (const market of data.markets) {

            let betIDs = []

            let marketID = market.id
            let specifier = market.specifier

            if (startTime.length > 0 && endTime.length > 0) { // if bet cancel has start and end time

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND match_id = ? AND status = 0 AND created BETWEEN ? AND ? ",
                    [specifier, marketID, matchID, startTime, endTime])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status = " + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND match_id = ? AND status = 0 AND created BETWEEN ? AND ? ",
                    [specifier, marketID, matchID, startTime, endTime])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            } else if (startTime.length == 0 && endTime.length > 0) { //  if bet cancel has end time only

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND match_id = ? AND status = 0 AND created < ? ",
                    [specifier, marketID, matchID, endTime])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status =" + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND match_id = ? AND status = 0 AND created < ? ",
                    [specifier, marketID, matchID, endTime])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            } else if (startTime.length > 0 && endTime.length == 0) { //  if bet cancel has start time only

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND match_id = ? AND status = 0 AND created > ? ",
                    [specifier, marketID, matchID, startTime])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status = " + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND match_id = ? AND status = 0 AND created > ? ",
                    [specifier, marketID, matchID, startTime])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            } else { //  if bet cancel has no time

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND match_id = ? AND status = 0  ",
                    [specifier, marketID, matchID])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status = " + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND match_id = ? AND status = 0  ",
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
                    subject: 'Bet Cancelled',
                    source: cancelledBet.source,
                    amount: cancelledBet.stake_after_tax.toFixed(2),
                    userId: cancelledBet.user_id,
                    clientId: cancelledBet.client_id,
                    username: cancelledBet.username,
                    description: "Bet betID " + cancelledBet.betslip_id + " was cancelled",
                    wallet: 'sport',
                    channel: 'Internal'
                }

                if(cancelledBet.bonus_id) {
                    creditPayload.wallet= 'sport-bonus'

                    await this.bonusService.settleBet({
                        clientId: cancelledBet.client_id,
                        betId: cancelledBet.id,
                        status: BET_CANCELLED,
                        amount: 0,
                    })
                }

                // send credit payload to wallet service
                await this.walletService.credit(creditPayload);
            }

        }

        return 1
    }


    /*
        {
          "event_id": "43429091",
          "event_type": "tournament",
          "event_prefix": "sr",
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
    async processOutrightsBetCancelMessage(data: any): Promise<number> {

        data = JSON.parse(JSON.stringify(data))

        let eventType = data.event_type;
        let eventPrefix = data.event_prefix;
        let eventID = data.event_id;

        let startTime = data.start_time || ""
        let endTime = data.end_time || ""

        // create bet_cancel
        for (const market of data.markets) {

            let betIDs = []

            let marketID = market.id
            let specifier = market.specifier

            if (startTime.length > 0 && endTime.length > 0) { // if bet cancel has start and end time

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND event_prefix  = ? AND event_type = ? AND match_id = ? AND status = 0 AND created BETWEEN ? AND ? ",
                    [specifier, marketID, eventPrefix, eventType, eventID, startTime, endTime])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status = " + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND event_prefix  = ? AND event_type = ? AND match_id = ? AND status = 0 AND created BETWEEN ? AND ? ",
                    [specifier, marketID, eventPrefix, eventType, eventID, startTime, endTime])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            } else if (startTime.length == 0 && endTime.length > 0) { //  if bet cancel has end time only

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND event_prefix  = ? AND event_type = ? AND match_id = ? AND status = 0 AND created < ? ",
                    [specifier, marketID, eventPrefix, eventType, eventID, endTime])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status =" + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND event_prefix  = ? AND event_type = ? AND match_id = ? AND status = 0 AND created < ? ",
                    [specifier, marketID, eventPrefix, eventType, eventID, endTime])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            } else if (startTime.length > 0 && endTime.length == 0) { //  if bet cancel has start time only

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND event_prefix  = ? AND event_type = ? AND match_id = ? AND status = 0 AND created > ? ",
                    [specifier, marketID, eventPrefix, eventType, eventID, startTime])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status = " + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND event_prefix  = ? AND event_type = ? AND match_id = ? AND status = 0 AND created > ? ",
                    [specifier, marketID, eventPrefix, eventType, eventID, startTime])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            } else { //  if bet cancel has no time

                let rows = await this.entityManager.query("SELECT bet_id FROM bet_slip WHERE specifier = ? AND market_id = ? AND event_prefix  = ? AND event_type = ? AND match_id = ? AND status = 0  ",
                    [specifier, marketID, eventPrefix, eventType, eventID])

                // update all betslips to be cancelled
                await this.entityManager.query("UPDATE bet_slip SET status = " + BET_CANCELLED + " WHERE specifier = ? AND market_id = ? AND event_prefix  = ? AND event_type = ? AND match_id = ? AND status = 0  ",
                    [specifier, marketID, eventPrefix, eventType, eventID])

                for (const slip of rows) {

                    betIDs.push(slip.bet_id)
                }
            }

            if (betIDs.length == 0) {

                continue
            }

            let betCancel = new BetCancel();
            betCancel.event_id = eventID
            betCancel.event_type = eventType
            betCancel.event_prefix = eventPrefix
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
                    subject:'Bet Cancelled',
                    source: cancelledBet.source,
                    amount: cancelledBet.stake_after_tax.toFixed(2),
                    userId: cancelledBet.user_id,
                    clientId: cancelledBet.client_id,
                    description: "Bet betID " + cancelledBet.betslip_id + " was cancelled",
                    wallet: 'sport',
                    channel: 'Internal',
                    username: cancelledBet.username
                }

                if(cancelledBet.bonus_id) {
                    creditPayload.wallet= 'sport-bonus'; 

                    await this.bonusService.settleBet({
                        clientId: cancelledBet.client_id,
                        betId: cancelledBet.id,
                        status: BET_CANCELLED,
                        amount: 0,
                    })
                }
                // send credit payload to wallet service
                await this.walletService.credit(creditPayload);
            }

        }

        return 1
    }

}