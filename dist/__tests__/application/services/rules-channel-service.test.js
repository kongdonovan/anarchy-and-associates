"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rules_channel_service_1 = require("../../../application/services/rules-channel-service");
const rules_channel_repository_1 = require("../../../infrastructure/repositories/rules-channel-repository");
const discord_js_1 = require("discord.js");
// Mock the external dependencies
jest.mock('../../../infrastructure/repositories/rules-channel-repository');
jest.mock('discord.js');
jest.mock('../../../infrastructure/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));
describe('RulesChannelService', () => {
    let rulesChannelService;
    let mockRulesChannelRepository;
    let mockDiscordClient;
    let mockTextChannel;
    let mockMessage;
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        // Initialize mocks
        mockRulesChannelRepository = new rules_channel_repository_1.RulesChannelRepository();
        mockDiscordClient = new discord_js_1.Client({ intents: [] });
        // Mock Message
        mockMessage = {
            id: '987654321098765432',
            edit: jest.fn(),
            delete: jest.fn(),
            author: {
                id: 'bot123456789'
            },
        };
        // Mock TextChannel
        mockTextChannel = {
            id: '123456789012345678',
            type: 0, // TextChannel type
            send: jest.fn().mockResolvedValue(mockMessage),
            messages: {
                fetch: jest.fn(),
            },
            bulkDelete: jest.fn(),
        };
        // Mock client channel fetching
        mockDiscordClient.channels = {
            fetch: jest.fn().mockResolvedValue(mockTextChannel),
            cache: new Map(),
        };
        // Mock guild fetching
        const mockGuild = {
            channels: {
                fetch: jest.fn().mockResolvedValue(mockTextChannel)
            }
        };
        mockDiscordClient.guilds = {
            fetch: jest.fn().mockResolvedValue(mockGuild),
            cache: new Map()
        };
        rulesChannelService = new rules_channel_service_1.RulesChannelService(mockRulesChannelRepository, mockDiscordClient);
    });
    describe('generateDefaultRules', () => {
        it('should generate anarchy-specific rules template', () => {
            const template = rules_channel_service_1.RulesChannelService.generateDefaultRules('anarchy');
            expect(template.title).toBe('⚖️ Code of Professional Conduct | Anarchy & Associates');
            expect(template.content).toContain('These bylaws govern all conduct');
            expect(template.rules).toHaveLength(8);
            expect(template.color).toBe(0x000000);
            expect(template.footer).toContain('Violations are subject to disciplinary review');
            expect(template.showNumbers).toBe(true);
            expect(template.additionalFields).toHaveLength(3);
            // Verify rule structure
            const firstRule = template.rules?.[0];
            expect(firstRule).toBeDefined();
            expect(firstRule).toMatchObject({
                id: 'rule_1',
                title: 'Professional Decorum & Mutual Respect',
                category: 'conduct',
                severity: 'critical',
                order: 1,
                isActive: true,
            });
            expect(firstRule?.content).toContain('professionalism and courtesy');
            expect(firstRule?.createdAt).toBeInstanceOf(Date);
            expect(firstRule?.updatedAt).toBeInstanceOf(Date);
        });
        it('should generate general rules template', () => {
            const template = rules_channel_service_1.RulesChannelService.generateDefaultRules('general');
            expect(template.title).toBe('§ Community Guidelines');
            expect(template.content).toContain('professional and respectful environment');
            expect(template.rules).toHaveLength(5);
            expect(template.showNumbers).toBe(true);
            expect(template.additionalFields).toBeUndefined();
            // Verify general rule has different content
            const firstRule = template.rules?.[0];
            expect(firstRule).toBeDefined();
            expect(firstRule?.title).toBe('Professional Courtesy');
            expect(firstRule?.severity).toBe('critical');
        });
        it('should generate general template by default', () => {
            const template = rules_channel_service_1.RulesChannelService.generateDefaultRules();
            expect(template.title).toBe('§ Community Guidelines');
        });
    });
    describe('updateRulesChannel', () => {
        const mockRequest = {
            guildId: '123456789012345678',
            channelId: '123456789012345678',
            title: 'Test Rules',
            content: 'Test content',
            updatedBy: '987654321098765432',
            rules: [
                {
                    id: 'test_rule_1',
                    title: 'Test Rule',
                    content: 'This is a test rule',
                    category: 'general',
                    severity: 'medium',
                    order: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                },
            ],
        };
        it('should successfully update rules channel', async () => {
            const mockRulesChannel = {
                _id: '507f1f77bcf86cd799439011',
                guildId: mockRequest.guildId,
                channelId: mockRequest.channelId,
                messageId: '111111111111111111',
                title: mockRequest.title,
                content: mockRequest.content,
                rules: mockRequest.rules || [],
                lastUpdatedBy: mockRequest.updatedBy,
                lastUpdatedAt: new Date(),
                createdBy: mockRequest.updatedBy,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockRulesChannelRepository.upsertByChannelId.mockResolvedValue(mockRulesChannel);
            mockTextChannel.messages.fetch.mockResolvedValue(mockMessage);
            mockMessage.edit.mockResolvedValue(mockMessage);
            await rulesChannelService.updateRulesChannel(mockRequest);
            expect(mockRulesChannelRepository.upsertByChannelId).toHaveBeenCalledWith(mockRequest.guildId, mockRequest.channelId, expect.objectContaining({
                title: mockRequest.title,
                content: mockRequest.content,
                rules: mockRequest.rules,
                lastUpdatedBy: mockRequest.updatedBy,
                messageId: mockMessage.id,
            }));
            expect(mockDiscordClient.guilds.fetch).toHaveBeenCalledWith(mockRequest.guildId);
            expect(mockMessage.edit).toHaveBeenCalled();
        });
        it('should create new message if none exists', async () => {
            const mockRulesChannel = {
                _id: '507f1f77bcf86cd799439011',
                guildId: mockRequest.guildId,
                channelId: mockRequest.channelId,
                messageId: '111111111111111111',
                title: mockRequest.title,
                content: mockRequest.content,
                rules: mockRequest.rules || [],
                lastUpdatedBy: mockRequest.updatedBy,
                lastUpdatedAt: new Date(),
                createdBy: mockRequest.updatedBy,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockRulesChannelRepository.upsertByChannelId.mockResolvedValue(mockRulesChannel);
            // Mock messages.fetch to return an empty Map for first call (no existing message)
            // and a Map with filter method for second call (cleanup check)
            const emptyMessagesMap = new Map();
            const messagesMapWithFilter = new Map();
            messagesMapWithFilter.filter = jest.fn().mockReturnValue(new Map());
            mockTextChannel.messages.fetch
                .mockResolvedValueOnce(emptyMessagesMap) // First call for existing message
                .mockResolvedValueOnce(messagesMapWithFilter); // Second call in createNewRulesMessage
            mockTextChannel.send.mockResolvedValue(mockMessage);
            await rulesChannelService.updateRulesChannel(mockRequest);
            expect(mockTextChannel.send).toHaveBeenCalled();
            expect(mockRulesChannelRepository.upsertByChannelId).toHaveBeenCalledTimes(1);
        });
        it('should handle channel not found error', async () => {
            mockDiscordClient.guilds.fetch.mockRejectedValue(new Error('Channel not found'));
            await expect(rulesChannelService.updateRulesChannel(mockRequest))
                .rejects.toThrow('Channel not found');
        });
        it('should handle repository errors', async () => {
            mockRulesChannelRepository.upsertByChannelId.mockRejectedValue(new Error('Database error'));
            await expect(rulesChannelService.updateRulesChannel(mockRequest))
                .rejects.toThrow('Database error');
        });
    });
    describe('getRulesChannel', () => {
        it('should retrieve rules channel data', async () => {
            const mockRulesChannel = {
                _id: '507f1f77bcf86cd799439011',
                guildId: '123456789012345678',
                channelId: '123456789012345678',
                messageId: '111111111111111111',
                title: 'Test Rules',
                content: 'Test content',
                rules: [],
                lastUpdatedBy: '987654321098765432',
                lastUpdatedAt: new Date(),
                createdBy: '987654321098765432',
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockRulesChannelRepository.findByChannelId.mockResolvedValue(mockRulesChannel);
            const result = await rulesChannelService.getRulesChannel(mockRulesChannel.guildId, mockRulesChannel.channelId);
            expect(result).toEqual(mockRulesChannel);
            expect(mockRulesChannelRepository.findByChannelId).toHaveBeenCalledWith(mockRulesChannel.guildId, mockRulesChannel.channelId);
        });
        it('should return null if no rules channel exists', async () => {
            mockRulesChannelRepository.findByChannelId.mockResolvedValue(null);
            const result = await rulesChannelService.getRulesChannel('123456789012345678', '123456789012345678');
            expect(result).toBeNull();
        });
    });
    describe('deleteRulesChannel', () => {
        it('should delete rules channel record', async () => {
            const mockRulesChannel = {
                _id: '507f1f77bcf86cd799439011',
                guildId: '123456789012345678',
                channelId: '123456789012345678',
                messageId: '111111111111111111',
                title: 'Test Rules',
                content: 'Test content',
                rules: [],
                lastUpdatedBy: '987654321098765432',
                lastUpdatedAt: new Date(),
                createdBy: '987654321098765432',
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockRulesChannelRepository.findByChannelId.mockResolvedValue(mockRulesChannel);
            mockRulesChannelRepository.delete.mockResolvedValue(true);
            // Mock guild and channel fetching
            const mockGuild = {
                channels: {
                    fetch: jest.fn().mockResolvedValue(mockTextChannel)
                }
            };
            mockDiscordClient.guilds = {
                fetch: jest.fn().mockResolvedValue(mockGuild),
                cache: new Map()
            };
            mockTextChannel.type = 0; // Text channel
            mockTextChannel.messages.fetch.mockResolvedValue(mockMessage);
            mockMessage.delete.mockResolvedValue(mockMessage);
            const result = await rulesChannelService.deleteRulesChannel('123456789012345678', '123456789012345678');
            expect(result).toBe(true);
            expect(mockRulesChannelRepository.findByChannelId).toHaveBeenCalledWith('123456789012345678', '123456789012345678');
            expect(mockRulesChannelRepository.delete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
        });
        it('should return false if no record to delete', async () => {
            mockRulesChannelRepository.findByChannelId.mockResolvedValue(null);
            const result = await rulesChannelService.deleteRulesChannel('123456789012345678', '123456789012345678');
            expect(result).toBe(false);
            expect(mockRulesChannelRepository.delete).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=rules-channel-service.test.js.map