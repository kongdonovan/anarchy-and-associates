import { MongoDbClient } from '../../infrastructure/database/mongo-client';
import { TestUtils } from './test-utils';

export class DatabaseTestHelpers {
  private static localConnectionCreated: boolean = false;

  /**
   * Setup for individual test files - establishes connection if needed
   */
  static async setupTestDatabase(): Promise<void> {
    // Try to use global connection first
    const globalClient = (global as any).__mongoClient as MongoDbClient;
    
    if (!globalClient) {
      // Create local connection for isolated test runs
      console.log('Global MongoDB client not found, creating local connection for isolated test run...');
      const mongoClient = MongoDbClient.getInstance();
      await mongoClient.connect();
      
      // Set it globally so other helpers can access it
      (global as any).__mongoClient = mongoClient;
      this.localConnectionCreated = true;
    }
    
    // Clear data for this test file
    await TestUtils.clearTestDatabase();
  }

  /**
   * Teardown for individual test files - clears data and cleans up local connection
   */
  static async teardownTestDatabase(): Promise<void> {
    // Clear data
    await TestUtils.clearTestDatabase();
    
    // If we created a local connection, clean it up
    if (this.localConnectionCreated) {
      const mongoClient = (global as any).__mongoClient as MongoDbClient;
      if (mongoClient) {
        await mongoClient.disconnect();
      }
      (global as any).__mongoClient = null;
      this.localConnectionCreated = false;
    }
  }

  /**
   * Get the database connection (either global or local)
   */
  static getMongoClient(): MongoDbClient {
    const mongoClient = (global as any).__mongoClient as MongoDbClient;
    if (!mongoClient) {
      throw new Error('MongoDB client not initialized. Call setupTestDatabase() first.');
    }
    return mongoClient;
  }

  static async insertTestData(collectionName: string, data: any[]): Promise<void> {
    const mongoClient = this.getMongoClient();
    const db = mongoClient.getDatabase();
    const collection = db.collection(collectionName);
    
    if (data.length > 0) {
      await collection.insertMany(data);
    }
  }

  static async getCollectionCount(collectionName: string): Promise<number> {
    const mongoClient = this.getMongoClient();
    const db = mongoClient.getDatabase();
    return await db.collection(collectionName).countDocuments();
  }

  static async findDocuments(collectionName: string, filter: any = {}): Promise<any[]> {
    const mongoClient = this.getMongoClient();
    const db = mongoClient.getDatabase();
    return await db.collection(collectionName).find(filter).toArray();
  }

  static async simulateDatabaseError(): Promise<void> {
    // For testing error scenarios, we'll just throw an error instead of disconnecting
    // since we want to maintain the shared connection
    throw new Error('Simulated database error for testing');
  }

  static async restoreDatabase(): Promise<void> {
    // No-op since we maintain shared connection
    // Just clear any error state if needed
  }

  static async createIndexes(): Promise<void> {
    // Indexes are created in globalSetup, this is a no-op for individual tests
    // to avoid duplicate index creation errors
  }

  static async dropIndexes(): Promise<void> {
    // Don't drop indexes during individual tests to avoid affecting other tests
    // This will be handled in globalTeardown if needed
  }
}