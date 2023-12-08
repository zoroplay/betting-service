import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,} from "typeorm";
import { Booking } from "./booking.entity";

@Entity()
@Index(['booking_id', 'event_id', 'market_id', 'specifier', 'outcome_id'], { unique: true })
export class BookingSelection {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column({ type: "bigint"})
    booking_id: number;
    
    @Index()
    @ManyToOne(() => Booking, (booking) => booking.selections)
    booking: Booking;

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
    @Column({ type: "varchar", length: 100, nullable: false })
    event_date: string;

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
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;

}