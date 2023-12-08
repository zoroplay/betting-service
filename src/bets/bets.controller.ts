import {Controller} from '@nestjs/common';
import {BetsService} from './bets.service';
import {GrpcMethod} from "@nestjs/microservices";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {PlaceBet} from "../grpc/interfaces/placebet.interface";
import {PlaceBetResponse} from "../grpc/interfaces/placebet.response.interface";
import {BetHistoryRequest} from "../grpc/interfaces/bet.history.request.interface";
import {BetHistoryResponse} from "../grpc/interfaces/bet.history.response.interface";
import { BookingCode } from 'src/grpc/interfaces/booking.code.interface';

@Controller('bets')
export class BetsController {

    private readonly logger: JsonLogger = LoggerFactory.createLogger(BetsService.name);

    constructor(

        private readonly betsService: BetsService,
    ) {}

    @GrpcMethod('BettingService', 'PlaceBet')
    PlaceBet(data: PlaceBet): Promise<PlaceBetResponse> {

        return this.betsService.placeBet(data);
    }

    @GrpcMethod('BettingService', 'BookBet')
    bookBet(data: PlaceBet): Promise<PlaceBetResponse> {
        return this.betsService.bookBet(data);
    }

    @GrpcMethod('BettingService', 'GetBooking')
    getBooking(data: BookingCode): Promise<PlaceBetResponse> {
        return this.betsService.getBooking(data);
    }

    @GrpcMethod('BettingService', 'BetHistory')
    BetHistory(data: BetHistoryRequest): Promise<BetHistoryResponse> {

        return this.betsService.findAll(data)
    }

}

