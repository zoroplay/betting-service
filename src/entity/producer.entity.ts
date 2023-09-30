import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity()
export class Producer {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index({unique: true})
    @Column({ type: "bigint"})
    producer_id: number;

    @Index()
    @Column({type:"int", nullable: false })
    status: number;

    @Index()
    @Column({ type: "varchar", length: 20, nullable: false })
    description: string;

    @Index()
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;

}