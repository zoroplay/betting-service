export interface GetOddsReply {
    odds: number;
    status: number;
    statusName: string;
    active: number;
}

export interface OddsProbability {
    probability: number;
}