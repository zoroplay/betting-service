import {Controller} from "@nestjs/common";
import {GrpcMethod} from "@nestjs/microservices";
import {CreateSetting} from "./interfaces/create.settings.interface";
import {EmptyInterface} from "./interfaces/empty.interface";
import {AllSettingsResponse} from "./interfaces/all.settings.response.interface";
import {GrpcService} from "./grpc.service";
import {SettingsResponse} from "./interfaces/settings.response.interface";
import {SettingsById} from "./interfaces/settings.byid.interface";

@Controller()
export class GrpcController {

    constructor(
        private readonly settingsService: GrpcService,
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
    GetSettingsByID(data: SettingsById): Promise<SettingsResponse> {

        return this.settingsService.findOne(data.clientID)

    }

    @GrpcMethod()
    GetAllSettings(data: EmptyInterface): Promise<AllSettingsResponse> {

        return this.settingsService.findAll()
    }
}