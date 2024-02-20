import { Inject, Injectable } from '@nestjs/common';
import { BONUS_SERVICE_NAME, BonusServiceClient, UserBet, protobufPackage } from './bonus.pb';
import { ClientGrpc } from '@nestjs/microservices';

@Injectable()
export class BonusService {
    private svc: BonusServiceClient;

    @Inject(protobufPackage)
    private readonly client: ClientGrpc;

    public onModuleInit(): void {
        this.svc = this.client.getService<BonusServiceClient>(BONUS_SERVICE_NAME);
    }

    public validateSelection(data: UserBet) {
        return this.svc.validateBetSelections(data);
    }

    public placeBet(data: UserBet) {
        // console.log('Place Bonus bet', data);
        return this.svc.placeBonusBet(data);
    }
}
