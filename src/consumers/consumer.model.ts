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

let maxSettlementChannels = 5
let exchanges = [];

let channels: RabbitMQChannels = {};

let defChannel : RabbitMQChannelConfig = {
    prefetchCount: 200,
    default: true,
}

channels['betting_service'] = defChannel

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

let names = ['settle_bets', 'bet_cancel','rollback_bet_settlement','bet_rejected','bet_accepted']

for (const name of names) {

    exchanges.push({
        name: 'betting_service.' + name,
        type: 'direct'
    })

    channels['betting_service.' + name] = {
        prefetchCount: 200,
    }
}

@Module({
    imports: [
        TypeOrmModule.forFeature([BetSlip, Settlement,BetCancel,Setting,BetClosure,Winning,SettlementRollback,BetStatus]),
        RabbitMQModule.forRoot(RabbitMQModule, {
            exchanges: exchanges,
            uri: "amqp://bs:betting@137.184.222.24:5672/sportsbook",//'amqp://rabbitmq:rabbitmq@localhost:5672',
            /*
            channels: {
                'betting_service.settlement.1': {
                    prefetchCount: 200,
                    default: true,
                },
                'betting_service.settlement.2': {
                    prefetchCount: 200,
                },
                'betting_service.settle_bets': {
                    prefetchCount: 200,
                },
                'betting_service.bet_cancel': {
                    prefetchCount: 200,
                },
            },
            */
            channels: channels,
            defaultRpcTimeout: 15000,
            connectionInitOptions: {
                timeout: 50000
            }
        }),
        ConsumerModule,
    ],
    providers: [ConsumerService, SettlementService, BetCancelService,SettlementRollbackService,MtsBetCancelledService,MtsBetAcceptedService, ConsumerController],
    controllers: [ConsumerController],
})
export class ConsumerModule {
}