import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity()
@Index(['event_id', 'market_id', 'specifier', 'outcome_id'], { unique: true })
export class Settlement {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column({ type: "bigint", nullable: false })
    event_id: number;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: false, default: 'match' })
    event_type: string;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: false, default: 'sr' })
    event_prefix: string;

    @Index()
    @Column({type:"int", nullable: false, default: 3 })
    producer_id: number;

    @Index()
    @Column({type:"int", nullable: false })
    market_id: number;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    specifier: string;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    outcome_id: string;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: true })
    ft_score: string;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: true })
    ht_score: string;

    @Index()
    @Column({type:"int", nullable: false })
    status: number;

    @Index()
    @Column({type:"int", nullable: false, default: 0 })
    processed: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    void_factor: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    dead_heat_factor: number;

    @Index()
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;

}