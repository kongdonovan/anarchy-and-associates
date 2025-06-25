"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseTestHelpers = void 0;
const mongo_client_1 = require("../../infrastructure/database/mongo-client");
const test_utils_1 = require("./test-utils");
class DatabaseTestHelpers {
    /**
     * Setup for individual test files - establishes connection if needed
     */
    static async setupTestDatabase() {
        // Try to use global connection first
        const globalClient = global.__mongoClient;
        if (!globalClient) {
            // Create local connection for isolated test runs
            console.log('Global MongoDB client not found, creating local connection for isolated test run...');
            const mongoClient = mongo_client_1.MongoDbClient.getInstance();
            await mongoClient.connect();
            // Set it globally so other helpers can access it
            global.__mongoClient = mongoClient;
            this.localConnectionCreated = true;
        }
        // Clear data for this test file
        await test_utils_1.TestUtils.clearTestDatabase();
    }
    /**
     * Teardown for individual test files - clears data and cleans up local connection
     */
    static async teardownTestDatabase() {
        // Clear data
        await test_utils_1.TestUtils.clearTestDatabase();
        // If we created a local connection, clean it up
        if (this.localConnectionCreated) {
            const mongoClient = global.__mongoClient;
            if (mongoClient) {
                await mongoClient.disconnect();
            }
            global.__mongoClient = null;
            this.localConnectionCreated = false;
        }
    }
    /**
     * Get the database connection (either global or local)
     */
    static getMongoClient() {
        const mongoClient = global.__mongoClient;
        if (!mongoClient) {
            throw new Error('MongoDB client not initialized. Call setupTestDatabase() first.');
        }
        return mongoClient;
    }
    static async insertTestData(collectionName, data) {
        const mongoClient = this.getMongoClient();
        const db = mongoClient.getDatabase();
        const collection = db.collection(collectionName);
        if (data.length > 0) {
            await collection.insertMany(data);
        }
    }
    static async getCollectionCount(collectionName) {
        const mongoClient = this.getMongoClient();
        const db = mongoClient.getDatabase();
        return await db.collection(collectionName).countDocuments();
    }
    static async findDocuments(collectionName, filter = {}) {
        const mongoClient = this.getMongoClient();
        const db = mongoClient.getDatabase();
        return await db.collection(collectionName).find(filter).toArray();
    }
    static async simulateDatabaseError() {
        // For testing error scenarios, we'll just throw an error instead of disconnecting
        // since we want to maintain the shared connection
        throw new Error('Simulated database error for testing');
    }
    static async restoreDatabase() {
        // No-op since we maintain shared connection
        // Just clear any error state if needed
    }
    static async createIndexes() {
        // Indexes are created in globalSetup, this is a no-op for individual tests
        // to avoid duplicate index creation errors
    }
    static async dropIndexes() {
        // Don't drop indexes during individual tests to avoid affecting other tests
        // This will be handled in globalTeardown if needed
    }
}
exports.DatabaseTestHelpers = DatabaseTestHelpers;
DatabaseTestHelpers.localConnectionCreated = false;
//# sourceMappingURL=database-helpers.js.map