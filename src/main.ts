import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {JsonLoggerService} from 'json-logger-service';

async function bootstrap() {

  /*
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://localhost:5672'],
      queue: 'cats_queue',
      queueOptions: {
        durable: false
      },
    },
  });
  */

  const app = await NestFactory.create(AppModule);
  app.useLogger(new JsonLoggerService('Betting service'));
  await app.listen(3000);
}
bootstrap();
