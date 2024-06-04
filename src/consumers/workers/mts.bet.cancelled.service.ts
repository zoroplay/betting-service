import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {BET_CANCELLED} from "../../constants";
import {Bet} from "../../entity/bet.entity";
import {BetStatus} from "../../entity/betstatus.entity";
import { Setting } from "src/entity/setting.entity";
import { WalletService } from "src/wallet/wallet.service";
import { BonusService } from "src/bonus/bonus.service";

@Injectable()
export class MtsBetCancelledService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(MtsBetCancelledService.name);

    constructor(
        @InjectRepository(BetStatus)
        private betStatusRepository: Repository<BetStatus>,

        @InjectRepository(Bet)
        private betRepository: Repository<Bet>,

        @InjectRepository(Setting)
        private settingRepository: Repository<Setting>,

        private readonly entityManager: EntityManager,

        private readonly walletService: WalletService,

        private readonly bonusService: BonusService,
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
            amount: bet.stake.toFixed(2),
            userId: bet.user_id,
            username: bet.username,
            clientId: bet.client_id,
            description: "Bet betID " + bet.betslip_id + " was cancelled",
            source: bet.source,
            wallet: 'sport',
            channel: 'Internal',
            subject: 'Bet Rejected - MTS'
        }
        if(bet.bonus_id) {
            creditPayload.wallet= 'sport-bonus';

            await this.bonusService.settleBet({
                clientId: bet.client_id,
                betId: bet.id,
                status: BET_CANCELLED,
                amount: 0,
            })
        }

        await this.walletService.credit(creditPayload);

        return 1
    }

}