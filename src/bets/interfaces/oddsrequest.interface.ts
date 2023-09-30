export interface GetOddsRequest {
    producerID: number;
    eventID: number;
    marketID: number;
    specifier: string;
    outcomeID: string;
}