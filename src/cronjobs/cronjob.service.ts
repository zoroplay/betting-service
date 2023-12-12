import {Injectable} from "@nestjs/common";
import {Cron, CronExpression} from "@nestjs/schedule";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {BetSettlementService} from "./workers/bet.settlement.service";
import {BetResultingController} from "./workers/bet.resulting.service";

@Injectable()
export class CronjobService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(CronjobService.name);

    constructor(
        private readonly betResultingService: BetResultingController,
        private readonly betSettlementService: BetSettlementService,
    ) {
    }

    @Cron(CronExpression.EVERY_5_SECONDS) // run every 5 seconds
    processBetResulting() {

        let vm = this;

        this.betResultingService.taskProcessBetResulting().then(function () {

            //vm.logger.info("done running taskProcessBetResulting ")

        })

    }

    @Cron(CronExpression.EVERY_5_SECONDS) // run every 5 seconds
    processBetSettlement() {

        let vm = this;

        this.betSettlementService.taskProcessBetSettlement().then(function () {

            vm.logger.info("done running processBetSettlement ")

        })
    }


    /*
    @Cron(CronExpression.EVERY_5_SECONDS) // run every 5 seconds
    processBetSettlement() {

        let vm = this;

        this.betSettlementService.taskProcessBetSettlement().then(function () {

            //vm.logger.info("done running processBetSettlement ")

        })

    }
    */

}