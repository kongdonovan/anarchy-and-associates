"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalTeardown;
const logger_1 = require("../infrastructure/logger");
async function globalTeardown() {
    try {
        logger_1.logger.info('Tearing down global test database connection...');
        // Get the global MongoDB client
        const mongoClient = global.__mongoClient;
        if (mongoClient) {
            // Clear all test data
            const db = mongoClient.getDatabase();
            const collections = await db.listCollections().toArray();
            for (const collection of collections) {
                await db.collection(collection.name).deleteMany({});
            }
            // Disconnect from MongoDB
            await mongoClient.disconnect();
        }
        logger_1.logger.info('Global test database teardown completed');
    }
    catch (error) {
        logger_1.logger.error('Global test teardown failed:', error);
        // Don't throw error in teardown to avoid masking test failures
    }
}
//# sourceMappingURL=globalTeardown.js.map