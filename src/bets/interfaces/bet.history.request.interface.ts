export interface BetHistoryRequest {
    userId: number;
    status: string;
    from?: string;
    to?: string;
    clientId: number,
    page?: number,
    perPage: number,
    betslipId: string,
    username: string,
}

export interface FindBetRequest{
    clientId: number,
    betslipId: string,
}