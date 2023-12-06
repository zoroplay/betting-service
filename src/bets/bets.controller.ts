import {Controller} from '@nestjs/common';
import {BetsService} from './bets.service';
import {GrpcMethod} from "@nestjs/microservices";
import {InjectRepository} from "@nestjs/typeorm";
import {Bet} from "../entity/bet.entity";
import {Repository} from "typeorm";
import {Mts} from "../entity/mts.entity";
import {BetSlip} from "../entity/betslip.entity";
import {Setting} from "../entity/setting.entity";
import {Producer} from "../entity/producer.entity";
import {OddsLive} from "../entity/oddslive.entity";
import {OddsPrematch} from "../entity/oddsprematch.entity";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {PlaceBet} from "../grpc/interfaces/placebet.interface";
import {PlaceBetResponse} from "../grpc/interfaces/placebet.response.interface";
import {BetHistoryRequest} from "../grpc/interfaces/bet.history.request.interface";
import {BetHistoryResponse} from "../grpc/interfaces/bet.history.response.interface";

@Controller('bets')
export class BetsController {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(BetsService.name);

    constructor(

        private readonly betsService: BetsService,

        //private transactionRunner: DbTransactionFactory,
        @InjectRepository(Bet)
        private betRepository: Repository<Bet>,
        @InjectRepository(Mts)
        private mstRepository: Repository<Mts>,
        @InjectRepository(BetSlip)
        private betslipRepository: Repository<BetSlip>,
        @InjectRepository(Setting)
        private settingRepository: Repository<Setting>,
        @InjectRepository(Producer)
        private producerRepository: Repository<Producer>,
        @InjectRepository(OddsLive)
        private liveRepository: Repository<OddsLive>,
        @InjectRepository(OddsPrematch)
        private prematchRepository: Repository<OddsPrematch>,
    ) {}

    @GrpcMethod('BettingService', 'PlaceBet')
    PlaceBet(data: PlaceBet): Promise<PlaceBetResponse> {

        return this.betsService.placeBet(data);
    }

    @GrpcMethod('BettingService', 'BookBet')
    bookBet(data: PlaceBet): Promise<PlaceBetResponse> {
        return this.betsService.placeBet(data);
    }

    @GrpcMethod('BettingService', 'BetHistory')
    BetHistory(data: BetHistoryRequest): Promise<BetHistoryResponse> {

        return this.betsService.findAll(data.userId,data.status,data.date)
    }

}

