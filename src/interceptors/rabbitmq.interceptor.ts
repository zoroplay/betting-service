import {CallHandler, ExecutionContext, Injectable, NestInterceptor} from "@nestjs/common";
import {isRabbitContext} from "@golevelup/nestjs-rabbitmq";

@Injectable()
export class RabbitMQInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler<any>) {
        const contextType = context.getType<'http' | 'rmq'>();

        // Do nothing if this is a RabbitMQ event
        if (isRabbitContext(context)) {

            return next.handle();
        }

        // Execute custom interceptor logic for HTTP request/response
        return next.handle();
    }
}