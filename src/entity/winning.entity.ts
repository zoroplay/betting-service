import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";
import {BET_PENDING, BET_TYPE_NORMAL} from "../constants";

@Entity()
export class Winning {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index({unique: true})
    @Column({ type: "bigint"})
    bet_id: number;

    @Index()
    @Column()
    client_id: number;

    @Index()
    @Column({ type: "bigint"})
    user_id: number;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: false })
    currency: string;

    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    winning_before_tax: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true, default: 0 })
    tax_on_winning: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true, default: 0 })
    winning_after_tax: number;

    @Index()
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;

}