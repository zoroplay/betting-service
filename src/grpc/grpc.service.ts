import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Setting} from "../entity/setting.entity";
import {CreateSetting} from "./interfaces/create.settings.interface";
import {AllSettingsResponse} from "./interfaces/all.settings.response.interface";
import {SettingsResponse} from "./interfaces/settings.response.interface";
import {OddsPrematch} from "../entity/oddsprematch.entity";
import {OddsLive} from "../entity/oddslive.entity";
import {BetSlip} from "../entity/betslip.entity";
import {Probability, ProbabilityBetSlipSelection} from "./interfaces/betslip.interface";
import {Bet} from "../entity/bet.entity";
import {Inject} from "@nestjs/common";
import {ClientGrpc} from "@nestjs/microservices";
import OddsService from "../bets/odds.service.interface";
import {GetOddsRequest} from "../bets/interfaces/oddsrequest.interface";
import {Observable} from "rxjs";
import {OddsProbability} from "../bets/interfaces/oddsreply.interface";

export class GrpcService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(GrpcService.name);
    private oddsService: OddsService;

    constructor(
        @InjectRepository(Setting)
        private settingRepository: Repository<Setting>,

        @InjectRepository(OddsPrematch)
        private oddsPrematchRepository: Repository<OddsPrematch>,

        @InjectRepository(OddsLive)
        private oddsLiveRepository: Repository<OddsLive>,

        @InjectRepository(BetSlip)
        private betslipRepository: Repository<BetSlip>,

        @InjectRepository(Bet)
        private betRepository: Repository<Bet>,

        @Inject('ODDS_PACKAGE')
        private readonly client: ClientGrpc

    ) {

    }

    onModuleInit(): any {

        this.oddsService = this.client.getService<OddsService>('Odds');

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

    async getProbabilityFromBetID(betID: number): Promise<Probability> {

        try {

            const betData = await this.betRepository.findOne({
                where: {
                    id: betID
                }
            });

            const slips = await this.betslipRepository.find({
                where: {
                    bet_id: betID
                }
            });

            let probability = 1

            let probabilityBetSlipSelection = []

            for (let slip of slips) {

                let selectionProbability = {} as ProbabilityBetSlipSelection

                let pro = await this.getOddsProbability(slip.producer_id,slip.event_id,slip.market_id,slip.specifier,slip.outcome_id)
                selectionProbability.currentProbability = pro;
                selectionProbability.eventId = slip.event_id;
                selectionProbability.marketId = slip.market_id;
                selectionProbability.marketName = slip.market_name;
                selectionProbability.specifier = slip.specifier;
                selectionProbability.outcomeId = slip.outcome_id;
                selectionProbability.outcomeName = slip.outcome_name;
                selectionProbability.initialProbability = slip.probability;
                selectionProbability.currentProbability = pro;
                probabilityBetSlipSelection.push(selectionProbability)
                probability = probability * pro
            }

            return {
                currentProbability: probability,
                initialProbability: betData.probability,
                selections: probabilityBetSlipSelection,
            }

        } catch (e) {

            this.logger.error(" error retrieving all settings " + e.toString())
            throw e
        }

    }

    async getOddsProbability(producerId: number, matchID: number, marketID: number, specifier: string, outcomeID: string): Promise<number> {

        let odds  = {
            producerID:producerId,
            eventID:matchID,
            marketID:marketID,
            outcomeID:outcomeID,
            specifier:specifier,
        }

        let oddStatus =  await this.getProbability(odds).toPromise()

        this.logger.info(oddStatus)

        return oddStatus.probability
    }

    getProbability(data: GetOddsRequest ): Observable<OddsProbability>  {

        return this.oddsService.GetProbability(data)
    }

}