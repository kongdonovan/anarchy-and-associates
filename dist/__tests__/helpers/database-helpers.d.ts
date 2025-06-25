import { MongoDbClient } from '../../infrastructure/database/mongo-client';
export declare class DatabaseTestHelpers {
    private static localConnectionCreated;
    /**
     * Setup for individual test files - establishes connection if needed
     */
    static setupTestDatabase(): Promise<void>;
    /**
     * Teardown for individual test files - clears data and cleans up local connection
     */
    static teardownTestDatabase(): Promise<void>;
    /**
     * Get the database connection (either global or local)
     */
    static getMongoClient(): MongoDbClient;
    static insertTestData(collectionName: string, data: any[]): Promise<void>;
    static getCollectionCount(collectionName: string): Promise<number>;
    static findDocuments(collectionName: string, filter?: any): Promise<any[]>;
    static simulateDatabaseError(): Promise<void>;
    static restoreDatabase(): Promise<void>;
    static createIndexes(): Promise<void>;
    static dropIndexes(): Promise<void>;
}
//# sourceMappingURL=database-helpers.d.ts.map