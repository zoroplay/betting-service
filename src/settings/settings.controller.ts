import {Controller} from "@nestjs/common";
import {GrpcMethod} from "@nestjs/microservices";
import {CreateSetting} from "./interfaces/create.settings.interface";
import {SettingsResponse} from "./interfaces/settings.response.interface";
import {SettingsById} from "./interfaces/settings.byid.interface";
import {EmptyInterface} from "./interfaces/empty.interface";
import {AllSettingsResponse} from "./interfaces/all.settings.response.interface";
import {SettingService} from "./settingService";
import {Setting} from "../entity/setting.entity";

@Controller()
export class SettingsService {

    constructor(
        private readonly settingsService: SettingService,
    ) {
    }

    @GrpcMethod()
    CreateSetting(data: CreateSetting): Promise<SettingsResponse> {

        return this.settingsService.createSettings(data)

    }

    @GrpcMethod()
    UpdateSetting(data: CreateSetting): Promise<SettingsResponse> {

        return this.settingsService.updateSettings(data)

    }

    @GrpcMethod()
    FindOne(data: SettingsById): Promise<SettingsResponse> {

        return this.settingsService.findOne(data.clientID)

    }

    @GrpcMethod()
    FindAll(data: EmptyInterface): Promise<AllSettingsResponse> {

        return this.settingsService.findAll()
    }
}