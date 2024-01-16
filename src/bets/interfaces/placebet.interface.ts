
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

export interface Combo {
}
