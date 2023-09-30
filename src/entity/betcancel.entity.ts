import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity()
@Index(['event_id', 'market_id', 'specifier'], { unique: true })
export class BetCancel {

    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column({ type: "bigint", nullable: false })
    event_id: number;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: false, default: 'match' })
    event_type: string;

    @Index()
    @Column({type:"int", nullable: false })
    market_id: number;

    @Index()
    @Column({ type: "varchar", length: 200, nullable: false })
    specifier: string;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: true, default: '' })
    start_time: string;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: true, default: '' })
    end_time: string;

    @Index()
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;

}