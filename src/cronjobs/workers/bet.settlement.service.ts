import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {Settlement} from "../../entity/settlement.entity";
import {BetSlip} from "../../entity/betslip.entity";
import {Setting} from "../../entity/setting.entity";
import {
    BET_LOST,
    BET_PENDING,
    BET_VOIDED,
    BET_WON, BETSLIP_PROCESSING_CANCELLED,
    BETSLIP_PROCESSING_COMPLETED,
    BETSLIP_PROCESSING_SETTLED, BETSLIP_PROCESSING_VOIDED, STATUS_LOST, STATUS_NOT_LOST_OR_WON, STATUS_WON
} from "../../constants";
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

    @Cron(CronExpression.EVERY_SECOND) // run every 5 seconds
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

            //this.logger.info('another '+taskName+' job is alread running');
            return
        }

        // update status to running
        // create settlement
        const task = new Cronjob();
        task.name = taskName;
        task.status = 1;
        await this.cronJobRepository.upsert(task,['status'])


        let rows = await this.settlementRepository.find({
            where: {
                processed: 0
            }
        });

        //this.entityManager.query("SELECT id FROM settlement where processed = 0 ")

        for (const row of rows) {

            let id = row.id;
            this.logger.info("start processing settlementID "+id)

            await this.createBetSettlement(id)

            await this.settlementRepository.update(
                {
                    id: id,
                },
                {
                    processed: 1
                }
            )

            this.logger.info("done processing settlementID "+id)

        }

        task.name = taskName;
        task.status = 0;
        await this.cronJobRepository.upsert(task,['status'])

    }

    async createBetSettlement(settlementID: number): Promise<number> {

        this.logger.info("createBetSettlement | settlementID "+settlementID)

        let rows = await this.entityManager.query("SELECT DISTINCT b.id,b.stake,b.stake_after_tax,b.total_bets,b.total_odd,b.bet_type,b.user_id,b.client_id " +
            "FROM bet b " +
            "INNER JOIN bet_slip bs on b.id = bs.bet_id " +
            "WHERE b.status IN (0,1) AND b.won = "+STATUS_NOT_LOST_OR_WON+" AND bs.settlement_id = ?", [settlementID])

        let bets = new Map()

        let betIds = []

        for (let row of rows) {

            let key = "bet-" + row.id;
            row.Won = 0
            row.Lost = 0
            row.Pending = 0
            row.Cancelled = 0
            row.Voided = 0
            row.TotalGames = row.total_bets
            bets.set(key, row)
            betIds.push(row.id)
        }

        this.logger.info("settlementID "+settlementID+" attached bets "+bets.size)

        if (bets.size == 0) {

            return 1;
        }

        // pull all the bet_slip of the bets we have pulled

        let queryString = "SELECT id,bet_id,status, won, void_factor, dead_heat_factor,odds FROM bet_slip " +
            "WHERE bet_id IN (" + betIds.join(',') + ")"

        console.log(queryString)

        let betSlips = await this.entityManager.query(queryString);

        for (const betSlip of betSlips) {

            let void_factor = parseFloat(betSlip.void_factor)
            let dead_heat_factor = parseFloat(betSlip.dead_heat_factor)
            let won = parseInt(betSlip.won)

            let lost = 0
            let pending = 0
            let win = 0
            let cancelled = 0
            let voided = 0

            if (parseInt(betSlip.status) == -1) {

                cancelled = 1
            }

            if (void_factor > 0) {

                voided = 1
            }

            if (won == STATUS_NOT_LOST_OR_WON) {

                pending = 1

            } else if (won == STATUS_WON) {

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
                Odd: betSlip.odds,
            }

            let keyName = "bet-" + currentBetSlip.BetID
            let bs = bets.get(keyName)
            if(bs == undefined ) {

                this.logger.error("could not find "+keyName+" from array ")
                continue
            }

            let slips = []

            if (bs.BetSlips !== undefined) {

                slips = bs.BetSlips
            }

            bs.Won = bs.Won + win
            bs.Lost = bs.Lost + lost
            bs.Pending = bs.Pending + pending
            bs.Cancelled = bs.Cancelled + cancelled
            bs.Voided = bs.Voided + voided

            slips.push(currentBetSlip)

            bs.BetSlips = slips

            bets[keyName] = bs

        }

        for (const bet of bets.values()) {

            // get client settings
            var clientSettings = await this.settingRepository.findOne({
                where: {
                    client_id: bet.client_id // add client id to bets
                }
            });

            let result = await this.resultBet(bet, clientSettings)

            console.log(bet.id+" | "+JSON.stringify(result,undefined,2))

            if (result.Won) {

                const betClosure = new BetClosure();
                betClosure.bet_id = result.BetID;
                await this.betClosureRepository.upsert(betClosure,['bet_id'])
                this.logger.info("bet ID "+result.BetID+" has won and bet closure created")

                // publish to bonus queue

            } else if (result.Lost) {

                // publish to bonus queue

            }

        }

        return 1

    }

    async resultBet(bet: any, setting: Setting): Promise<any> {

       console.log(JSON.stringify(bet,undefined,2))

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
                        status: BETSLIP_PROCESSING_SETTLED,
                    },
                    {
                        odds: b.VoidFactor,
                        won: STATUS_WON,
                        status: BETSLIP_PROCESSING_VOIDED,
                    });

                // recalculate odds
                let newOdds = (bet.total_odd / b.Odd) * b.VoidFactor

                bet.total_odd = newOdds

                // calculate new net win
                let netWin = newOdds * bet.stake_after_tax

                // calculate profit
                let profit = netWin - bet.stake_after_tax

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
                        id: bet.id, // confirm if ID is present
                    },
                    {
                        possible_win: possibleWin,
                        winning_after_tax: netWin,
                        tax_on_winning: withHoldingTax,
                        total_odd: newOdds
                    });

            } else {

                console.log('lets update bet slip ID '+b.ID)

                await this.betslipRepository.update(
                    {
                        id: b.ID,
                        status: BETSLIP_PROCESSING_SETTLED,
                    },
                    {
                        status: BETSLIP_PROCESSING_COMPLETED,
                    });
            }
        }

        // if bet has any voided slips, get new summary i.e won,lost,cancelled,voided slips
        if (hasVoidedSlip) {

            let rows = await this.entityManager.query("SELECT status, won FROM bet_slip WHERE bet_id = " + bet.id)

            let TotalWon = 0
            let TotalLost = 0
            let TotalPending = 0
            let TotalCancelled = 0
            let TotalGames = 0

            for (const row of rows) {

                let status = row.status
                let won = row.won;
                TotalGames = TotalGames + 1

                let lost, pending, win, cancelled = 0

                if (status == BETSLIP_PROCESSING_CANCELLED) {

                    cancelled = 1

                } else {

                    if (won == STATUS_NOT_LOST_OR_WON) {

                        pending = 1

                    } else if (won == STATUS_WON) {

                        win = 1

                    } else {

                        lost = 1
                    }
                }

                TotalWon = TotalWon + win
                TotalLost = TotalLost + lost
                TotalPending = TotalPending + pending
                TotalCancelled = TotalCancelled + cancelled
            }

            bet.Won = TotalWon
            bet.Lost = TotalLost
            bet.Pending = TotalPending
            bet.Cancelled = TotalCancelled
            bet.TotalGames = TotalGames
        }

        // lets start resulting here

        // bet won
        if (bet.Lost == 0 && bet.Pending == 0 && bet.TotalGames == bet.Won) {

            processing_status = BET_PENDING

            if (bet.Voided > 0 && bet.Voided == bet.TotalGames) {

                processing_status = BET_VOIDED

            }

            console.log('lets update bet ID '+bet.id)

            //UPDATE bet SET won = ?, status = ?, lost_games = ?, won_games = ?, resulted_bets = ?, processing_status = ?  WHERE id = ?
            await this.betRepository.update(
                {
                    id: bet.id,
                },
                {
                    won: STATUS_WON,
                    status: processing_status,
                });

            this.logger.info("Done Processing BET ID " + bet.id+" as won ")

            return {
                BetID: bet.id,
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

            console.log('lets update bet ID '+bet.id)
            //UPDATE bet SET won = ?, status = ?, lost_games = ?, won_games = ?, resulted_bets = ?, processing_status = ?  WHERE id = ?
            await this.betRepository.update(
                {
                    id: bet.id,
                },
                {
                    won: STATUS_LOST,
                    status: processing_status,
                });

            this.logger.info("Done Processing BET ID " + bet.id+" as lost")

            return {
                BetID: bet.id,
                Won: false,
                Lost: true,
                Pending: false,
            }
        }

        this.logger.info("Done Processing BET ID " + bet.id+" as pending ")

        return {
            BetID: bet.id,
            Won: false,
            Lost: false,
            Pending: true,
        }
    }

}