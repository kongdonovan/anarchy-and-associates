"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const information_channel_service_1 = require("../../application/services/information-channel-service");
const test_utils_1 = require("../helpers/test-utils");
describe('InformationChannelService', () => {
    let service;
    let mockRepository;
    let mockDiscordClient;
    let mockGuild;
    let mockChannel;
    let mockMessage;
    // Helper to create valid InformationChannel mock
    const createMockInfoChannel = (overrides = {}) => ({
        _id: test_utils_1.TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        channelId: '234567890123456789',
        content: 'Test content',
        createdBy: '123456789012345678',
        lastUpdatedBy: '123456789012345678',
        lastUpdatedAt: new Date(),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    });
    beforeEach(() => {
        // Setup mock repository
        mockRepository = {
            findByChannelId: jest.fn(),
            findByGuildId: jest.fn(),
            upsertByChannelId: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn(),
            count: jest.fn(),
            exists: jest.fn(),
            aggregate: jest.fn(),
            transaction: jest.fn(),
        };
        // Setup mock Discord objects
        mockMessage = {
            id: 'message123',
            edit: jest.fn(),
            delete: jest.fn(),
        };
        mockChannel = {
            id: '234567890123456789',
            type: 0, // GuildText channel type
            messages: {
                fetch: jest.fn().mockResolvedValue(mockMessage),
            },
            send: jest.fn().mockResolvedValue(mockMessage),
            bulkDelete: jest.fn(),
        };
        mockGuild = {
            id: '123456789012345678',
            channels: {
                fetch: jest.fn().mockResolvedValue(mockChannel),
            },
        };
        mockDiscordClient = {
            guilds: {
                fetch: jest.fn().mockResolvedValue(mockGuild),
            },
            user: {
                id: 'bot123',
            },
        };
        service = new information_channel_service_1.InformationChannelService(mockRepository, mockDiscordClient);
    });
    describe('updateInformationChannel', () => {
        const request = {
            guildId: '123456789012345678',
            channelId: '234567890123456789',
            title: 'Test Information',
            content: 'This is test content',
            updatedBy: '123456789012345678',
        };
        it('should create a new information channel when none exists', async () => {
            mockRepository.findByChannelId.mockResolvedValue(null);
            mockRepository.upsertByChannelId.mockResolvedValue({
                _id: test_utils_1.TestUtils.generateObjectId().toString(),
                guildId: '123456789012345678',
                channelId: '234567890123456789',
                messageId: '345678901234567890',
                content: 'This is test content',
                lastUpdatedBy: '123456789012345678',
                lastUpdatedAt: new Date(),
                createdBy: '123456789012345678',
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            const result = await service.updateInformationChannel(request);
            expect(mockRepository.findByChannelId).toHaveBeenCalledWith('123456789012345678', '234567890123456789');
            expect(mockChannel.send).toHaveBeenCalled();
            expect(mockRepository.upsertByChannelId).toHaveBeenCalledWith('123456789012345678', '234567890123456789', expect.objectContaining({
                content: 'This is test content',
                color: 0xFF0000,
                messageId: 'message123',
                lastUpdatedBy: '345678901234567890',
            }));
            expect(result.messageId).toBe('message123');
        });
        it('should update existing information channel and message', async () => {
            const existingInfo = createMockInfoChannel({
                messageId: 'oldMessage123',
                content: 'Old content',
                lastUpdatedBy: 'oldUser',
            });
            mockRepository.findByChannelId.mockResolvedValue(existingInfo);
            mockRepository.upsertByChannelId.mockResolvedValue({
                ...existingInfo,
                content: request.content,
                lastUpdatedBy: request.updatedBy,
                lastUpdatedAt: new Date(),
            });
            await service.updateInformationChannel(request);
            expect(mockMessage.edit).toHaveBeenCalled();
            expect(mockChannel.send).not.toHaveBeenCalled();
        });
        it('should create new message if existing message is not found', async () => {
            const existingInfo = createMockInfoChannel({
                messageId: 'nonExistentMessage',
                content: 'Old content',
                lastUpdatedBy: 'oldUser',
            });
            mockRepository.findByChannelId.mockResolvedValue(existingInfo);
            mockChannel.messages.fetch = jest.fn().mockRejectedValue(new Error('Unknown Message'));
            mockRepository.upsertByChannelId.mockResolvedValue({
                ...existingInfo,
                messageId: 'message123',
                content: request.content,
                lastUpdatedBy: request.updatedBy,
            });
            await service.updateInformationChannel(request);
            expect(mockChannel.send).toHaveBeenCalled();
        });
        it('should handle channel not being a text channel', async () => {
            mockGuild.channels.fetch = jest.fn().mockResolvedValue(null);
            await expect(service.updateInformationChannel(request))
                .rejects.toThrow('Channel not found or is not a text channel');
        });
    });
    describe('getInformationChannel', () => {
        it('should return information channel if it exists', async () => {
            const info = createMockInfoChannel({
                content: 'Content',
                lastUpdatedBy: '345678901234567890'
            });
            mockRepository.findByChannelId.mockResolvedValue(info);
            const result = await service.getInformationChannel('123456789012345678', '234567890123456789');
            expect(result).toEqual(info);
            expect(mockRepository.findByChannelId).toHaveBeenCalledWith('123456789012345678', '234567890123456789');
        });
        it('should return null if information channel does not exist', async () => {
            mockRepository.findByChannelId.mockResolvedValue(null);
            const result = await service.getInformationChannel('123456789012345678', '234567890123456789');
            expect(result).toBeNull();
        });
    });
    describe('listInformationChannels', () => {
        it('should return all information channels for a guild', async () => {
            const channels = [
                createMockInfoChannel({
                    channelId: 'channel1',
                    content: 'Content 1',
                    lastUpdatedBy: '345678901234567890'
                }),
                createMockInfoChannel({
                    channelId: 'channel2',
                    content: 'Content 2',
                    lastUpdatedBy: 'user456'
                }),
            ];
            mockRepository.findByGuildId.mockResolvedValue(channels);
            const result = await service.listInformationChannels('123456789012345678');
            expect(result).toEqual(channels);
            expect(mockRepository.findByGuildId).toHaveBeenCalledWith('123456789012345678');
        });
    });
    describe('deleteInformationChannel', () => {
        it('should delete information channel and message', async () => {
            const info = createMockInfoChannel({
                messageId: 'message123',
                content: 'Content',
                lastUpdatedBy: '345678901234567890'
            });
            mockRepository.findByChannelId.mockResolvedValue(info);
            mockRepository.delete.mockResolvedValue(true);
            const result = await service.deleteInformationChannel('123456789012345678', '234567890123456789');
            expect(result).toBe(true);
            expect(mockMessage.delete).toHaveBeenCalled();
            expect(mockRepository.delete).toHaveBeenCalledWith(info._id.toString());
        });
        it('should return false if information channel does not exist', async () => {
            mockRepository.findByChannelId.mockResolvedValue(null);
            const result = await service.deleteInformationChannel('123456789012345678', '234567890123456789');
            expect(result).toBe(false);
            expect(mockRepository.delete).not.toHaveBeenCalled();
        });
        it('should continue deletion even if Discord message deletion fails', async () => {
            const info = createMockInfoChannel({
                messageId: 'message123',
                content: 'Content',
                lastUpdatedBy: '345678901234567890'
            });
            mockRepository.findByChannelId.mockResolvedValue(info);
            mockRepository.delete.mockResolvedValue(true);
            mockMessage.delete.mockRejectedValue(new Error('Unknown Message'));
            const result = await service.deleteInformationChannel('123456789012345678', '234567890123456789');
            expect(result).toBe(true);
            expect(mockRepository.delete).toHaveBeenCalledWith(info._id.toString());
        });
    });
    describe('syncInformationMessage', () => {
        it('should sync existing information message', async () => {
            const info = createMockInfoChannel({
                messageId: 'message123',
                content: 'Content',
                lastUpdatedBy: '345678901234567890'
            });
            mockRepository.findByChannelId.mockResolvedValue(info);
            const result = await service.syncInformationMessage('123456789012345678', '234567890123456789');
            expect(result).toBe(true);
            expect(mockMessage.edit).toHaveBeenCalled();
        });
        it('should create new message if existing message not found', async () => {
            const info = createMockInfoChannel({
                messageId: 'nonExistentMessage',
                content: 'Content',
                lastUpdatedBy: '345678901234567890'
            });
            mockRepository.findByChannelId.mockResolvedValue(info);
            mockChannel.messages.fetch = jest.fn().mockRejectedValue(new Error('Unknown Message'));
            const result = await service.syncInformationMessage('123456789012345678', '234567890123456789');
            expect(result).toBe(true);
            expect(mockChannel.send).toHaveBeenCalled();
            expect(mockRepository.update).toHaveBeenCalledWith(info._id.toString(), { messageId: 'message123' });
        });
        it('should return false if no information channel exists', async () => {
            mockRepository.findByChannelId.mockResolvedValue(null);
            const result = await service.syncInformationMessage('123456789012345678', '234567890123456789');
            expect(result).toBe(false);
        });
        it('should return false on error', async () => {
            const info = createMockInfoChannel({
                content: 'Content',
                lastUpdatedBy: '345678901234567890'
            });
            mockRepository.findByChannelId.mockResolvedValue(info);
            mockGuild.channels.fetch = jest.fn().mockRejectedValue(new Error('Channel not found'));
            const result = await service.syncInformationMessage('123456789012345678', '234567890123456789');
            expect(result).toBe(false);
        });
    });
});
//# sourceMappingURL=information-channel-service.test.js.map