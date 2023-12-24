import {Controller} from '@nestjs/common';
import {BetsService} from './bets.service';
import {GrpcMethod} from "@nestjs/microservices";
import {JsonLogger, LoggerFactory} from "json-logger-service";
import {PlaceBet} from "./interfaces/placebet.interface";
import {PlaceBetResponse} from "./interfaces/placebet.response.interface";
import {BetHistoryRequest} from "./interfaces/bet.history.request.interface";
import {BetHistoryResponse} from "./interfaces/bet.history.response.interface";
import { BookingCode } from './interfaces/booking.code.interface';
import { UpdateBetRequest } from './interfaces/update.bet.request.interface';
import { UpdateBetResponse } from './interfaces/update.bet.response.interface';
import {BetID} from "./interfaces/betid.interface";
import {Probability} from "./interfaces/betslip.interface";

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

    @GrpcMethod('BettingService', 'UpdateBet')
    UpdateBet(data: UpdateBetRequest): Promise<UpdateBetResponse> {

        return this.betsService.updateBet(data);
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

    @GrpcMethod('BettingService', 'GetProbabilityFromBetID')
    GetProbabilityFromBetID(data: BetID): Promise<Probability> {

        return this.betsService.getProbabilityFromBetID(data.betID)
    }

}

