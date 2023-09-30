import {Global, Module} from "@nestjs/common";
import {RabbitMQModule} from "@golevelup/nestjs-rabbitmq";

@Global()
@Module({
    imports: [
        RabbitMQModule.forRoot(RabbitMQModule, {
            exchanges: [{
                name: 'betting_service.publisher',
                type: 'direct'
            }],
            uri: process.env.RABITTMQ_URI,
            defaultRpcTimeout: 15000,
            connectionInitOptions: {
                timeout: 50000
            },
            enableControllerDiscovery: true
        }),
        RabbitmqModule,
    ],
    exports: [RabbitMQModule],
    providers: [],
    controllers: [],
})
export class RabbitmqModule {
}