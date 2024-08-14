import { Controller } from '@nestjs/common';
import { BetsService } from './bets.service';
import { GrpcMethod } from '@nestjs/microservices';
import { JsonLogger, LoggerFactory } from 'json-logger-service';
import {
  GetVirtualBetRequest,
  GetVirtualBetResponse,
  PlaceBet,
  PlaceCasinoBetRequest,
  PlaceCasinoBetResponse,
  PlaceVirtualBetRequest,
  PlaceVirtualBetResponse,
  RollbackCasinoBetRequest,
  SettleCasinoBetRequest,
  SettleVirtualBetRequest,
  SettleVirtualBetResponse,
} from './interfaces/placebet.interface';
import { PlaceBetResponse } from './interfaces/placebet.response.interface';
import {
  BetHistoryRequest,
  FindBetRequest,
} from './interfaces/bet.history.request.interface';
import {
  BetHistoryResponse,
} from './interfaces/bet.history.response.interface';
import { UpdateBetRequest } from './interfaces/update.bet.request.interface';
import { UpdateBetResponse } from './interfaces/update.bet.response.interface';
import { BetID } from './interfaces/betid.interface';
import { Probability, ProcessCashoutRequest, ProcessCashoutResponse } from './interfaces/betslip.interface';
import { ReportService } from './report.service';
import { VirtualBetService } from './virtual-bet.service';
import { PaginationResponse } from 'src/identity/identity.pb';
import { CasinoBetService } from './casino-bet.service';
import { CashoutService } from 'src/bets/cashout.service';
import { CommonResponseObj, GamingActivityRequest, GamingActivityResponse, GetCommissionsRequest, GetTicketsRequest, GetVirtualBetsRequest, NetworkSalesRequest, SettingsById } from 'src/proto/betting.pb';
import { RetailService } from './retail.service';

@Controller('bets')
export class BetsController {
  private readonly logger: JsonLogger = LoggerFactory.createLogger(
    BetsService.name,
  );

  constructor(
    private readonly betsService: BetsService,
    private readonly virtualService: VirtualBetService,
    private readonly casinoService: CasinoBetService,
    private readonly reportService: ReportService,
    private readonly cashoutService: CashoutService,
    private readonly retailService: RetailService,
  ) {}

  @GrpcMethod('BettingService', 'CancelCasinoBet')
  CancelCasinoBet(
    data: RollbackCasinoBetRequest,
  ): Promise<PlaceCasinoBetResponse> {
    return this.casinoService.cancelCasinoBet(data);
  }

  @GrpcMethod('BettingService', 'PlaceCasinoBet')
  PlaceCasinoBet(data: PlaceCasinoBetRequest): Promise<PlaceCasinoBetResponse> {
    console.log('PlaceCasinoBet');
    return this.casinoService.placeCasinoBet(data);
  }
  @GrpcMethod('BettingService', 'PlaceBet')
  PlaceBet(data: PlaceBet): Promise<PlaceBetResponse> {
    return this.betsService.placeBet(data);
  }

  @GrpcMethod('BettingService', 'UpdateBet')
  UpdateBet(data: UpdateBetRequest): Promise<UpdateBetResponse> {
    return this.betsService.updateBet(data);
  }

  @GrpcMethod('BettingService', 'PlaceVirtualBet')
  placeVirtualBet(
    data: PlaceVirtualBetRequest,
  ): Promise<PlaceVirtualBetResponse> {
    return this.virtualService.placeVirtualBet(data);
  }

  @GrpcMethod('BettingService', 'GetVirtualBet')
  getVirtualBet(data: GetVirtualBetRequest): Promise<GetVirtualBetResponse> {
    return this.virtualService.getVirtualTicket(data);
  }

  @GrpcMethod('BettingService', 'SettleCasinoBet')
  SettleCasinoBet(
    data: SettleCasinoBetRequest,
  ): Promise<PlaceCasinoBetResponse> {
    return this.casinoService.settleCasinoBet(data);
  }


  @GrpcMethod('BettingService', 'CloseCasinoRound')
  CloseCasinoRound(
    data: SettleCasinoBetRequest,
  ): Promise<PlaceCasinoBetResponse> {
    return this.casinoService.closeCasinoRound(data);
  }
  @GrpcMethod('BettingService', 'SettleVirtualBet')
  settleVirtualBet(
    data: SettleVirtualBetRequest,
  ): Promise<SettleVirtualBetResponse> {
    return this.virtualService.settleBet(data);
  }

  @GrpcMethod('BettingService', 'GetCoupon')
  getBooking(data: FindBetRequest): Promise<CommonResponseObj> {
    console.log('GetCoupon')
    return this.betsService.findSingle(data);
  }

  @GrpcMethod('BettingService', 'BetHistory')
  BetHistory(data: BetHistoryRequest): Promise<BetHistoryResponse> {
    return this.betsService.findAll(data);
  }

  @GrpcMethod('BettingService', 'FindBet')
  FindBet(data: FindBetRequest): Promise<CommonResponseObj> {
    console.log('FindBet')
    return this.betsService.findCoupon(data);
  }

  @GrpcMethod('BettingService', 'GamingActivity')
  GamingActivity(data: GamingActivityRequest): Promise<GamingActivityResponse> {
    return this.reportService.gamingActivity(data);
  }

  @GrpcMethod('BettingService', 'GetProbabilityFromBetID')
  GetProbabilityFromBetID(data: BetID): Promise<Probability> {
    return this.cashoutService.getProbabilityFromBetID(data.betID);
  }

  @GrpcMethod('BettingService', 'GetVirtualBets')
  GetVirtualBets(data: GetVirtualBetsRequest): Promise<CommonResponseObj> {
    return this.virtualService.getTickets(data);
  }

  @GrpcMethod('BettingService', 'CashoutRequest')
  CashoutRequest(data: ProcessCashoutRequest): Promise<ProcessCashoutResponse> {
    console.log('cashout request')
    return this.cashoutService.processCashout(data);
  }

  @GrpcMethod('BettingService', 'GetRetailBets')
  GetRetailBets(data: BetHistoryRequest): Promise<CommonResponseObj> {
    return this.retailService.agentBets(data);
  }

  @GrpcMethod('BettingService', 'GetRetailVBets')
  GetRetailVBets(data: GetVirtualBetsRequest): Promise<CommonResponseObj> {
    return this.retailService.agentVBets(data);
  }

  @GrpcMethod('BettingService', 'GetSalesReport')
  GetSalesReport(data: BetHistoryRequest): Promise<CommonResponseObj> {
    return this.reportService.salesReport(data);
  }

  @GrpcMethod('BettingService', 'GetTotalSalesReport')
  GetTotalSalesReport(data: NetworkSalesRequest): Promise<CommonResponseObj> {
    return this.retailService.getTotalSales(data);
  }

  @GrpcMethod('BettingService', 'DeletePlayerData')
  deletePlayerData(data: SettingsById): Promise<CommonResponseObj> {
    return this.reportService.salesReport(data);
  }

  @GrpcMethod('BettingService', 'GetCommissions')
  getCommissions(data: GetCommissionsRequest): Promise<CommonResponseObj> {
    return this.retailService.getCommissions(data);
  }

  @GrpcMethod('BettingService', 'TicketsReport')
  getTickets(data: GetTicketsRequest): Promise<CommonResponseObj> {
    return this.reportService.ticketsReport(data);
  }
}
