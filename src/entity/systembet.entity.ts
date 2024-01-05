import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity('system_bets')
@Index(['bet_id'], { unique: true })
export class BetSlip {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column()
    client_id: number;

    @Index()
    @Column({ type: "bigint"})
    bet_id: number;

    @Index()
    @Column({ type: "bigint"})
    combination_size: number;

    @Index()
    @Column({ type: "bigint", nullable: false })
    no_of_combos: number;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    combined: string;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    odds: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true })
    min_stake: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    max_win: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true })
    max_bonus: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, default: 0.00 })
    winnings: number;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    games: string;

    @Index()
    @Column({type:"int", nullable: false, default: 0 })
    status: number;

    @Index()
    @Column({type:"varchar", nullable: true })
    settled_date: string;

    @Index()
    @CreateDateColumn()
    created_at: string;

    @Index()
    @UpdateDateColumn()
    updated_at: string;

}