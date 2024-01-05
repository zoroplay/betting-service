export interface GamingActivityRequest {
    productType: string;
    groupBy: string;
    from: string;
    to: string;
    username: string;
    betType: string;
    source: string;
    eventType: string;
    clientID: number
}

export interface GamingActivityResponse {
    status: number;
    success: boolean;
    message: string;
    data?: any;
    error?: string;
}