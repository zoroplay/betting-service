import {Controller, Get, Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {Settlement} from "../../entity/settlement.entity";
import {BetSlip} from "../../entity/betslip.entity";
import {Setting} from "../../entity/setting.entity";
import {BET_PENDING, BET_VOIDED, BET_WON, STATUS_WON, TRANSACTION_TYPE_WINNING} from "../../constants";
import {Bet} from "../../entity/bet.entity";
import {Cronjob} from "../../entity/cronjob.entity";
import {Winning} from "../../entity/winning.entity";
import any = jasmine.any;
import axios from "axios";

@Controller('cronjob/bet/resulting')
export class BetResultingController {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(BetResultingController.name);

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

        @InjectRepository(Winning)
        private winningRepository: Repository<Winning>,

        private readonly entityManager: EntityManager,

    ) {

    }

    async taskProcessBetResulting() {

        const taskName = 'bet.resulting'

        // check if similar job is running
        // get client settings
        try {

            let cronJob = await this.cronJobRepository.findOne({
                where: {
                    name: taskName,
                    status: 1,
                }
            });

            if (cronJob !== null && cronJob.id > 0) {

                //this.logger.info('another ' + taskName + ' job is already running');
                return
            }

        }
        catch (e) {

            this.logger.error("error checking if task is running "+e.toString())
            return
        }

        // update status to running
        // create settlement
        const task = new Cronjob();
        task.name = taskName;
        task.status = 1;

        try {

            await this.cronJobRepository.upsert(task, ['status'])
        }
        catch (e) {

            this.logger.error("error updating running task  "+e.toString())
            return
        }

        let rows : any;

        try {

            rows = await this.entityManager.query("SELECT bet_id FROM bet_closure ")

        }
        catch (e) {

            this.logger.error("error retrieving bet_closure "+e.toString())
            return
        }

        for (const row of rows) {

            let id = row.bet_id;
            await this.closeBet(id)

            try {

                await this.entityManager.query("DELETE FROM bet_closure WHERE bet_id = " + id)
            }
            catch (e) {

                this.logger.error("error deleting bet closure "+e.toString())
            }
        }

        task.name = taskName;
        task.status = 0;

        try {

            await this.cronJobRepository.upsert(task, ['status'])
        }
        catch (e) {

            this.logger.error("error updating task as done "+e.toString())
            return
        }

    }

    async taskFixInvalidBetStatus() {

        const taskName = 'bet.resulting.invalid-status'

        // check if similar job is running
        // get client settings
        try {

            let cronJob = await this.cronJobRepository.findOne({
                where: {
                    name: taskName,
                    status: 1,
                }
            });

            if (cronJob !== null && cronJob.id > 0) {

                //this.logger.info('another ' + taskName + ' job is already running');
                return
            }

        }
        catch (e) {

            this.logger.error("error checking if task is running "+e.toString())
            return
        }

        // update status to running
        // create settlement
        const task = new Cronjob();
        task.name = taskName;
        task.status = 1;

        try {

            await this.cronJobRepository.upsert(task, ['status'])
        }
        catch (e) {

            this.logger.error("error updating running task  "+e.toString())
            return
        }


        try {

            await this.entityManager.query("insert ignore into bet_closure (bet_id,created) select id, now() from bet where won = 1 and status = 0 and id not in (select bet_id from winning) " + id)
        }
        catch (e) {

            this.logger.error("error deleting bet closure "+e.toString())
        }

        task.name = taskName;
        task.status = 0;

        try {

            await this.cronJobRepository.upsert(task, ['status'])
        }
        catch (e) {

            this.logger.error("error updating task as done "+e.toString())
            return
        }

    }


    async closeBet(betID: number): Promise<number> {

        let rows : any

        try {

            rows = await this.entityManager.query("SELECT possible_win,user_id,tax_on_winning,winning_after_tax,client_id,currency,betslip_id,source FROM bet WHERE id = " + betID + " AND won = " + STATUS_WON + " AND status IN (" + BET_PENDING + ","+BET_VOIDED+") AND id NOT IN (SELECT bet_id FROM winning) ")

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
                    status: BET_WON,
                }
            );

        }
        catch (e) {

            this.logger.error("error updating bet to won "+e.toString())
            return
        }

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

        let creditPayload = {
            amount: winning_after_tax,
            user_id: profileID,
            bet_id: row.betslip_id,
            description: "Sport Win",
            source: row.source,
        }

        this.logger.info(creditPayload)

         // get client settings
         var clientSettings = await this.settingRepository.findOne({
            where: {
                client_id: row.client_id // add client id to bets
            }
        });


        axios.post(clientSettings.url + '/api/wallet/credit', creditPayload);

        return winner.id

    }

    @Get()
    async status() {

        return {status: 200, message: 'Ok'}
    }

}