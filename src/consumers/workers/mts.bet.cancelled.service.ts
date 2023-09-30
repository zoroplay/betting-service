import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {BET_CANCELLED, TRANSACTION_TYPE_BET_CANCELLED} from "../../constants";
import {Bet} from "../../entity/bet.entity";
import {BetStatus} from "../../entity/betstatus.entity";

@Injectable()
export class MtsBetCancelledService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(MtsBetCancelledService.name);

    constructor(
        @InjectRepository(BetStatus)
        private betStatusRepository: Repository<BetStatus>,

        @InjectRepository(Bet)
        private betRepository: Repository<Bet>,

        private readonly entityManager: EntityManager,


    ) {

    }

    /*
        {
          "bet_id": 43429091,
          "reason": "sr:match:43429091",
          "code": 0
        }
         */
    async processBetRejectedMessage(data: any): Promise<number> {

        data = JSON.parse(JSON.stringify(data))

        let betID = data.bet_id;
        let reason = data.reason;
        let code = data.code;

        if(reason.length > 300 ) {

            reason = reason.slice(0, 290) + '...'
        }

        let betStatus = new BetStatus()
        betStatus.status = BET_CANCELLED
        betStatus.bet_id = betID
        betStatus.description = reason
        await this.betStatusRepository.save(betStatus)

        await this.entityManager.query("UPDATE bet_slip SET status = "+BET_CANCELLED+", won = -1 WHERE bet_id = ? ",[betID])

        await this.entityManager.query("UPDATE bet SET status = "+BET_CANCELLED+", won = -1 WHERE id = ? ",[betID])

        // get client settings
        let bet = await this.betRepository.findOne({
            where: {
                id: betID
            }
        });

        // revert the stake
        let creditPayload = {
            currency: bet.currency,
            amount: bet.stake,
            user_id: bet.user_id,
            client_id: bet.client_id,
            description: "Bet cancelled betID "+betID,
            transaction_id: betID,
            transaction_type: TRANSACTION_TYPE_BET_CANCELLED
        }

        return 1
    }

}