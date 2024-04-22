import {Module} from '@nestjs/common';
import {BetsController} from './bets.controller';
import {BetsService} from './bets.service';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Bet} from '../entity/bet.entity';
import {BetSlip} from '../entity/betslip.entity';
import {Mts} from '../entity/mts.entity';
import {Setting} from '../entity/setting.entity';
import {ClientsModule, Transport} from "@nestjs/microservices";
import {join} from "path";
import { HttpModule } from '@nestjs/axios';
import { Booking } from 'src/entity/booking.entity';
import { BookingSelection } from 'src/entity/booking.selection.entity';
import { ReportService } from './report.service';
import { BonusModule } from 'src/bonus/bonus.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { VirtualBetService } from './virtual-bet.service';
import { VirtualBet } from 'src/entity/virtual-bet.entity';
import { IdentityModule } from 'src/identity/identity.module';
import { BetStatus } from 'src/entity/betstatus.entity';

@Module({
  imports: [
    HttpModule,
    BonusModule,
    IdentityModule,
    WalletModule,
    TypeOrmModule.forFeature([Bet,BetSlip,Booking,BookingSelection,Mts,Setting, VirtualBet, BetStatus]),
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
  providers: [BetsService, ReportService, VirtualBetService]
})

export class BetsModule {}
