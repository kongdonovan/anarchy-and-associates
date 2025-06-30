import { Collection, Db } from 'mongodb';
import { RulesChannelRepository } from '../../../infrastructure/repositories/rules-channel-repository';
import { MongoDbClient } from '../../../infrastructure/database/mongo-client';
import { TestUtils } from '../../helpers/test-utils';

// Mock dependencies
jest.mock('../../../infrastructure/database/mongo-client');
jest.mock('../../../infrastructure/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('RulesChannelRepository', () => {
  let rulesChannelRepository: RulesChannelRepository;
  let mockCollection: jest.Mocked<Collection<any>>;
  let mockDb: jest.Mocked<Db>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock collection
    mockCollection = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      find: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
      countDocuments: jest.fn(),
      deleteMany: jest.fn(),
    } as any;

    // Setup mock database
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    } as any;

    // Mock MongoDbClient
    const mockClient = {
      getDatabase: jest.fn().mockReturnValue(mockDb),
    };
    (MongoDbClient.getInstance as jest.Mock).mockReturnValue(mockClient);

    // Create repository instance
    rulesChannelRepository = new RulesChannelRepository();
  });

  describe('upsert', () => {
    it('should upsert rules channel data', async () => {
      const guildId = TestUtils.generateSnowflake();
      const channelId = TestUtils.generateSnowflake();
      const userId = TestUtils.generateSnowflake();
      const now = new Date();

      const data = {
        content: JSON.stringify({ title: 'Test Rules', content: 'Test content' }),
        lastUpdatedBy: userId,
        messageId: TestUtils.generateSnowflake(),
      };

      const expectedDoc = {
        _id: TestUtils.generateObjectId(),
        guildId,
        channelId,
        ...data,
        lastUpdatedAt: now,
        version: 2,
        createdAt: now,
        updatedAt: now,
      };

      mockCollection.findOneAndUpdate.mockResolvedValue(expectedDoc);

      const result = await rulesChannelRepository.upsertByChannelId(guildId, channelId, data);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId, channelId },
        expect.objectContaining({
          $set: expect.objectContaining({
            guildId,
            channelId,
            content: data.content,
            lastUpdatedBy: data.lastUpdatedBy,
            messageId: data.messageId,
          }),
          $setOnInsert: { createdAt: expect.any(Date) },
          $inc: { version: 1 },
        }),
        expect.objectContaining({
          upsert: true,
          returnDocument: 'after',
        })
      );

      expect(result).toMatchObject({
        _id: expectedDoc._id.toString(),
        guildId,
        channelId,
        content: data.content,
        lastUpdatedBy: data.lastUpdatedBy,
        messageId: data.messageId,
      });
    });

    it('should handle upsert without messageId', async () => {
      const guildId = TestUtils.generateSnowflake();
      const channelId = TestUtils.generateSnowflake();
      const userId = TestUtils.generateSnowflake();

      const data = {
        content: JSON.stringify({ title: 'Test Rules' }),
        lastUpdatedBy: userId,
      };

      const expectedDoc = {
        _id: TestUtils.generateObjectId(),
        guildId,
        channelId,
        ...data,
        lastUpdatedAt: new Date(),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCollection.findOneAndUpdate.mockResolvedValue(expectedDoc);

      const result = await rulesChannelRepository.upsertByChannelId(guildId, channelId, data);

      expect(result).toBeTruthy();
      expect(result.messageId).toBeUndefined();
    });

    it('should throw error on database failure', async () => {
      const guildId = TestUtils.generateSnowflake();
      const channelId = TestUtils.generateSnowflake();

      mockCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'));

      await expect(
        rulesChannelRepository.upsertByChannelId(guildId, channelId, { content: 'test', lastUpdatedBy: 'user' })
      ).rejects.toThrow('Database error');
    });
  });

  describe('findByGuildAndChannel', () => {
    it('should find rules channel by guild and channel', async () => {
      const guildId = TestUtils.generateSnowflake();
      const channelId = TestUtils.generateSnowflake();

      const mockDoc = {
        _id: TestUtils.generateObjectId(),
        guildId,
        channelId,
        content: JSON.stringify({ title: 'Test' }),
        lastUpdatedBy: TestUtils.generateSnowflake(),
        lastUpdatedAt: new Date(),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCollection.findOne.mockResolvedValue(mockDoc);

      const result = await rulesChannelRepository.findByChannelId(guildId, channelId);

      expect(mockCollection.findOne).toHaveBeenCalledWith({ guildId, channelId });
      expect(result).toMatchObject({
        _id: mockDoc._id.toString(),
        guildId,
        channelId,
        content: mockDoc.content,
      });
    });

    it('should return null if not found', async () => {
      const guildId = TestUtils.generateSnowflake();
      const channelId = TestUtils.generateSnowflake();

      mockCollection.findOne.mockResolvedValue(null);

      const result = await rulesChannelRepository.findByChannelId(guildId, channelId);

      expect(result).toBeNull();
    });
  });

  describe('findByGuild', () => {
    it('should find all rules channels for a guild', async () => {
      const guildId = TestUtils.generateSnowflake();

      const mockDocs = [
        {
          _id: TestUtils.generateObjectId(),
          guildId,
          channelId: TestUtils.generateSnowflake(),
          content: JSON.stringify({ title: 'Rules 1' }),
          lastUpdatedBy: TestUtils.generateSnowflake(),
          lastUpdatedAt: new Date(),
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: TestUtils.generateObjectId(),
          guildId,
          channelId: TestUtils.generateSnowflake(),
          content: JSON.stringify({ title: 'Rules 2' }),
          lastUpdatedBy: TestUtils.generateSnowflake(),
          lastUpdatedAt: new Date(),
          version: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockCursor = {
        toArray: jest.fn().mockResolvedValue(mockDocs),
      };
      mockCollection.find.mockReturnValue(mockCursor as any);

      const result = await rulesChannelRepository.findByGuildId(guildId);

      expect(mockCollection.find).toHaveBeenCalledWith({ guildId });
      expect(result).toHaveLength(2);
      expect(result[0]!).toMatchObject({
        guildId,
        content: mockDocs[0]!.content,
      });
      expect(result[1]!).toMatchObject({
        guildId,
        content: mockDocs[1]!.content,
      });
    });

    it('should return empty array if no channels found', async () => {
      const guildId = TestUtils.generateSnowflake();

      const mockCursor = {
        toArray: jest.fn().mockResolvedValue([]),
      };
      mockCollection.find.mockReturnValue(mockCursor as any);

      const result = await rulesChannelRepository.findByGuildId(guildId);

      expect(result).toEqual([]);
    });
  });

  describe('base repository methods', () => {
    it('should inherit from BaseMongoRepository', () => {
      // Verify that the repository has base methods
      expect(rulesChannelRepository.add).toBeDefined();
      expect(rulesChannelRepository.findById).toBeDefined();
      expect(rulesChannelRepository.update).toBeDefined();
      expect(rulesChannelRepository.delete).toBeDefined();
      expect(rulesChannelRepository.findByFilters).toBeDefined();
    });
  });
});