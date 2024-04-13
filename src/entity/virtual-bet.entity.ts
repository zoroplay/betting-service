import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity({name: 'virtual_bets'})
@Index(['round_id', 'transaction_id'], { unique: true })
export class VirtualBet {

    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column({ type: "bigint", nullable: false })
    client_id: number;

    @Index()
    @Column({ type: "bigint", nullable: false })
    user_id: number;
    
    @Index()
    @Column({ type: "varchar", length: 50, nullable: false })
    username: string;

    @Index()
    @Column({ type: "varchar", length: 150 })
    round_id: string;

    @Index()
    @Column({ type: "varchar", length: 150 })
    game_id: string;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    stake: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true, default: 0 })
    winnings: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
    jackpot_amount: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
    commission: number;

    @Index()
    @Column({ type: "varchar", length: 150 })
    transaction_id: string;

    @Index()
    @Column({ type: "varchar", length: 150 })
    transaction_category: string;

    @Index()
    @Column({ type: "tinyint", nullable: true, default: 0 })
    game_cycle_closed: number;

    @Index()
    @Column({ type: "tinyint", nullable: true, default: 0 })
    status: number;

    @Index()
    @CreateDateColumn()
    created_at: string;

    @Index()
    @UpdateDateColumn()
    updated_at: string;

}