import {Module} from "@nestjs/common";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Setting} from "../entity/setting.entity";
import {GrpcController} from "./grpc.controller";
import {GrpcService} from "./grpc.service";
import { BetSlip } from "src/entity/betslip.entity";
import { Bet } from "src/entity/bet.entity";
import { OddsLive } from "src/entity/oddslive.entity";
import { OddsPrematch } from "src/entity/oddsprematch.entity";

@Module({
    imports: [TypeOrmModule.forFeature([Bet,BetSlip,Setting, OddsLive, OddsPrematch]),
    ],
    controllers: [GrpcController],
    providers: [GrpcService]
})
export class GrpcModule {
}