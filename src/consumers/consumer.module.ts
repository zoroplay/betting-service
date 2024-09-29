import {RabbitMQChannelConfig, RabbitMQModule} from '@golevelup/nestjs-rabbitmq';
import {Module} from '@nestjs/common';
import {ConsumerService} from './consumer.service';
import {ConsumerController} from "./consumer.controller";
import {SettlementRollbackService} from "./workers/settlement.rollback.service";
import {SettlementService} from "./workers/settlement.service";
import {BetCancelService} from "./workers/bet.cancel.service";
import {TypeOrmModule} from "@nestjs/typeorm";
import {BetSlip} from "../entity/betslip.entity";
import {Settlement} from "../entity/settlement.entity";
import {BetCancel} from "../entity/betcancel.entity";
import {Setting} from "../entity/setting.entity";
import {BetClosure} from "../entity/betclosure.entity";
import {Winning} from "../entity/winning.entity";
import {RabbitMQChannels} from "@golevelup/nestjs-rabbitmq/lib/rabbitmq.interfaces";
import {SettlementRollback} from "../entity/settlementrollback.entity";
import {BetStatus} from "../entity/betstatus.entity";
import {MtsBetCancelledService} from "./workers/mts.bet.cancelled.service";
import {MtsBetAcceptedService} from "./workers/mts.bet.accepted.service";
import {Bet} from "../entity/bet.entity";
import { WalletModule } from 'src/wallet/wallet.module';
import { BonusModule } from 'src/bonus/bonus.module';

let maxSettlementChannels = 5
let maxBetAcceptedChannels = 5
let exchanges = [];

let channels: RabbitMQChannels = {};

let defChannel : RabbitMQChannelConfig = {
    prefetchCount: 200,
    default: true,
}

channels['betting_service'] = defChannel

for (let n = 0; n < maxBetAcceptedChannels; n++) {

    let name = 'betting_service.bet_accepted.' + n
    exchanges.push({
        name: name,
        type: 'direct'
    })

    channels[name] = {
        prefetchCount: 200,
    }
}

for (let n = 0; n < maxSettlementChannels; n++) {

    let name = 'betting_service.settlement.' + n
    exchanges.push({
        name: name,
        type: 'direct'
    })

    channels[name] = {
        prefetchCount: 200,
    }
}

let names = ['settle_bets', 'bet_cancel','rollback_bet_settlement','bet_rejected','bet_accepted','bet_cancelled']

for (const name of names) {

    let newName = 'betting_service.' + name

    exchanges.push({
        name: newName,
        type: 'direct'
    })

    channels[newName] = {
        prefetchCount: 200,
    }
}


let outrightQueues = ['bet_cancel','rollback_bet_settlement','bet_settlement']

for (const name of outrightQueues) {

    let newName = 'outright_service.' + name

    exchanges.push({
        name: newName,
        type: 'direct'
    })

    channels[newName] = {
        prefetchCount: 200,
    }
}


@Module({
    imports: [
        TypeOrmModule.forFeature([Bet,BetSlip, Settlement,BetCancel,Setting,BetClosure,Winning,SettlementRollback,BetStatus]),
        RabbitMQModule.forRoot(RabbitMQModule, {
            exchanges: exchanges,
            uri: process.env.RABITTMQ_URI,
            channels: channels,
            defaultRpcTimeout: 15000,
            connectionInitOptions: {
                timeout: 50000
            }
        }),
        WalletModule,
        BonusModule
    ],
    providers: [ConsumerService, SettlementService, BetCancelService,SettlementRollbackService,MtsBetCancelledService,MtsBetAcceptedService, ConsumerController],
    controllers: [ConsumerController],
})
export class ConsumerModule {
}