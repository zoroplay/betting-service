import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {Settlement} from "../../entity/settlement.entity";
import {BetSlip} from "../../entity/betslip.entity";
import {Setting} from "../../entity/setting.entity";
import {BET_LOST, BET_PENDING, BET_VOIDED, BET_WON} from "../../constants";
import {Bet} from "../../entity/bet.entity";
import {Cron, CronExpression} from "@nestjs/schedule";
import {Cronjob} from "../../entity/cronjob.entity";
import {BetClosure} from "../../entity/betclosure.entity";

@Injectable()
export class BetSettlementService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(BetSettlementService.name);

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

    ) {

    }

    @Cron(CronExpression.EVERY_5_SECONDS) // run every 2 seconds
    processBetSettlement() {

        let vm = this;

        this.taskProcessBetSettlement().then(function () {

            vm.logger.info("done running processBetSettlement ")

        })
    }

    async taskProcessBetSettlement() {

        const taskName = 'bet.settlement'

        // check if similar job is running
        // get client settings
        var cronJob = await this.cronJobRepository.findOne({
            where: {
                name: taskName,
                status: 1,
            }
        });

        if(cronJob !== null && cronJob.id > 0 ) {

            this.logger.debug('another '+taskName+' job is alread running');
            return
        }

        // update status to running
        // create settlement
        const task = new Cronjob();
        task.name = taskName;
        task.status = 1;
        await this.cronJobRepository.upsert(task,['status'])

        let rows = await this.entityManager.query("SELECT id FROM settlement where processed = 0 ")
        for (const row of rows) {

            let id = row.id;
            await this.createBetSettlement(id)
            await this.entityManager.query("UPDATE settlement SET processed = 1 WHERE id = "+id)
        }

        task.name = taskName;
        task.status = 0;
        await this.cronJobRepository.upsert(task,['status'])

    }

    async createBetSettlement(settlementID: number): Promise<number> {

        let rows = await this.entityManager.query("SELECT DISTINCT b.id,b.stake,b.total_bets,b.total_odd,b.bet_type,b.user_id " +
            "FROM bet b " +
            "INNER JOIN bet_slip bs on b.id = bs.bet_id " +
            "WHERE b.status IN (0,1) AND bs.settlement_id = ?", [settlementID])

        let bets = [];
        let betIds = []

        for (const row of rows) {

            let key = "bet-" + row.id;

            let bet = []

            if (bets[key] !== undefined) {

                bet = bets[key]
            }

            bet.push(row)
            bets[key] = bet;
            betIds.push(row.id)

        }

        if (betIds.length == 0) {

            return 1;
        }

        // pull all the bet_slip of the bets we have pulled

        let queryString = "SELECT id,bet_id,status, won, void_factor, dead_heat_factor,odd FROM bet_slip " +
            "WHERE bet_id IN (" + betIds.join(',') + ")"

        let betSlips = await this.entityManager.query(queryString);


        for (const betSlip of betSlips) {

            let void_factor = -1

            if (betSlip.void_factor !== undefined && !betSlip.void_factor == false && betSlip.void_factor !== null) {

                void_factor = betSlip.void_factor
            }

            let dead_heat_factor = -1

            if (betSlip.dead_heat_factor !== undefined && !betSlip.dead_heat_factor == false && betSlip.dead_heat_factor !== null) {

                dead_heat_factor = betSlip.dead_heat_factor
            }

            let won = -1
            if (betSlip.won !== undefined && betSlip.won == false && betSlip.won !== null) {

                won = betSlip.won
            }


            let lost = 0
            let pending = 0
            let win = 0
            let cancelled = 0
            let voided = 0

            if (betSlip.status == -1) {

                cancelled = 1
            }

            if (void_factor > 0) {

                voided = 1
            }

            if (won == -1) {

                pending = 1

            } else if (won == 1) {

                win = 1

            } else {

                lost = 1
            }

            let currentBetSlip = {
                ID: betSlip.id,
                BetID: betSlip.bet_id,
                Status: betSlip.status,
                Won: won,
                VoidFactor: void_factor,
                DeadHeatFactor: dead_heat_factor,
                Odd: betSlip.dd,
            }


            // update bet details
            let bs = bets["key-" + currentBetSlip.ID]
            bs.Won = bs.Won + win
            bs.Lost = bs.Lost + lost
            bs.Pending = bs.Pending + pending
            bs.Cancelled = bs.Cancelled + cancelled
            bs.Voided = bs.Voided + voided

            let slips = []

            if (bs.BetSlips !== undefined) {

                slips = bs.BetSlips
            }

            slips.push(currentBetSlip)

            bs.BetSlips = slips

            bets["key-" + currentBetSlip.ID] = bs
        }

        for (const bet of bets) {

            // get client settings
            var clientSettings = await this.settingRepository.findOne({
                where: {
                    client_id: bet.client_id // add client id to bets
                }
            });

            let result = await this.resultBet(bet, clientSettings)

            if (result.Won) {

                const betClosure = new BetClosure();
                betClosure.bet_id = result.BetID;
                await this.betClosureRepository.upsert(betClosure,['bet_id'])

                // publish to bonus queue

            } else if (result.Lost) {

                // publish to bonus queue

            }

        }

        return 1

    }

    async resultBet(bet: any, setting: Setting): Promise<any> {

        let processing_status = BET_PENDING
        let hasVoidedSlip = false

        // check if any match was voided
        for (const b of bet.BetSlips) {

            if (b.VoidFactor > 0) {

                hasVoidedSlip = true

                // update voided bet_slip
                await this.betslipRepository.update(
                    {
                        id: b.ID,
                        status: 1, // when did we get here
                    },
                    {
                        odds: b.VoidFactor,
                        won: 1,
                        status: 2,
                    });

                // recalculate odds
                let newOdds = (bet.TotalOdds / b.Odd) * b.VoidFactor

                bet.TotalOdds = newOdds

                // calculate new net win
                let netWin = newOdds * bet.Stake

                // calculate profit
                let profit = netWin - bet.Stake

                // calculate tax & possible win
                let winningTaxPercentage = setting.tax_on_winning / 100

                let withHoldingTax = profit * winningTaxPercentage

                let possibleWin = netWin - withHoldingTax

                // check limits maximum winning

                if (possibleWin > setting.maximum_winning) {

                    possibleWin = setting.maximum_winning
                }

                // update bet with new odds and new winning amount
                await this.betRepository.update(
                    {
                        id: bet.ID, // confirm if ID is present
                    },
                    {
                        possible_win: possibleWin,
                        winning_after_tax: netWin,
                        tax_on_winning: withHoldingTax,
                        total_odd: newOdds
                    });

            } else {

                await this.betslipRepository.update(
                    {
                        id: b.ID,
                        status: 1, // when did we get here
                    },
                    {
                        status: 2,
                    });
            }
        }

        // if bet has any voided slips, get new summary i.e won,lost,cancelled,voided slips
        if (hasVoidedSlip) {

            let rows = await this.entityManager.query("SELECT status, won FROM bet_slip WHERE bet_id = " + bet.ID)

            let Won, Lost, Pending, Cancelled, TotalGames = 0

            for (const row of rows) {

                let status = row.status
                let won = row.won;
                TotalGames = TotalGames + 1

                let lost, pending, win, cancelled = 0

                if (status == -1) {

                    cancelled = 1

                } else {

                    if (won == -1) {

                        pending = 1

                    } else if (won == 1) {

                        win = 1

                    } else {

                        lost = 1
                    }
                }

                Won = Won + win
                Lost = Lost + lost
                Pending = Pending + pending
                Cancelled = Cancelled + cancelled
            }

            bet.Won = Won
            bet.Lost = Lost
            bet.Pending = Pending
            bet.Cancelled = Cancelled
            bet.TotalGames = TotalGames
        }

        // lets start resulting here

        // bet won
        if (bet.Lost == 0 && bet.Pending == 0 && bet.TotalGames == bet.Won) {

            processing_status = BET_WON

            if (bet.Voided > 0 && bet.Voided == bet.TotalGames) {

                processing_status = BET_VOIDED

            }

            //UPDATE bet SET won = ?, status = ?, lost_games = ?, won_games = ?, resulted_bets = ?, processing_status = ?  WHERE id = ?
            await this.betRepository.update(
                {
                    id: bet.ID, // confirm if ID is present
                },
                {
                    won: 1,
                    ///status: processing_status,
                });

            this.logger.info("Done Processing BET ID " + bet.ID)

            return {
                BetID: bet.ID,
                Won: true,
                Lost: false,
                Pending: false,
            }

        }

        // bet lost
        if (bet.Lost > 0) {

            processing_status = BET_LOST

            if (bet.Voided > 0 && bet.Voided == bet.TotalGames) {

                processing_status = BET_VOIDED

            }

            //UPDATE bet SET won = ?, status = ?, lost_games = ?, won_games = ?, resulted_bets = ?, processing_status = ?  WHERE id = ?
            await this.betRepository.update(
                {
                    id: bet.ID, // confirm if ID is present
                },
                {
                    won: 0,
                    status: processing_status,
                });

            this.logger.info("Done Processing BET ID " + bet.ID)

            return {
                BetID: bet.ID,
                Won: false,
                Lost: true,
                Pending: false,
            }
        }

        this.logger.info("Done Processing BET ID " + bet.ID)

        return {
            BetID: bet.ID,
            Won: false,
            Lost: false,
            Pending: true,
        }
    }

}