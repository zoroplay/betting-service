import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";
import {BET_PENDING, BET_TYPE_NORMAL, CASH_OUT_STATUS_PENDING} from "../constants";

@Entity()
export class Bet {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column()
    client_id: number;

    @Index()
    @Column({ type: "bigint"})
    user_id: number;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: false })
    betslip_id: string;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    stake: number;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: false })
    currency: string;

    @Index()
    @Column({ type: "varchar", length: 100, nullable: true })
    bet_type: string;

    @Index()
    @Column({type:"int", nullable: false, default: BET_TYPE_NORMAL })
    bet_category: string;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    total_odd: number;

    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    possible_win: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false, default: 0 })
    stake_after_tax: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true, default: 0 })
    tax_on_stake: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true, default: 0 })
    tax_on_winning: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true, default: 0 })
    winning_after_tax: number;

    @Index()
    @Column({type:"int", nullable: false })
    total_bets: number;

    @Index()
    @Column({type:"int", nullable: false, default: BET_PENDING })
    status: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
    cash_out_amount: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true, default: 0 })
    probability: number;
    
    @Index()
    @Column({type:"int", nullable: false, default: CASH_OUT_STATUS_PENDING })
    cash_out_status: number;

    @Index()
    @Column({type:"int", nullable: false, default: -1 })
    won: number;

    @Index()
    @Column({ type: "varchar", length: 50, nullable: false })
    source: string;

    @Index()
    @Column({ type: "varchar", length: 50, nullable: true })
    ip_address: string;

    @Index()
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;

}