import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity()
export class BetClosure {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index({unique: true})
    @Column({ type: "bigint", nullable: false})
    bet_id: number;

    @Index()
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;

}