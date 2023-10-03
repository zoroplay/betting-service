import {Module} from "@nestjs/common";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Setting} from "../entity/setting.entity";
import {SettingsService} from "./settings.controller";
import {SettingService} from "./settingService";

@Module({
    imports: [TypeOrmModule.forFeature([Setting]),
    ],
    controllers: [SettingsService],
    providers: [SettingService]
})
export class SettingsModule {
}