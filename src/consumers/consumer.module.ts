import {RabbitMQChannelConfig, RabbitMQModule} from '@golevelup/nestjs-rabbitmq';
import {Module, OnModuleInit} from '@nestjs/common';
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
import { connect } from "mqtt";

let maxSettlementChannels = 10
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
export class ConsumerModule implements OnModuleInit {
    constructor(private readonly settlementService: SettlementService) {}

    onModuleInit() {
        const settlementService = this.settlementService;
    
        const host = process.env.MQTT_HOST;
        const port = process.env.MQTT_PORT;
        const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
        const connectUrl = `mqtt://${host}:${port}/mqtt`;
        const client = connect(connectUrl, {
          clientId,
          clean: true,
          connectTimeout: 4000,
          username: process.env.MQTT_USERNAME,
          password: process.env.MQTT_PASSWORD,
          reconnectPeriod: 1000,
          protocolVersion: 5,
        });
        client.on("connect", function () {
          console.log("Connected to CloudMQTT");
          // Subscribe to a topic
          const topic = "betradar/bet_settlement/#";
          client.subscribe(topic, function (err) {
            if (!err) {
              // Publish a message to a topic
              //client.publish('test', 'Hello mqtt')
              console.log("subscribed to " + topic);
            }
          });
        });
        client.on("reconnect", function () {
          console.log("Reconnecting...");
        });
        client.on("disconnect", function (packet) {
          console.log(packet);
        });
        client.on("offline", function () {
          console.log("MQTT is offline");
        });
        client.on("close", function () {
          console.log("Disconnected from MQTT");
        });
        client.on("error", function () {
          console.log("Error in connecting to CloudMQTT");
        });
        // Receive messages
        client.on("message", function (topic, message) {
          try {

            // message is Buffer
            const object = JSON.parse(message.toString());
            
            settlementService.createSettlement(object, 'mqtt');
            //client.end()
          }catch(e) {
            console.log('error processing message', e.message);
          }
        });
      }
}