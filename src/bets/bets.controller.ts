import {Body, Controller, Get, Inject, OnModuleInit, Param, Post, Query} from '@nestjs/common';
import {BetsService} from './bets.service';
import OddsService from "./odds.service.interface";
import {GetOddsRequest} from "./interfaces/oddsrequest.interface";
import {ClientGrpc, GrpcMethod} from "@nestjs/microservices";
import {InjectRepository} from "@nestjs/typeorm";
import {Bet} from "../entity/bet.entity";
import {Repository} from "typeorm";
import {Mts} from "../entity/mts.entity";
import {BetSlip} from "../entity/betslip.entity";
import {Setting} from "../entity/setting.entity";
import {Producer} from "../entity/producer.entity";
import {OddsLive} from "../entity/oddslive.entity";
import {OddsPrematch} from "../entity/oddsprematch.entity";
import {ProducerstatusreplyInterface} from "./interfaces/producerstatusreply.interface";
import {GetOddsReply} from "./interfaces/oddsreply.interface";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {Observable} from "rxjs";
import {BET_PENDING, TRANSACTION_TYPE_PLACE_BET} from "../constants";
import {AmqpConnection} from "@golevelup/nestjs-rabbitmq";
import {EmptyInterface} from "../grpc/interfaces/empty.interface";
import {AllSettingsResponse} from "../grpc/interfaces/all.settings.response.interface";
import {PlaceBet} from "../grpc/interfaces/placebet.interface";
import {PlaceBetResponse} from "../grpc/interfaces/placebet.response.interface";
import {BetSlipSelection} from "../grpc/interfaces/betslip.interface";
import {BetHistoryRequest} from "../grpc/interfaces/bet.history.request.interface";
import {BetHistoryResponse} from "../grpc/interfaces/bet.history.response.interface";

@Controller('bets')
export class BetsController implements OnModuleInit {

    private oddsService: OddsService;
    private readonly logger: JsonLogger = LoggerFactory.createLogger(BetsService.name);

    constructor(

        private readonly betsService: BetsService,

        //private transactionRunner: DbTransactionFactory,
        @InjectRepository(Bet)
        private betRepository: Repository<Bet>,
        @InjectRepository(Mts)
        private mstRepository: Repository<Mts>,
        @InjectRepository(BetSlip)
        private betslipRepository: Repository<BetSlip>,
        @InjectRepository(Setting)
        private settingRepository: Repository<Setting>,
        @InjectRepository(Producer)
        private producerRepository: Repository<Producer>,
        @InjectRepository(OddsLive)
        private liveRepository: Repository<OddsLive>,
        @InjectRepository(OddsPrematch)
        private prematchRepository: Repository<OddsPrematch>,

        private readonly amqpConnection: AmqpConnection,

        @Inject('ODDS_PACKAGE')
        private readonly client: ClientGrpc

    ) {}

    //create bet
    @Post()
    async create(@Body() data: PlaceBet): Promise<PlaceBetResponse> {

        return this.createBet(data);

    }

    onModuleInit(): any {

        this.oddsService = this.client.getService<OddsService>('Odds');

    }

    @GrpcMethod('BettingService', 'PlaceBet')
    PlaceBet(data: PlaceBet): Promise<PlaceBetResponse> {

        return this.createBet(data)
    }

    @GrpcMethod('BettingService', 'BetHistory')
    BetHistory(data: BetHistoryRequest): Promise<BetHistoryResponse> {

        return this.betsService.findAll(data.userId,data.status,data.date)
    }

    @Get(':user_id')
    async getAllBets(@Param('user_id') userID: number,@Query() params: any) {

        return this.betsService.findAll(userID,params.status,params.date)
    }

    getProducerStatus(producerID: number): Observable<ProducerstatusreplyInterface> {

        return this.oddsService.GetProducerStatus({producer: producerID})
    }

    getOddsStatus(data: GetOddsRequest ): Observable<GetOddsReply>  {

        return this.oddsService.GetOdds(data)
    }

    async createBet(bet: PlaceBet): Promise<PlaceBetResponse> {


        //this.logger.info("received bet " + JSON.stringify(bet))

        //1. fields validations

        if (bet.clientId == 0)
            return {status: 400, statusDescription: "missing client id", betId: 0};

        if (bet.userId == 0)
            return {status: 400, statusDescription: "missing user id", betId: 0};

        if (bet.stake  === 0)
            return {status: 400, statusDescription: "missing stake", betId: 0};

        if (bet.source == undefined || bet.source.length === 0)
            return {status: 400, statusDescription: "missing bet source", betId: 0};

        if (bet.betslip == undefined )
            return {status: 400, statusDescription: "missing selections", betId: 0};

        let userSelection =  bet.betslip
        console.log("userSelection | "+JSON.stringify(userSelection))

        // get client settings
        var clientSettings = await this.settingRepository.findOne({
            where: {
                client_id: bet.clientId
            }
        });

        if(clientSettings == undefined || clientSettings.id == undefined || clientSettings.id == 0 ) {
            // return {status: 400, data: "invalid client"};
            clientSettings = new Setting();
            clientSettings.id = 1;
            clientSettings.client_id = 1;
            clientSettings.maximum_selections = 100;
            clientSettings.maximum_stake = 1000
            clientSettings.maximum_winning = 10000
            clientSettings.tax_on_stake = 0
            clientSettings.tax_on_winning = 0
        }


        // settings validation
        if (bet.stake < clientSettings.minimum_stake)
            return {status: 400, statusDescription: "Minimum stake is " + clientSettings.minimum_stake, betId: 0};

        if (bet.stake > clientSettings.maximum_stake)
            bet.stake = clientSettings.maximum_stake;


        //2. odds validation
        var selections = [];
        var totalOdds = 1;

        for (const slips of userSelection) {

            const selection = slips as BetSlipSelection

            if (selection.eventName.length === 0 )
                return {status: 400, statusDescription: "missing event name in your selection ", betId: 0};

            if (selection.eventType.length === 0 )
                selection.eventType = "match";

            if (selection.eventId === 0 )
                return {status: 400, statusDescription: "missing event ID in your selection ", betId: 0};

            if (selection.producerId === 0 )
                return {status: 400, statusDescription: "missing producer id in your selection ", betId: 0};

            if (selection.marketId === 0 )
                return {status: 400, statusDescription: "missing market id in your selection ", betId: 0};

            if (selection.marketName.length === 0 )
                return {status: 400, statusDescription: "missing market name in your selection ", betId: 0};

            if (selection.outcomeName.length === 0 )
                return {status: 400, statusDescription: "missing outcome name in your selection ", betId: 0};

            if (selection.outcomeId.length === 0 )
                return {status: 400, statusDescription: "missing outcome id in your selection ", betId: 0};

            if (selection.specifier === undefined )
                return {status: 400, statusDescription: "missing specifier in your selection ", betId: 0};

            if (selection.odds === 0 )
                return {status: 400, statusDescription: "missing odds in your selection ", betId: 0};

            // get odds
            var odd = await this.getOdds(selection.producerId, selection.eventId, selection.marketId, selection.specifier, selection.outcomeId)

            if (odd === 0 ) { // || odd.active == 0 || odd.status !== 0 ) {

                this.logger.info("selection suspended " + JSON.stringify(selection))
                return {
                    statusDescription: "Your selection " + selection.eventName + " - " + selection.marketName + " is suspended",
                    status: 400,
                    betId: 0
                };

            }

            selection.odds = odd
            selections.push({
                event_name: selection.eventName,
                event_type: selection.eventType,
                event_prefix: "sr",
                producer_id: selection.producerId,
                sport_id: selection.sportId,
                event_id: selection.eventId,
                market_id: selection.marketId,
                market_name: selection.marketName,
                specifier: selection.specifier,
                outcome_name: selection.outcomeName,
                outcome_id: selection.outcomeId,
                odds: selection.odds,
            })
            totalOdds = totalOdds * odd
        }

        if (selections.length === 0)
            return {status: 400, statusDescription: "missing selections", betId: 0};

        if (selections.length > clientSettings.maximum_selections)
            return {statusDescription: "maximum allowed selection is " + clientSettings.maximum_selections, status: 400, betId: 0};

        //3. tax calculations

        let taxOnStake = 0;
        let taxOnWinning = 0;
        let stake = bet.stake;
        let stakeAfterTax = stake;

        if (clientSettings.tax_on_stake > 0) {

            taxOnStake = clientSettings.tax_on_stake * bet.stake;
            stakeAfterTax = stake - taxOnStake;
        }

        let possibleWin = stakeAfterTax * totalOdds
        let payout = possibleWin;

        if (clientSettings.tax_on_winning > 0) {

            taxOnWinning = clientSettings.tax_on_winning * (possibleWin - stake);
            payout = possibleWin - taxOnWinning;
        }

        if (payout > clientSettings.maximum_winning) {

            payout = clientSettings.maximum_winning;
        }

        //@TODO debit user
        //4. debit user by calling wallet service
        let debitPayload = {
            currency: clientSettings.currency,
            amount: stake,
            user_id: bet.userId,
            client_id: bet.clientId,
            description: "Place Bet Request ",
            transaction_id: 0,
            transaction_type: TRANSACTION_TYPE_PLACE_BET
        }

        //let transactionRunner = null;
        const betData = new Bet();
        let betResult = null;
        let mtsSelection = [];

        try {

            // creating transaction
            //transactionRunner = await this.transactionRunner.createTransaction();

            // starting transaction
            // pass the ISOLATION_LEVEL (default is READ COMMITTED)
            //await transactionRunner.startTransaction();

            //const transactionManager = transactionRunner.transactionManager;

            //5. create bet
            betData.client_id = bet.clientId;
            betData.user_id = bet.userId;
            betData.stake = bet.stake;
            betData.currency = clientSettings.currency;
            betData.bet_type = 1;
            betData.total_odd = totalOdds;
            betData.possible_win = possibleWin;
            betData.tax_on_stake = taxOnStake;
            betData.stake_after_tax = stakeAfterTax;
            betData.tax_on_winning = taxOnWinning;
            betData.winning_after_tax = payout;
            betData.total_bets = selections.length;
            betData.source = bet.source;
            betData.ip_address = bet.ipAddress;

            //let betResult = await this.saveBetWithTransactions(betData, transactionManager)
            betResult = await this.betRepository.save(betData)

            // create betslip
            for (const selection of selections) {

                if(selection.event_type.length == 0 ) {

                    selection.event_type = "match"
                }

                let betSlipData = new BetSlip()
                betSlipData.bet_id = betResult.id;
                betSlipData.client_id = bet.clientId;
                betSlipData.user_id = bet.userId;
                betSlipData.event_type = selection.event_type;
                betSlipData.event_id = selection.event_id;
                betSlipData.event_name = selection.event_name;
                betSlipData.producer_id = selection.producer_id;
                betSlipData.market_name = selection.market_name;
                betSlipData.market_id = selection.market_id;
                betSlipData.outcome_name = selection.outcome_name;
                betSlipData.outcome_id = selection.outcome_id;
                betSlipData.specifier = selection.specifier;
                betSlipData.odds = selection.odds
                betSlipData.status = BET_PENDING
                //await this.saveBetSlipWithTransactions(betSlipData,transactionManager);
                await this.betslipRepository.save(betSlipData);

                mtsSelection.push({
                    sport_id: selection.sport_id,
                    producer_id: parseInt(selection.producer_id),
                    market_id: parseInt(selection.market_id),
                    outcome_id: selection.outcome_id,
                    specifier: selection.specifier,
                    odds: parseFloat(selection.odds),
                    event_id: selection.event_id,
                    event_type: selection.event_type,
                    event_prefix: "sr",
                })

            }

            // committing transaction
            // await transactionRunner.commitTransaction();

        } catch (error) {

            this.logger.error("error saving bets "+error)
            // rollback transaction if something fails
            //if (transactionRunner) await transactionRunner.rollbackTransaction();

            //@TODO credit user

        } finally {

            // finally release the transaction
            //if (transactionRunner) await transactionRunner.releaseTransaction();
        }

        this.logger.info("bet created with id "+betData.id)

        // send bets to MTS
        let mtsBet = {
            bet_id: ""+betResult.id,
            limit_id: clientSettings.mts_limit_id,
            profile_id: bet.userId,
            ip_address: bet.ipAddress,
            stake: stakeAfterTax,
            source: 1,
            reply_prefix: 'betting_service',
            bets: mtsSelection,
            currency: clientSettings.currency,
        }

        let queueName = "mts.bet_pending"
        await this.amqpConnection.publish(queueName, queueName, mtsBet);
        this.logger.debug("published to "+queueName)

        return {status: 201, statusDescription: "Bet placed successfully", betId: betResult.id}
    }

    async getOdds(producerId: number, eventId: number, marketId: number, specifier: string, outcomeId: string): Promise<number> {

        if(producerId !== 3 ) {

            // check producer id
            let producerStatus = await this.getProducerStatus(producerId).toPromise()

            if (producerStatus.status === 0) {

                this.logger.error("Producer " + producerId + " | status " + producerStatus.status)
                return 0;
            }

        }

        let odds  = {
            producerID:producerId,
            eventID:eventId,
            marketID:marketId,
            outcomeID:outcomeId,
            specifier:specifier,
        }

        let vm = this;

        let oddStatus =  await this.getOddsStatus(odds).toPromise()

        this.logger.info(oddStatus)

        return oddStatus.statusName == 'Active' && oddStatus.active == 1 ? oddStatus.odds  : 0

    }

}

