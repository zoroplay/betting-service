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
import {Cronjob} from "../../entity/cronjob.entity";
import {BetClosure} from "../../entity/betclosure.entity";
import { BonusService } from "src/bonus/bonus.service";
import * as dayjs from "dayjs";
import { WalletService } from "src/wallet/wallet.service";
import { Winning } from "src/entity/winning.entity";

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

        @InjectRepository(Winning)
        private winningRepository: Repository<Winning>,

        private readonly entityManager: EntityManager,

        private readonly bonusService: BonusService,

        private readonly walletService: WalletService,

    ) {

    }

    async taskProcessBetSettlement() {
        console.log('task for processing bet settlement')

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

            this.logger.info('another '+taskName+' job is already running');
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

            await this.createBetSettlement(row)

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


    async taskProcessUnSettledBet() {
        console.log('task for processing unsettled bet')

        const taskName = 'unsettled.bet'

        // check if similar job is running
        // get client settings
        var cronJob = await this.cronJobRepository.findOne({
            where: {
                name: taskName,
                status: 1,
            }
        });

        if(cronJob !== null && cronJob.id > 0 ) {

            this.logger.info('another '+taskName+' job is already running');
            return
        }

        // update status to running
        // create settlement
        const task = new Cronjob();
        task.name = taskName;
        task.status = 1;

        await this.cronJobRepository.upsert(task,['status']);
        // find unsettled bets
        let rows = await this.entityManager.query("SELECT b.betslip_id, b.id, b.bonus_id, b.client_id " +
            "FROM bet b " +
            "WHERE (b.status = "+BET_PENDING+ " AND b.won = "+STATUS_NOT_LOST_OR_WON+") OR (b.status = "+BET_PENDING+ " AND b.won = "+STATUS_WON+")")

        for (let row of rows) {
            if(row.betslip_id === '8W7ZO8W')
                console.log(row.betslip_id);
            const betId = row.id;
            // find selections
            let total = await this.betslipRepository.count({where: {bet_id: betId}});
            const won = await this.betslipRepository.count({where: {bet_id: betId, won: STATUS_WON}})
            const lost = await this.betslipRepository.count({where: {bet_id: betId, won: STATUS_LOST}});
            const voidGames = await this.betslipRepository.count({where: {bet_id: betId, status: BETSLIP_PROCESSING_VOIDED}});

            // console.log(total, won, lost, voidGames);

            total = total - voidGames;

            if (lost > 0){
                await this.betRepository.update(
                    {
                        id: row.id,
                    },
                    {
                        won: STATUS_LOST,
                        status: BET_LOST,
                        settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                    });
    
                if (row.bonus_id) {
                    await this.bonusService.settleBet({
                        clientId: row.client_id,
                        betId: row.id,
                        amount: 0,
                        status: BET_LOST
                    })
                }
            }

            if (won === total) {
                this.closeBet(row.id);
            }
        }

        task.name = taskName;
        task.status = 0;
        await this.cronJobRepository.upsert(task,['status'])
    }

    async createBetSettlement(settlement: Settlement): Promise<number> {
        this.logger.info("createBetSettlement | settlementID "+settlement.id)

        let rows = await this.entityManager.query("SELECT DISTINCT b.id,b.stake,b.stake_after_tax,b.total_bets,b.total_odd,b.bet_type,b.user_id,b.client_id, b.bonus_id " +
            "FROM bet b " +
            "INNER JOIN bet_slip bs on b.id = bs.bet_id " +
            "INNER JOIN bet_status bst on b.id = bst.bet_id " +
            "WHERE bst.status = 1 AND b.status IN (0,1) AND b.won = "+STATUS_NOT_LOST_OR_WON+" AND bs.settlement_id = ?", [settlement.id])

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

        this.logger.info("settlementID "+settlement.id+" attached bets "+bets.size)

        if (bets.size == 0) {

            return 1;
        }

        // pull all the bet_slip of the bets we have pulled

        let queryString = "SELECT id,bet_id,status, won, void_factor, dead_heat_factor,odds FROM bet_slip " +
            "WHERE bet_id IN (" + betIds.join(',') + ")"

       // console.log(queryString)

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

            let result = await this.resultBet(bet, clientSettings, {ftScore: settlement.ft_score, htScore: settlement.ht_score})

            //console.log(bet.id+" | "+JSON.stringify(result,undefined,2))

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

    async resultBet(bet: any, setting: Setting, scores: any): Promise<any> {
        console.log('starting  result bet')

    //    console.log(JSON.stringify(bet,undefined,2))

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
                        won: STATUS_NOT_LOST_OR_WON,
                        status: BETSLIP_PROCESSING_VOIDED,
                        score: scores.ftScore,
                        ht_score: scores.htScores,
                        settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                        settlement_type: 'betradar',
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

                // console.log(possibleWin, netWin, withHoldingTax, newOdds)

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

                // console.log('lets update bet slip ID '+b.ID)

                await this.betslipRepository.update(
                    {
                        id: b.ID,
                        status: BETSLIP_PROCESSING_SETTLED,
                    },
                    {
                        status: BETSLIP_PROCESSING_COMPLETED,
                        score: scores.ftScore,
                        ht_score: scores.htScores,
                        settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                        settlement_type: 'betradar',
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
        // console.log(bet.id)

        // bet won
        if (bet.Lost == 0 && bet.Pending == 0 && bet.TotalGames == bet.Won) {

            processing_status = BET_WON

            if (bet.Voided > 0 && bet.Voided == bet.TotalGames) {

                processing_status = BET_VOIDED

            }

            // console.log('lets update bet ID '+bet.id)

            //UPDATE bet SET won = ?, status = ?, lost_games = ?, won_games = ?, resulted_bets = ?, processing_status = ?  WHERE id = ?
            await this.betRepository.update(
                {
                    id: bet.id,
                },
                {
                    won: STATUS_WON,
                    status: processing_status,
                    settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                    settlement_type: 'secondary_automation'
                });

                if (bet.bonus_id) {
                    await this.bonusService.settleBet({
                        clientId: bet.client_id,
                        betId: bet.id,
                        amount: 0,
                        status: BET_WON
                    })
                }

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

            // console.log('lets update bet ID '+bet.id)
            //UPDATE bet SET won = ?, status = ?, lost_games = ?, won_games = ?, resulted_bets = ?, processing_status = ?  WHERE id = ?
            await this.betRepository.update(
                {
                    id: bet.id,
                },
                {
                    won: STATUS_LOST,
                    status: processing_status,
                    settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                    settlement_type: 'secondary_automation'
                });

            if (bet.bonus_id) {
                await this.bonusService.settleBet({
                    clientId: bet.client_id,
                    betId: bet.id,
                    amount: 0,
                    status: BET_LOST
                })
            }

            this.logger.info("Done Processing BET ID " + bet.id+" as lost")

            return {
                BetID: bet.id,
                Won: false,
                Lost: true,
                Pending: false,
            }
        }

        // this.logger.info("Done Processing BET ID " + bet.id+" as pending ")

        return {
            BetID: bet.id,
            Won: false,
            Lost: false,
            Pending: true,
        }
    }

    async closeBet(betID: number): Promise<number> {
        // console.log('close bet')

        let rows : any

        try {

            rows = await this.entityManager.query("SELECT possible_win,user_id,tax_on_winning,winning_after_tax,client_id,currency,betslip_id,source,username,bonus_id,stake FROM bet WHERE id = " + betID + " AND status IN (" + BET_PENDING + ","+BET_VOIDED+") AND id NOT IN (SELECT bet_id FROM winning) ")

        }
        catch (e) {

            this.logger.error("error retrieving bets to settle "+e.toString())
            return
        }

        if (rows == undefined || rows == false || rows == null) {
            return 0
        }

        let row = rows[0]

        let possibleWin = row.possible_win;
        let profileID = row.user_id;
        let winningTaxAmount = row.tax_on_winning;
        let winning_after_tax = row.winning_after_tax;

        try {
            //H. update bet to won and status = 2
            //UPDATE bet SET status = 2  WHERE id = ?
            await this.betRepository.update(
                {
                    id: betID,
                },
                {
                    won: STATUS_WON,
                    status: BET_WON,
                    settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                    settlement_type: 'secondary_automation'
                }
            );
        } catch (e) {
            this.logger.error("error updating bet to won "+e.toString())
            return
        }

        // check if winning exist
        const isWon = await this.winningRepository.findOne({where: {bet_id: betID}});

        let winning = new Winning();
        winning.bet_id = betID
        winning.user_id = profileID
        winning.client_id = row.client_id
        winning.currency = row.currency
        winning.tax_on_winning = winningTaxAmount
        winning.winning_before_tax = possibleWin
        winning.winning_after_tax = winning_after_tax

        let winner : any
        // wrap in try catch
        // J. create winning
        try {
            winner = await this.winningRepository.save(winning)
        }
        catch (e) {

            this.logger.error("error saving winner "+e.toString())
            return
        }

        if (winner.id == 0 ) {

            return 0
        }

        try {
            if (!isWon) { // if ticket has not been updated as won, credit user
                let creditPayload = {
                    amount: ''+`${winning_after_tax}`,
                    userId: profileID,
                    username: row.username,
                    clientId: row.client_id,
                    subject:  'Sport Win',
                    description: "Bet betID " + row.betslip_id ,
                    source: row.source,
                    wallet: 'sport',
                    channel: 'Internal'
                }

                if(row.bonus_id) {
                    creditPayload.wallet = 'sport-bonus';

                    const bonusData = await this.bonusService.settleBet({
                        clientId: row.client_id,
                        betId: betID.toString(),
                        amount: winning_after_tax,
                        status: BET_WON
                    })
                    // remove stake amount from winning
                    const amount = winning_after_tax - row.stake;
                    creditPayload.amount = '' + amount

                    // set credit amount to amount returned from bonus
                    if (bonusData.success) creditPayload.amount = bonusData.data.amount;
                }

                // credit user wallet
                await this.walletService.credit(creditPayload);
            }
        } catch (e) {
            console.log('Error processing winning', e.message);
        }

        return winner.id

    }

}