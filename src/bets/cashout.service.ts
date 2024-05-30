import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import * as dayjs from 'dayjs';
import { JsonLogger, LoggerFactory } from "json-logger-service";
import { Observable } from "rxjs";
import { Probability, ProbabilityBetSlipSelection, ProcessCashoutRequest, ProcessCashoutResponse } from "src/bets/interfaces/betslip.interface";
import { OddsProbability } from "src/bets/interfaces/oddsreply.interface";
import { GetOddsRequest } from "src/bets/interfaces/oddsrequest.interface";
import { BET_PENDING, BET_WON, STATUS_WON } from "src/constants";
import { Bet } from "src/entity/bet.entity";
import { BetSlip } from "src/entity/betslip.entity";
import { Cashout } from "src/entity/cashout.entity";
import { CashoutLadder } from "src/entity/cashout.ladder.entity";
import OutrightsService from 'src/bets/outrights.service.interface';

import { Repository } from "typeorm";
import { WalletService } from "src/wallet/wallet.service";
import { Winning } from "src/entity/winning.entity";
import axios from "axios";
var customParseFormat = require('dayjs/plugin/customParseFormat')

dayjs.extend(customParseFormat)


@Injectable()
export class CashoutService {
    private outrightsService: OutrightsService;

    private readonly logger: JsonLogger = LoggerFactory.createLogger(
        CashoutService.name,
    );

    constructor(
        @InjectRepository(Cashout)
        private readonly cashoutRepo: Repository<Cashout>,
        @InjectRepository(CashoutLadder)
        private readonly cashoutLadderRepo: Repository<CashoutLadder>,
        @InjectRepository(Bet)
        private readonly betRepository: Repository<Bet>,
        @InjectRepository(BetSlip)
        private readonly betSliptRepository: Repository<BetSlip>,
        @InjectRepository(Winning)
        private readonly winningRepository: Repository<Winning>,

        private readonly walletService: WalletService
    ) {}

    async checkCashoutAvailability (matchID: number, marketID: string, specifier: string, outcomeID: number) {

        const selections = await this.betSliptRepository.createQueryBuilder('betslip')
                            .select('bet_id', "odds")
                            .where("match_id = :matchID", {matchID})
                            .andWhere("market_id = :marketID", {marketID})
                            .andWhere("specifier = :specifier", {specifier})
                            .andWhere("outcome_id = :outcomeID", {outcomeID})
                            .getMany();
        // 
        if (selections.length) {
            for (const selection of selections) {   
                // find the bet             
                const bet = await this.betRepository.findOne({where: {id: selection.bet_id, status: BET_PENDING}});
                // find slips
                const slips = await this.betSliptRepository.find({where: {
                    bet_id: bet.id,
                    won: STATUS_WON
                }})
                let totalOds = 1;
                const probabilityAtTicketTime = bet.probability;
                let currentProbability = 1;

                for (const slip of slips) {
                    totalOds = totalOds * slip.odds;

                    let selectionProbability = await this.getProbability(
                        slip.producer_id,
                        slip.event_prefix,
                        selection.event_type,
                        selection.match_id,
                        selection.market_id,
                        selection.specifier,
                        selection.outcome_id,
                    );
                      
                    if (selectionProbability)
                        currentProbability = currentProbability * selectionProbability;
                }

                // get cashout value
                const cashout = await this.calculateCashout(currentProbability, probabilityAtTicketTime, bet.stake, totalOds);

                // update cashout amount on ticket
                await this.betRepository.update({
                    id: bet.id,
                }, {
                    cash_out_amount: cashout,
                    cash_out_status: cashout > 0 ? 1 : 0
                });
            }
        }
    }
    
    async calculateCashout(currentProbability: number, probabilityAtTicketTime: number, stake: number, odds: number) {
        // console.log('current Probability', currentProbability)
        // console.log('Probability at ticket time', probabilityAtTicketTime)
        // cashout value without margin
        const cashoutValueNoMargin = stake * odds * currentProbability;
        // calculate ticket value
        const ticketValueFactor = currentProbability / probabilityAtTicketTime;
        // console.log('ticket value factor', ticketValueFactor)
        const ladder = await this.cashoutLadderRepo.createQueryBuilder('ladder')
                                .where('ladder_type = :type', {type: 'low_reduction'})
                                .andWhere('ticket_value <= :value', {value: ticketValueFactor})
                                .getOne();
        if(ladder) {
            const reductionFactor = ladder.deduction_factor;
            // console.log('reduction factor', reductionFactor)

            // const cashout = cashoutValueNoMargin / reductionFactor;
            const cashout = (stake * currentProbability * odds) / reductionFactor;
            return cashout * 100;
        } else {
            return 0
        }
    }

    async processCashout({betId, amount}: ProcessCashoutRequest): Promise<ProcessCashoutResponse> {
        try {
            const bet = await this.betRepository.findOne({where: {id: betId}});

            if (bet) {
                // update bet status
                await this.betRepository.update(
                    {
                        id: betId,
                    },
                    {
                        status: BET_WON,
                        winning_after_tax: amount,
                        won: STATUS_WON
                    }
                );

                let winning = new Winning();
                winning.bet_id = betId
                winning.user_id = bet.user_id
                winning.client_id = bet.client_id
                winning.currency = bet.currency
                winning.tax_on_winning = amount;
                winning.winning_before_tax = amount
                winning.winning_after_tax = amount

                let winner : any
                // wrap in try catch
                // J. create winning
                try {
                    winner = await this.winningRepository.save(winning)
                }
                catch (e) {

                    this.logger.error("error saving winner "+e.toString())
                    return
                }

                // send amount user
                let winCreditPayload = {
                    amount: amount,
                    userId: bet.user_id,
                    username: bet.username,
                    clientId: bet.client_id,
                    subject: 'Sport Win (Cashout)',
                    description: 'Bet betID ' + bet.betslip_id,
                    source: bet.source,
                    wallet: 'sport',
                    channel: 'Internal',
                };
                // credit user wallet
                const wallet = await this.walletService.credit(winCreditPayload);
      
                return {success: true, message: 'Cashout successful', balance: wallet.data.availableBalance};

            } else {
                return {success: false, message: 'Bet not found'};
            }
        } catch(e) {
            return {success: false, message: 'Error processing cashout'};
        }
    }

    async getProbability(
        producerId: number,
        eventPrefix: string,
        eventType: string,
        eventId: number,
        marketId: number,
        specifier: string,
        outcomeId: string,
    ): Promise<number> {
            let odds = {
                eventType: eventType,
                eventPrefix: eventPrefix,
                eventID: eventId,
                producerID: producerId,
                marketID: marketId,
                outcomeID: outcomeId,
                specifier: specifier,
            };
    
        try {
            let probability = 0;
    
            if (eventType.toLowerCase() === 'match')
                probability = await this.getOddsProbability(odds);
            // else probability = await this.getOddsOutrightsProbability(odds).toPromise();
            else probability = 0;
    
            // console.log('probability outcome', oddStatus);
    
            // if oddStatus is undefined or there no probability we use a probability of 1
            return probability;
        } catch (e) {
          this.logger.error(e.toString());
            return 0;
        }
    }
    
    async getProbabilityFromBetID(betID: number): Promise<Probability> {
        try {
            const betData = await this.betRepository.findOne({
                where: {
                    id: betID,
                },
            });
        
            const slips = await this.betSliptRepository.find({
                where: {
                    bet_id: betID,
                },
            });
    
            let probability = 1;
        
            let probabilityBetSlipSelection = [];
        
            for (let slip of slips) {
                let selectionProbability = {} as ProbabilityBetSlipSelection;
        
                let pro = await this.getProbability(
                    slip.producer_id,
                    slip.event_prefix,
                    slip.event_type,
                    slip.event_id,
                    slip.market_id,
                    slip.specifier,
                    slip.outcome_id,
                );

                selectionProbability.currentProbability = pro;
                selectionProbability.eventId = slip.event_id;
                selectionProbability.eventType = slip.event_type;
                selectionProbability.eventPrefix = slip.event_prefix;
                selectionProbability.marketId = slip.market_id;
                selectionProbability.marketName = slip.market_name;
                selectionProbability.specifier = slip.specifier;
                selectionProbability.outcomeId = slip.outcome_id;
                selectionProbability.outcomeName = slip.outcome_name;
                selectionProbability.initialProbability = slip.probability;
                selectionProbability.currentProbability = pro;
                probabilityBetSlipSelection.push(selectionProbability);
                probability = probability * pro;
            }
    
            return {
                currentProbability: probability,
                initialProbability: betData.probability,
                selections: probabilityBetSlipSelection,
            };
        } catch (e) {
            this.logger.error(' error retrieving all settings ' + e.toString());
            throw e;
        }
    }
    
        // return this.oddsService.GetProbability(data);
    async getOddsProbability(data: GetOddsRequest) {
        // console.log(data);
        const matchId = `${data.eventPrefix}:${data.eventType}:${data.eventID}`
        // console.log(matchId);
        let url = `https://api.betradar.com/v1/probabilities/${matchId}/${data.marketID}`;

        if(data.specifier) {
            url = `https://api.betradar.com/v1/probabilities/${matchId}/${data.marketID}/${data.specifier}`;
        }
        
        return await axios.get(url, {
            headers: {
                'x-access-token': process.env.BETRADAR_API_TOKEN
            }
        }).then(res => {
            const match = res.data;
            if (res.data.response_code) return  0;

            const markets: any = match.odds.market;
            let probability = 0
            for (const market of markets) {
                if (market.cashout_status === 'AVAILABLE' || market.cashout_status === 1) {
                    const outcome = market.outcome.find(({ id }) => id === data.outcomeID);
                    if (outcome) probability = outcome.probabilities;
                    else probability = 0
                } else {
                    probability = 0
                }
            }
            
            return probability;
            
        }).catch(err => {
            console.log('Error, fetching probability', err)
            return 0
        });

    }
    
    
    getOddsOutrightsProbability(
        data: GetOddsRequest,
    ): Observable<OddsProbability> {
        return this.outrightsService.GetProbability(data);
    }


}