export interface PlaceBet {
  selections: BetSlip[];
  clientId: number;
  userId?: number | undefined;
  stake: number;
  source: string;
  ipAddress: string;
  betType: string;
  username?: string | undefined;
  minBonus: number;
  maxBonus: number;
  minOdds: number;
  maxOdds: number;
  type: string;
  combos: Combo[];
  isBooking: number;
  useBonus: boolean;
}

export interface RollbackCasinoBetRequest {
  transactionId: string;
}

export interface SettleCasinoBetRequest {
  transactionId: string;
  winnings: number;
  provider: string;
}
export interface SettleCasinoBetResponse {
  success: boolean;
  message: string;
}

export interface BetSlip {
  eventName: string;
  eventType: string;
  eventId: number;
  eventPrefix: string;
  producerId: number;
  marketId: number;
  marketName: string;
  specifier: string;
  outcomeId: string;
  outcomeName: string;
  odds: number;
  sportId: number;
  sport: string;
  tournament: string;
  category: string;
  matchId: number;
  awayTeam: string;
  homeTeam: string;
  type: string;
  fixed: boolean;
  selectionId: string;
  eventDate: string;
}

export interface Combo {}

export interface PlaceVirtualBetRequest {
  userId: number;
  clientId: number;
  roundId: string;
  transactionId: string;
  transactionCategory: string;
  gameId: string;
  stake: number;
  username: string;
}

export interface PlaceVirtualBetResponse {
  success: boolean;
  status: number;
  message: string;
  data?: VirtualBetData | undefined;
}

export interface GetVirtualBetRequest {
  clientId: number;
  gameId: string;
  transactionId: string;
}

export interface GetVirtualBetResponse {
  success: boolean;
  gameId: boolean;
  transactionId: boolean;
  data?: VirtualBetData | undefined;
}

export interface VirtualBetData {
  userId: number;
  clientId: number;
  betId: number;
  roundId: string;
  transactionId: string;
  transactionCategory: string;
  gameId: string;
  stake: number;
  gameCycleClosed: number;
  username: string;
}
export interface PlaceCasinoBetRequest {
  userId: number;
  clientId: number;
  roundId: string;
  transactionId: string;
  gameId: string;
  gameName?: string | undefined;
  stake: number;
  winnings?: number | undefined;
  gameNumber?: string | undefined;
  source?: string | undefined;
  cashierTransactionId?: string | undefined;
}

export interface PlaceCasinoBetResponse {
  success: boolean;
  status: number;
  message: string;
  data?: CasinoBetData | undefined;
}

export interface CasinoBetData {
  transactionId: string;
  balance: number;
}

export interface SettleVirtualBetRequest {
  userId: number;
  clientId: number;
  amount: number;
  jackpot: number;
  roundId: string;
  category: string;
  gameCycleClosed: number;
}

export interface SettleVirtualBetResponse {
  success: boolean;
  message: string;
}
