import { MongoDbClient } from '../infrastructure/database/mongo-client';
import { logger } from '../infrastructure/logger';

export default async function globalTeardown(): Promise<void> {
  try {
    logger.info('Tearing down global test database connection...');

    // Get the global MongoDB client
    const mongoClient = (global as any).__mongoClient as MongoDbClient;

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

    logger.info('Global test database teardown completed');
  } catch (error) {
    logger.error('Global test teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}
