import {Module} from "@nestjs/common";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Setting} from "../entity/setting.entity";
import {GrpcController} from "./grpc.controller";
import {GrpcService} from "./grpc.service";

@Module({
    imports: [TypeOrmModule.forFeature([Setting]),
    ],
    controllers: [GrpcController],
    providers: [GrpcService]
})
export class GrpcModule {
}