import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity()
@Index(['event_id', 'market_id', 'specifier', 'outcome_id'], { unique: true })
export class OddsPrematch {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column({ type: "bigint", nullable: false })
    event_id: number;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: false, default: 'match' })
    event_type: string;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    event_name: string;

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
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    odds: number;

    @Index()
    @Column({type:"int", nullable: false })
    status: number;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    status_name: string;

    @Index()
    @Column({type:"int", nullable: false })
    active: number;

    @Index()
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;

}