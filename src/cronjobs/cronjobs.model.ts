import {Module} from "@nestjs/common";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Bet} from "../entity/bet.entity";
import {BetSlip} from "../entity/betslip.entity";
import {Settlement} from "../entity/settlement.entity";
import {Setting} from "../entity/setting.entity";
import {BetClosure} from "../entity/betclosure.entity";
import {Winning} from "../entity/winning.entity";
import {ScheduleModule} from "@nestjs/schedule";
import {BetResultingController} from "./workers/bet.resulting.service";
import {BetSettlementService} from "./workers/bet.settlement.service";
import {CronjobController} from "./cronjob.controller";
import {CronjobService} from "./cronjob.service";
import {Cronjob} from "../entity/cronjob.entity";

@Module({
    imports: [
        TypeOrmModule.forFeature([Bet, BetSlip, Settlement, Setting, BetClosure, Winning, Cronjob]),
        ScheduleModule.forRoot(),
        CronJobModule,
    ],
    providers: [BetResultingController, BetSettlementService,CronjobService],
    controllers: [CronjobController],
})
export class CronJobModule {
}