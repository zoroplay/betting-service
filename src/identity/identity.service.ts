import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { GetAgentUsersRequest, GetCommissionsRequest, IDENTITY_SERVICE_NAME, IdentityServiceClient, PlaceBetRequest, protobufPackage } from './identity.pb';

@Injectable()
export class IdentityService {
    private svc: IdentityServiceClient;

    @Inject(protobufPackage)
    private readonly client: ClientGrpc;

    public onModuleInit(): void {
        this.svc = this.client.getService<IdentityServiceClient>(IDENTITY_SERVICE_NAME);
    }

    public async validateBet(param: PlaceBetRequest) {
      // console.log(param)
      return await firstValueFrom(this.svc.validateBet(param));
    }

    public async getAgentUser(param: GetAgentUsersRequest) {
      // console.log(param)
      return await firstValueFrom(this.svc.listAgentUsers(param));
    }

    public async getCommissionProfileUsers(param: GetCommissionsRequest) {
      // console.log(param)
      return await firstValueFrom(this.svc.getCommissionProfileUsers(param));
    }
    
}
