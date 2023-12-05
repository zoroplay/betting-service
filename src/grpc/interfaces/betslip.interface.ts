export interface BetSlipSelection {
    eventName: string;
    eventType: string;
    eventId: number;
    producerId: number;
    marketId: number;
    marketName: string;
    specifier: string;
    outcomeId: string;
    outcomeName: string;
    odds: number;
    sportId: number;
}

export interface ProbabilityBetSlipSelection {
    eventId: number;
    marketId: number;
    marketName: string;
    specifier: string;
    outcomeId: string;
    outcomeName: string;
    sportId: number;
    currentProbability: number;
    initialProbability: number;
}

export interface Probability {
    currentProbability: number;
    initialProbability: number;
    selections: ProbabilityBetSlipSelection[];
}