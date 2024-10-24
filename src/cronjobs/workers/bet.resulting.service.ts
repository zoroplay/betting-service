import {Controller} from "@nestjs/common";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {InjectRepository} from "@nestjs/typeorm";
import {EntityManager, Repository} from "typeorm";
import {Settlement} from "../../entity/settlement.entity";
import {BetSlip} from "../../entity/betslip.entity";
import {Setting} from "../../entity/setting.entity";
import {BET_PENDING, BET_VOIDED, BET_WON, BETSLIP_PROCESSING_PENDING, STATUS_NOT_LOST_OR_WON, STATUS_WON, TRANSACTION_TYPE_WINNING} from "../../constants";
import {Bet} from "../../entity/bet.entity";
import {Cronjob} from "../../entity/cronjob.entity";
import {Winning} from "../../entity/winning.entity";
import { BetClosure } from "src/entity/betclosure.entity";
import { BetSettlementService } from "./bet.settlement.service";
import { WalletService } from "src/wallet/wallet.service";
import { BonusService } from "src/bonus/bonus.service";
import { BetStatus } from "src/entity/betstatus.entity";
import axios from "axios";
import * as dayjs from "dayjs";

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

        @InjectRepository(BetStatus)
        private betStatusRepository: Repository<BetStatus>,

        @InjectRepository(Cronjob)
        private cronJobRepository: Repository<Cronjob>,

        @InjectRepository(Winning)
        private winningRepository: Repository<Winning>,

        @InjectRepository(BetClosure)
        private betClosureRepository: Repository<BetClosure>,

        private betSettlementService: BetSettlementService,

        private readonly entityManager: EntityManager,

        private readonly walletService: WalletService,

        private readonly bonusService: BonusService

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
        } catch (e) {
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
        try {

            await this.entityManager.query("insert ignore into bet_closure (bet_id,created) select id, now() from bet where won = 1 and status = 0 and id not in (select bet_id from winning) ");            

        }
        catch (e) {
            this.logger.error("error deleting bet closure "+e.toString())
        }

    }
    
    async taskInsertBetWithoutBetStatus() {

        try {

            await this.entityManager.query("insert ignore into bet_closure (bet_id,created) select id, now() from bet where won = 1 and status = 0 and id not in (select bet_id from winning) ")
        }
        catch (e) {

            this.logger.error("error deleting bet closure "+e.toString())
        }

    }


    async closeBet(betID: number): Promise<number> {

        let rows : any

        try {

            rows = await this.entityManager.query("SELECT possible_win,user_id,tax_on_winning,winning_after_tax,client_id,currency,betslip_id,source,username,bonus_id,stake FROM bet WHERE id = " + betID + " AND won = " + STATUS_WON + " AND status IN (" + BET_PENDING + ","+BET_VOIDED+") AND id NOT IN (SELECT bet_id FROM winning) ")

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
                    won: STATUS_WON,
                    settled_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                    settlement_type: 'betradar'
                }
            );
        } catch (e) {
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

        try {
            const isWon = await this.winningRepository.findOne({where: {bet_id: betID}});
            
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


                await this.walletService.credit(creditPayload);
            }
        } catch (e) {
            console.log('Error processing winning', e.message);
        }

        return winner.id

    }

    async taskRequestSettlement() {
        const start = dayjs().subtract(3, 'days').format('YYYY-MM-DD HH:mm:ss');
        const end = dayjs().subtract(2, 'hours').format('YYYY-MM-DD HH:mm:ss');
            
        const matches = await this.betslipRepository.createQueryBuilder('b')
                            .where('won = :won', {won: STATUS_NOT_LOST_OR_WON})
                            .andWhere('status = :status', {status: BETSLIP_PROCESSING_PENDING})
                            .andWhere('event_date >= :start', {start})
                            .andWhere('event_date <= :end', {end})
                            .groupBy('match_id')
                            .getMany();
        
                                    
        console.log('number of pending games', matches.length);


        // for (const bet of bets) {
        //     const betStatus = await this.betStatusRepository.find({where: {bet_id: bet.id}});
        //     if (!betStatus) {
        //         let betStatus = new BetStatus()
        //         betStatus.status = 1
        //         betStatus.bet_id = bet.id
        //         betStatus.description = "Bet accepted by MTS";
        //         await this.betStatusRepository.upsert(betStatus,['status','description']);
        //     }
        // }

        // // find unsettled events
        // const matches = await this.betslipRepository.createQueryBuilder('bs')
        // .where('DATE(event_date) = :eDate', {eDate: '2024-09-14'})
        // .andWhere('DATE(created) >= :date', {date: '2024-09-13'})
        // .andWhere('won = :won', {won: STATUS_NOT_LOST_OR_WON})
        // .andWhere('status = :status', {status: BETSLIP_PROCESSING_PENDING})
        // .groupBy('match_id')
        // .getMany();


        let requestId = 1001;
        for (const match of matches) {
            // check if settlement exists
            const settlement = await this.settlementRepository.find({where: {event_id: match.match_id}});
            
            if (settlement.length === 0){
                const url = `https://api.betradar.com/v1/pre/stateful_messages/events/sr:match:${match.match_id}/initiate_request?request_id=${requestId}`
                // request settlement
                await axios.post(url, {}, {
                    headers: {
                        'x-access-token': process.env.BETRADAR_API_TOKEN
                    }
                }).then(res => {
                    // console.log('response', res.data);
                }).catch(err => console.log('error', err))
            } else {
                // update settlement status
                await this.settlementRepository.update(
                    {event_id: match.match_id}, 
                    {processed: 0}
                )
            }
            requestId++;
        }
    }

    async settleCancelledBets() {

    }

}