import {Injectable} from "@nestjs/common";
import {Cron, CronExpression, Timeout} from "@nestjs/schedule";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {BetSettlementService} from "./workers/bet.settlement.service";
import {BetResultingController} from "./workers/bet.resulting.service";
import { EntityManager } from "typeorm";

@Injectable()
export class CronjobService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(CronjobService.name);

    constructor(
        private readonly betResultingService: BetResultingController,
        private readonly betSettlementService: BetSettlementService,
        private readonly entityManager: EntityManager
    ) {
    }

    @Cron(CronExpression.EVERY_5_SECONDS) // run every 5 seconds
    processBetResulting() {

        let vm = this;

        this.betResultingService.taskProcessBetResulting().then(function () {

           // vm.logger.info("done running taskProcessBetResulting ")

        })

    }

    @Cron(CronExpression.EVERY_5_SECONDS) // run every 5 seconds
    processBetSettlement() {

        let vm = this;

        this.betSettlementService.taskProcessBetSettlement().then(function () {

            //vm.logger.info("done running processBetSettlement ")

        })
    }
    
    @Timeout(10000)
    async updateOutcomeIds() {
        console.log('updating outcome ids');
        const selections = await this.entityManager.query(`SELECT outcome_id FROM odds_prematch WHERE status = ?`, [0]);
        console.log('found ' + selections.length + ' selections')
        for (const selection of selections) {
            const outcome = await this.entityManager.query(`SELECT * from odds_prematch where id = ?`, [selection.outcome_id]);
            console.log('updating outcome', selection.outcome_id);
            await this.entityManager.query(`UPDATE bet_slip SET outcome_id = ? WHERE outcome_id = ?`, [outcome.outcome_id]);

        }

    }
}