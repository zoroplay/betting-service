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
import { HttpModule } from '@nestjs/axios';
import { Booking } from 'src/entity/booking.entity';
import { BookingSelection } from 'src/entity/booking.selection.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Bet,BetSlip,Booking,BookingSelection,Mts,Setting,Producer,OddsLive,OddsPrematch]),
    ClientsModule.register([
      {
        name: 'ODDS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'protobuf',
          protoPath: join(__dirname, 'odds.proto'),
          url: process.env.FEEDS_SERVICE_GRPC_URI
        },
      },
      {
        name: 'OUTRIGHTS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'protobuf',
          protoPath: join(__dirname, 'outrights.proto'),
          url: process.env.OUTRIGHTS_SERVICE_GRPC_URI
        },
      },
    ]),
  ],
  controllers: [BetsController],
  providers: [BetsService]
})
export class BetsModule {}
