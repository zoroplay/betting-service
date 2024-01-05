import {Controller} from "@nestjs/common";
import {GrpcMethod} from "@nestjs/microservices";
import {CreateSetting} from "./interfaces/create.settings.interface";
import {AllSettingsResponse} from "./interfaces/all.settings.response.interface";
import {SettingsService} from "./settings.service";
import {SettingsResponse} from "./interfaces/settings.response.interface";
import {SettingsById} from "./interfaces/settings.byid.interface";
import {EmptyInterface} from "../bets/interfaces/empty.interface";

@Controller()
export class SettingsController {

    constructor(
        private readonly settingsService: SettingsService,
    ) {
    }

    @GrpcMethod('BettingService', 'CreateSetting')
    CreateSetting(data: CreateSetting): Promise<SettingsResponse> {

        return this.settingsService.createSettings(data)

    }

    @GrpcMethod('BettingService', 'UpdateSetting')
    UpdateSetting(data: CreateSetting): Promise<SettingsResponse> {

        return this.settingsService.updateSettings(data)

    }

    @GrpcMethod('BettingService', 'GetSettingsByID')
    GetSettingsByID(data: SettingsById): Promise<SettingsResponse> {

        return this.settingsService.findOne(data.clientID)

    }

    @GrpcMethod('BettingService', 'GetAllSettings')
    GetAllSettings(data: EmptyInterface): Promise<AllSettingsResponse> {

        return this.settingsService.findAll()
    }
}