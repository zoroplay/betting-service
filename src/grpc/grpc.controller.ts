import {Controller} from "@nestjs/common";
import {GrpcMethod} from "@nestjs/microservices";
import {CreateSetting} from "./interfaces/create.settings.interface";
import {EmptyInterface} from "./interfaces/empty.interface";
import {AllSettingsResponse} from "./interfaces/all.settings.response.interface";
import {GrpcService} from "./grpc.service";
import {SettingsResponse} from "./interfaces/settings.response.interface";
import {SettingsById} from "./interfaces/settings.byid.interface";
import {BetID} from "./interfaces/betid.interface";
import {Probability, Selections} from "./interfaces/betslip.interface";

@Controller()
export class GrpcController {

    constructor(
        private readonly settingsService: GrpcService,
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

    @GrpcMethod('BettingService', 'GetProbabilityFromBetID')
    GetProbabilityFromBetID(data: BetID): Promise<Probability> {

        return this.settingsService.getProbabilityFromBetID(data.betID)
    }

    @GrpcMethod('BettingService', 'GetProbabilityFromSelection')
    GetProbabilityFromSelection(data: Selections): Promise<Probability> {

        return this.settingsService.getProbabilityFromSelection(data)
    }

}