import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Bet } from '../entity/bet.entity';
import { BetSlip } from '../entity/betslip.entity';
import { JsonLogger, LoggerFactory } from 'json-logger-service';
import {
  BET_CANCELLED,
  BET_CASHOUT,
  BET_LOST,
  BET_PENDING,
  BET_VOIDED,
  BET_WON,
  BETSLIP_PROCESSING_CANCELLED,
  BETSLIP_PROCESSING_COMPLETED,
  BETSLIP_PROCESSING_PENDING,
  BETSLIP_PROCESSING_VOIDED,
  STATUS_LOST,
  STATUS_NOT_LOST_OR_WON,
  STATUS_WON,
} from '../constants';
import {
  BetHistoryResponse,
} from './interfaces/bet.history.response.interface';
import { PlaceBetResponse } from './interfaces/placebet.response.interface';
import {
  BetSlipSelection,
} from './interfaces/betslip.interface';
import { Observable } from 'rxjs';
import { ProducerstatusreplyInterface } from './interfaces/producerstatusreply.interface';
import {AmqpConnection} from '@golevelup/nestjs-rabbitmq';
import { ClientGrpc } from '@nestjs/microservices';
import OddsService from './odds.service.interface';
import {
  GetOddsReply,
} from './interfaces/oddsreply.interface';
import { GetOddsRequest } from './interfaces/oddsrequest.interface';
import {
  BetHistoryRequest,
  FindBetRequest,
} from './interfaces/bet.history.request.interface';
// import {Booking} from 'src/entity/booking.entity';
// import {BookingSelection} from 'src/entity/booking.selection.entity';
// import {BookingCode} from './interfaces/booking.code.interface';
import { UpdateBetRequest } from './interfaces/update.bet.request.interface';
import { UpdateBetResponse } from './interfaces/update.bet.response.interface';
import { Winning } from 'src/entity/winning.entity';
import OutrightsService from './outrights.service.interface';
import { betTypeDescription, countItem, recalculateVoid } from 'src/commons/helper';
import { BonusService } from 'src/bonus/bonus.service';
import { WalletService } from 'src/wallet/wallet.service';
import { IdentityService } from 'src/identity/identity.service';
import { CashoutService } from 'src/bets/cashout.service';
import { CommonResponseObj } from 'src/proto/betting.pb';
import * as dayjs from 'dayjs';

@Injectable()
export class BetsService {
  private oddsService: OddsService;
  private outrightsService: OutrightsService;

  private readonly logger: JsonLogger = LoggerFactory.createLogger(
    BetsService.name,
  );

  constructor(
    //private transactionRunner: DbTransactionFactory,
    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,

    @InjectRepository(BetSlip)
    private betslipRepository: Repository<BetSlip>,

    @InjectRepository(Winning)
    private winningRepository: Repository<Winning>,

    private readonly entityManager: EntityManager,

    private readonly amqpConnection: AmqpConnection,

    @Inject('ODDS_PACKAGE')
    private readonly client: ClientGrpc,

    @Inject('OUTRIGHTS_PACKAGE')
    private readonly outrightsClient: ClientGrpc,

    private readonly bonusService: BonusService,

    private readonly walletService: WalletService,

    private readonly identityService: IdentityService,

    private readonly cashoutService: CashoutService
  ) {}

  onModuleInit(): any {
    this.oddsService = this.client.getService<OddsService>('Odds');
    this.outrightsService =
      this.outrightsClient.getService<OutrightsService>('Outrights');
  }

  async findAll({
    userId,
    status,
    to,
    from,
    clientId,
    perPage,
    page,
    betslipId,
    username,
  }: BetHistoryRequest): Promise<BetHistoryResponse> {
    let response = {} as BetHistoryResponse;

    let bets: any = [];
    let total = 0;
    let last_page = 0;
    let start = 0;
    let left_records = 0;
    let totalStake = 0;
    let current_page = page - 1;
    let noPerPage = perPage || 50;

    try {
      let params = [];
      params.push(clientId);
      let where = [];

      if (userId > 0) {
        where.push('b.user_id = ? ');
        params.push(userId);
      }

      if (status === 'settled') {
        where.push('b.status != ? ');
        params.push(0);
      } else if (status !== '') {
        where.push(`b.status = ?`);
        params.push(status);
      }

      if (from && from !== '') {
        where.push('b.created >= ? ');
        params.push(from);
      }

      if (to && to !== '') {
        where.push('b.created <= ? ');
        params.push(to);
      }

      if (betslipId && betslipId !== '') {
        where.push('b.betslip_id = ?');
        params.push(betslipId);
      }

      if (username && username !== '') {
        where.push('b.username = ?');
        params.push(username);
      }

      // count games

      let queryCount = `SELECT count(id) as total FROM bet b WHERE is_booked = 0 AND client_id = ? AND ${where.join(
        ' AND ',
      )} `;

      let res = await this.entityManager.query(queryCount, params);

      if (res) {
        let result = res[0];
        total = result.total;
      }


      let sumQuery = `SELECT SUM(stake) as total_stake FROM bet b WHERE is_booked = 0 AND client_id = ? AND ${where.join(
        ' AND ',
      )} `;

      let resSum = await this.entityManager.query(sumQuery, params);

      if (resSum) {
        let result = resSum[0];
        totalStake = result.total_stake;
      }
      // calculate offset

      if (total <= noPerPage) {
        last_page = 1;
      } else {
        let totalPages = Math.ceil(total / noPerPage);

        if (total > noPerPage && total % noPerPage > 0) {
          totalPages++;
        }

        last_page = totalPages;
      }

      let offset = 0;

      if (current_page > 0) {
        offset = noPerPage * current_page;
      } else {
        current_page = 0;
        offset = 0;
      }

      if (offset > total) {
        let a = current_page * noPerPage;

        if (a > total) {
          offset = (current_page - 1) * noPerPage;
        } else {
          offset = total - a;
        }
      }

      start = offset + 1;

      current_page++;
      left_records = total - offset;
      let off = offset - 1;

      if (off > 0) {
        offset = off;
      }

      let limit = ` LIMIT ${offset},${noPerPage}`;

      let queryString = `SELECT b.id,b.user_id,b.username,b.betslip_id,b.stake,b.currency,b.bet_type,b.bet_category,b.total_odd,b.possible_win,b.source,b.total_bets,
            b.won,b.status,b.created,w.winning_after_tax as winnings, b.sports, b.tournaments, b.events, b.markets, b.event_type, b.bet_category_desc, b.probability,
            b.bonus_id FROM bet b LEFT JOIN winning w ON w.bet_id = b.id WHERE is_booked = 0 AND b.client_id = ? AND  ${where.join(
              ' AND ',
            )} ORDER BY b.created DESC ${limit}`;

      bets = await this.entityManager.query(queryString, params);
    } catch (e) {
      this.logger.error(' error retrieving bets ' + e.toString());
      throw e;
    }

    let myBets = [];

    for (let bet of bets) {
      let slips: any;
      let pendingGames: any;
      // let settled: any;

      try {
        const slipQuery = `SELECT * FROM bet_slip WHERE bet_id =? `;
        slips = await this.entityManager.query(slipQuery, [bet.id]);

        const pendingGamesQry = `SELECT count(*) as pending FROM bet_slip WHERE bet_id =? AND status =?`;
        pendingGames = await this.entityManager.query(pendingGamesQry, [bet.id, BET_PENDING]);

      } catch (e) {
        this.logger.error(' error retrieving bet slips ' + e.toString());
        continue;
      }

      if (bet.status == BET_PENDING) {
        bet.statusDescription = 'Pending';
        bet.statusCode = 0;
      }

      if (bet.status == BET_LOST) {
        bet.statusDescription = 'Lost';
        bet.statusCode = 2;
      }

      if (bet.status == BET_WON) {
        bet.statusDescription = 'Won';
        bet.statusCode = 1;
      }

      if (bet.status == BET_VOIDED) {
        bet.statusDescription = 'Void';
        bet.statusCode = 3;
      }

      if (bet.status == BET_CANCELLED) {
        bet.statusDescription = 'Cancelled';
        bet.statusCode = 4;
      }

      if (bet.status == BET_CASHOUT) {
        bet.statusDescription = 'Cashout';
        bet.statusCode = 1;
      }

      bet.selections = [];
      let currentProbability = 1;
      let totalOdds = 1;
      let cashOutAmount = 0;
      let lostGames = 0;

      if (slips.length > 0) {
        for (const slip of slips) {

          let slipStatusDesc, slipStatus;
          switch (slip.won) {
            case STATUS_NOT_LOST_OR_WON:
              slipStatusDesc = 'Pending';
              slipStatus = 0;
              break;
            case STATUS_LOST:
              slipStatusDesc = 'Lost';
              slipStatus = 2;

              break;
            case STATUS_WON:
              slipStatusDesc = 'Won';
              slipStatus = 1;
              break;
            default:
              slipStatus = 'Void';
              slipStatus = 3;
              break;
          }


          if (slip.won === STATUS_LOST) {
             currentProbability = 0;
            lostGames += 1;
          } else if (slip.won !== STATUS_LOST && bet.status === BET_PENDING && (!bet.bonus_id || bet.bonus_id !== 0)) {
            // get probability for selection
            let selectionProbability = await this.cashoutService.getProbability(
              slip.producer_id,
              slip.event_prefix,
              slip.event_type,
              slip.match_id,
              slip.market_id,
              slip.specifier,
              slip.outcome_id,
              slip.odds
            );

            totalOdds = totalOdds * slip.odds;

            // if (selectionProbability)
            currentProbability = currentProbability * selectionProbability;
          }

          bet.selections.push({
            eventName: slip.event_name,
            eventDate: slip.event_date,
            eventType: slip.event_type,
            eventPrefix: slip.event_prefix,
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
            status: slipStatus,
            score: slip.score,
            htScore: slip.ht_score,
            id: slip.id
          });
        }
      }


      if ((!bet.bonus_id || bet.bonus_id !== 0) && bet.status === BET_PENDING && lostGames === 0)
        cashOutAmount = await this.cashoutService.calculateCashout(currentProbability, bet.probability, bet.stake, totalOdds);
      
      bet.id = bet.id;
      bet.userId = bet.user_id;
      bet.username = bet.username;
      bet.betslipId = bet.betslip_id;
      bet.totalOdd = bet.total_odd;
      bet.possibleWin = bet.possible_win;
      bet.betType = bet.bet_type;
      bet.eventType = bet.event_type;
      bet.betCategory = bet.bet_category;
      bet.totalSelections = bet.total_bets;
      bet.winnings = bet.winnings;
      bet.sports = bet.sports;
      bet.tournaments = bet.tournaments;
      bet.events = bet.events;
      bet.markets = bet.markets;
      bet.betCategoryDesc = bet.bet_category_desc;
      bet.cashOutAmount = cashOutAmount;
      bet.isBonusBet = bet.bonus_id ? true : false
      bet.pendingGames = pendingGames[0].pending;
      
      myBets.push(bet);
    }

    response.lastPage = last_page;
    response.from = start;
    response.to = start + total;
    response.remainingRecords = left_records;
    response.bets = myBets;
    response.totalRecords = total;
    response.totalStake = totalStake;

    return response;
  }

  async findSingle({
    clientId,
    betslipId,
  }: FindBetRequest): Promise<CommonResponseObj> {
    let bet = await this.betRepository
      .createQueryBuilder('bet')
      .select(
        'bet.id,bet.user_id,bet.username,bet.betslip_id,bet.stake,bet.currency,bet.bet_type,bet.bet_category,bet.total_odd,bet.possible_win,bet.source,bet.total_bets,bet.won,bet.status,bet.created,winning.winning_after_tax',
      )
      .leftJoin(Winning, 'winning', 'bet.id = winning.bet_id')
      .where('bet.betslip_id = :betslipId', { betslipId })
      .andWhere('bet.client_id = :clientId', { clientId })
      .getRawOne();

    if (bet) {
      // get bet items
      let slips = await this.betslipRepository.find({
        where: { bet_id: bet.id },
      });

      let data: any = {};
      data.selections = [];

      if (bet.status == BET_PENDING) {
        data.statusDescription = 'Pending';
        data.statusCode = 0;
      }

      if (bet.status == BET_LOST) {
        data.statusDescription = 'Lost';
        data.statusCode = 2;
      }

      if (bet.status == BET_WON) {
        data.statusDescription = 'Won';
        data.statusCode = 1;
      }

      if (bet.status == BET_VOIDED) {
        data.statusDescription = 'Void';
        data.statusCode = 3;
      }

      if (bet.status == BET_CANCELLED) {
        data.statusDescription = 'Cancelled';
        data.statusCode = 3;
      }

      if (bet.status == BET_CASHOUT) {
        data.statusDescription = 'Cashout';
        data.statusCode = 1;
      }

      if (slips.length > 0) {
        for (const slip of slips) {
          let slipStatusDesc, slipStatus;
          switch (slip.won) {
            case STATUS_NOT_LOST_OR_WON:
              slipStatusDesc = 'Pending';
              slipStatus = 0;
              break;
            case STATUS_LOST:
              slipStatusDesc = 'Lost';
              slipStatus = 2;
              break;
            case STATUS_WON:
              slipStatusDesc = 'Won';
              slipStatus = 1;
              break;
            default:
              slipStatus = 'Void';
              slipStatus = 3;
              break;
          }

          data.selections.push({
            eventName: slip.event_name,
            eventDate: slip.event_date,
            eventType: slip.event_type,
            eventPrefix: slip.event_prefix,
            eventId: slip.event_id,
            matchId: slip.match_id,
            marketName: slip.market_name,
            specifier: slip.specifier,
            outcomeName: slip.outcome_name,
            odds: slip.odds,
            sport: slip.sport_name,
            sportId: slip.sport_id,
            category: slip.category_name,
            tournament: slip.tournament_name,
            type: slip.is_live === 1 ? 'live' : 'pre',
            statusDescription: slipStatusDesc,
            status: slipStatus,
            score: slip.score,
            htScore: slip.ht_score,
            id: slip.id
          });
        }
      }

      data.id = bet.id;
      data.stake = bet.stake;
      data.created = dayjs(bet.created).format('YYYY-MM-DD HH:mm:ss');
      data.userId = bet.user_id;
      data.username = bet.username;
      data.betslipId = bet.betslip_id;
      data.totalOdd = bet.total_odd;
      data.possibleWin = bet.possible_win;
      data.betType = bet.bet_type;
      data.betCategory = bet.bet_category;
      data.totalSelections = bet.total_bets;
      data.winnings = bet.winning_after_tax;
      data.source = bet.source;

      return { success: true, message: 'Bet Found', data };
    } else {
      return { success: false, message: 'Betslip not found' };
    }
  }

  async placeBet(bet): Promise<PlaceBetResponse> {

    if (bet.clientId == 0)
      return { status: 400, message: 'missing client id', success: false };

    if (bet.stake === 0)
      return { status: 400, message: 'missing stake', success: false };

    if (bet.source == undefined || bet.source.length === 0)
      return { status: 400, message: 'missing bet source', success: false };

    if (bet.selections == undefined)
      return { status: 400, message: 'missing selections', success: false };

    //1. odds validation
    let selections = [];
    let totalOdds = 1;

    let overallProbability = 1;
    let userSelection = bet.selections;

    for (const slips of userSelection) {
      const selection = slips as BetSlipSelection;

      if (selection.eventName.length === 0)
        return {
          status: 400,
          message: 'missing event name in your selection ',
          success: false,
        };

      if (!selection.eventType) selection.eventType = 'match';

      if (!selection.eventPrefix) selection.eventPrefix = 'sr';

      // if(selection.eventId === 0 && selection.matchId > 0) {

      //     selection.eventId = selection.matchId
      // }

      // if (selection.eventId === 0 )
      //     return {status: 400, message: "missing event ID in your selection ", success: false};

      if (selection.producerId === 0)
        return {
          status: 400,
          message: 'missing producer id in your selection ',
          success: false,
        };

      if (selection.sportId === 0)
        return {
          status: 400,
          message: 'missing sport id in your selection ',
          success: false,
        };

      if (selection.marketId === 0)
        return {
          status: 400,
          message: 'missing market id in your selection ',
          success: false,
        };

      if (selection.marketName.length === 0)
        return {
          status: 400,
          message: 'missing market name in your selection ',
          success: false,
        };

      if (selection.outcomeName.length === 0)
        return {
          status: 400,
          message: 'missing outcome name in your selection ',
          success: false,
        };

      if (selection.outcomeId.length === 0)
        return {
          status: 400,
          message: 'missing outcome id in your selection ',
          success: false,
        };

      if (selection.specifier === undefined)
        return {
          status: 400,
          message: 'missing specifier in your selection ',
          success: false,
        };

      if (selection.odds === 0)
        return {
          status: 400,
          message: 'missing odds in your selection ',
          success: false,
        };

      // get odds
      let odd = await this.getOdds(
        selection.producerId,
        selection.eventPrefix,
        selection.eventType,
        selection.matchId,
        selection.marketId,
        selection.specifier,
        selection.outcomeId,
      );

      if (odd === 0) {
        // || odd.active == 0 || odd.status !== 0 ) {

        // this.logger.info("selection suspended " + JSON.stringify(selection))

        return {
          message:
            'Your selection ' +
            selection.eventName +
            ' - ' +
            selection.marketName +
            ' is suspended',
          status: 400,
          success: false,
        };
      } else {
        this.logger.info('Got Odds ' + odd);
      }
      // let odd = selection.odds;

      // get probability overallProbability
      let selectionProbability = await this.cashoutService.getProbability(
        selection.producerId,
        selection.eventPrefix,
        selection.eventType,
        selection.matchId,
        selection.marketId,
        selection.specifier,
        selection.outcomeId,
        odd
      );

      if (selectionProbability)
        overallProbability = overallProbability * selectionProbability;

      // selection.odds = odd
      selections.push({
        event_name: selection.eventName,
        event_date: selection.eventDate,
        selection_id: selection.selectionId,
        event_type: selection.eventType,
        event_prefix: selection.eventPrefix,
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
        probability: selectionProbability,
        is_live: selection.type === 'live' ? 1 : 0,
      });

      totalOdds = totalOdds * odd;

      bet.totalOdds = totalOdds;
    }

    // 2. Bet Validation

    let validationData;

    //TO-DO: Validate bet from identity service
    const validationRes = await this.identityService.validateBet(bet);
    if (!validationRes.success)
      return { status: 400, message: validationRes.message, success: false };

    validationData = validationRes.data;

    // }

    
    let bonusId = null;

    if (bet.useBonus) {
      //check if bonus is till valid
      const bonusRes = await this.bonusService.validateSelection(bet);
      if (bonusRes.success) {
        bonusId = bonusRes.id;
      } else {
        return { status: 400, message: bonusRes.message, success: false };
      }
    }

    //3. tax calculations

    let taxOnStake = 0;
    let taxOnWinning = 0;
    let stake = bet.stake;
    let stakeAfterTax = stake;

    // if (clientSettings.tax_on_stake > 0) {

    //     taxOnStake = clientSettings.tax_on_stake * bet.stake;
    //     stakeAfterTax = stake - taxOnStake;
    // }

    let possibleWin = stakeAfterTax * totalOdds + bet.maxBonus;
    let payout = possibleWin;

    // if (clientSettings.tax_on_winning > 0) {

    //     taxOnWinning = clientSettings.tax_on_winning * (possibleWin - stake);
    //     payout = possibleWin - taxOnWinning;
    // }
    if (payout > parseFloat(validationData.max_winning)) {
      payout = validationData.max_winning;
    }

    //let transactionRunner = null;
    const betData = new Bet();
    let betResult = null;
    let mtsSelection = [];
    let cashoutAmount = 0;
    try {
      //4. Calculate Cashout, if not bonus bet
      // if (!bonusId)
      //   cashoutAmount = await this.cashoutService.calculateCashout(overallProbability, overallProbability, bet.stake, 1);

      //5. create bet
      betData.client_id = bet.clientId;
      betData.user_id = bet.isBooking === 0 ? bet.userId : 0;
      betData.username = bet.isBooking === 0 ? bet.username : 'guest';
      betData.betslip_id = this.generateBetslipId();
      betData.stake = bet.stake;
      // betData.cash_out_amount = cashoutAmount;
      // betData.cash_out_status = cashoutAmount > 0 ? 1 : 0;
      betData.commission = validationData.commission;
      betData.currency = validationData.currency;
      betData.bet_category = bet.betType;
      betData.bet_category_desc = betTypeDescription(bet);
      betData.total_odd = totalOdds;
      betData.possible_win = payout;
      betData.tax_on_stake = taxOnStake;
      betData.stake_after_tax = stakeAfterTax;
      betData.tax_on_winning = taxOnWinning;
      betData.winning_after_tax = payout;
      betData.total_bets = selections.length;
      betData.source = bet.source;
      betData.ip_address = bet.ipAddress;
      betData.min_bonus = bet.minBonus;
      betData.max_bonus = bet.maxBonus;
      betData.sports = countItem(userSelection, 'sport', 'Sports');
      betData.events = countItem(userSelection, 'eventName', 'Events');
      betData.tournaments = countItem(
        userSelection,
        'tournament',
        'Tournaments',
      );
      betData.markets = countItem(userSelection, 'marketName', 'Markets');
      betData.event_type = bet.type;
      betData.probability = overallProbability || 0;
      betData.is_booked = bet.isBooking;
      betData.bonus_id = bonusId;

      //let betResult = await this.saveBetWithTransactions(betData, transactionManager)
      betResult = await this.betRepository.save(betData);

      // create betslip
      for (const selection of selections) {
        if (selection.event_type.length == 0) {
          selection.event_type = 'match';
        }

        if (selection.event_prefix.length == 0) {
          selection.event_prefix = 'sr';
        }


        let betSlipData = new BetSlip();
        betSlipData.bet_id = betResult.id;
        betSlipData.client_id = bet.clientId;
        betSlipData.user_id = bet.userId || 0;
        betSlipData.event_type = selection.event_type;
        betSlipData.event_prefix = selection.event_prefix;
        betSlipData.event_date = selection.event_date;
        betSlipData.event_id = selection.event_id;
        betSlipData.match_id = selection.match_id;
        betSlipData.selection_id = selection.selection_id;
        betSlipData.event_name = selection.event_name;
        betSlipData.sport_name = selection.sport_name;
        betSlipData.sport_id = selection.sport_id;
        betSlipData.tournament_name = selection.tournament_name;
        betSlipData.category_name = selection.category_name;
        betSlipData.producer_id = selection.producer_id;
        betSlipData.market_name = selection.market_name;
        betSlipData.market_id = selection.market_id;
        betSlipData.outcome_name = selection.outcome_name;
        betSlipData.outcome_id = selection.outcome_id;
        betSlipData.specifier = selection.specifier;
        betSlipData.is_live = selection.is_live;
        betSlipData.odds = selection.odds;
        betSlipData.status = BET_PENDING;
        betSlipData.probability = selection.probability || 0;

        //await this.saveBetSlipWithTransactions(betSlipData,transactionManager);
        await this.betslipRepository.save(betSlipData);

        if (bet.isBooking === 0) {
          // if it's not booking, submit to mts
          mtsSelection.push({
            sport_id: parseInt(selection.sport_id),
            producer_id: parseInt(selection.producer_id),
            market_id: parseInt(selection.market_id),
            outcome_id: selection.outcome_id,
            specifier: selection.specifier,
            odds: parseFloat(selection.odds),
            event_id: parseInt(selection.match_id),
            event_type: selection.event_type,
            event_prefix: selection.event_prefix,
          });
        }
      }

      if (bet.isBooking === 0) {
        // if it's not booking, debit user

        //6. debit user by calling wallet service
        let debitPayload = {
          // currency: clientSettings.currency,
          amount: ''+stake,
          userId: bet.userId,
          username: bet.username,
          clientId: bet.clientId,
          subject: 'Bet Deposit (Sport)',
          description: betResult.betslip_id,
          source: betResult.source,
          wallet: 'sport',
          channel: 'Internal',
          // transaction_type: TRANSACTION_TYPE_PLACE_BET
        };

        if (bet.useBonus) {
          debitPayload.subject = 'Bonus Bet (Sport)';
          debitPayload.wallet = 'sport-bonus';
          bet.bonusId = bonusId;
          bet.betId = betResult.id;
          await this.bonusService.placeBet(bet);
        }

        await this.walletService.debit(debitPayload);

        // axios.post(clientSettings.url + '/api/wallet/debit', debitPayload);
        // committing transaction
        // await transactionRunner.commitTransaction();
      }
    } catch (error) {
      this.logger.error('error saving bets ' + error);
      // rollback transaction if something fails
      //if (transactionRunner) await transactionRunner.rollbackTransaction();

      //@TODO credit user
      return { status: 400, message: 'error accepting bets ', success: false };
    } finally {
      // finally release the transaction
      //if (transactionRunner) await transactionRunner.releaseTransaction();
    }

    // this.logger.info("bet created with id "+betResult.id)

    if (betData) {
      if (bet.isBooking === 0) {
        // if it's not booking, submit to mts

        // send bets to MTS
        let mtsBet = {
          bet_id: '' + betResult.id,
          limit_id: 5071, //clientSettings.mts_limit_id,
          profile_id: bet.userId,
          ip_address: bet.ipAddress,
          stake: stakeAfterTax,
          source: 1,
          reply_prefix: 'betting_service',
          bets: mtsSelection,
          currency: validationData.currency,
        };

        // by pass mts acceptance
        // let betStatus = new BetStatus()
        // betStatus.status = 1
        // betStatus.bet_id = betResult.id
        // betStatus.description = "By passed MTS acceptance"
        // await this.betStatusRepository.upsert(betStatus,['status','description'])

        let queueName = 'mts.bet_pending';
        await this.amqpConnection.publish(queueName, queueName, mtsBet);
        this.logger.info('published to ' + queueName);
      }

      // do debit
      return {
        status: 201,
        message: 'Bet placed successfully',
        data: {
          betslipId: betResult.betslip_id,
          stake: betResult.stake,
          possibleWin: betResult.possible_win,
          totalOdd: betResult.total_odd,
        },
        success: true,
      };
    } else {
      return {
        status: 400,
        message: 'We are unable to accept this bet at the moment ',
        success: false,
      };
    }
  }

  async updateBet({
    betId,
    status,
    entityType,
    selectionId,
  }: UpdateBetRequest): Promise<UpdateBetResponse> {
    try {
      let wonStatus: number, betStatus: number;

      const bet = await this.betRepository.findOne({ where: { id: betId } });
      

      if (entityType === 'bet') {
        switch (status) {
          case 'won':
            wonStatus = STATUS_WON;
            betStatus = BET_WON;
            // to-DO: credit user
            let winCreditPayload = {
              amount: ''+bet.winning_after_tax,
              userId: bet.user_id,
              username: bet.username,
              clientId: bet.client_id,
              subject: 'Sport Win',
              description: 'Bet betID ' + bet.betslip_id,
              source: bet.source,
              wallet: 'sport',
              channel: 'Internal',
            };

            if (bet.bonus_id) {
              winCreditPayload.wallet = 'sport-bonus';
              await this.bonusService.settleBet({
                clientId: bet.client_id,
                betId: bet.id.toString(),
                amount: bet.winning_after_tax,
                status: BET_WON,
              });
            }

            let winning = new Winning();
            winning.bet_id = bet.id
            winning.user_id = bet.user_id
            winning.client_id = bet.client_id
            winning.currency = bet.currency
            winning.tax_on_winning = bet.tax_on_winning
            winning.winning_before_tax = bet.possible_win
            winning.winning_after_tax = bet.winning_after_tax
            await this.winningRepository.upsert(winning, ['bet_id'])
            // credit user wallet
            await this.walletService.credit(winCreditPayload);

            break;
          case 'lost':
            wonStatus = STATUS_LOST;
            betStatus = BET_LOST;
            // TO-DO: check if ticket was won

            if (bet.bonus_id) {
              await this.bonusService.settleBet({
                clientId: bet.client_id,
                betId: bet.id.toString(),
                amount: 0,
                status: BET_LOST,
              });
            }
            break;
          case 'void':
            wonStatus = STATUS_NOT_LOST_OR_WON;
            betStatus = BET_VOIDED;
            // revert the stake
            let voidCreditPayload = {
              amount: ''+bet.stake,
              userId: bet.user_id,
              clientId: bet.client_id,
              description: 'Bet betID ' + bet.betslip_id + ' was cancelled',
              subject: 'Bet Cancelled',
              source: bet.source,
              wallet: 'sport',
              channel: 'Internal',
              username: bet.username,
            };

            if (bet.bonus_id) {
              voidCreditPayload.wallet = 'sport-bonus';
              await this.bonusService.settleBet({
                clientId: bet.client_id,
                betId: bet.id.toString(),
                amount: 0,
                status: BET_VOIDED,
              });
            }
            // credit user wallet
            await this.walletService.credit(voidCreditPayload);
            // update betslips to cancelled
            await this.betslipRepository.update({bet_id: betId}, {won: STATUS_NOT_LOST_OR_WON, status: BETSLIP_PROCESSING_VOIDED});

            break;
          case 'cancel':
            wonStatus = STATUS_NOT_LOST_OR_WON;
            betStatus = BET_CANCELLED;
            // revert the stake
            let cancelCreditPayload = {
              amount: ''+bet.stake,
              userId: bet.user_id,
              clientId: bet.client_id,
              description: 'Bet betID ' + bet.betslip_id + ' was cancelled',
              subject: 'Bet Cancelled',
              source: bet.source,
              wallet: 'sport',
              channel: 'Internal',
              username: bet.username,
            };

            if (bet.bonus_id) {
              cancelCreditPayload.wallet = 'sport-bonus';
              await this.bonusService.settleBet({
                clientId: bet.client_id,
                betId: bet.id.toString(),
                amount: 0,
                status: BET_VOIDED,
              });
            }
            // credit user wallet
            await this.walletService.credit(cancelCreditPayload);
            // update betslips to cancelled
            await this.betslipRepository.update({bet_id: betId}, {won: STATUS_NOT_LOST_OR_WON, status: BETSLIP_PROCESSING_CANCELLED})
            break;
          default:
            wonStatus = STATUS_NOT_LOST_OR_WON;
            betStatus = BET_PENDING;
            break;
        }
        // update bet status
        await this.betRepository.update(
          {
            id: betId,
          },
          {
            won: wonStatus,
            status: betStatus,
            settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            settlement_type: 'manual'
          },
        );
      } else {
        const slip = await this.betslipRepository.findOne({where: {id: selectionId}})
        switch (status) {
          case 'won':
            wonStatus = STATUS_WON;
            betStatus = BETSLIP_PROCESSING_COMPLETED
            break;
          case 'lost':
            betStatus = BETSLIP_PROCESSING_COMPLETED;
            wonStatus = STATUS_LOST;
            break;
          case 'void':
            betStatus = BETSLIP_PROCESSING_COMPLETED;
            wonStatus = STATUS_NOT_LOST_OR_WON
            // TO-DO: recalcumlate odds
            const {possibleWin, newOdds} = recalculateVoid({bet: bet, odd: slip.odds  });

            await this.betRepository.update(
              {
                  id: bet.id, // confirm if ID is present
              },
              {
                  possible_win: possibleWin,
                  winning_after_tax: possibleWin,
                  tax_on_winning: 0,
                  total_odd: newOdds,
              });

              await this.betslipRepository.update(
                {
                  id: selectionId,
                },
                {
                  odds: 1,
                  won: betStatus,
                  status: wonStatus,
                  settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                  settlement_type: 'manual',
                },
              );

              return {
                status: 200,
                success: true,
                message: `${entityType} updated successfully`,
              };
          default:
            wonStatus = STATUS_NOT_LOST_OR_WON;
            betStatus = BETSLIP_PROCESSING_PENDING
            break;
        }
        // update selection status
        await this.betslipRepository.update(
          {
            id: selectionId,
          },
          {
            won: wonStatus,
            status: betStatus,
            settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            settlement_type: 'manual',
          },
        );
      }

      return {
        status: 200,
        success: true,
        message: `${entityType} updated successfully`,
      };
    } catch (e) {
      return {
        status: 500,
        success: false,
        message: 'Unable to carry out operations',
      };
    }
  }

  async findCoupon({
    betslipId,
    clientId,
  }: FindBetRequest): Promise<CommonResponseObj> {
    try {
      const booking = await this.betRepository.findOne({
        where: { betslip_id: betslipId, client_id: clientId },
      });

      if (booking) {
        const slips = await this.betslipRepository.find({
          where: { bet_id: booking.id },
        });
        const selections = [];

        if (slips.length) {
          for (const selection of slips) {
            let odd = await this.getOdds(
              selection.producer_id,
              selection.event_prefix,
              selection.event_type,
              selection.match_id,
              selection.market_id,
              selection.specifier,
              selection.outcome_id,
            );

            if (odd > 0) {
              // || odd.active == 0 || odd.status !== 0 ) {

              selections.push({
                eventName: selection.event_name,
                eventId: selection.event_id,
                eventPrefix: selection.event_prefix,
                eventDate: selection.event_date,
                eventType: selection.event_type,
                matchId: selection.match_id,
                producerId: selection.producer_id,
                marketId: selection.market_id,
                marketName: selection.market_name,
                specifier: selection.specifier,
                outcomeId: selection.outcome_id,
                outcomeName: selection.outcome_name,
                odds: selection.odds,
                sport: selection.sport_name,
                sportId: selection.sport_id,
                category: selection.category_name,
                tournament: selection.tournament_name,
                selectionId: selection.selection_id,
                id: selection.id
              });
            }
          }
        }

        const data = {
          stake: booking.stake,
          betslipId: booking.betslip_id,
          totalOdd: booking.total_odd,
          possibleWin: booking.possible_win,
          source: 'mobile',
          selections,
        };

        return { success: true, message: 'Booking code found', data };
      } else {
        return { success: false, message: 'Booking code not found' };
      }
    } catch (e) {
      return { success: false, message: 'Unable to fetch booking code' };
    }
  }

  async getOdds(
    producerId: number,
    eventPrefix: string,
    eventType: string,
    eventId: number,
    marketId: number,
    specifier: string,
    outcomeId: string,
  ): Promise<number> {
    if (producerId !== 3) {
      // check producer id
      let producerStatus = await this.getProducerStatus(producerId).toPromise();

      if (producerStatus.status === 0) {
        this.logger.error(
          'Producer ' + producerId + ' | status ' + producerStatus.status,
        );
        return 0;
      }
    }

    let odds = {
      eventType: eventType,
      eventPrefix: eventPrefix,
      eventID: eventId,
      producerID: producerId,
      marketID: marketId,
      outcomeID: outcomeId,
      specifier: specifier,
    };

    let vm = this;

    let oddStatus = {} as GetOddsReply;

    if (eventType.toLowerCase() === 'match')
      oddStatus = await this.getOddsStatus(odds).toPromise();
    else oddStatus = await this.getOutrightsOddsStatus(odds).toPromise();

    // this.logger.info(oddStatus)

    return oddStatus.statusName == 'Active' && oddStatus.active == 1
      ? oddStatus.odds
      : 0;
  }

  getProducerStatus(
    producerID: number,
  ): Observable<ProducerstatusreplyInterface> {
    return this.oddsService.GetProducerStatus({ producer: producerID });
  }

  getOddsStatus(data: GetOddsRequest): Observable<GetOddsReply> {
    return this.oddsService.GetOdds(data);
  }

  getOutrightsOddsStatus(data: GetOddsRequest): Observable<GetOddsReply> {
    return this.outrightsService.GetOdds(data);
  }

  generateBetslipId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < 7; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
  }
}
