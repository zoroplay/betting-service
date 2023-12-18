export interface BetHistoryRequest {
    userId: number;
    status: string;
    from?: string;
    to?: string;
    clientId: number,
    page?: number,
    perPage: number,
    betslipId: string,
}