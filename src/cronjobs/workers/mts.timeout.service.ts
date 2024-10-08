import {Injectable} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {BetSlip} from "../../entity/betslip.entity";
import {BET_CANCELLED, BET_PENDING, BET_WON, STATUS_NOT_LOST_OR_WON} from "../../constants";
import {Bet} from "../../entity/bet.entity";
import {Cron} from "@nestjs/schedule";
import {Cronjob} from "../../entity/cronjob.entity";
// import {AmqpConnection} from "@golevelup/nestjs-rabbitmq";
import {BetStatus} from "../../entity/betstatus.entity";
import { Setting } from "src/entity/setting.entity";
import { WalletService } from "src/wallet/wallet.service";
import { BonusService } from "src/bonus/bonus.service";
import * as dayjs from "dayjs";

@Injectable()
export class MtsTimeoutService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(MtsTimeoutService.name);

    constructor(
        //private transactionRunner: DbTransactionFactory,
        @InjectRepository(BetSlip)
        private betslipRepository: Repository<BetSlip>,
        @InjectRepository(Bet)
        private betRepository: Repository<Bet>,
        @InjectRepository(Cronjob)
        private cronJobRepository: Repository<Cronjob>,
        @InjectRepository(BetStatus)
        private betStatusRepository: Repository<BetStatus>,
        @InjectRepository(Setting)
        private settingRepository: Repository<Setting>,

        private readonly entityManager: EntityManager,
        // private readonly amqpConnection: AmqpConnection,

        private readonly walletService: WalletService,
        
        private readonly bonusService: BonusService
    ) {

    }

    // @Cron("*/2 * * * * *") // run every 2 seconds
    processMtsTimeoutBetCancelation() {

        let vm = this;

        this.taskProcessMtsTimeoutBetCancelation().then(function () {

           // vm.logger.info("done running taskProcessMtsTimeoutBetCancelation ")

        })
    }

    // any bet that we have not received MTS response with 2s of bet placement, we cancel the bet and send notification to MTS, for live bets we wait for 16s before we cancel any bet
    async taskProcessMtsTimeoutBetCancelation() {

        let vm = this;

        const taskName = 'mts.timeout'

        // check if similar job is running
        // get client settings
        var cronJob = await this.cronJobRepository.findOne({
            where: {
                name: taskName,
                status: 1,
            }
        });

        if (cronJob !== null && cronJob.id > 0) {

            //this.logger.info('another '+taskName+' job is alread running');
            return
        }

        // update status to running
        // create settlement
        const task = new Cronjob();
        task.name = taskName;
        task.status = 1;
        await this.cronJobRepository.upsert(task, ['status'])

        let queryString = "SELECT b.id,b.won,b.winning_after_tax,b.source,b.stake,b.user_id,b.client_id,b.user_id,TIMESTAMPDIFF(SECOND,b.created,now()) as difference FROM bet b LEFT JOIN bet_status bs ON b.id=bs.bet_id WHERE bs.id IS NULL AND TIMESTAMPDIFF(SECOND,b.created,now()) > 3 AND b.created BETWEEN date_sub(now(), INTERVAL 3 MINUTE ) AND NOW() "
        queryString = "SELECT b.id,b.won,b.winning_after_tax,b.source,b.stake,b.user_id,b.client_id,b.user_id,TIMESTAMPDIFF(SECOND,b.created,now()) as difference FROM bet b LEFT JOIN bet_status bs ON b.id=bs.bet_id WHERE bs.id IS NULL AND TIMESTAMPDIFF(SECOND,b.created,now()) > 30 AND b.created BETWEEN date_sub(now(), INTERVAL 3 MINUTE ) AND NOW()"

        let rows = await this.entityManager.query(queryString)
        for (const row of rows) {

            let id = row.id;
            let difference = row.difference;

            let live = 0;

            // check betID has any live events
            let betslipsRows = await this.entityManager.query("SELECT count(id) as counts FROM bet_slip WHERE bet_id = " + id + " AND producer_id IN (1,4) ")

            if (betslipsRows) {

                live = betslipsRows[0].counts
            }

            if (live > 0 && difference < 16) {

                vm.logger.info("Match contains live event, wait for 16s")
                continue

            }

            let reqPayload = {
                bet_id: id,
                code: "102",
                reply_prefix: 'betting_service',
            }

            let queueName = "mts.bet_cancel"
            // await this.amqpConnection.publish(queueName, queueName, reqPayload);

            // cancel bets
            let betStatus = new BetStatus()
            betStatus.status = -1
            betStatus.bet_id = id
            betStatus.description = "Bet Cancelled - MTS Timeout"
            await this.betStatusRepository.save(betStatus)

            // if bet is won, debit winnings
            if (row.won === BET_WON) {
                let debitPayload = {
                    subject: "Cancelled - Retract Cashout",
                    source: row.source,
                    amount: ''+row.winning_after_tax,
                    userId: row.user_id,
                    username: row.username,
                    clientId: row.client_id,
                    description: "Bet betID " + row.betslip_id + " was cancelled by MTS",
                    wallet: 'sport',
                    channel: 'Internal'
                }
                // debit user account
                await this.walletService.debit(debitPayload);

            }
            // update bet to cancelled
            await this.betRepository.update(
                {
                    id: id,
                    status: BET_PENDING,
                },
                {
                    status: BET_CANCELLED,
                    settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                    settlement_type: 'mts'
                });

            // update bet slip to cancelled
            await this.betslipRepository.update(
                {
                    bet_id: id,
                    status: BET_PENDING,
                },
                {
                    status: BET_CANCELLED,
                    won: STATUS_NOT_LOST_OR_WON
                });

            let bet = await this.betRepository.findOne({
                where: {
                    id: id
                }
            })

            //@TODO refund use the stake he/she used

            //5. credit user by calling wallet service

            this.logger.info("done processing mts timeout for betID " + id)

            let creditPayload = {
                subject: "Bet Cancelled - MTS Timeout",
                source: bet.source,
                amount: ''+bet.stake,
                userId: bet.user_id,
                username: bet.username,
                clientId: bet.client_id,
                description: "Bet betID " + bet.betslip_id + " was cancelled by MTS",
                wallet: 'sport',
                channel: 'Internal'
            }

            if(bet.bonus_id) {
                creditPayload.wallet= 'sport-bonus';

                await this.bonusService.settleBet({
                    clientId: bet.client_id,
                    betId: bet.id.toString(),
                    status: BET_CANCELLED,
                    amount: 0,
                })
            }

            await this.walletService.credit(creditPayload);
        }

        task.name = taskName;
        task.status = 0;
        await this.cronJobRepository.upsert(task, ['status'])

    }
}