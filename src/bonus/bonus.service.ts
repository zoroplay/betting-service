import { Inject, Injectable } from '@nestjs/common';
import { BONUS_SERVICE_NAME, BonusServiceClient, SettleBetRequest, UserBet, protobufPackage } from './bonus.pb';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BonusService {
    private svc: BonusServiceClient;

    @Inject(protobufPackage)
    private readonly client: ClientGrpc;

    public onModuleInit(): void {
        this.svc = this.client.getService<BonusServiceClient>(BONUS_SERVICE_NAME);
    }

    public validateSelection(data: UserBet) {
        return firstValueFrom(this.svc.validateBetSelections(data));
    }

    public async placeBet(data: UserBet) {
        // console.log('Place Bonus bet', data);
        return await firstValueFrom(this.svc.placeBonusBet(data));
    }

    public async settleBet(data: SettleBetRequest) {
        // console.log('Place Bonus bet', data);
        return await firstValueFrom(this.svc.settleBet(data));
    }
}
