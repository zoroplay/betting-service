import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {Bet} from '../entity/bet.entity';
import {BetSlip} from '../entity/betslip.entity';
import {Mts} from '../entity/mts.entity';
import {Setting} from '../entity/setting.entity';
import {Producer} from '../entity/producer.entity';
import {OddsLive} from '../entity/oddslive.entity';
import {OddsPrematch} from '../entity/oddsprematch.entity';
import {JsonLogger, LoggerFactory} from 'json-logger-service';

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

    ) {

    }

    async findAll(): Promise<Bet[]> {

        return this.betRepository.find();
    }

    async findOne(id: number): Promise<Bet> {

        return this.betRepository.findOne({where: {id}});
    }

    async update(id: number, user: Partial<Bet>): Promise<Bet> {

        await this.betRepository.update(id, user);
        return this.betRepository.findOne({where: {id}});

    }

    async delete(id: number): Promise<void> {

        await this.betRepository.delete(id);
    }

    async saveBetWithTransactions(data: Bet, transactionManager): Promise<Bet> {

        if (transactionManager) return transactionManager.save(Bet, data);
        return this.betRepository.save(data);
    }

    async saveBetSlipWithTransactions(data: BetSlip, transactionManager): Promise<BetSlip> {

        if (transactionManager) return transactionManager.save(BetSlip, data);
        return this.betslipRepository.save(data);
    }



}