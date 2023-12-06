import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity()
@Index(['bet_id', 'event_id', 'market_id', 'specifier', 'outcome_id'], { unique: true })
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
    user_id: number;

    @Index()
    @Column({ type: "bigint", nullable: false })
    event_id: number;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    selection_id: string;

    @Index()
    @Column({ type: "bigint", nullable: false })
    match_id: number;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: false, default: 'match' })
    event_type: string;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    event_name: string;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    tournament_name: string;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    category_name: string;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    sport_name: string;

    @Index()
    @Column({type:"int", nullable: false })
    producer_id: number;

    @Index()
    @Column({type:"int", nullable: false })
    market_id: number;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    market_name: string;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    specifier: string;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    outcome_id: string;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    outcome_name: string;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    odds: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true, default: 1 })
    probability: number;

    @Index()
    @Column({type:"int", nullable: false, default: -1 })
    won: number;

    @Index()
    @Column({type:"int", nullable: false, default: 0 })
    status: number;

    @Index()
    @Column({type:"int", nullable: false, default: 0 })
    is_live: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true })
    void_factor: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true })
    dead_heat_factor: number;

    @Index()
    @Column({type:"bigint", nullable: true })
    settlement_id: number;

    @Index()
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;

}