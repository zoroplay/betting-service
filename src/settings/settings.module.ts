import {Module} from "@nestjs/common";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Setting} from "../entity/setting.entity";
import {SettingsController} from "./settings.controller";
import {SettingsService} from "./settings.service";
import { BetSlip } from "src/entity/betslip.entity";
import { Bet } from "src/entity/bet.entity";
import { OddsLive } from "src/entity/oddslive.entity";
import { OddsPrematch } from "src/entity/oddsprematch.entity";
import {ClientsModule, Transport} from "@nestjs/microservices";
import {join} from "path";

@Module({
    imports: [
        TypeOrmModule.forFeature([Bet,BetSlip,Setting, OddsLive, OddsPrematch]),
        ClientsModule.register([]
        ),
    ],
    controllers: [SettingsController],
    providers: [SettingsService]
})
export class SettingsModule {
}