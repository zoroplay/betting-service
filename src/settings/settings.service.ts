import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Setting} from "../entity/setting.entity";
import {CreateSetting} from "./interfaces/create.settings.interface";
import {AllSettingsResponse} from "./interfaces/all.settings.response.interface";
import {SettingsResponse} from "./interfaces/settings.response.interface";

export class SettingsService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(SettingsService.name);

    constructor(
        @InjectRepository(Setting)
        private settingRepository: Repository<Setting>,
    ) {

    }

    async createSettings(data: CreateSetting): Promise<SettingsResponse> {

        try {

            let setting = new Setting();
            setting.client_id = data.clientID
            setting.tax_on_stake = data.taxOnStake
            setting.tax_on_winning = data.taxOnWinning
            setting.minimum_stake = data.minimumStake
            setting.maximum_stake = data.maximumStake
            setting.maximum_winning = data.maximumWinning
            setting.maximum_selections = data.maximumSelections
            setting.mts_limit_id = data.mtsLimitID
            setting.currency = data.currency
            setting.url = data.url;
            let savedSettings = await this.settingRepository.save(setting)

            return this.getSettingsResponseFromSetting(savedSettings);

        } catch (e) {

            this.logger.error(" error creating settings " + e.toString())
            throw e
        }
    }

    async updateSettings(data: CreateSetting): Promise<SettingsResponse> {

        try {

            let setting = new Setting();
            setting.client_id = data.clientID
            setting.tax_on_stake = data.taxOnStake
            setting.tax_on_winning = data.taxOnWinning
            setting.minimum_stake = data.minimumStake
            setting.maximum_stake = data.maximumStake
            setting.maximum_winning = data.maximumWinning
            setting.maximum_selections = data.maximumSelections
            setting.mts_limit_id = data.mtsLimitID
            setting.currency = data.currency
            setting.url = data.url
            await this.settingRepository.upsert(setting, ['tax_on_stake', 'tax_on_winning', 'minimum_stake', 'maximum_stake', 'maximum_winning', 'maximum_selections', 'mts_limit_id'])
            return this.findOne(data.clientID)

        } catch (e) {

            this.logger.error(" error updating settings " + e.toString())
            throw e
        }
    }

    async findOne(clientID: number): Promise<SettingsResponse> {

        try {

            var savedSettings = await this.settingRepository.findOne({
                where: {
                    client_id: clientID
                }
            });

            return this.getSettingsResponseFromSetting(savedSettings);

        } catch (e) {

            this.logger.error(" error retrieving one settings " + e.toString())
            throw e
        }
    }

    getSettingsResponseFromSetting(savedSettings: Setting): SettingsResponse {

        return {
            clientID: savedSettings.client_id,
            created: savedSettings.created,
            maximumSelections: savedSettings.maximum_selections,
            maximumStake: savedSettings.maximum_stake,
            maximumWinning: savedSettings.maximum_winning,
            minimumStake: savedSettings.minimum_stake,
            mtsLimitID: savedSettings.mts_limit_id,
            taxOnStake: savedSettings.tax_on_stake,
            taxOnWinning: savedSettings.tax_on_winning,
            updated: savedSettings.updated,
            currency: savedSettings.currency,
            url: savedSettings.url
        }
    }

    async findAll(): Promise<AllSettingsResponse> {

        try {

            var allSettings = await this.settingRepository.find();

            let all = []

            for (let savedSettings of allSettings) {

                let res = this.getSettingsResponseFromSetting(savedSettings);
                all.push(res)
            }

            return {
                settings: all
            };

        } catch (e) {

            this.logger.error(" error retrieving all settings " + e.toString())
            throw e
        }
    }

}