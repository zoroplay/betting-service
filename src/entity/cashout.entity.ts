import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity({name: 'cashouts'})
export class Cashout {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index()
    @Column({ type: "bigint", nullable: false})
    bet_id: number;

    @Column({type:"decimal", precision: 20, scale: 2})
    amount: number;

    @Column({type:"int", nullable: false, default: 0 })
    accepted: number;

    @Column({type:"int", nullable: false, default: 1 })
    status: number;

    @Index()
    @CreateDateColumn()
    created_at: string;

    @Index()
    @UpdateDateColumn()
    updated_at: string;
}