
export interface PlaceBet {
    betslip: BetSlip[];
    clientId: number;
    userId: number;
    stake: number;
    source: string;
    ipAddress: string;
    betType: string;
    username: string;
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
