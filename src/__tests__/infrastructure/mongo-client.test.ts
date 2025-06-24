import { MongoDbClient } from '../../infrastructure/database/mongo-client';

describe('MongoDbClient', () => {
  let mongoClient: MongoDbClient;

  beforeAll(() => {
    mongoClient = MongoDbClient.getInstance();
  });

  afterAll(async () => {
    if (mongoClient.isConnected()) {
      await mongoClient.disconnect();
    }
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = MongoDbClient.getInstance();
      const instance2 = MongoDbClient.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('connection management', () => {
    it('should initially not be connected', () => {
      expect(mongoClient.isConnected()).toBe(false);
    });

    it('should throw error when trying to get database before connecting', () => {
      expect(() => mongoClient.getDatabase()).toThrow('Database not connected. Call connect() first.');
    });

    // Note: This test requires a running MongoDB instance
    it.skip('should connect to MongoDB successfully', async () => {
      await mongoClient.connect();
      expect(mongoClient.isConnected()).toBe(true);
    });

    it.skip('should disconnect from MongoDB successfully', async () => {
      if (mongoClient.isConnected()) {
        await mongoClient.disconnect();
        expect(mongoClient.isConnected()).toBe(false);
      }
    });
  });
});