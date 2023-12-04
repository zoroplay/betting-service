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

export interface Selections {

    selections: BetSlipSelection[];
}

export interface Probability {

    probability: number;
}