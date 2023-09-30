import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {BetsModule} from './bets/bets.module';
import {ConfigModule} from '@nestjs/config';
import {ConsumerModule} from "./consumers/consumer.model";
import {CronJobModule} from "./cronjobs/cronjobs.model";
import {DatabaseModule} from "./database.module";
import {Bet} from "./entity/bet.entity";
import {BetStatus} from "./entity/betstatus.entity";
import {BetSlip} from "./entity/betslip.entity";
import {OddsLive} from "./entity/oddslive.entity";
import {Mts} from "./entity/mts.entity";
import {OddsPrematch} from "./entity/oddsprematch.entity";
import {Setting} from "./entity/setting.entity";
import {Producer} from "./entity/producer.entity";
import {Settlement} from "./entity/settlement.entity";
import {BetCancel} from "./entity/betcancel.entity";
import {SettlementRollback} from "./entity/settlementrollback.entity";
import {BetClosure} from "./entity/betclosure.entity";
import {Winning} from "./entity/winning.entity";
import {Cronjob} from "./entity/cronjob.entity";
import {TypeOrmModule} from "@nestjs/typeorm";

@Module({
    imports: [
        ConfigModule.forRoot(),
        BetsModule,
        ConsumerModule,
        CronJobModule,
        //DatabaseModule
        TypeOrmModule.forRoot({
          type: process.env.DB_TYPE as any,
          host: 'localhost',
          port: 3306,
          username: 'root',
          password: '',
          database: 'betting_service_v1',
          entities:[Bet,BetSlip,BetStatus,Mts,OddsLive,OddsPrematch,Producer,Setting,Settlement,BetCancel,SettlementRollback,BetClosure,Winning,Cronjob],
          //entities: [__dirname + '/entity/*.ts'],
          //entities: [__dirname + '/ ** / *.entity{.ts,.js}'],
          //entities: [__dirname + '/ ** / *.entity{.ts,.js}'],
          synchronize: true,
        }),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
}