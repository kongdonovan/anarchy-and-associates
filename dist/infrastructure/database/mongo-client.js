"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDbClient = void 0;
const mongodb_1 = require("mongodb");
const logger_1 = require("../logger");
class MongoDbClient {
    constructor() {
        this.client = null;
        this.database = null;
        this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
        this.databaseName = process.env.MONGODB_DB_NAME || 'anarchy_associates';
    }
    static getInstance() {
        if (!MongoDbClient.instance) {
            MongoDbClient.instance = new MongoDbClient();
        }
        return MongoDbClient.instance;
    }
    async connect() {
        try {
            if (this.client) {
                logger_1.logger.info('MongoDB client already connected');
                return;
            }
            logger_1.logger.info('Connecting to MongoDB...');
            this.client = new mongodb_1.MongoClient(this.connectionString);
            await this.client.connect();
            this.database = this.client.db(this.databaseName);
            // Test the connection
            await this.database.admin().ping();
            logger_1.logger.info('Successfully connected to MongoDB');
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to MongoDB:', error);
            throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async disconnect() {
        try {
            if (this.client) {
                await this.client.close();
                this.client = null;
                this.database = null;
                logger_1.logger.info('Disconnected from MongoDB');
            }
        }
        catch (error) {
            logger_1.logger.error('Error disconnecting from MongoDB:', error);
            throw error;
        }
    }
    getDatabase() {
        if (!this.database) {
            // Check for global connection instance
            const globalClient = global.__mongoClient;
            if (globalClient && globalClient.database) {
                return globalClient.database;
            }
            throw new Error('Database not connected. Call connect() first.');
        }
        return this.database;
    }
    getClient() {
        if (!this.client) {
            throw new Error('Client not connected. Call connect() first.');
        }
        return this.client;
    }
    isConnected() {
        return this.client !== null && this.database !== null;
    }
}
exports.MongoDbClient = MongoDbClient;
//# sourceMappingURL=mongo-client.js.map