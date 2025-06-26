"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const guild_owner_utils_1 = require("../../infrastructure/utils/guild-owner-utils");
const discord_js_1 = require("discord.js");
// Mock Discord.js components
jest.mock('discord.js', () => ({
    ModalBuilder: jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setTitle: jest.fn().mockReturnThis(),
        addComponents: jest.fn().mockReturnThis(),
    })),
    TextInputBuilder: jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis(),
        setRequired: jest.fn().mockReturnThis(),
        setPlaceholder: jest.fn().mockReturnThis(),
        setMaxLength: jest.fn().mockReturnThis(),
    })),
    ActionRowBuilder: jest.fn().mockImplementation(() => ({
        addComponents: jest.fn().mockReturnThis(),
    })),
    EmbedBuilder: jest.fn().mockImplementation(() => ({
        setColor: jest.fn().mockReturnThis(),
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
    })),
    TextInputStyle: {
        Short: 1,
        Paragraph: 2,
    },
}));
describe('GuildOwnerUtils', () => {
    const userId = 'user_123';
    const guildId = 'guild_123';
    const mockValidationResult = {
        valid: false,
        errors: ['Cannot hire Managing Partner. Maximum limit of 1 reached (current: 1)'],
        warnings: [],
        bypassAvailable: true,
        bypassType: 'guild-owner',
        currentCount: 1,
        maxCount: 1,
        roleName: 'Managing Partner',
        metadata: {
            ruleType: 'role-limit',
            role: 'Managing Partner',
            currentCount: 1,
            maxCount: 1,
        },
    };
    describe('createRoleLimitBypassModal', () => {
        it('should create modal with correct structure', () => {
            const modal = guild_owner_utils_1.GuildOwnerUtils.createRoleLimitBypassModal(userId, mockValidationResult);
            expect(discord_js_1.ModalBuilder).toHaveBeenCalled();
            const mockModal = discord_js_1.ModalBuilder.mock.instances[0];
            expect(mockModal.setCustomId).toHaveBeenCalledWith(expect.stringMatching(/^role_limit_bypass_user_123_\d+$/));
            expect(mockModal.setTitle).toHaveBeenCalledWith('🚨 Role Limit Bypass Required');
            expect(mockModal.addComponents).toHaveBeenCalledTimes(2); // confirmation and reason inputs
        });
        it('should generate unique custom IDs', () => {
            const modal1 = guild_owner_utils_1.GuildOwnerUtils.createRoleLimitBypassModal(userId, mockValidationResult);
            // Wait a millisecond to ensure different timestamp
            setTimeout(() => {
                const modal2 = guild_owner_utils_1.GuildOwnerUtils.createRoleLimitBypassModal(userId, mockValidationResult);
                const mockModal1 = discord_js_1.ModalBuilder.mock.instances[0];
                const mockModal2 = discord_js_1.ModalBuilder.mock.instances[1];
                // Should have different timestamps in custom IDs
                expect(mockModal1.setCustomId).not.toEqual(mockModal2.setCustomId);
            }, 1);
        });
    });
    describe('createBypassConfirmationEmbed', () => {
        it('should create informational embed with validation details', () => {
            const embed = guild_owner_utils_1.GuildOwnerUtils.createBypassConfirmationEmbed(mockValidationResult);
            expect(discord_js_1.EmbedBuilder).toHaveBeenCalled();
            const mockEmbed = discord_js_1.EmbedBuilder.mock.instances[0];
            expect(mockEmbed.setColor).toHaveBeenCalledWith('#FFA500'); // Orange warning
            expect(mockEmbed.setTitle).toHaveBeenCalledWith('⚠️ Guild Owner Role Limit Bypass');
            expect(mockEmbed.setDescription).toHaveBeenCalledWith(expect.stringContaining('Managing Partner'));
            expect(mockEmbed.setDescription).toHaveBeenCalledWith(expect.stringContaining('Current Count: 1'));
            expect(mockEmbed.setDescription).toHaveBeenCalledWith(expect.stringContaining('Maximum Limit: 1'));
        });
    });
    describe('validateBypassConfirmation', () => {
        let mockInteraction;
        beforeEach(() => {
            mockInteraction = {
                user: { id: userId },
                guildId,
                fields: {
                    getTextInputValue: jest.fn(),
                },
            };
        });
        it('should accept valid confirmation', () => {
            mockInteraction.fields.getTextInputValue
                .mockReturnValueOnce('Confirm') // confirmation input
                .mockReturnValueOnce('Need to exceed limit for important hire'); // reason input
            const result = guild_owner_utils_1.GuildOwnerUtils.validateBypassConfirmation(mockInteraction);
            expect(result.confirmed).toBe(true);
            expect(result.reason).toBe('Need to exceed limit for important hire');
            expect(result.error).toBeUndefined();
        });
        it('should accept case-insensitive confirmation', () => {
            mockInteraction.fields.getTextInputValue
                .mockReturnValueOnce('CONFIRM')
                .mockReturnValueOnce('');
            const result = guild_owner_utils_1.GuildOwnerUtils.validateBypassConfirmation(mockInteraction);
            expect(result.confirmed).toBe(true);
        });
        it('should reject invalid confirmation text', () => {
            mockInteraction.fields.getTextInputValue
                .mockReturnValueOnce('confirm please')
                .mockReturnValueOnce('reason');
            const result = guild_owner_utils_1.GuildOwnerUtils.validateBypassConfirmation(mockInteraction);
            expect(result.confirmed).toBe(false);
            expect(result.error).toContain('Confirmation text must be exactly "Confirm"');
        });
        it('should handle empty confirmation', () => {
            mockInteraction.fields.getTextInputValue
                .mockReturnValueOnce('')
                .mockReturnValueOnce('reason');
            const result = guild_owner_utils_1.GuildOwnerUtils.validateBypassConfirmation(mockInteraction);
            expect(result.confirmed).toBe(false);
            expect(result.error).toContain('Confirmation text must be exactly "Confirm"');
        });
        it('should handle missing reason gracefully', () => {
            mockInteraction.fields.getTextInputValue
                .mockReturnValueOnce('Confirm')
                .mockReturnValueOnce(undefined);
            const result = guild_owner_utils_1.GuildOwnerUtils.validateBypassConfirmation(mockInteraction);
            expect(result.confirmed).toBe(true);
            expect(result.reason).toBeUndefined();
        });
        it('should handle field access errors', () => {
            mockInteraction.fields.getTextInputValue.mockImplementation(() => {
                throw new Error('Field access error');
            });
            const result = guild_owner_utils_1.GuildOwnerUtils.validateBypassConfirmation(mockInteraction);
            expect(result.confirmed).toBe(false);
            expect(result.error).toContain('Failed to validate bypass confirmation');
        });
    });
    describe('isEligibleForBypass', () => {
        let mockInteraction;
        beforeEach(() => {
            mockInteraction = {
                user: { id: userId },
                guild: {
                    ownerId: userId,
                },
            };
        });
        it('should return true for guild owner', () => {
            const result = guild_owner_utils_1.GuildOwnerUtils.isEligibleForBypass(mockInteraction);
            expect(result).toBe(true);
        });
        it('should return false for non-guild owner', () => {
            mockInteraction.guild.ownerId = 'different_user_123';
            const result = guild_owner_utils_1.GuildOwnerUtils.isEligibleForBypass(mockInteraction);
            expect(result).toBe(false);
        });
        it('should return false when guild is null', () => {
            mockInteraction.guild = null;
            const result = guild_owner_utils_1.GuildOwnerUtils.isEligibleForBypass(mockInteraction);
            expect(result).toBe(false);
        });
    });
    describe('generateBypassId', () => {
        it('should generate correct bypass ID format', () => {
            const bypassId = guild_owner_utils_1.GuildOwnerUtils.generateBypassId(userId, 'role_limit', 'additional_data');
            expect(bypassId).toMatch(/^role_limit_bypass_user_123_\d+_additional_data$/);
        });
        it('should generate bypass ID without additional data', () => {
            const bypassId = guild_owner_utils_1.GuildOwnerUtils.generateBypassId(userId, 'role_limit');
            expect(bypassId).toMatch(/^role_limit_bypass_user_123_\d+$/);
        });
        it('should include timestamp in ID', () => {
            const beforeTime = Date.now();
            const bypassId = guild_owner_utils_1.GuildOwnerUtils.generateBypassId(userId, 'role_limit');
            const afterTime = Date.now();
            const parts = bypassId.split('_');
            const timestamp = parseInt(parts[3]);
            expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(timestamp).toBeLessThanOrEqual(afterTime);
        });
    });
    describe('parseBypassId', () => {
        it('should parse valid bypass ID correctly', () => {
            const timestamp = Date.now();
            const customId = `role_limit_bypass_user_123_${timestamp}_extra_data`;
            const result = guild_owner_utils_1.GuildOwnerUtils.parseBypassId(customId);
            expect(result).toEqual({
                bypassType: 'role_limit',
                userId: 'user_123',
                timestamp,
                additionalData: 'extra_data',
            });
        });
        it('should parse bypass ID without additional data', () => {
            const timestamp = Date.now();
            const customId = `role_limit_bypass_user_123_${timestamp}`;
            const result = guild_owner_utils_1.GuildOwnerUtils.parseBypassId(customId);
            expect(result).toEqual({
                bypassType: 'role_limit',
                userId: 'user_123',
                timestamp,
                additionalData: undefined,
            });
        });
        it('should return null for invalid format', () => {
            const result = guild_owner_utils_1.GuildOwnerUtils.parseBypassId('invalid_format');
            expect(result).toBeNull();
        });
        it('should return null for missing bypass keyword', () => {
            const result = guild_owner_utils_1.GuildOwnerUtils.parseBypassId('role_limit_something_user_123_12345');
            expect(result).toBeNull();
        });
        it('should handle parsing errors gracefully', () => {
            const result = guild_owner_utils_1.GuildOwnerUtils.parseBypassId('role_limit_bypass_user_invalid_timestamp');
            expect(result).toBeNull();
        });
    });
    describe('isBypassExpired', () => {
        it('should return false for recent bypass', () => {
            const recentTimestamp = Date.now() - 10000; // 10 seconds ago
            const customId = `role_limit_bypass_user_123_${recentTimestamp}`;
            const result = guild_owner_utils_1.GuildOwnerUtils.isBypassExpired(customId);
            expect(result).toBe(false);
        });
        it('should return true for expired bypass', () => {
            const expiredTimestamp = Date.now() - 40000; // 40 seconds ago (> 30 second limit)
            const customId = `role_limit_bypass_user_123_${expiredTimestamp}`;
            const result = guild_owner_utils_1.GuildOwnerUtils.isBypassExpired(customId);
            expect(result).toBe(true);
        });
        it('should return true for unparseable custom ID', () => {
            const result = guild_owner_utils_1.GuildOwnerUtils.isBypassExpired('invalid_custom_id');
            expect(result).toBe(true);
        });
        it('should handle edge case at exact expiry time', () => {
            const exactExpiryTimestamp = Date.now() - 30000; // Exactly 30 seconds
            const customId = `role_limit_bypass_user_123_${exactExpiryTimestamp}`;
            const result = guild_owner_utils_1.GuildOwnerUtils.isBypassExpired(customId);
            expect(result).toBe(false); // Should not be expired at exactly 30 seconds
        });
    });
    describe('embed creation helpers', () => {
        it('should create success embed with correct format', () => {
            const embed = guild_owner_utils_1.GuildOwnerUtils.createBypassSuccessEmbed('Managing Partner', 2, 'Emergency hire needed');
            expect(discord_js_1.EmbedBuilder).toHaveBeenCalled();
            const mockEmbed = discord_js_1.EmbedBuilder.mock.instances[0];
            expect(mockEmbed.setColor).toHaveBeenCalledWith('#00FF00'); // Green
            expect(mockEmbed.setTitle).toHaveBeenCalledWith('✅ Role Limit Bypass Completed');
            expect(mockEmbed.setDescription).toHaveBeenCalledWith(expect.stringContaining('Managing Partner'));
            expect(mockEmbed.setDescription).toHaveBeenCalledWith(expect.stringContaining('New Count: 2'));
            expect(mockEmbed.setDescription).toHaveBeenCalledWith(expect.stringContaining('Emergency hire needed'));
        });
        it('should create error embed with correct format', () => {
            const errorMessage = 'Bypass failed due to invalid permissions';
            const embed = guild_owner_utils_1.GuildOwnerUtils.createBypassErrorEmbed(errorMessage);
            expect(discord_js_1.EmbedBuilder).toHaveBeenCalled();
            const mockEmbed = discord_js_1.EmbedBuilder.mock.instances[0];
            expect(mockEmbed.setColor).toHaveBeenCalledWith('#FF0000'); // Red
            expect(mockEmbed.setTitle).toHaveBeenCalledWith('❌ Bypass Failed');
            expect(mockEmbed.setDescription).toHaveBeenCalledWith(errorMessage);
        });
        it('should handle success embed without reason', () => {
            const embed = guild_owner_utils_1.GuildOwnerUtils.createBypassSuccessEmbed('Paralegal', 11);
            const mockEmbed = discord_js_1.EmbedBuilder.mock.instances[0];
            expect(mockEmbed.setDescription).toHaveBeenCalledWith(expect.stringContaining('No reason provided'));
        });
    });
    describe('edge cases and error scenarios', () => {
        it('should handle extremely long custom IDs', () => {
            const longId = 'role_limit_bypass_' + 'x'.repeat(1000) + '_12345';
            const result = guild_owner_utils_1.GuildOwnerUtils.parseBypassId(longId);
            expect(result).toBeNull();
        });
        it('should handle negative timestamps', () => {
            const customId = 'role_limit_bypass_user_123_-12345';
            const result = guild_owner_utils_1.GuildOwnerUtils.parseBypassId(customId);
            expect(result?.timestamp).toBe(-12345);
        });
        it('should handle future timestamps in expiry check', () => {
            const futureTimestamp = Date.now() + 10000; // 10 seconds in future
            const customId = `role_limit_bypass_user_123_${futureTimestamp}`;
            const result = guild_owner_utils_1.GuildOwnerUtils.isBypassExpired(customId);
            expect(result).toBe(false); // Future timestamps are not expired
        });
        it('should handle modal creation with extreme validation results', () => {
            const extremeResult = {
                valid: false,
                errors: ['Error 1', 'Error 2', 'Error 3'],
                warnings: ['Warning 1', 'Warning 2'],
                bypassAvailable: true,
                currentCount: 999,
                maxCount: 1,
                roleName: 'Very Long Role Name That Might Cause Issues',
                metadata: {},
            };
            const modal = guild_owner_utils_1.GuildOwnerUtils.createRoleLimitBypassModal(userId, extremeResult);
            expect(discord_js_1.ModalBuilder).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=guild-owner-utils.test.js.map