import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity()
export class Cronjob {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index({unique: true})
    @Column({ type: "varchar", length: 50, nullable: false})
    name: string;

    @Index()
    @Column({type:"int", nullable: false, default: 0 })
    status: number;

    @Index()
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;

}