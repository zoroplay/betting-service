import {Module} from "@nestjs/common";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Setting} from "../entity/setting.entity";
import {GrpcController} from "./grpc.controller";
import {GrpcService} from "./grpc.service";
import { BetSlip } from "src/entity/betslip.entity";
import { Bet } from "src/entity/bet.entity";
import { OddsLive } from "src/entity/oddslive.entity";
import { OddsPrematch } from "src/entity/oddsprematch.entity";
import {ClientsModule, Transport} from "@nestjs/microservices";
import {join} from "path";

@Module({
    imports: [
        TypeOrmModule.forFeature([Bet,BetSlip,Setting, OddsLive, OddsPrematch]),
        ClientsModule.register([
                {
                    name: 'ODDS_PACKAGE',
                    transport: Transport.GRPC,
                    options: {
                        package: 'protobuf',
                        protoPath: join(__dirname, '../bets/odds.proto'),
                        url: process.env.FEEDS_SERVICE_GRPC_URI
                    },
                },
            ]
        ),
    ],
    controllers: [GrpcController],
    providers: [GrpcService]
})
export class GrpcModule {
}