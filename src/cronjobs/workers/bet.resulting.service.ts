import {Controller, Get, Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {Settlement} from "../../entity/settlement.entity";
import {BetSlip} from "../../entity/betslip.entity";
import {Setting} from "../../entity/setting.entity";
import {BET_PENDING, BET_WON, TRANSACTION_TYPE_WINNING} from "../../constants";
import {Bet} from "../../entity/bet.entity";
import {Cronjob} from "../../entity/cronjob.entity";
import {Winning} from "../../entity/winning.entity";

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

        let rows = await this.entityManager.query("SELECT bet_id FROM bet_closure ")
        for (const row of rows) {

            let id = row.bet_id;
            await this.closeBet(id)
            await this.entityManager.query("DELETE FROM bet_closure WHERE bet_id = "+id)
        }

        task.name = taskName;
        task.status = 0;
        await this.cronJobRepository.upsert(task,['status'])

    }

    async closeBet(betID: number): Promise<number> {

        // G. retrieve possible win and profile ID
        let row = await this.entityManager.query("SELECT possible_win,user_id,tax_on_winning,winning_after_tax,client_id,currency FROM bet WHERE id = "+betID+" AND won = 1 AND status = "+BET_PENDING+" AND id NOT (SELECT bet_id FROM winning) ")
        if (row == undefined || row == false || row == null) {

            return 0

        }

        let possibleWin = row.possible_win;
        let profileID = row.user_id;
        let winningTaxAmount = row.tax_on_winning;
        let winning_after_tax = row.winning_after_tax;

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

        let winning = new Winning();
        winning.bet_id = betID
        winning.user_id = profileID
        winning.client_id = row.client_id
        winning.currency = row.currency
        winning.tax_on_winning = winningTaxAmount
        winning.winning_before_tax = possibleWin
        winning.winning_after_tax = winning_after_tax

        // wrap in try catch
        // J. create winning
        let winner = await this.winningRepository.save(winning)
        if (winner.id == 0 ) {

            return 0
        }

        let creditPayload = {
            currency: row.currency,
            amount: winning_after_tax,
            user_id: profileID,
            client_id: row.client_id,
            description: "Won betID "+betID,
            transaction_id: betID,
            transaction_type: TRANSACTION_TYPE_WINNING
        }

        // send credit payload to wallet service

        return winner.id

    }

    @Get()
    async status() {

        return {status: 200, message: 'Ok'}
    }

}