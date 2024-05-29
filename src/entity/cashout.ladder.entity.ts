import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity()
export class CashoutLadder {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Column({ type: "varchar", length: 50})
    ladder_type: string;

    @Column({type:"decimal", precision: 20, scale: 4})
    ticket_value: number;

    @Column({type:"decimal", precision: 20, scale: 1})
    deduction_factor: number;

}