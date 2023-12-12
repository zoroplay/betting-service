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
    /** total records for the period */
    totalRecords: number;
    /** total number of stake for the period */
    totalStake: number;
    currentPage: number;
}