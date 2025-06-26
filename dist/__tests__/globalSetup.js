"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalSetup;
const dotenv_1 = require("dotenv");
const mongo_client_1 = require("../infrastructure/database/mongo-client");
const logger_1 = require("../infrastructure/logger");
// Load test environment variables
(0, dotenv_1.config)({ path: '.env.test' });
// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.MONGODB_URI =
    process.env.MONGODB_URI ||
        'mongodb://localhost:27017/anarchy_associates_test';
process.env.MONGODB_DB_NAME =
    process.env.MONGODB_DB_NAME || 'anarchy_associates_test';
async function globalSetup() {
    try {
        logger_1.logger.info('Setting up global test database connection...');
        // Initialize and connect to MongoDB
        const mongoClient = mongo_client_1.MongoDbClient.getInstance();
        await mongoClient.connect();
        // Clear any existing test data
        const db = mongoClient.getDatabase();
        const collections = await db.listCollections().toArray();
        for (const collection of collections) {
            await db.collection(collection.name).deleteMany({});
        }
        // Create indexes for performance
        await db
            .collection('staff')
            .createIndex({ guildId: 1, userId: 1 }, { unique: true });
        await db
            .collection('cases')
            .createIndex({ guildId: 1, caseNumber: 1 }, { unique: true });
        await db.collection('jobs').createIndex({ guildId: 1, status: 1 });
        await db
            .collection('applications')
            .createIndex({ guildId: 1, jobId: 1, applicantId: 1 });
        await db.collection('auditLogs').createIndex({ guildId: 1, timestamp: -1 });
        // Store connection globally for test access
        global.__mongoClient = mongoClient;
        logger_1.logger.info('Global test database setup completed');
    }
    catch (error) {
        logger_1.logger.error('Global test setup failed:', error);
        throw error;
    }
}
//# sourceMappingURL=globalSetup.js.map