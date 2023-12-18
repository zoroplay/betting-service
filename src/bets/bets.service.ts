import {ForbiddenException, Inject, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {EntityManager, Repository} from 'typeorm';
import {Bet} from '../entity/bet.entity';
import {BetSlip} from '../entity/betslip.entity';
import {Mts} from '../entity/mts.entity';
import {Setting} from '../entity/setting.entity';
import {Producer} from '../entity/producer.entity';
import {OddsLive} from '../entity/oddslive.entity';
import {OddsPrematch} from '../entity/oddsprematch.entity';
import {JsonLogger, LoggerFactory} from 'json-logger-service';
import {BET_LOST, BET_PENDING, BET_VOIDED, BET_WON, STATUS_LOST, STATUS_NOT_LOST_OR_WON, STATUS_WON, TRANSACTION_TYPE_PLACE_BET} from "../constants";
import {BetHistoryResponse} from "../grpc/interfaces/bet.history.response.interface";
import { PlaceBetResponse } from 'src/grpc/interfaces/placebet.response.interface';
import { BetSlipSelection } from 'src/grpc/interfaces/betslip.interface';
import { Observable, catchError, map } from 'rxjs';
import { ProducerstatusreplyInterface } from './interfaces/producerstatusreply.interface';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ClientGrpc } from '@nestjs/microservices';
import OddsService from "./odds.service.interface";
import { HttpService } from '@nestjs/axios';
import {GetOddsReply, OddsProbability} from "./interfaces/oddsreply.interface";
import {GetOddsRequest} from "./interfaces/oddsrequest.interface";
import axios from 'axios';
import { BetHistoryRequest } from 'src/grpc/interfaces/bet.history.request.interface';
import { Booking } from 'src/entity/booking.entity';
import { BookingSelection } from 'src/entity/booking.selection.entity';
import { BookingCode } from 'src/grpc/interfaces/booking.code.interface';
import { UpdateBetRequest } from 'src/grpc/interfaces/update.bet.request.interface';
import { UpdateBetResponse } from 'src/grpc/interfaces/update.bet.response.interface';
import * as dayjs from 'dayjs';

@Injectable()
export class BetsService {

    private oddsService: OddsService;

    private readonly logger: JsonLogger = LoggerFactory.createLogger(BetsService.name);

    constructor(
        //private transactionRunner: DbTransactionFactory,
        @InjectRepository(Bet)
        private betRepository: Repository<Bet>,
        @InjectRepository(Booking)
        private bookingRepository: Repository<Booking>,
        @InjectRepository(BetSlip)
        private betslipRepository: Repository<BetSlip>,
        @InjectRepository(Setting)
        private settingRepository: Repository<Setting>,
        @InjectRepository(BookingSelection)
        private bookingSelectionRepo: Repository<BookingSelection>,
        @InjectRepository(OddsLive)
        private liveRepository: Repository<OddsLive>,
        @InjectRepository(OddsPrematch)
        private prematchRepository: Repository<OddsPrematch>,

        private readonly entityManager: EntityManager,

        private readonly amqpConnection: AmqpConnection,

        private readonly httpService: HttpService,

        @Inject('ODDS_PACKAGE')
        private readonly client: ClientGrpc

    ) {

    }

    onModuleInit(): any {

        this.oddsService = this.client.getService<OddsService>('Odds');

    }

    async findAll({userId, status, to, from, clientId, perPage, page, betslipId}: BetHistoryRequest): Promise<BetHistoryResponse> {

        let response = {} as BetHistoryResponse;

        let bets: any = [];
        let total = 0;
        let last_page = 0;
        let start = 0;
        let left_records = 0;
        let totalStake = 0;
        let current_page = page - 1

        try {
            
            let params = [];
            params.push(clientId);
            let where = []

            if (userId > 0) {

                where.push("user_id = ? ")
                params.push(userId)

            }

            if (status === 'settled') {
                where.push("won != ? ")
                params.push(-1)
            } else if (status !== '') {
                where.push("won = ? ")
                params.push(status)
            }

            if(from && from !== '' ) {
                where.push("created >= ? ")
                params.push(from)
            }

            if(to && to !== '' ) {
                where.push("created <= ? ")
                params.push(to)
            }

            if(betslipId && betslipId !== '') {
                where.push('betslip_id = ?')
                params.push(betslipId);
            }

            // count games

            let queryCount = `SELECT count(id) as total FROM bet WHERE client_id = ? AND ${where.join(" AND ")} `

            let res = await this.entityManager.query(queryCount, params)

            if (res) {

                let result = res[0]
                total = result.total;
            }

            console.log('total | '+total)

            let sumQuery = `SELECT SUM(stake) as total_stake FROM bet WHERE client_id = ? AND ${where.join(" AND ")} `

            let resSum = await this.entityManager.query(sumQuery, params)

            if (resSum) {

                let result = res[0]
                totalStake = result.total_total;
            }
            // calculate offset

            if (total <= perPage) {

                last_page = 1

            } else {

                let totalPages = Math.ceil(total / perPage)

                if (total > perPage && total % perPage > 0) {

                    totalPages++
                }

                last_page = totalPages
            }


            let offset = 0

            if (current_page > 0) {

                offset = perPage * current_page

            } else {

                current_page = 0
                offset = 0
            }

            if (offset > total) {

                let a = current_page * perPage

                if (a > total) {

                    offset = (current_page - 1) * perPage

                } else {

                    offset = total - a
                }
            }

            start = offset + 1

            current_page++
            left_records = total - offset
            let off = offset - 1

            if (off > 0) {

                offset = off
            }

            let limit = ` LIMIT ${offset},${perPage}`

            let queryString = `SELECT id,user_id,username,betslip_id,stake,currency,bet_type,bet_category,total_odd,possible_win,source,total_bets,won,status,created FROM bet WHERE client_id = ? AND  ${where.join(' AND ')} ORDER BY created DESC ${limit}`

            bets = await this.entityManager.query(queryString,params)

        }
        catch (e) {

            this.logger.error(" error retrieving bets "+e.toString())
            throw e
        }

        let myBets = []

        for(let bet of bets ) {

            let slips : any

            try {
                const slipQuery = `SELECT id,event_id,event_type,event_name,event_date,market_name,specifier,outcome_name,odds,won,
                status,sport_name,category_name,tournament_name,match_id FROM bet_slip WHERE bet_id =? `
                slips = await this.entityManager.query(slipQuery,[bet.id])

            }
            catch (e) {

                this.logger.error(" error retrieving bet slips "+e.toString())
                continue
            }

            if(bet.won == STATUS_NOT_LOST_OR_WON) {

                bet.statusDescription = "Pending"
                bet.status = 0;
            }

            if(bet.won == STATUS_LOST) {

                bet.statusDescription = "Lost"
                bet.status = 2;
            }

            if(bet.won == STATUS_WON) {

                bet.statusDescription = "Won"
                bet.status = 1;
            }

            if(bet.won == BET_VOIDED) {

                bet.statusDescription = "Void"
                bet.status = 3;
            }

            bet.selections = [];
            if (slips.length > 0 ) {
                for (const slip of slips) {
                    let slipStatusDesc, slipStatus;
                    switch (slip.won) {
                        case STATUS_NOT_LOST_OR_WON:
                            slipStatusDesc = 'Pending'
                            slipStatus = 0;
                            break;
                        case STATUS_LOST:
                            slipStatusDesc = 'Lost'
                            slipStatus = 2;

                            break;
                        case STATUS_WON:
                            slipStatusDesc = 'Won'
                            slipStatus = 1;
                        default:
                            slipStatus  = 'Void'
                            slipStatus = 3;
                            break;
                    }
        
                    bet.selections.push({
                        eventName: slip.event_name,
                        eventDate: slip.event_date,
                        eventType: slip.event_type,
                        eventId: slip.event_id,
                        matchId: slip.match_id,
                        marketName: slip.market_name,
                        specifier: slip.specifier,
                        outcomeName: slip.outcome_name,
                        odds: slip.odds,
                        sport: slip.sport_name,
                        category: slip.category_name,
                        tournament: slip.tournament_name,
                        type: slip.is_live === 1 ? 'live' : 'pre',
                        statusDescription: slipStatusDesc,
                        status: slipStatus
                    })
                }
                
            }

            bet.id = bet.id;
            bet.userId = bet.user_id;
            bet.username = bet.username;
            bet.betslipId = bet.betslip_id;
            bet.totalOdd = bet.total_odd;
            bet.possibleWin = bet.possible_win;
            bet.betType = bet.bet_type;
            bet.betCategory = bet.bet_category;
            bet.totalSelections = bet.total_bets;

            myBets.push(bet)

        }
        response.lastPage = last_page
        response.from = start
        response.to = (start + total)
        response.remainingRecords = left_records
        response.bets = myBets;
        response.totalRecords = total;
        response.totalStake = totalStake;

        return response;
    }

    async placeBet(bet): Promise<PlaceBetResponse> {

        if (bet.clientId == 0)
            return {status: 400, message: "missing client id", success: false};

        if (bet.userId == 0)
            return {status: 400, message: "missing user id", success: false};

        if (bet.stake  === 0)
            return {status: 400, message: "missing stake", success: false};

        if (bet.source == undefined || bet.source.length === 0)
            return {status: 400, message: "missing bet source", success: false};

        if (bet.selections == undefined )
            return {status: 400, message: "missing selections", success: false};

        
        // get client settings
        var clientSettings = await this.settingRepository.findOne({
            where: {
                client_id: bet.clientId
            }
        });
        const {data: userRes} = await axios.get(clientSettings.url + '/api/wallet/balance/' +bet.userId)
                                    .catch(() => {
                                        throw new ForbiddenException('API not available');
                                    });
                                    
        let user;
        if (userRes.status) {
            user = userRes.data;
        }

        if(!user) 
            return {status: 400, message: "please login to procceed", success: false};

        

        if (user.available_balance < bet.stake)
            return {status: 400, message: "Insufficient balance ", success: false};

        let userSelection =  bet.selections
        // console.log("userSelection | "+JSON.stringify(userSelection))

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
            return {status: 400, message: "Minimum stake is " + clientSettings.minimum_stake, success: false};

        if (bet.stake > clientSettings.maximum_stake)
            bet.stake = clientSettings.maximum_stake;


        //2. odds validation
        var selections = [];
        var totalOdds = 1;

        let overallProbability = 1

        for (const slips of userSelection) {

            const selection = slips as BetSlipSelection

            if (selection.eventName.length === 0 )
                return {status: 400, message: "missing event name in your selection ", success: false};

            if (!selection.eventType)
                selection.eventType = "match";

            if (selection.eventId === 0 )
                return {status: 400, message: "missing event ID in your selection ", success: false};

            if (selection.producerId === 0 )
                return {status: 400, message: "missing producer id in your selection ", success: false};

            if (selection.sportId === 0 )
                return {status: 400, message: "missing sport id in your selection ", success: false};

            this.logger.info("got sportId "+selection.sportId)

            if (selection.marketId === 0 )
                return {status: 400, message: "missing market id in your selection ", success: false};

            if (selection.marketName.length === 0 )
                return {status: 400, message: "missing market name in your selection ", success: false};

            if (selection.outcomeName.length === 0 )
                return {status: 400, message: "missing outcome name in your selection ", success: false};

            if (selection.outcomeId.length === 0 )
                return {status: 400, message: "missing outcome id in your selection ", success: false};

            if (selection.specifier === undefined )
                return {status: 400, message: "missing specifier in your selection ", success: false};

            if (selection.odds === 0 )
                return {status: 400, message: "missing odds in your selection ", success: false};

            // get odds
            let odd = await this.getOdds(selection.producerId, selection.matchId, selection.marketId, selection.specifier, selection.outcomeId)

            if (odd === 0 ) { // || odd.active == 0 || odd.status !== 0 ) {

                this.logger.info("selection suspended " + JSON.stringify(selection))

                return {
                    message: "Your selection " + selection.eventName + " - " + selection.marketName + " is suspended",
                    status: 400,
                    success: false
                };

            } else {

                this.logger.info("Got Odds " + odd)

            }


            // get probability overallProbability
            let selectionProbability = await this.getProbability(selection.producerId, selection.matchId, selection.marketId, selection.specifier, selection.outcomeId)
            overallProbability = overallProbability * selectionProbability

            // selection.odds = odd
            selections.push({
                event_name: selection.eventName,
                event_date: selection.eventDate,
                selection_id: selection.selectionId,
                event_type: selection.eventType,
                event_prefix: "sr",
                producer_id: selection.producerId,
                sport_id: selection.sportId,
                event_id: selection.eventId,
                match_id: selection.matchId,
                market_id: selection.marketId,
                market_name: selection.marketName,
                specifier: selection.specifier,
                outcome_name: selection.outcomeName,
                outcome_id: selection.outcomeId,
                tournament_name: selection.tournament,
                category_name: selection.category,
                sport_name: selection.sport,
                odds: odd,
                probability:selectionProbability,
                is_live: selection.type === 'live' ? 1 : 0
            })

            totalOdds = totalOdds * parseFloat(selection.odds.toFixed(2))
        }

        if (selections.length === 0)
            return {status: 400, message: "missing selections", success: false};

        if (selections.length > clientSettings.maximum_selections)
            return {message: "maximum allowed selection is " + clientSettings.maximum_selections, status: 400, success: false};

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

            //4. create bet
            betData.client_id = bet.clientId;
            betData.user_id = bet.userId;
            betData.username = bet.username;
            betData.betslip_id = this.generateBetslipId()
            betData.stake = bet.stake;
            betData.currency = clientSettings.currency;
            betData.bet_category = bet.betType;
            betData.total_odd = totalOdds;
            betData.possible_win = possibleWin;
            betData.tax_on_stake = taxOnStake;
            betData.stake_after_tax = stakeAfterTax;
            betData.tax_on_winning = taxOnWinning;
            betData.winning_after_tax = payout;
            betData.total_bets = selections.length;
            betData.source = bet.source;
            betData.ip_address = bet.ipAddress;
            betData.probability = overallProbability

            //let betResult = await this.saveBetWithTransactions(betData, transactionManager)
            betResult = await this.betRepository.save(betData)

            // create betslip
            for (const selection of selections) {

                if(selection.event_type.length == 0 ) {

                    selection.event_type = "match"
                }

                // console.log(JSON.stringify(selection));

                let betSlipData = new BetSlip()
                betSlipData.bet_id = betResult.id;
                betSlipData.client_id = bet.clientId;
                betSlipData.user_id = bet.userId;
                betSlipData.event_type = selection.event_type;
                betSlipData.event_date = selection.event_date;
                betSlipData.event_id = selection.event_id;
                betSlipData.match_id = selection.match_id;
                betSlipData.selection_id = selection.selection_id;
                betSlipData.event_name = selection.event_name;
                betSlipData.sport_name = selection.sport_name;
                betSlipData.tournament_name = selection.tournament_name;
                betSlipData.category_name = selection.category_name;
                betSlipData.producer_id = selection.producer_id;
                betSlipData.market_name = selection.market_name;
                betSlipData.market_id = selection.market_id;
                betSlipData.outcome_name = selection.outcome_name;
                betSlipData.outcome_id = selection.outcome_id;
                betSlipData.specifier = selection.specifier;
                betSlipData.is_live = selection.is_live;
                betSlipData.odds = selection.odds
                betSlipData.status = BET_PENDING
                betSlipData.probability = selection.probability
                //await this.saveBetSlipWithTransactions(betSlipData,transactionManager);
                await this.betslipRepository.save(betSlipData);

                mtsSelection.push({
                    sport_id: parseInt(selection.sport_id),
                    producer_id: parseInt(selection.producer_id),
                    market_id: parseInt(selection.market_id),
                    outcome_id: selection.outcome_id,
                    specifier: selection.specifier,
                    odds: parseFloat(selection.odds),
                    event_id: selection.match_id,
                    event_type: selection.event_type,
                    event_prefix: "sr",
                })

            }

            //5. debit user by calling wallet service
            let debitPayload = {
                // currency: clientSettings.currency,
                amount: stake,
                user_id: bet.userId,
                client_id: bet.clientId,
                description: "Bet Deposit (Sport)",
                bet_id: betResult.betslip_id,
                source: betResult.source,
                type: 'Sport'
                // transaction_type: TRANSACTION_TYPE_PLACE_BET
            }

            axios.post(clientSettings.url + '/api/wallet/debit', debitPayload);
            // committing transaction
            // await transactionRunner.commitTransaction();

        } catch (error) {

            this.logger.error("error saving bets "+error)
            // rollback transaction if something fails
            //if (transactionRunner) await transactionRunner.rollbackTransaction();

            //@TODO credit user
            return {status: 400, message: "error accepting bets ", success: false};

        } finally {

            // finally release the transaction
            //if (transactionRunner) await transactionRunner.releaseTransaction();
        }

        this.logger.info("bet created with id "+betResult.id)

        if (betData) {
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

            // do debit
            this.logger.info("published to "+queueName)

            return {
                status: 201, 
                message: "Bet placed successfully", 
                data: {
                    betslipId: betResult.betslip_id,
                    stake: betResult.stake,
                    possibleWin: betResult.possible_win,
                    totalOdd: betResult.total_odd, 
                },
                success: true
            }
        } else {
            return {status: 400, message: "We are unable to accept this bet at the moment ", success: false};

        }
    }

    async bookBet(bet): Promise<PlaceBetResponse> {

        if (bet.clientId == 0)
            return {status: 400, message: "missing client id", success: false};

        if (bet.stake  === 0)
            return {status: 400, message: "missing stake", success: false};

        if (bet.source == undefined || bet.source.length === 0)
            return {status: 400, message: "missing bet source", success: false};

        if (bet.selections == undefined )
            return {status: 400, message: "missing selections", success: false};

        
        // get client settings
        var clientSettings = await this.settingRepository.findOne({
            where: {
                client_id: bet.clientId
            }
        });
        
        let userSelection =  bet.selections
        // console.log("userSelection | "+JSON.stringify(userSelection))

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
            return {status: 400, message: "Minimum stake is " + clientSettings.minimum_stake, success: false};

        if (bet.stake > clientSettings.maximum_stake)
            bet.stake = clientSettings.maximum_stake;


        //2. odds validation
        var selections = [];
        var totalOdds = 1;

        for (const slips of userSelection) {

            const selection = slips as BetSlipSelection

            if (selection.eventName.length === 0 )
                return {status: 400, message: "missing event name in your selection ", success: false};

            if (!selection.eventType)
                selection.eventType = "match";

            if (selection.matchId === 0 )
                return {status: 400, message: "missing event ID in your selection ", success: false};

            if (selection.producerId === 0 )
                return {status: 400, message: "missing producer id in your selection ", success: false};

            if (selection.marketId === 0 )
                return {status: 400, message: "missing market id in your selection ", success: false};

            if (selection.marketName.length === 0 )
                return {status: 400, message: "missing market name in your selection ", success: false};

            if (selection.outcomeName.length === 0 )
                return {status: 400, message: "missing outcome name in your selection ", success: false};

            if (selection.outcomeId.length === 0 )
                return {status: 400, message: "missing outcome id in your selection ", success: false};

            if (selection.specifier === undefined )
                return {status: 400, message: "missing specifier in your selection ", success: false};

            if (selection.odds === 0 )
                return {status: 400, message: "missing odds in your selection ", success: false};

            // get odds
            let odd = await this.getOdds(selection.producerId, selection.matchId, selection.marketId, selection.specifier, selection.outcomeId)

            if (odd === 0 ) { // || odd.active == 0 || odd.status !== 0 ) {

                this.logger.info("selection suspended " + JSON.stringify(selection))
                
                return {
                    message: "Your selection " + selection.eventName + " - " + selection.marketName + " is suspended",
                    status: 400,
                    success: false
                };
                

            } else {

                this.logger.info("Got Odds " + odd)

            }

            // selection.odds = odd
            selections.push({
                event_name: selection.eventName,
                event_date: selection.eventDate,
                selection_id: selection.selectionId,
                event_type: selection.eventType,
                event_prefix: "sr",
                producer_id: selection.producerId,
                sport_id: selection.sportId,
                event_id: selection.eventId,
                match_id: selection.matchId,
                market_id: selection.marketId,
                market_name: selection.marketName,
                specifier: selection.specifier,
                outcome_name: selection.outcomeName,
                outcome_id: selection.outcomeId,
                tournament_name: selection.tournament,
                category_name: selection.category,
                sport_name: selection.sport,
                odds: odd,
                is_live: selection.type === 'live' ? 1 : 0
            })
            totalOdds = totalOdds * parseFloat(selection.odds.toFixed(2))
        }

        if (selections.length === 0)
            return {status: 400, message: "missing selections", success: false};

        if (selections.length > clientSettings.maximum_selections)
            return {message: "maximum allowed selection is " + clientSettings.maximum_selections, status: 400, success: false};

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


        //let transactionRunner = null;
        const betData = new Booking();
        let betResult = null;

        try {

            // creating transaction
            //transactionRunner = await this.transactionRunner.createTransaction();

            // starting transaction
            // pass the ISOLATION_LEVEL (default is READ COMMITTED)
            //await transactionRunner.startTransaction();

            //const transactionManager = transactionRunner.transactionManager;

            //4. create bet
            betData.client_id = bet.clientId;
            betData.user_id = bet.userId;
            betData.betslip_id = this.generateBetslipId()
            betData.stake = bet.stake;
            betData.bet_type = bet.bet_type;
            betData.total_odd = totalOdds;
            betData.possible_win = possibleWin;
            betData.ip_address = bet.ipAddress;

            //let betResult = await this.saveBetWithTransactions(betData, transactionManager)
            betResult = await this.bookingRepository.save(betData)

            // create betslip
            for (const selection of selections) {

                if(selection.event_type.length == 0 ) {

                    selection.event_type = "match"
                }

                // console.log(JSON.stringify(selection));

                let betSlipData = new BookingSelection()
                betSlipData.booking = betResult;
                betSlipData.event_type = selection.event_type;
                betSlipData.event_date = selection.event_date;
                betSlipData.event_id = selection.event_id;
                betSlipData.match_id = selection.match_id;
                betSlipData.selection_id = selection.selection_id;
                betSlipData.event_name = selection.event_name;
                betSlipData.sport_name = selection.sport_name;
                betSlipData.tournament_name = selection.tournament_name;
                betSlipData.category_name = selection.category_name;
                betSlipData.producer_id = selection.producer_id;
                betSlipData.market_name = selection.market_name;
                betSlipData.market_id = selection.market_id;
                betSlipData.outcome_name = selection.outcome_name;
                betSlipData.outcome_id = selection.outcome_id;
                betSlipData.specifier = selection.specifier;
                // betSlipData.is_live = selection.is_live;
                betSlipData.odds = selection.odds
                //await this.saveBetSlipWithTransactions(betSlipData,transactionManager);
                await this.bookingSelectionRepo.save(betSlipData);

            }

            // committing transaction
            // await transactionRunner.commitTransaction();

        } catch (error) {

            this.logger.error("error saving bets "+error)
            // rollback transaction if something fails
            //if (transactionRunner) await transactionRunner.rollbackTransaction();

            //@TODO credit user
            return {status: 400, message: "error accepting bets ", success: false};

        } finally {

            // finally release the transaction
            //if (transactionRunner) await transactionRunner.releaseTransaction();
        }

        this.logger.info("booking created with id "+betResult.id)

        if (betData) {

            return {
                status: 201, 
                message: "Booking placed successfully", 
                data: {
                    betslipId: betResult.betslip_id,
                    stake: betResult.stake,
                    possibleWin: betResult.possible_win,
                    totalOdd: betResult.total_odd, 
                }, 
                success: true
            }
        } else {
            return {status: 400, message: "We are unable to accept this bet at the moment ", success: false};

        }
    }

    async getBooking({code, clientId}: BookingCode): Promise<PlaceBetResponse> {
        try {
            const booking = await this.bookingRepository.findOne({
                where: {betslip_id: code, client_id: clientId},
                relations: {selections: true}
            });

            if (booking) {
                
                const selections = [];

                if (booking.selections.length) {

                    for (const selection of booking.selections) {
                        let odd = await this.getOdds(selection.producer_id, selection.match_id, selection.market_id, selection.specifier, selection.outcome_id)

                        if (odd > 0 ) { // || odd.active == 0 || odd.status !== 0 ) {
                        
                            selections.push({
                                eventName: selection.event_name,
                                eventDate: selection.event_date,
                                eventType: selection.event_type,
                                eventId: selection.event_id,
                                matchId: selection.match_id,
                                producerId: selection.producer_id,
                                marketId: selection.market_id,
                                marketName: selection.market_name,
                                specifier: selection.specifier,
                                outcomeId: selection.outcome_id,
                                outcomeName: selection.outcome_name,
                                odds: selection.odds,
                                sport: selection.sport_name,
                                category: selection.category_name,
                                tournament: selection.tournament_name,
                                selectionId: selection.selection_id,
                            })
                        }
                    }
                } else {
                    const bookingSelections = await this.bookingSelectionRepo.find({where: {booking}});
                    if (bookingSelections.length) {
                        for (const selection of bookingSelections) {
                            selections.push({
                                eventName: selection.event_name,
                                eventDate: selection.event_date,
                                eventType: selection.event_type,
                                eventId: selection.event_id,
                                matchId: selection.match_id,
                                producerId: selection.producer_id,
                                marketId: selection.market_id,
                                marketName: selection.market_name,
                                specifier: selection.specifier,
                                outcomeId: selection.outcome_id,
                                outcomeName: selection.outcome_name,
                                odds: selection.odds,
                                sport: selection.sport_name,
                                category: selection.category_name,
                                tournament: selection.tournament_name,
                                selectionId: selection.selection_id,
                            })
                        }
                    }
                }
                const data = {
                    stake: booking.stake,
                    betslipId: booking.betslip_id,
                    totalOdd: booking.total_odd,
                    possibleWin: booking.possible_win,
                    source: 'mobile',
                    selections
                }

                return {status: 200, success: true, message: 'Booking code found', data };
            } else {
                return {status: 404, success: false, message: 'Booking code not found'};
            }
        } catch (e) {
            return {status: 500, success: false, message: 'Unable to fetch booking code'};
        }

    }

    async updateBet({betId, status, entityType, clientId }: UpdateBetRequest): Promise<UpdateBetResponse> {
        try {
            let updateStatus;

            if (entityType === 'bet') {

                switch (status) {
                    case 'won':
                       updateStatus = STATUS_WON;
                       // to-DO: credit user
                        break;
                    case 'lost':
                        updateStatus = STATUS_LOST;
                        // TO-DO: check if ticket was won
                        break;
                    case 'void': 
                        updateStatus = BET_VOIDED;
                        // TO-DO: return stake and credit user
                        break;
                    default:
                        updateStatus = STATUS_NOT_LOST_OR_WON;
                        break;
                }
                // update bet status
                await this.betRepository.update(
                    {
                        id: betId,
                    },
                    {
                        won: updateStatus,
                    }
                );
            } else {

                switch (status) {
                    case 'won':
                       updateStatus = STATUS_WON;
                        break;
                    case 'lost':
                        updateStatus = STATUS_LOST;
                        break;
                    case 'void': 
                        updateStatus = BET_VOIDED;
                        // TO-DO: recalculate odds
                        break;
                    default:
                        updateStatus = STATUS_NOT_LOST_OR_WON;
                        break;
                }
                // update selection status
                await this.betslipRepository.update(
                    {
                        id: betId,
                    },
                    {
                        won: updateStatus,
                    }
                );
            }

            return {status: 200, success: true, message: `${entityType} updated successfully` };

        } catch(e) {
            return {status: 500, success: false, message: 'Unable to carry out operations'};
        }
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

    getProducerStatus(producerID: number): Observable<ProducerstatusreplyInterface> {

        return this.oddsService.GetProducerStatus({producer: producerID})
    }

    getOddsStatus(data: GetOddsRequest ): Observable<GetOddsReply>  {

        return this.oddsService.GetOdds(data)
    }

    getOddsProbability(data: GetOddsRequest ): Observable<OddsProbability>  {

        return this.oddsService.GetProbability(data)
    }

    generateBetslipId() {
        const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        const charactersLength = characters.length;
        for ( let i = 0; i < 7; i++ ) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }

        return result;

    }

    async getProbability(producerId: number, eventId: number, marketId: number, specifier: string, outcomeId: string): Promise<number> {

        let odds  = {
            producerID:producerId,
            eventID:eventId,
            marketID:marketId,
            outcomeID:outcomeId,
            specifier:specifier,
        }

        try {

            let oddStatus =  await this.getOddsProbability(odds).toPromise()

            this.logger.info(oddStatus)

            return oddStatus.probability

        }catch (e) {

            this.logger.error(e.toString())
            return 1
        }

    }


}