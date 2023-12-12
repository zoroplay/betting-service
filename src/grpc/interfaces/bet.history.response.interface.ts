export interface BetHistoryResponse {
    bets: any;
    /** Last pagination page */
    lastPage: number;
    /** From data index */
    from: number;
    /** to data index */
    to: number;
    /** how many records are remaining */
    remainingRecords: number;
}