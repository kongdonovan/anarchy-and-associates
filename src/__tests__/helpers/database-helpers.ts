import { MongoDbClient } from '../../infrastructure/database/mongo-client';
import { TestUtils } from './test-utils';

export class DatabaseTestHelpers {
  static async setupTestDatabase(): Promise<void> {
    await TestUtils.ensureTestDatabaseConnection();
    await TestUtils.clearTestDatabase();
  }

  static async teardownTestDatabase(): Promise<void> {
    await TestUtils.clearTestDatabase();
  }

  static async insertTestData(collectionName: string, data: any[]): Promise<void> {
    const mongoClient = MongoDbClient.getInstance();
    const db = mongoClient.getDatabase();
    const collection = db.collection(collectionName);
    
    if (data.length > 0) {
      await collection.insertMany(data);
    }
  }

  static async getCollectionCount(collectionName: string): Promise<number> {
    const mongoClient = MongoDbClient.getInstance();
    const db = mongoClient.getDatabase();
    return await db.collection(collectionName).countDocuments();
  }

  static async findDocuments(collectionName: string, filter: any = {}): Promise<any[]> {
    const mongoClient = MongoDbClient.getInstance();
    const db = mongoClient.getDatabase();
    return await db.collection(collectionName).find(filter).toArray();
  }

  static async simulateDatabaseError(): Promise<void> {
    // Simulate database disconnection
    const mongoClient = MongoDbClient.getInstance();
    await mongoClient.disconnect();
  }

  static async restoreDatabase(): Promise<void> {
    const mongoClient = MongoDbClient.getInstance();
    await mongoClient.connect();
  }

  static async createIndexes(): Promise<void> {
    const mongoClient = MongoDbClient.getInstance();
    const db = mongoClient.getDatabase();
    
    // Create indexes for performance testing
    await db.collection('staff').createIndex({ guildId: 1, userId: 1 }, { unique: true });
    await db.collection('cases').createIndex({ guildId: 1, caseNumber: 1 }, { unique: true });
    await db.collection('jobs').createIndex({ guildId: 1, status: 1 });
    await db.collection('applications').createIndex({ guildId: 1, jobId: 1, applicantId: 1 });
    await db.collection('auditLogs').createIndex({ guildId: 1, timestamp: -1 });
  }

  static async dropIndexes(): Promise<void> {
    const mongoClient = MongoDbClient.getInstance();
    const db = mongoClient.getDatabase();
    const collections = ['staff', 'cases', 'jobs', 'applications', 'auditLogs'];
    
    for (const collectionName of collections) {
      try {
        await db.collection(collectionName).dropIndexes();
      } catch (error) {
        // Ignore errors if collection doesn't exist
      }
    }
  }
}