import { Module } from '@nestjs/common';
import { BonusService } from './bonus.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BONUS_PACKAGE_NAME, protobufPackage } from './bonus.pb';
import { join } from 'path';
import 'dotenv/config'

@Module({
  imports: [
    ClientsModule.register([
        {
          name: protobufPackage,
          transport: Transport.GRPC,
          options: {
              url: process.env.BONUS_SERVICE_URI,
              package: BONUS_PACKAGE_NAME,
              protoPath: join('node_modules/sbe-service-proto/proto/bonus.proto'),
          },
        },
    ]),
  ],
  providers: [BonusService],
  exports: [BonusService]
})
export class BonusModule {}
