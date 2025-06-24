"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseTestHelpers = void 0;
const mongo_client_1 = require("../../infrastructure/database/mongo-client");
const test_utils_1 = require("./test-utils");
class DatabaseTestHelpers {
    static async setupTestDatabase() {
        await test_utils_1.TestUtils.ensureTestDatabaseConnection();
        await test_utils_1.TestUtils.clearTestDatabase();
    }
    static async teardownTestDatabase() {
        await test_utils_1.TestUtils.clearTestDatabase();
    }
    static async insertTestData(collectionName, data) {
        const mongoClient = mongo_client_1.MongoDbClient.getInstance();
        const db = mongoClient.getDatabase();
        const collection = db.collection(collectionName);
        if (data.length > 0) {
            await collection.insertMany(data);
        }
    }
    static async getCollectionCount(collectionName) {
        const mongoClient = mongo_client_1.MongoDbClient.getInstance();
        const db = mongoClient.getDatabase();
        return await db.collection(collectionName).countDocuments();
    }
    static async findDocuments(collectionName, filter = {}) {
        const mongoClient = mongo_client_1.MongoDbClient.getInstance();
        const db = mongoClient.getDatabase();
        return await db.collection(collectionName).find(filter).toArray();
    }
    static async simulateDatabaseError() {
        // Simulate database disconnection
        const mongoClient = mongo_client_1.MongoDbClient.getInstance();
        await mongoClient.disconnect();
    }
    static async restoreDatabase() {
        const mongoClient = mongo_client_1.MongoDbClient.getInstance();
        await mongoClient.connect();
    }
    static async createIndexes() {
        const mongoClient = mongo_client_1.MongoDbClient.getInstance();
        const db = mongoClient.getDatabase();
        // Create indexes for performance testing
        await db.collection('staff').createIndex({ guildId: 1, userId: 1 }, { unique: true });
        await db.collection('cases').createIndex({ guildId: 1, caseNumber: 1 }, { unique: true });
        await db.collection('jobs').createIndex({ guildId: 1, status: 1 });
        await db.collection('applications').createIndex({ guildId: 1, jobId: 1, applicantId: 1 });
        await db.collection('auditLogs').createIndex({ guildId: 1, timestamp: -1 });
    }
    static async dropIndexes() {
        const mongoClient = mongo_client_1.MongoDbClient.getInstance();
        const db = mongoClient.getDatabase();
        const collections = ['staff', 'cases', 'jobs', 'applications', 'auditLogs'];
        for (const collectionName of collections) {
            try {
                await db.collection(collectionName).dropIndexes();
            }
            catch (error) {
                // Ignore errors if collection doesn't exist
            }
        }
    }
}
exports.DatabaseTestHelpers = DatabaseTestHelpers;
//# sourceMappingURL=database-helpers.js.map