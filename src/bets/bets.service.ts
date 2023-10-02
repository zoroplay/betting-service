import {Injectable} from '@nestjs/common';
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
import {STATUS_LOST, STATUS_NOT_LOST_OR_WON, STATUS_WON} from "../constants";

@Injectable()
export class BetsService {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(BetsService.name);

    constructor(
        //private transactionRunner: DbTransactionFactory,
        @InjectRepository(Bet)
        private betRepository: Repository<Bet>,
        @InjectRepository(Mts)
        private mstRepository: Repository<Mts>,
        @InjectRepository(BetSlip)
        private betslipRepository: Repository<BetSlip>,
        @InjectRepository(Setting)
        private settingRepository: Repository<Setting>,
        @InjectRepository(Producer)
        private producerRepository: Repository<Producer>,
        @InjectRepository(OddsLive)
        private liveRepository: Repository<OddsLive>,
        @InjectRepository(OddsPrematch)
        private prematchRepository: Repository<OddsPrematch>,

        private readonly entityManager: EntityManager,

    ) {

    }

    async findAll(userID: number, status: any, date: any): Promise<any> {

        let bets : any

        try {

            let params = []
            let where = []

            where.push("user_id = ? ")
            params.push(userID)

            if(status !== undefined && status != null) {

                where.push("status = ? ")
                params.push(parseInt(status))
            }

            if(date !== undefined && date != null) {

                where.push("date(created) = ? ")
                params.push(date)
            }

            let queryString = "SELECT id,stake,currency,bet_type,total_odd,possible_win,stake_after_tax,tax_on_stake,tax_on_winning,winning_after_tax,total_bets,status,won,created FROM bet WHERE  " + where.join(' AND ')

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

                slips = await this.entityManager.query("SELECT id,event_id,event_type,event_name,producer_id,market_id,market_name,specifier,outcome_id,outcome_name,odds,won,status,void_factor FROM bet_slip WHERE bet_id =? ",[bet.id])

            }
            catch (e) {

                this.logger.error(" error retrieving bet slips "+e.toString())
                continue
            }

            if(bet.won == STATUS_NOT_LOST_OR_WON) {

                bet.status_description = "Pending"
            }

            if(bet.won == STATUS_LOST) {

                bet.status_description = "Lost"
            }

            if(bet.won == STATUS_WON) {

                bet.status_description = "Won"
            }

            bet.selections = slips

            myBets.push(bet)

        }

        return myBets;
    }

}