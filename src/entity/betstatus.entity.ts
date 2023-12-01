import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class BetStatus {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index({ unique: true })
  @Column({ type: 'bigint' })
  bet_id: number;

  @Index()
  @Column({ type: 'int', nullable: false })
  status: number;

  @Index()
  @Column({ type: 'varchar', length: 300, nullable: false })
  description: string;

  @Index()
  @CreateDateColumn()
  created: string;

  @Index()
  @UpdateDateColumn()
  updated: string;
}
