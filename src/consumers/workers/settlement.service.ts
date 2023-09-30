import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Settlement} from "../../entity/settlement.entity";
import {BetSlip} from "../../entity/betslip.entity";
import {AmqpConnection} from "@golevelup/nestjs-rabbitmq";

@Injectable()
export class SettlementService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(SettlementService.name);

    constructor(
        //private transactionRunner: DbTransactionFactory,
        @InjectRepository(BetSlip)
        private betslipRepository: Repository<BetSlip>,
        @InjectRepository(Settlement)
        private settlementRepository: Repository<Settlement>,
        private readonly amqpConnection: AmqpConnection
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

        //this.logger.info("createSettlement "+JSON.stringify(data))

        data = JSON.parse(JSON.stringify(data))

        let matchID = data.match_id
        let markets = data.markets;
        if(markets == undefined) {

            console.log("invalid data "+JSON.stringify(data))
            return 0;

        }

        let producer_id = data.producer_id;
        let event_type = data.event_type;

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

                if (!await this.betExists(matchID, marketID, specifier, outcomeID)) {

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
                let settlementResult = await this.settlementRepository.upsert(settlementData, ['event_id', 'market_id', 'specifier', 'outcome_id'])

                // update slips with this information

                await this.betslipRepository.update(
                    {
                        event_id: matchID,
                        market_id: marketID,
                        specifier: specifier,
                        outcome_id: outcomeID,
                        status: 0,
                    },
                    {
                        settlement_id: settlementData.id,
                        won: result,
                        dead_heat_factor: dead_heat_factor,
                        void_factor: void_factor,
                        status: 1,
                    });

                // publish settlements to queue
                //let queueName = "betting_service.settle_bets"
                //await this.amqpConnection.publish(queueName, queueName, {settlement_id: settlementData.id});
                this.logger.info("done processing settlement match | " + matchID + " | marketID " + marketID + " | specifier " + specifier + " | outcomeID " + outcomeID + " | settlementID " + settlementData.id)

                counts++

            }
        }

        return counts;
    }

    async betExists(matchID: number, marketID: number, specifier: string, outcomeID: string): Promise<boolean> {

        // get client settings
        var counts = await this.betslipRepository.count({
            where: {
                event_id: matchID,
                market_id: marketID,
                specifier: specifier,
                outcome_id: outcomeID
            }
        });

        return counts > 0

    }

}