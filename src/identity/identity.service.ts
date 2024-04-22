import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { IDENTITY_SERVICE_NAME, IdentityServiceClient, PlaceBetRequest, protobufPackage } from './identity.pb';

@Injectable()
export class IdentityService {
    private svc: IdentityServiceClient;

    @Inject(protobufPackage)
    private readonly client: ClientGrpc;

    public onModuleInit(): void {
        this.svc = this.client.getService<IdentityServiceClient>(IDENTITY_SERVICE_NAME);
    }

    public async validateBet(param: PlaceBetRequest) {
      return await firstValueFrom(this.svc.validateBet(param));
    }
    
}
