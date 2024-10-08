export const BET_PENDING = 0
export const BET_LOST = 1
export const BET_WON = 2
export const BET_VOIDED = 3
export const BET_CANCELLED = -1
export const BET_CASHOUT  = 5

export const BET_TYPE_NORMAL  = 0
export const BET_TYPE_FREEBET  = 1
export const BET_TYPE_BONUS  = 2
export const BET_TYPE_OUTRIGHT  = 3
export const BET_TYPE_JACKPOT  = 4
export const BET_TYPE_STAKE_BONUS  = 5

export const BETSLIP_PROCESSING_PENDING = 0
export const BETSLIP_PROCESSING_SETTLED = 1
export const BETSLIP_PROCESSING_COMPLETED = 2
export const BETSLIP_PROCESSING_CANCELLED = -1
export const BETSLIP_PROCESSING_VOIDED = 3

export const STATUS_NOT_LOST_OR_WON = -1
export const STATUS_WON = 1
export const STATUS_LOST = 0

export const CASH_OUT_STATUS_PENDING = 0 //GAME RUNNING AND HAS CASH OUT
export const CASH_OUT_STATUS_LOST = 1 // GAME LOST, AND YOU DID NOT CASH OUT
export const CASH_OUT_STATUS_WON = 2 //GAME WON VIA CASH OUT
export const CASH_OUT_STATUS_EXPIRED = -1 // GAME WON, BUT YOU DID NOT CASH OUT

export const TRANSACTION_TYPE_WINNING  = 1
export const TRANSACTION_TYPE_BET_CANCEL  = 2 
export const TRANSACTION_TYPE_BET_ROLLBACK  = 3
export const TRANSACTION_TYPE_PLACE_BET  = 4
export const TRANSACTION_TYPE_BET_CANCELLED  = 5
