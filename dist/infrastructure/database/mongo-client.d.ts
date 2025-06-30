import { MongoClient, Db } from 'mongodb';
export declare class MongoDbClient {
    private static instance;
    private client;
    private database;
    private readonly connectionString;
    private readonly databaseName;
    private constructor();
    static getInstance(): MongoDbClient;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getDatabase(): Db;
    getClient(): MongoClient;
    isConnected(): boolean;
}
//# sourceMappingURL=mongo-client.d.ts.map