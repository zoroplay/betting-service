import { Injectable } from '@nestjs/common';
import { JsonLogger, LoggerFactory } from 'json-logger-service';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Settlement } from '../../entity/settlement.entity';
import { BetSlip } from '../../entity/betslip.entity';
import { Setting } from '../../entity/setting.entity';
import {
  BET_LOST,
  BET_PENDING,
  BET_VOIDED,
  BETSLIP_PROCESSING_CANCELLED,
  BETSLIP_PROCESSING_COMPLETED,
  BETSLIP_PROCESSING_SETTLED,
  BETSLIP_PROCESSING_VOIDED,
  STATUS_LOST,
  STATUS_NOT_LOST_OR_WON,
  STATUS_WON,
  CASH_OUT_STATUS_PENDING,
} from '../../constants';
import { Bet } from '../../entity/bet.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cronjob } from '../../entity/cronjob.entity';
import { BetClosure } from '../../entity/betclosure.entity';
import { BetsService } from '../../bets/bets.service';
import { Probability } from 'src/bets/interfaces/betslip.interface';

@Injectable()
export class BetSettlementService {
  private readonly logger: JsonLogger = LoggerFactory.createLogger(
    BetSettlementService.name,
  );

  constructor(
    //private transactionRunner: DbTransactionFactory,
    @InjectRepository(BetSlip)
    private betslipRepository: Repository<BetSlip>,

    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,

    @InjectRepository(Setting)
    private settingRepository: Repository<Setting>,

    @InjectRepository(Settlement)
    private settlementRepository: Repository<Settlement>,

    @InjectRepository(Cronjob)
    private cronJobRepository: Repository<Cronjob>,

    @InjectRepository(BetClosure)
    private betClosureRepository: Repository<BetClosure>,

    private readonly entityManager: EntityManager,

    private readonly betsService: BetsService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS) // run every 2 seconds
  processCashOutUpdate() {
    // const vm = this;

    this.taskProcessCashOutUpdate().then(function () {
      // vm.logger.info("done running processBetSettlement ")
    });
  }

  async taskProcessCashOutUpdate() {
    const taskName = 'bet.cashout';

    // check if similar job is running
    // get client settings
    const cronJob = await this.cronJobRepository.findOne({
      where: {
        name: taskName,
        status: 1,
      },
    });

    if (cronJob !== null && cronJob.id > 0) {
      //this.logger.info('another '+taskName+' job is already running');
      return;
    }

    // update status to running
    // create cashout
    const task = new Cronjob();
    task.name = taskName;
    task.status = 1;
    await this.cronJobRepository.upsert(task, ['status']);

    // Get Bet with Cashout pending status,
    const rows = await this.entityManager.query(
      'SELECT id FROM bet where cash_out_status = ' + CASH_OUT_STATUS_PENDING,
    );
    for (const row of rows) {
      // loop through all and calculate cashout amount for each
      const id = row.id;
      this.logger.info('start updating betID ' + id);
      await this.calculateBetCashOut(id);
      await this.entityManager.query(
        'UPDATE settlement SET processed = 1 WHERE id = ' + id,
      );
      this.logger.info('done processing settlementID ' + id);
    }

    task.name = taskName;
    task.status = 0;
    await this.cronJobRepository.upsert(task, ['status']);
  }

  @Cron(CronExpression.EVERY_MINUTE) // run every Minute
  async getPendingBetsUpdateCashoutAmount() {
    const pendingBets = await this.betRepository.find({
      where: {
        status: BET_PENDING,
      },
    });
    if (pendingBets.length > 0) {
      pendingBets.forEach(async (bet) => {
        const amount = await this.calculateBetCashOut(bet.id);
        bet.cash_out_amount = amount;
        this.betRepository.save(bet);
      });
    }
  }

  async calculateBetCashOut(betID: number): Promise<number> {
    // get client settings
    const bet = await this.betRepository.findOne({
      where: {
        id: betID,
      },
      relations: {
        betSlips: true,
      },
    });

    // Custom Cashout fixed probability : .85 —> Event Not started

    // Cashout With Additional Profit :
    // Bets placed before game starts—> Pre-Match
    // Simple Cashout :
    // Bets placed while games are ongoing—> Live Match
    // get probability at ticket time
    const probs: Probability =
      await this.betsService.getProbabilityFromBetID(betID);
    const probabilityAtTicketTime = probs.initialProbability / 100;
    const currentProbability = probs.currentProbability / 100;
    // get current probability
    const fixedProbability = 85 / 100;
    // check if bet event has not started
    // const eventNotStarted = true;
    // if (eventNotStarted == true) {
    //   return this.getCashoutWithFixedProbability(bet, fixedProbability);
    // }
    //async getProbabilityFromBetID(betID: number)
    const wonEventOdds = bet.betSlips
      .filter((slip) => slip.won > 0)
      .map((slip) => slip.odds);

    const bLostEventOdds = bet.betSlips.some(
      (slip) => slip.status === STATUS_LOST,
    );

    if (bLostEventOdds) {
      // if one event is lost return cash out value to zero
      return 0;
    }
    // get won event odds
    if (wonEventOdds.length <= 0) {
      // if no event is won yet use simple cashout i.e event not started
      return this.getCashoutWithFixedProbability(bet, fixedProbability);
    } else {
      const PRE_MATCH = 'pre-match';
      const LIVE = 'live';
      switch (bet.event_type) {
        case PRE_MATCH:
          return this.getSimpleCashout(bet, currentProbability);
          break;
        case LIVE:
          return this.getCashoutWithAdditionalProfit(
            bet,
            wonEventOdds,
            currentProbability,
            probabilityAtTicketTime,
          );
          break;
      }
    }

    // if bet is pre
    // ➔ Simple Cashout returns punters a purely probabilistic Cashout value.

    // if bet is live
    // ➔ Cashout With Additional Expected Profit is an option that gives the bookmaker lower cashout values
    // to offer, than are calculated via Simple Cashout.

    // ➔ Advanced Cashout Compensating For high Implied Margin describes a way to offer less aggressive
    // cashout offers for losing tickets.
    return 1;
  }

  async resultBet(bet: any, setting: Setting): Promise<any> {
    console.log(JSON.stringify(bet, undefined, 2));

    let processing_status = BET_PENDING;
    let hasVoidedSlip = false;

    // check if any match was voided
    for (const b of bet.BetSlips) {
      if (b.VoidFactor > 0) {
        hasVoidedSlip = true;

        // update voided bet_slip
        await this.betslipRepository.update(
          {
            id: b.ID,
            status: BETSLIP_PROCESSING_SETTLED,
          },
          {
            odds: b.VoidFactor,
            won: STATUS_WON,
            status: BETSLIP_PROCESSING_VOIDED,
          },
        );

        // recalculate odds
        const newOdds = (bet.total_odd / b.Odd) * b.VoidFactor;

        bet.total_odd = newOdds;

        // calculate new net win
        const netWin = newOdds * bet.stake_after_tax;

        // calculate profit
        const profit = netWin - bet.stake_after_tax;

        // calculate tax & possible win
        const winningTaxPercentage = setting.tax_on_winning / 100;

        const withHoldingTax = profit * winningTaxPercentage;

        let possibleWin = netWin - withHoldingTax;

        // check limits maximum winning

        if (possibleWin > setting.maximum_winning) {
          possibleWin = setting.maximum_winning;
        }

        // update bet with new odds and new winning amount
        await this.betRepository.update(
          {
            id: bet.id, // confirm if ID is present
          },
          {
            possible_win: possibleWin,
            winning_after_tax: netWin,
            tax_on_winning: withHoldingTax,
            total_odd: newOdds,
          },
        );
      } else {
        console.log('lets update bet slip ID ' + b.ID);

        await this.betslipRepository.update(
          {
            id: b.ID,
            status: BETSLIP_PROCESSING_SETTLED,
          },
          {
            status: BETSLIP_PROCESSING_COMPLETED,
          },
        );
      }
    }

    // if bet has any voided slips, get new summary i.e won,lost,cancelled,voided slips
    if (hasVoidedSlip) {
      const rows = await this.entityManager.query(
        'SELECT status, won FROM bet_slip WHERE bet_id = ' + bet.id,
      );

      let TotalWon = 0;
      let TotalLost = 0;
      let TotalPending = 0;
      let TotalCancelled = 0;
      let TotalGames = 0;

      for (const row of rows) {
        const status = row.status;
        const won = row.won;
        TotalGames = TotalGames + 1;

        let lost,
          pending,
          win,
          cancelled = 0;

        if (status == BETSLIP_PROCESSING_CANCELLED) {
          cancelled = 1;
        } else {
          if (won == STATUS_NOT_LOST_OR_WON) {
            pending = 1;
          } else if (won == STATUS_WON) {
            win = 1;
          } else {
            lost = 1;
          }
        }

        TotalWon = TotalWon + win;
        TotalLost = TotalLost + lost;
        TotalPending = TotalPending + pending;
        TotalCancelled = TotalCancelled + cancelled;
      }

      bet.Won = TotalWon;
      bet.Lost = TotalLost;
      bet.Pending = TotalPending;
      bet.Cancelled = TotalCancelled;
      bet.TotalGames = TotalGames;
    }

    // lets start resulting here

    // bet won
    if (bet.Lost == 0 && bet.Pending == 0 && bet.TotalGames == bet.Won) {
      processing_status = BET_PENDING;

      if (bet.Voided > 0 && bet.Voided == bet.TotalGames) {
        processing_status = BET_VOIDED;
      }

      console.log('lets update bet ID ' + bet.id);

      //UPDATE bet SET won = ?, status = ?, lost_games = ?, won_games = ?, resulted_bets = ?, processing_status = ?  WHERE id = ?
      await this.betRepository.update(
        {
          id: bet.id,
        },
        {
          won: STATUS_WON,
          status: processing_status,
        },
      );

      this.logger.info('Done Processing BET ID ' + bet.id + ' as won ');

      return {
        BetID: bet.id,
        Won: true,
        Lost: false,
        Pending: false,
      };
    }

    // bet lost
    if (bet.Lost > 0) {
      processing_status = BET_LOST;

      if (bet.Voided > 0 && bet.Voided == bet.TotalGames) {
        processing_status = BET_VOIDED;
      }

      console.log('lets update bet ID ' + bet.id);
      //UPDATE bet SET won = ?, status = ?, lost_games = ?, won_games = ?, resulted_bets = ?, processing_status = ?  WHERE id = ?
      await this.betRepository.update(
        {
          id: bet.id,
        },
        {
          won: STATUS_LOST,
          status: processing_status,
        },
      );

      this.logger.info('Done Processing BET ID ' + bet.id + ' as lost');

      return {
        BetID: bet.id,
        Won: false,
        Lost: true,
        Pending: false,
      };
    }

    this.logger.info('Done Processing BET ID ' + bet.id + ' as pending ');

    return {
      BetID: bet.id,
      Won: false,
      Lost: false,
      Pending: true,
    };
  }

  async getCashoutWithFixedProbability(
    bet: Bet,
    fixedProbability: any,
  ): Promise<any> {
    return bet.stake * fixedProbability;
  }

  async getSimpleCashout(bet: Bet, probability: any): Promise<any> {
    return bet.stake * bet.total_odd * probability;
  }

  async getCashoutWithAdditionalProfit(
    bet: Bet,
    wonEventOdds: Array<number>,
    currentProbability: any,
    probabilityAtTicketTime: any,
  ): Promise<any> {
    const productOfOdds = wonEventOdds.reduce((a, b) => a * b, 1);
    // multiply won event selection odds
    // get reduction factor
    const ladder = {
      lower: {
        ticketValueFactor: 1.0,
        desiredReductionFactor: 101 / 100,
      },
      higher: {
        ticketValueFactor: 1.2,
        desiredReductionFactor: 103 / 100,
      },
    };
    const interpolationWeight = 84 / 100;
    const ticketValueFactor = currentProbability / probabilityAtTicketTime;
    const lowerFactor =
      ladder.lower.ticketValueFactor / ladder.lower.desiredReductionFactor;
    const higherFactor =
      ladder.higher.ticketValueFactor / ladder.higher.desiredReductionFactor;
    const subInterpolationWeight = 1 - interpolationWeight;
    // get reduction factor
    const reductionFactor =
      ticketValueFactor /
      (interpolationWeight * lowerFactor +
        subInterpolationWeight * higherFactor);
    // get cashout value
    const cashoutValue =
      (bet.stake * currentProbability * productOfOdds) / reductionFactor;
    return cashoutValue;
  }
}
