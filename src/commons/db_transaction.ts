import { DataSource } from 'typeorm';

import {Injectable} from "@nestjs/common";
import {TransactionRunner} from "./transaction-factory";

@Injectable()
export class DbTransaction {
    private queryRunner = this.dataSource.createQueryRunner();
    constructor(private readonly dataSource: DataSource) {}

    async start(): Promise<TransactionRunner> {
        return this.queryRunner.connect();
    }

    async commitTransaction(): Promise<void> {
        return this.queryRunner.commitTransaction();
    }

    async rollbackTransaction(): Promise<void> {
        return this.queryRunner.rollbackTransaction();
    }

    async release(): Promise<void> {
        return this.queryRunner.release();
    }
}