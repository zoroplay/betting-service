export interface GetOddsRequest {
    producerID: number;
    eventPrefix: string;
    eventType: string;
    eventID: number;
    marketID: number;
    specifier: string;
    outcomeID: string;
}