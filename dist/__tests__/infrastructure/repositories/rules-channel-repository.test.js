"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rules_channel_repository_1 = require("../../../infrastructure/repositories/rules-channel-repository");
const mongo_client_1 = require("../../../infrastructure/database/mongo-client");
const test_utils_1 = require("../../helpers/test-utils");
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
    let rulesChannelRepository;
    let mockCollection;
    let mockDb;
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
        };
        // Setup mock database
        mockDb = {
            collection: jest.fn().mockReturnValue(mockCollection),
        };
        // Mock MongoDbClient
        const mockClient = {
            getDatabase: jest.fn().mockReturnValue(mockDb),
        };
        mongo_client_1.MongoDbClient.getInstance.mockReturnValue(mockClient);
        // Create repository instance
        rulesChannelRepository = new rules_channel_repository_1.RulesChannelRepository();
    });
    describe('upsert', () => {
        it('should upsert rules channel data', async () => {
            const guildId = test_utils_1.TestUtils.generateSnowflake();
            const channelId = test_utils_1.TestUtils.generateSnowflake();
            const userId = test_utils_1.TestUtils.generateSnowflake();
            const now = new Date();
            const data = {
                content: JSON.stringify({ title: 'Test Rules', content: 'Test content' }),
                lastUpdatedBy: userId,
                messageId: test_utils_1.TestUtils.generateSnowflake(),
            };
            const expectedDoc = {
                _id: test_utils_1.TestUtils.generateObjectId(),
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
            expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith({ guildId, channelId }, expect.objectContaining({
                $set: expect.objectContaining({
                    guildId,
                    channelId,
                    content: data.content,
                    lastUpdatedBy: data.lastUpdatedBy,
                    messageId: data.messageId,
                }),
                $setOnInsert: { createdAt: expect.any(Date) },
                $inc: { version: 1 },
            }), expect.objectContaining({
                upsert: true,
                returnDocument: 'after',
            }));
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
            const guildId = test_utils_1.TestUtils.generateSnowflake();
            const channelId = test_utils_1.TestUtils.generateSnowflake();
            const userId = test_utils_1.TestUtils.generateSnowflake();
            const data = {
                content: JSON.stringify({ title: 'Test Rules' }),
                lastUpdatedBy: userId,
            };
            const expectedDoc = {
                _id: test_utils_1.TestUtils.generateObjectId(),
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
            const guildId = test_utils_1.TestUtils.generateSnowflake();
            const channelId = test_utils_1.TestUtils.generateSnowflake();
            mockCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'));
            await expect(rulesChannelRepository.upsertByChannelId(guildId, channelId, { content: 'test', lastUpdatedBy: 'user' })).rejects.toThrow('Database error');
        });
    });
    describe('findByGuildAndChannel', () => {
        it('should find rules channel by guild and channel', async () => {
            const guildId = test_utils_1.TestUtils.generateSnowflake();
            const channelId = test_utils_1.TestUtils.generateSnowflake();
            const mockDoc = {
                _id: test_utils_1.TestUtils.generateObjectId(),
                guildId,
                channelId,
                content: JSON.stringify({ title: 'Test' }),
                lastUpdatedBy: test_utils_1.TestUtils.generateSnowflake(),
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
            const guildId = test_utils_1.TestUtils.generateSnowflake();
            const channelId = test_utils_1.TestUtils.generateSnowflake();
            mockCollection.findOne.mockResolvedValue(null);
            const result = await rulesChannelRepository.findByChannelId(guildId, channelId);
            expect(result).toBeNull();
        });
    });
    describe('findByGuild', () => {
        it('should find all rules channels for a guild', async () => {
            const guildId = test_utils_1.TestUtils.generateSnowflake();
            const mockDocs = [
                {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId,
                    channelId: test_utils_1.TestUtils.generateSnowflake(),
                    content: JSON.stringify({ title: 'Rules 1' }),
                    lastUpdatedBy: test_utils_1.TestUtils.generateSnowflake(),
                    lastUpdatedAt: new Date(),
                    version: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId,
                    channelId: test_utils_1.TestUtils.generateSnowflake(),
                    content: JSON.stringify({ title: 'Rules 2' }),
                    lastUpdatedBy: test_utils_1.TestUtils.generateSnowflake(),
                    lastUpdatedAt: new Date(),
                    version: 2,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];
            const mockCursor = {
                toArray: jest.fn().mockResolvedValue(mockDocs),
            };
            mockCollection.find.mockReturnValue(mockCursor);
            const result = await rulesChannelRepository.findByGuildId(guildId);
            expect(mockCollection.find).toHaveBeenCalledWith({ guildId });
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                guildId,
                content: mockDocs[0].content,
            });
            expect(result[1]).toMatchObject({
                guildId,
                content: mockDocs[1].content,
            });
        });
        it('should return empty array if no channels found', async () => {
            const guildId = test_utils_1.TestUtils.generateSnowflake();
            const mockCursor = {
                toArray: jest.fn().mockResolvedValue([]),
            };
            mockCollection.find.mockReturnValue(mockCursor);
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
//# sourceMappingURL=rules-channel-repository.test.js.map