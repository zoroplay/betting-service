
export class CreateSettingDto {
    client_id: number;
    tax_on_stake: number;
    tax_on_winning: number;
    minimum_stake: number;
    maximum_stake: number;
    maximum_winning: number;
    maximum_selections: number;
    mts_limit_id: number;
}
