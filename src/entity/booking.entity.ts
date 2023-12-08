import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity()
export class Booking {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column()
    client_id: number;

    @Index()
    @Column({ type: "bigint", nullable: true})
    user_id: number;

    @Index()
    @Column({type:"varchar", length: 150, nullable: true })
    betslip_id: string;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    stake: number;

    @Index()
    @Column({type:"varchar", length: 150, nullable: true })
    bet_type: string;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    total_odd: number;

    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    possible_win: number;

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