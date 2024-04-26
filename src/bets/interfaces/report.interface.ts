export interface GamingActivityRequest {
    productType: string;
    groupBy: string;
    from: string;
    to: string;
    username: string;
    betType: string;
    source: string;
    eventType: string;
    displayType: string;
    clientID: number
}

export interface GamingActivityResponse {
    status: number;
    success: boolean;
    message: string;
    data?: any;
    error?: string;
}

export interface GetVirtualBetsRequest {
    clientId: number;
    from: string;
    to: string;
    betType?: number;
    username?: string;
    page: number;
}
