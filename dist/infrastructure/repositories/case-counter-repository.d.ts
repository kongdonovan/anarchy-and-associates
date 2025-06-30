import { CaseCounter } from '../../validation';
import { BaseMongoRepository } from './base-mongo-repository';
export declare class CaseCounterRepository extends BaseMongoRepository<CaseCounter> {
    constructor();
    getNextCaseNumber(guildId: string): Promise<number>;
    getCurrentCount(guildId: string, year?: number): Promise<number>;
    resetYearlyCounter(guildId: string, year: number): Promise<void>;
}
//# sourceMappingURL=case-counter-repository.d.ts.map