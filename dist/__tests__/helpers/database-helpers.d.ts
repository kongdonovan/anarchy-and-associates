export declare class DatabaseTestHelpers {
    static setupTestDatabase(): Promise<void>;
    static teardownTestDatabase(): Promise<void>;
    static insertTestData(collectionName: string, data: any[]): Promise<void>;
    static getCollectionCount(collectionName: string): Promise<number>;
    static findDocuments(collectionName: string, filter?: any): Promise<any[]>;
    static simulateDatabaseError(): Promise<void>;
    static restoreDatabase(): Promise<void>;
    static createIndexes(): Promise<void>;
    static dropIndexes(): Promise<void>;
}
//# sourceMappingURL=database-helpers.d.ts.map