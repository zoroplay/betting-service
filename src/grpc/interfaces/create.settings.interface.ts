export interface CreateSetting {
    clientID: number;
    taxOnStake: number;
    taxOnWinning: number;
    minimumStake: number;
    maximumStake: number;
    maximumWinning: number;
    maximumSelections: number;
    mtsLimitID: number;
    currency: string;
    url: string;
}