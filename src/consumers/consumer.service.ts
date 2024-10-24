import {RabbitRPC, RabbitSubscribe} from "@golevelup/nestjs-rabbitmq";
import {Injectable, UseInterceptors} from "@nestjs/common";
import {RabbitMQInterceptor} from "../interceptors/rabbitmq.interceptor"
import {SettlementService} from "./workers/settlement.service";
import {BetCancelService} from "./workers/bet.cancel.service";
import {SettlementRollbackService} from "./workers/settlement.rollback.service";
import {MtsBetAcceptedService} from "./workers/mts.bet.accepted.service";
import {MtsBetCancelledService} from "./workers/mts.bet.cancelled.service";

@Injectable()
export class ConsumerService {

    constructor(
        private readonly settlementService: SettlementService,
        private readonly betCancelService: BetCancelService,
        private readonly settlementRollbackService: SettlementRollbackService,
        private readonly mtsBetAcceptedService: MtsBetAcceptedService,
        private readonly mtsBetCancelledService: MtsBetCancelledService,

    ) {}

    @RabbitSubscribe({
        exchange: 'betting_service.settlement.0',
        routingKey: 'betting_service.settlement.0',
        queue: 'betting_service.settlement.0',
        queueOptions: {
            channel: 'betting_service.settlement.0',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async processSettlement0(msg: {}) {
        await  this.settlementService.createSettlement(msg);
        return
    }

    @RabbitRPC({
        exchange: 'betting_service.settlement.1',
        routingKey: 'betting_service.settlement.1',
        queue: 'betting_service.settlement.1',
        queueOptions: {
            channel: 'betting_service.settlement.1',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    @UseInterceptors(RabbitMQInterceptor)
    public async processSettlement1(msg: {}) {

        let counts = await  this.settlementService.createSettlement(msg)
        return {counts: counts};
    }

    @RabbitSubscribe({
        exchange: 'betting_service.settlement.2',
        routingKey: 'betting_service.settlement.2',
        queue: 'betting_service.settlement.2',
        queueOptions: {
            channel: 'betting_service.settlement.2',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async processSettlement2(msg: {}) {

        let counts = await  this.settlementService.createSettlement(msg)
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.settlement.3',
        routingKey: 'betting_service.settlement.3',
        queue: 'betting_service.settlement.3',
        queueOptions: {
            channel: 'betting_service.settlement.3',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async processSettlement3(msg: {}) {
        await  this.settlementService.createSettlement(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.settlement.4',
        routingKey: 'betting_service.settlement.4',
        queue: 'betting_service.settlement.4',
        queueOptions: {
            channel: 'betting_service.settlement.4',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async processSettlement4(msg: {}) {
        await  this.settlementService.createSettlement(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.settlement.5',
        routingKey: 'betting_service.settlement.5',
        queue: 'betting_service.settlement.5',
        queueOptions: {
            channel: 'betting_service.settlement.5',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async processSettlement5(msg: {}) {
        await  this.settlementService.createSettlement(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.settlement.6',
        routingKey: 'betting_service.settlement.6',
        queue: 'betting_service.settlement.6',
        queueOptions: {
            channel: 'betting_service.settlement.4',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async processSettlement6(msg: {}) {
        await  this.settlementService.createSettlement(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.settlement.7',
        routingKey: 'betting_service.settlement.7',
        queue: 'betting_service.settlement.7',
        queueOptions: {
            channel: 'betting_service.settlement.7',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async processSettlement7(msg: {}) {
        await  this.settlementService.createSettlement(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.settlement.8',
        routingKey: 'betting_service.settlement.8',
        queue: 'betting_service.settlement.8',
        queueOptions: {
            channel: 'betting_service.settlement.8',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async processSettlement8(msg: {}) {
        await  this.settlementService.createSettlement(msg);
        return
    }


    @RabbitSubscribe({
        exchange: 'betting_service.settlement.9',
        routingKey: 'betting_service.settlement.9',
        queue: 'betting_service.settlement.9',
        queueOptions: {
            channel: 'betting_service.settlement.9',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async processSettlement9(msg: {}) {
        await  this.settlementService.createSettlement(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.settle_bets',
        routingKey: 'betting_service.settle_bets',
        queue: 'betting_service.settle_bets',
        queueOptions: {
            channel: 'betting_service.settle_bets',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async settleBets(msg: {}) {

        //let counts = await  this.settlementService.createSettlement(msg)
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.bet_cancel',
        routingKey: 'betting_service.bet_cancel',
        queue: 'betting_service.bet_cancel',
        queueOptions: {
            channel: 'betting_service.bet_cancel',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async betCancel(msg: {}) {
        await  this.betCancelService.processBetCancelMessage(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.rollback_bet_settlement',
        routingKey: 'betting_service.rollback_bet_settlement',
        queue: 'betting_service.rollback_bet_settlement',
        queueOptions: {
            channel: 'betting_service.rollback_bet_settlement',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async rollbackBetSettlement(msg: {}) {
        await  this.settlementRollbackService.createSettlementRollback(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.bet_accepted',
        routingKey: 'betting_service.bet_accepted',
        queue: 'betting_service.bet_accepted',
        queueOptions: {
            channel: 'betting_service.bet_accepted',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async betAccepted(msg: {}) {
        await  this.mtsBetAcceptedService.processBetAcceptedMessage(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.bet_accepted.0',
        routingKey: 'betting_service.bet_accepted.0',
        queue: 'betting_service.bet_accepted.0',
        queueOptions: {
            channel: 'betting_service.bet_accepted.0',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async betAccepted0(msg: {}) {
        await  this.mtsBetAcceptedService.processBetAcceptedMessage(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.bet_accepted.1',
        routingKey: 'betting_service.bet_accepted.1',
        queue: 'betting_service.bet_accepted.1',
        queueOptions: {
            channel: 'betting_service.bet_accepted.1',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async betAccepted1(msg: {}) {
        await  this.mtsBetAcceptedService.processBetAcceptedMessage(msg);
        return
    }

    @RabbitSubscribe({
        exchange: 'betting_service.bet_accepted.2',
        routingKey: 'betting_service.bet_accepted.2',
        queue: 'betting_service.bet_accepted.2',
        queueOptions: {
            channel: 'betting_service.bet_accepted.2',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async betAccepted2(msg: {}) {
        await  this.mtsBetAcceptedService.processBetAcceptedMessage(msg);
        return
    }


    @RabbitSubscribe({
        exchange: 'betting_service.bet_accepted.3',
        routingKey: 'betting_service.bet_accepted.3',
        queue: 'betting_service.bet_accepted.3',
        queueOptions: {
            channel: 'betting_service.bet_accepted.3',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async betAccepted3(msg: {}) {
        await  this.mtsBetAcceptedService.processBetAcceptedMessage(msg);
        return
    }


    @RabbitSubscribe({
        exchange: 'betting_service.bet_accepted.4',
        routingKey: 'betting_service.bet_accepted.4',
        queue: 'betting_service.bet_accepted.4',
        queueOptions: {
            channel: 'betting_service.bet_accepted.4',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async betAccepted4(msg: {}) {
        await  this.mtsBetAcceptedService.processBetAcceptedMessage(msg);
        return
    }


    // @RabbitSubscribe({
    //     exchange: 'betting_service.bet_accepted.5',
    //     routingKey: 'betting_service.bet_accepted.5',
    //     queue: 'betting_service.bet_accepted.5',
    //     queueOptions: {
    //         channel: 'betting_service.bet_accepted.5',
    //         durable: true,
    //     },
    //     createQueueIfNotExists: true,
    // })
    // public async betAccepted5(msg: {}) {
    //     await  this.mtsBetAcceptedService.processBetAcceptedMessage(msg);
    //     return
    // }


    @RabbitSubscribe({
        exchange: 'betting_service.bet_rejected',
        routingKey: 'betting_service.bet_rejected',
        queue: 'betting_service.bet_rejected',
        queueOptions: {
            channel: 'betting_service.bet_rejected',
            durable: true,
        },
        createQueueIfNotExists: true,
    })
    public async betRejected(msg: {}) {
        await  this.mtsBetCancelledService.processBetRejectedMessage(msg);
        return
    }

}