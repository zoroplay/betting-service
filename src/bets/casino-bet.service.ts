import { HttpStatus, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { InjectRepository } from '@nestjs/typeorm';
import { CasinoBet } from 'src/entity/casino-bet.entity';
import {
  PlaceCasinoBetRequest,
  PlaceCasinoBetResponse,
  RollbackCasinoBetRequest,
} from './interfaces/placebet.interface';
import { v4 as uuidv4 } from 'uuid';
import { SettleCasinoBetRequest } from 'src/proto/betting.pb';

var customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(customParseFormat);

@Injectable()
export class CasinoBetService {
  constructor(
    @InjectRepository(CasinoBet)
    private readonly casinoBetRepo: Repository<CasinoBet>,
  ) {}

  async cancelCasinoBet(
    data: RollbackCasinoBetRequest,
  ): Promise<PlaceCasinoBetResponse> {
    try {
      const { transactionId } = data;

      const operator = await this.casinoBetRepo.findOneBy({
        transaction_id: transactionId,
      });
      
      if (!operator)
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message: 'TransactionID wrong',
          data: null,
        };

      if (operator.status === 3) 
        return {
          success: false,
          status: HttpStatus.CREATED,
          message: 'Transaction already processed',
          data: null,
        };

      await this.casinoBetRepo.update(
        { transaction_id: transactionId },
        {
          status: 3,
        },
      );

      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Casino Bet cancelled Succesfully ',
        data: {
          transactionId: operator.transaction_id,
          balance: 0,
        },
      };
    } catch (e) {
      console.log(e.message);
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Something went wrong: ' + e.message,
        data: null,
      };
    }
  }

  async closeCasinoRound(
    data: SettleCasinoBetRequest,
  ): Promise<PlaceCasinoBetResponse> {
    try {
      const { transactionId } = data;

      await this.casinoBetRepo.update(
        { round_id: transactionId, status: 0 },
        {
          status: 2,
        },
      );

      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Casino Bet cancelled Succesfully ',
        data: {
          transactionId: uuidv4(),
          balance: 0,
        },
      };
    } catch (e) {
      console.log(e.message);
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Something went wrong: ' + e.message,
        data: null,
      };
    }
  }

  async placeCasinoBet(
    data: PlaceCasinoBetRequest,
  ): Promise<PlaceCasinoBetResponse> {
    try {
      const betData = new CasinoBet();
      betData.client_id = data.clientId;
      betData.game_id = data.gameId;
      betData.round_id = data.roundId;
      betData.transaction_id = data.transactionId;
      betData.stake = data.stake;
      betData.user_id = data.userId;
      betData.username = data.username;
      betData.game_name = data.gameName ? data.gameName : null;
      betData.game_number = data.gameNumber ? data.gameNumber : null;
      betData.source = data.source ? data.source : null;
      betData.cashier_transaction_id = data.cashierTransactionId
        ? data.cashierTransactionId
        : null;

      const bet = await this.casinoBetRepo.save(betData);

      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Casino Bet Placed',
        data: {
          transactionId: bet.id,
          balance: 0,
        },
      };
    } catch (e) {
      console.log(e.message);
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Something went wrong: ' + e.message,
        data: null,
      };
    }
  }

  async settleCasinoBet(
    data: SettleCasinoBetRequest,
  ): Promise<PlaceCasinoBetResponse> {
    try {
      // console.log(data);
      const { winnings, transactionId } = data;

      const bet = await this.casinoBetRepo.find({
        where: {
          transaction_id: transactionId,
        }
      });

      if (!bet.length) {// return error if bet not found
        return {
          success: false,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Bet not found',
          data: {
            transactionId: transactionId,
            balance: 0,
          },
        };
      } 

      if (data.provider === 'smart-soft' && bet[0].status !== 0 ) { // check if bet has been settled and return message
        return {
          success: false,
          status: HttpStatus.BAD_REQUEST,
          message: 'Bet already closed',
          data: {
            transactionId: bet[0].id,
            balance: 0,
          },
        };
      }

      let status = 0;
      if (winnings > 0) {
        status = 1;
      } else {
        status = 2;
      }

      if (data.provider === 'evoplay')
      for (const singleBet of bet) {
        // update bet status
        await this.casinoBetRepo.update(
          { transaction_id: transactionId },
          {
            winnings: winnings + singleBet.winnings,
            status,
          },
        );
      }
      


      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Bet Settled Successfully',
        data: {
          transactionId: bet[0].id,
          balance: 0,
        },
      };
    } catch (e) {
      console.log('settlement error', e.message);
      return {
        success: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Something went wrong: ' + e.message,
        data: null,
      };
    }
  }

  async getCommissionReport (from, to, userIds) {
    const startDate = dayjs(from, 'DD-MM-YYYY').format('YYYY-MM-DD');
    const endDate = dayjs(to, 'DD-MM-YYYY').format('YYYY-MM-DD');

    return await this.casinoBetRepo.createQueryBuilder('c')
                    .addSelect('COUNT(*)', 'totalTickets')
                    .addSelect('SUM(stake)', 'totalSales')
                    .addSelect('SUM(winnings)', 'totalWinnings')
                    .addSelect('SUM(comission)', 'totalCommissions')
                    .where('user_id IN (:...userIds)', {userIds})
                    .andWhere('created_at >= :startDate', {startDate})
                    .andWhere('created_at <= :endDate', {endDate})
                    .andWhere("status IN (:...status)", {status: [1, 2]})
                    .getRawOne();

}
}
