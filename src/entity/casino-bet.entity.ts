import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CasinoBetStatus {
  PENDING = 'pending',
  WON = 'won',
  LOST = 'lost',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'casino-bets' })
export class CasinoBet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  clientId: number;

  @Column()
  roundId: string;

  @Column()
  transactionId: string;

  @Column()
  gameId: string;

  @Column({
    type: 'enum',
    enum: CasinoBetStatus,
    default: CasinoBetStatus.PENDING,
  })
  status: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  stake: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  winnings: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
