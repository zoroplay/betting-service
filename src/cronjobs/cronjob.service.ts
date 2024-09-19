import {Injectable} from "@nestjs/common";
import {Cron, CronExpression} from "@nestjs/schedule";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {BetSettlementService} from "./workers/bet.settlement.service";
import {BetResultingController} from "./workers/bet.resulting.service";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Cronjob} from "../entity/cronjob.entity";

@Injectable()
export class CronjobService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(CronjobService.name);

    constructor(
        private readonly betResultingService: BetResultingController,
        private readonly betSettlementService: BetSettlementService,

        @InjectRepository(Cronjob)
        private cronjobRepository: Repository<Cronjob>,
    ) {
    }

    @Cron(CronExpression.EVERY_5_SECONDS) // run every 5 seconds
    processBetResulting() {
        console.log('cronjob for bet resulting')

        let vm = this;

        this.betResultingService.taskProcessBetResulting().then(function () {

            vm.logger.info("done running taskProcessBetResulting ")

        })

    }

    @Cron(CronExpression.EVERY_5_SECONDS) // run every 5 seconds
    processBetSettlement() {
        
        let vm = this;

        this.betSettlementService.taskProcessBetSettlement().then(function () {

            vm.logger.info("done running processBetSettlement ")

        })
    }

    @Cron(new Date(Date.now() + 10 * 1000),{
    name: 'startUp',
    timeZone: 'Africa/Lagos',
    })
    async startUp(){
        console.log('start up script')

        // reset all cron jobs when the application starts
        await this.cronjobRepository.update(
            {
                status: 1,
            },
            {
                status: 0
            }
        )

        let vm = this;

        this.betResultingService.taskFixInvalidBetStatus().then(function () {

            vm.logger.info("done running taskFixInvalidBetStatus ")

        })

    }

    
    @Cron(CronExpression.EVERY_10_MINUTES) // run every 5 seconds
    processUnsettledBets() {

        let vm = this;

        this.betSettlementService.taskProcessUnSettledBet().then(function () {

            vm.logger.info("done running processUnsettledBets ")

        })

    }

}