import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'casino_bets' })
@Index(['round_id', 'transaction_id'], { unique: true })
export class CasinoBet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'bigint', nullable: false })
  client_id: number;

  @Index()
  @Column({ type: 'bigint', nullable: false })
  user_id: number;

  @Index()
  @Column({ type: 'varchar', length: 150 })
  round_id: string;

  @Index()
  @Column({ type: 'varchar', length: 150 })
  game_id: string;

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  game_name: string;

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  game_number: string;

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  source: string;

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  cashier_transaction_id: string;

  @Index()
  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  stake: number;

  @Index()
  @Column({
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
    default: 0,
  })
  winnings: number;

  @Index()
  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  commission: number;

  @Index()
  @Column({ type: 'varchar', length: 150 })
  transaction_id: string;

  @Index()
  @Column({ type: 'tinyint', nullable: true, default: 0 })
  status: number;

  @Index()
  @CreateDateColumn()
  created_at: string;

  @Index()
  @UpdateDateColumn()
  updated_at: string;
}
