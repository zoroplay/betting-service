import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReportModule } from './report/report.module';
import { CommissionModule } from './commission/commission.module';
import { CashoutModule } from './cashout/cashout.module';
import { JackpotModule } from './jackpot/jackpot.module';
import { BonusModule } from './bonus/bonus.module';

@Module({
  imports: [ReportModule, CommissionModule, CashoutModule, JackpotModule, BonusModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
