import {Module} from "@nestjs/common";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Setting} from "../entity/setting.entity";
import {SettingsController} from "./settings.controller";
import {SettingsService} from "./settings.service";
import { BetSlip } from "src/entity/betslip.entity";
import { Bet } from "src/entity/bet.entity";
import {ClientsModule, Transport} from "@nestjs/microservices";
import {join} from "path";

@Module({
    imports: [
        TypeOrmModule.forFeature([Bet,BetSlip,Setting]),
        ClientsModule.register([]
        ),
    ],
    controllers: [SettingsController],
    providers: [SettingsService]
})
export class SettingsModule {
}