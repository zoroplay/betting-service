import {Body, Controller, Get, Inject, OnModuleInit, Param, Post, Put} from '@nestjs/common';
import {BetsService} from './bets.service';
import OddsService from "./odds.service.interface";
import {GetOddsRequest} from "./interfaces/oddsrequest.interface";
import {ClientGrpc} from "@nestjs/microservices";
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
import {isArray} from "util";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {Observable} from "rxjs";
import {BET_PENDING, TRANSACTION_TYPE_PLACE_BET, TRANSACTION_TYPE_WINNING} from "../constants";
import {AmqpConnection} from "@golevelup/nestjs-rabbitmq";

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
    async create(@Body() data: any): Promise<any> {

        return this.createBet(data);

    }

    onModuleInit(): any {

        this.oddsService = this.client.getService<OddsService>('Odds');

    }

    @Get(':id')
    async getProducerStatus1(@Param('id') id: number) {

        return this.getProducerStatus(id)
    }

    @Put()
    async getOddsStatus1(@Body() data: GetOddsRequest ) {

        return this.getOddsStatus(data)
    }

    getProducerStatus(producerID: number): Observable<ProducerstatusreplyInterface> {

        return this.oddsService.GetProducerStatus({producer: producerID})
    }

    getOddsStatus(data: GetOddsRequest ): Observable<GetOddsReply>  {

        return this.oddsService.GetOdds(data)
    }

    async createBet(bet: any): Promise<any> {


        this.logger.info("received bet " + JSON.stringify(bet))

        //1. fields validations

        if (bet.client_id == undefined || parseInt(bet.client_id) === 0)
            return {status: 400, data: "missing client id"};

        if (bet.user_id == undefined || parseInt(bet.user_id) === 0)
            return {status: 400, data: "missing user id"};

        if (bet.stake == undefined || parseFloat(bet.stake) === 0)
            return {status: 400, data: "missing stake"};

        if (bet.currency == undefined || bet.currency.length === 0)
            return {status: 400, data: "missing currency"};

        if (bet.source == undefined || bet.source.length === 0)
            return {status: 400, data: "missing bet source"};

        if (bet.selections == undefined || !isArray(bet.selections))
            return {status: 400, data: "missing selections"};

        let userSelection =  bet.selections

        if (userSelection.length === 0)
            return {status: 400, data: "missing selections"};


        // get client settings
        var clientSettings = await this.settingRepository.findOne({
            where: {
                client_id: bet.client_id
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
        if (parseFloat(bet.stake) < clientSettings.minimum_stake)
            return {status: 400, data: "Minimum stake is " + clientSettings.minimum_stake};

        if (parseFloat(bet.stake) > clientSettings.maximum_stake)
            bet.stake = clientSettings.maximum_stake;


        //2. odds validation
        var selections = [];
        var totalOdds = 1;

        for (const selection of bet.selections) {

            let proceed = false;

            if (selection.event_name.length > 0 &&
                selection.event_type.length > 0 &&
                parseInt(selection.event_id) > 0 &&
                parseInt(selection.producer_id) > 0 &&
                parseInt(selection.market_id) > 0 &&
                selection.market_name.length > 0 &&
                selection.outcome_name.length > 0 &&
                selection.outcome_id.length > 0 &&
                parseFloat(selection.odds) > 0) {

                proceed = true;
            }

            if (!proceed) {

                continue;
            }

            // get odds
            var odd = await this.getOdds(selection.producer_id, selection.event_id, selection.market_id, selection.specifier, selection.outcome_id)

            if (odd === 0 ) { // || odd.active == 0 || odd.status !== 0 ) {

                this.logger.info("selection suspended " + JSON.stringify(selection))
                return {
                    data: "Your selection " + selection.event_name + " - " + selection.market_name + " is suspended",
                    status: 400
                };

            }

            selection.odds = odd
            selection.event_prefix = "sr"
            selections.push(selection)
            totalOdds = totalOdds * odd
        }

        if (selections.length === 0)
            return {status: 400, data: "missing selections"};

        if (selections.length > clientSettings.maximum_selections)
            return {message: "maximum allowed selection is " + clientSettings.maximum_selections, status: 400};


        //3. tax calculations

        let taxOnStake = 0;
        let taxOnWinning = 0;
        let stake = parseFloat(bet.stake);
        let stakeAfterTax = stake;


        if (clientSettings.tax_on_stake > 0) {

            taxOnStake = clientSettings.tax_on_stake * parseFloat(bet.stake);
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
            currency: bet.currency,
            amount: stake,
            user_id: bet.user_id,
            client_id: bet.client_id,
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
            betData.client_id = bet.client_id;
            betData.user_id = bet.user_id;
            betData.stake = bet.stake;
            betData.currency = bet.currency;
            betData.bet_type = bet.bet_type;
            betData.total_odd = totalOdds;
            betData.possible_win = possibleWin;
            betData.tax_on_stake = taxOnStake;
            betData.stake_after_tax = stakeAfterTax;
            betData.tax_on_winning = taxOnWinning;
            betData.winning_after_tax = payout;
            betData.total_bets = selections.length;
            betData.source = bet.source;

            //let betResult = await this.saveBetWithTransactions(betData, transactionManager)
            betResult = await this.betRepository.save(betData)

            // create betslip
            for (const selection of selections) {

                if(selection.event_type.length == 0 ) {

                    selection.event_type = "match"
                }

                let betSlipData = new BetSlip()
                betSlipData.bet_id = betResult.id;
                betSlipData.client_id = bet.client_id;
                betSlipData.user_id = bet.user_id;
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
                    sport_id: parseInt(bet.sport_id),
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
            profile_id: parseInt(bet.user_id),
            ip_address: bet.ip_address,
            stake: stakeAfterTax,
            source: 1,
            reply_prefix: 'betting_service',
            bets: mtsSelection
        }

        let queueName = "mts.bet_pending"
        await this.amqpConnection.publish(queueName, queueName, mtsBet);

        return mtsBet
    }

    async getOdds(producerId: number, eventId: number, marketId: number, specifier: string, outcomeId: string): Promise<number> {

        // check producer id
        let producerStatus = await this.getProducerStatus(producerId).toPromise()

        if (producerStatus.status === 0) {

            this.logger.error("Producer " + producerId + " | status " + producerStatus.status)
            return 0;
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

        return oddStatus.status === 0 ? oddStatus.odds : 0

    }

}

