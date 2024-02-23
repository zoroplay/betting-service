export interface PlaceCasinoBet {
  userId: number;
  clientId: number;
  roundId: string;
  transactionId: string;
  gameId: string;
  stake: number;
  winnings?: number;
}

export interface CreditCasinoBet {
  transactionId: string;
  winnings: number;
}

export interface RollbackCasinoBet {
  transactionId: string;
}
