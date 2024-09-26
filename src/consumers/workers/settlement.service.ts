import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Settlement} from "../../entity/settlement.entity";
import {BetSlip} from "../../entity/betslip.entity";
// import {AmqpConnection} from "@golevelup/nestjs-rabbitmq";
import {BETSLIP_PROCESSING_PENDING, BETSLIP_PROCESSING_SETTLED} from "../../constants";
import axios from "axios";
import { xml2js } from 'xml-js';
// import { CashoutService } from "src/bets/cashout.service";

@Injectable()
export class SettlementService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(SettlementService.name);

    constructor(
        //private transactionRunner: DbTransactionFactory,
        @InjectRepository(BetSlip)
        private betslipRepository: Repository<BetSlip>,

        @InjectRepository(Settlement)
        private settlementRepository: Repository<Settlement>,

        // private readonly cashoutService: CashoutService,

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
      "outcome": [
        {
          "id": "58",
          "result": 0,
          "void_factor": 0,
          "dead_heat_factor": 1
        }
      ]
    }
  ]
}
 */

    async createSettlement(data: any): Promise<number> {
        // console.log('creating bet settlement');
        
        data = JSON.parse(JSON.stringify(data))
        // console.log(data)
        let matchID = data.match_id
        let markets = data.markets;
        
        if(markets == undefined) {
            console.log("invalid data "+JSON.stringify(data))
            return 0;
        }

        let producer_id = data.producer_id;
        let event_type = data.event_type;
        let eventPrefix = 'sr';

        //To-Do: Get Event Scores
        const scores: any = await this.getMatchInfo(data.event_id);
        let ft_score = '-';
        let ht_score = '-';

        if (scores.success) {
            ft_score = scores.scores.ft_score;
            ht_score = scores.scores.ht_score;
        }
        let counts = 0

        for (const market of markets) {

            let marketID = market.id
            let specifier = market.specifier
            let outcomes = market.outcome

            for (const outcome of outcomes) {

                let outcomeID = outcome.id
                let result = outcome.result
                let void_factor = outcome.void_factor
                let dead_heat_factor = outcome.dead_heat_factor

               // this.logger.info("settlement | match_id "+matchID+" | marketID "+marketID+" | specifier "+specifier+" | outcomeID "+outcomeID+" | result "+result)

                if (!await this.betExists(eventPrefix, event_type, matchID, marketID, specifier, outcomeID)) {

                    continue
                }


                // create settlement
                const settlementData = new Settlement();
                settlementData.event_id = matchID;
                settlementData.event_type = event_type;
                settlementData.market_id = marketID;
                settlementData.specifier = specifier;
                settlementData.outcome_id = outcomeID;
                settlementData.status = result;
                settlementData.producer_id = producer_id;
                settlementData.void_factor = void_factor;
                settlementData.dead_heat_factor = dead_heat_factor;
                settlementData.ft_score = ft_score;
                settlementData.ht_score = ht_score;

                await this.settlementRepository.upsert(settlementData, ['event_id', 'market_id', 'specifier', 'outcome_id'])

                const settlementResult = await this.settlementRepository.findOne({
                    where: {
                        event_id: matchID,
                        market_id: marketID,
                        specifier: specifier,
                        outcome_id: outcomeID
                    }
                })

                // update slips with this information

                await this.betslipRepository.update(
                    {
                        match_id: matchID,
                        market_id: marketID,
                        specifier: specifier,
                        outcome_id: outcomeID,
                        status: BETSLIP_PROCESSING_PENDING,
                    },
                    {
                        settlement_id: settlementResult.id,
                        won: result,
                        dead_heat_factor: dead_heat_factor,
                        void_factor: void_factor,
                        status: BETSLIP_PROCESSING_SETTLED,
                    });

                // publish settlements to queue
                //let queueName = "betting_service.settle_bets"
                //await this.amqpConnection.publish(queueName, queueName, {settlement_id: settlementData.id});
                this.logger.info("done processing settlement match | " + matchID + " | marketID " + marketID + " | specifier " + specifier + " | outcomeID " + outcomeID + " | settlementID " + settlementResult.id)

                counts++
                // if result is won, check and calculate cashout amount
                // if (result === 1) {
                //     this.cashoutService.checkCashoutAvailability(matchID, marketID, specifier, outcomeID);
                // }
            }

        }

        return counts;
    }

    /*
        {
         "event_id": 43429091,
         "event_prefix": "sr",
         "event_type": "tournament",
         "timestamp": 0,
         "markets": [
           {
             "id": 156,
             "specifier": "",
             "outcome": [
               {
                 "id": "58",
                 "result": 0,
                 "void_factor": 0,
                 "dead_heat_factor": 1
               }
             ]
           }
         ]
        }
    */
    async createOutrightSettlement(data: any): Promise<number> {

        data = JSON.parse(JSON.stringify(data))
        let urn = data.event_prefix+":"+data.event_type+":"+data.event_id;

        let markets = data.markets;
        if(markets == undefined) {

            console.log("invalid data "+JSON.stringify(data))
            return 0;

        }

        let producer_id = data.producer_id;
        let eventType = data.event_type;
        let eventPrefix = data.event_prefix;
        let eventID = data.event_id;

        let counts = 0

        for (const market of markets) {

            let marketID = market.id
            let specifier = market.specifier
            let outcomes = market.outcome

            for (const outcome of outcomes) {

                let outcomeID = outcome.id
                let result = outcome.result
                let void_factor = outcome.void_factor
                let dead_heat_factor = outcome.dead_heat_factor

                if (!await this.betExists(eventPrefix,eventType, eventID, marketID, specifier, outcomeID)) {

                    continue
                }

                // create settlement
                const settlementData = new Settlement();
                settlementData.event_id = eventID;
                settlementData.event_type = eventType;
                settlementData.event_prefix = eventPrefix;
                settlementData.market_id = marketID;
                settlementData.specifier = specifier;
                settlementData.outcome_id = outcomeID;
                settlementData.status = result;
                settlementData.producer_id = producer_id;
                settlementData.void_factor = void_factor;
                settlementData.dead_heat_factor = dead_heat_factor;
                await this.settlementRepository.upsert(settlementData, ['event_type','event_prefix','event_id', 'market_id', 'specifier', 'outcome_id'])

                const settlementResult = await this.settlementRepository.findOne({
                    where: {
                        event_type: eventType,
                        event_prefix: eventPrefix,
                        event_id: eventID,
                        market_id: marketID,
                        specifier: specifier,
                        outcome_id: outcomeID
                    }
                })

                // update slips with this information

                await this.betslipRepository.update(
                    {
                        event_type: eventType,
                        event_prefix: eventPrefix,
                        match_id: eventID,
                        market_id: marketID,
                        specifier: specifier,
                        outcome_id: outcomeID,
                        status: BETSLIP_PROCESSING_PENDING,
                    },
                    {
                        settlement_id: settlementResult.id,
                        won: result,
                        dead_heat_factor: dead_heat_factor,
                        void_factor: void_factor,
                        status: BETSLIP_PROCESSING_SETTLED,
                    });

                // publish settlements to queue
                //let queueName = "betting_service.settle_bets"
                //await this.amqpConnection.publish(queueName, queueName, {settlement_id: settlementData.id});
                this.logger.info("done processing settlement match | " + urn + " | marketID " + marketID + " | specifier " + specifier + " | outcomeID " + outcomeID + " | settlementID " + settlementResult.id)

                counts++
            }

        }

        return counts;
    }

    async betExists(eventPrefix : string,eventType: string, eventID: number, marketID: number, specifier: string, outcomeID: string): Promise<boolean> {

        // get client settings
        var counts = await this.betslipRepository.count({
            where: {
                match_id: eventID,
                event_type: eventType,
                event_prefix: eventPrefix,
                market_id: marketID,
                specifier: specifier,
                outcome_id: outcomeID
            }
        });

        return counts > 0

    }

    async getMatchInfo(matchId) {
        // console.log(matchId);
        const url = `https://api.betradar.com/v1/sports/en/sport_events/${matchId}/summary.xml`;
        
        return await axios.get(url, {
            headers: {
                'x-access-token': process.env.BETRADAR_API_TOKEN
            }
        }).then(res => {
            const json: any = xml2js(res.data, { compact: true});
            // console.log(json.match_summary)
            const periodScore: any = json.match_summary.sport_event_status.period_scores ? 
                json.match_summary.sport_event_status.period_scores.period_score[0]?._attributes : null;
            const eventStatus = json.match_summary.sport_event_status;
            const ft_score = `${eventStatus._attributes.home_score}:${eventStatus._attributes.away_score}`;
            const ht_score = `${periodScore?.home_score}:${periodScore?.away_score}`;
            return {success: true, scores: {ft_score, ht_score} };
        }).catch(err => {
            console.log('Error, fetching match scores', err)
            return {success: false, scores: {}}
        });

    }

}