import { ObjectId } from 'mongodb';
import { Staff, Case, Job, Application, Retainer, Reminder, Feedback } from '../../validation';
export declare class TestUtils {
    static generateObjectId(): ObjectId;
    static generateMockStaff(overrides?: Partial<Staff>): Staff;
    static generateMockCase(overrides?: Partial<Case>): Case;
    static generateMockJob(overrides?: Partial<Job>): Job;
    static generateMockApplication(overrides?: Partial<Application>): Application;
    static generateMockRetainer(overrides?: Partial<Retainer>): Retainer;
    static generateMockReminder(overrides?: Partial<Reminder>): Reminder;
    static generateMockFeedback(overrides?: Partial<Feedback>): Feedback;
    static clearTestDatabase(): Promise<void>;
    static ensureTestDatabaseConnection(): Promise<void>;
    static mockDiscordInteraction(overrides?: any): any;
    static createMockPermissionContext(overrides?: any): any;
    static wait(ms: number): Promise<void>;
    static runConcurrentOperations<T>(operations: (() => Promise<T>)[], concurrency?: number): Promise<T[]>;
    static generateLargeDataset<T>(generator: (index: number) => T, count: number): T[];
    static generateSnowflake(): string;
    static ensureValidSnowflake(id: string | undefined): string;
    static toZodId(id: ObjectId | string | undefined): string | undefined;
}
//# sourceMappingURL=test-utils.d.ts.map