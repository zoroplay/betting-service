export interface SettingsResponse {
    clientID: number;
    taxOnStake: number;
    taxOnWinning: number;
    minimumStake: number;
    maximumStake: number;
    maximumWinning: number;
    maximumSelections: number;
    mtsLimitID: number;
    currency: string;
    url?: string;
    created: string;
    updated: string;
}