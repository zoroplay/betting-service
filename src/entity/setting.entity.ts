import {Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,} from "typeorm";

@Entity()
export class Setting {
    @PrimaryGeneratedColumn({ type: "bigint"})
    id: number;

    @Index({unique: true})
    @Column()
    client_id: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    tax_on_stake: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    tax_on_winning: number;

    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false })
    minimum_stake: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: false, default: 0 })
    maximum_stake: number;

    @Index()
    @Column({ type: "decimal", precision: 20, scale: 2, nullable: true, default: 0 })
    maximum_winning: number;

    @Index()
    @Column({ type: "int", nullable: true, default: 0 })
    maximum_selections: number;

    @Index()
    @Column({ type: "int", nullable: true, default: 4793 })
    mts_limit_id: number;

    @Index()
    @Column({ type: "varchar", nullable: true, default: 'NGN' })
    currency: string;

    @Index()
    @CreateDateColumn()
    created: string;

    @Index()
    @UpdateDateColumn()
    updated: string;
}