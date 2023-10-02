import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {BetsModule} from './bets/bets.module';
import {ConfigModule} from '@nestjs/config';
import {ConsumerModule} from "./consumers/consumer.module";
import {CronJobModule} from "./cronjobs/cronjobs.model";
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
import {RabbitmqModule} from "./rabbitmq.module";
import 'dotenv/config'


@Module({
    imports: [
        ConfigModule.forRoot({
            // envFilePath: '.env',
            // ignoreEnvFile: false,
            isGlobal: true,
        }),
        BetsModule,
        ConsumerModule,
        CronJobModule,
        RabbitmqModule,
        TypeOrmModule.forRoot({
          type: process.env.DB_TYPE as any,
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
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