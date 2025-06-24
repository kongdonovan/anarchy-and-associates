import { ObjectId } from 'mongodb';
import { Staff } from '../../domain/entities/staff';
import { Case } from '../../domain/entities/case';
import { Job } from '../../domain/entities/job';
import { Application } from '../../domain/entities/application';
export declare class TestUtils {
    static generateObjectId(): ObjectId;
    static generateMockStaff(overrides?: Partial<Staff>): Staff;
    static generateMockCase(overrides?: Partial<Case>): Case;
    static generateMockJob(overrides?: Partial<Job>): Job;
    static generateMockApplication(overrides?: Partial<Application>): Application;
    static clearTestDatabase(): Promise<void>;
    static ensureTestDatabaseConnection(): Promise<void>;
    static mockDiscordInteraction(overrides?: any): any;
    static createMockPermissionContext(overrides?: any): any;
    static wait(ms: number): Promise<void>;
    static runConcurrentOperations<T>(operations: (() => Promise<T>)[], concurrency?: number): Promise<T[]>;
    static generateLargeDataset<T>(generator: (index: number) => T, count: number): T[];
}
//# sourceMappingURL=test-utils.d.ts.map