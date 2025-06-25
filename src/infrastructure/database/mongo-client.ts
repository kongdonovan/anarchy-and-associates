import { MongoClient, Db } from 'mongodb';
import { logger } from '../logger';

export class MongoDbClient {
  private static instance: MongoDbClient;
  private client: MongoClient | null = null;
  private database: Db | null = null;
  private readonly connectionString: string;
  private readonly databaseName: string;

  private constructor() {
    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.databaseName = process.env.MONGODB_DB_NAME || 'anarchy_associates';
  }

  public static getInstance(): MongoDbClient {
    if (!MongoDbClient.instance) {
      MongoDbClient.instance = new MongoDbClient();
    }
    return MongoDbClient.instance;
  }

  public async connect(): Promise<void> {
    try {
      if (this.client) {
        logger.info('MongoDB client already connected');
        return;
      }

      logger.info('Connecting to MongoDB...');
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.database = this.client.db(this.databaseName);
      
      // Test the connection
      await this.database.admin().ping();
      logger.info('Successfully connected to MongoDB');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.database = null;
        logger.info('Disconnected from MongoDB');
      }
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  public getDatabase(): Db {
    if (!this.database) {
      // Check for global connection instance
      const globalClient = (global as any).__mongoClient as MongoDbClient;
      if (globalClient && globalClient.database) {
        return globalClient.database;
      }
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.database;
  }

  public isConnected(): boolean {
    return this.client !== null && this.database !== null;
  }
}