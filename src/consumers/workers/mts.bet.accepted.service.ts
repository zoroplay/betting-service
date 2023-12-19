import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {BetStatus} from "../../entity/betstatus.entity";

@Injectable()
export class MtsBetAcceptedService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(MtsBetAcceptedService.name);

    constructor(
        @InjectRepository(BetStatus)
        private betStatusRepository: Repository<BetStatus>,

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
    async processBetAcceptedMessage(data: any): Promise<number> {

        data = JSON.parse(JSON.stringify(data))
        this.logger.info("processBetAcceptedMessage "+JSON.stringify(data))

        let betID = data.bet_id;

        let betStatus = new BetStatus()
        betStatus.status = 1
        betStatus.bet_id = betID
        betStatus.description = "Bet accepted by MTS"
        await this.betStatusRepository.upsert(betStatus,['status','description'])

        return 1
    }

}