export interface UpdateBetRequest {
    betId: number;
    status: string;
    entityType: string;
    clientId: number,
    selectionId?: number
}