import {Module} from '@nestjs/common';
import {BetsController} from './bets.controller';
import {BetsService} from './bets.service';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Bet} from '../entity/bet.entity';
import {BetSlip} from '../entity/betslip.entity';
import {Mts} from '../entity/mts.entity';
import {Setting} from '../entity/setting.entity';
import {Producer} from '../entity/producer.entity';
import {OddsLive} from '../entity/oddslive.entity';
import {OddsPrematch} from '../entity/oddsprematch.entity';
import {ClientsModule, Transport} from "@nestjs/microservices";
import {join} from "path";


@Module({
  imports: [TypeOrmModule.forFeature([Bet,BetSlip,Mts,Setting,Producer,OddsLive,OddsPrematch]),
    ClientsModule.register([
      {
        name: 'ODDS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'protobuf',
          protoPath: join(__dirname, 'odds.proto'),
          url: "161.35.104.145:6011"
        },
      },
    ]),
  ],
  controllers: [BetsController],
  providers: [BetsService]
})
export class BetsModule {}
