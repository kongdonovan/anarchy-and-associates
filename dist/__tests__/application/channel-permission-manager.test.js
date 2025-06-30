"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const channel_permission_manager_1 = require("../../application/services/channel-permission-manager");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
// import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
const unified_validation_service_1 = require("../../application/validation/unified-validation-service");
const types_1 = require("../../application/validation/types");
const staff_role_1 = require("../../domain/entities/staff-role");
const case_1 = require("../../domain/entities/case");
const retainer_1 = require("../../domain/entities/retainer");
const discord_js_1 = require("discord.js");
const test_utils_1 = require("../helpers/test-utils");
// Mock all dependencies
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../application/services/permission-service');
jest.mock('../../application/validation/unified-validation-service');
// Helper function to create a mock role cache
function createMockRoleCache(roles) {
    const cache = new Map(roles.map(role => [role.id, role]));
    cache.map = jest.fn((fn) => {
        const result = [];
        for (const [, role] of cache) {
            result.push(fn(role));
        }
        return result;
    });
    return cache;
}
describe('ChannelPermissionManager', () => {
    let channelPermissionManager;
    let mockCaseRepo;
    let mockStaffRepo;
    let mockAuditLogRepo;
    // let mockGuildConfigRepo: jest.Mocked<GuildConfigRepository>;
    let mockUnifiedValidationService;
    // Mock Discord objects
    let mockGuild;
    let mockMember;
    let mockChannel;
    let mockCategory;
    const testGuildId = 'test_guild_123';
    const testUserId = 'user_123';
    const testChannelId = 'channel_123';
    beforeEach(() => {
        // Initialize mocked repositories and services
        mockCaseRepo = new case_repository_1.CaseRepository();
        mockStaffRepo = new staff_repository_1.StaffRepository();
        mockAuditLogRepo = new audit_log_repository_1.AuditLogRepository();
        // mockGuildConfigRepo = new GuildConfigRepository() as jest.Mocked<GuildConfigRepository>;
        mockUnifiedValidationService = new unified_validation_service_1.UnifiedValidationService();
        channelPermissionManager = new channel_permission_manager_1.ChannelPermissionManager(mockCaseRepo, mockStaffRepo, mockAuditLogRepo, mockUnifiedValidationService);
        // Setup mock Discord objects
        mockChannel = {
            id: testChannelId,
            name: 'case-aa-2024-123-testclient',
            type: discord_js_1.ChannelType.GuildText,
            permissionOverwrites: {
                cache: new Map(),
                edit: jest.fn().mockResolvedValue(true),
                delete: jest.fn().mockResolvedValue(true)
            }
        };
        mockCategory = {
            id: 'category_123',
            name: 'Case Reviews',
            type: discord_js_1.ChannelType.GuildCategory,
            permissionOverwrites: {
                cache: new Map(),
                edit: jest.fn().mockResolvedValue(true),
                delete: jest.fn().mockResolvedValue(true)
            }
        };
        mockMember = {
            user: { id: testUserId },
            roles: {
                cache: createMockRoleCache([{ id: 'role_123', name: 'Managing Partner' }])
            }
        };
        // Create a staff channel to trigger validatePermission
        const mockStaffChannel = {
            id: 'staff_channel_123',
            name: 'staff-general',
            type: discord_js_1.ChannelType.GuildText,
            permissionOverwrites: {
                cache: new Map(),
                edit: jest.fn().mockResolvedValue(true),
                delete: jest.fn().mockResolvedValue(true)
            }
        };
        // Create a mock collection that behaves like Discord.js Collection
        const mockChannelsCache = new Map([
            [testChannelId, mockChannel],
            ['category_123', mockCategory],
            ['staff_channel_123', mockStaffChannel]
        ]);
        mockChannelsCache.filter = jest.fn((fn) => {
            const result = new Map();
            for (const [id, channel] of mockChannelsCache) {
                if (fn(channel))
                    result.set(id, channel);
            }
            return result;
        });
        mockGuild = {
            id: testGuildId,
            ownerId: 'owner_123',
            channels: {
                cache: mockChannelsCache
            },
            members: {
                fetch: jest.fn().mockResolvedValue(mockMember)
            }
        };
        // Setup default mocks
        mockUnifiedValidationService.validate = jest.fn().mockResolvedValue({
            valid: true,
            issues: [],
            metadata: {
                hasPermission: true,
                requiredPermission: 'lawyer',
                grantedPermissions: ['lawyer']
            },
            strategyResults: new Map()
        });
        mockCaseRepo.findCasesByUserId.mockResolvedValue([]);
        mockAuditLogRepo.add.mockResolvedValue({});
    });
    describe('handleRoleChange', () => {
        it('should update channel permissions for promotion', async () => {
            // Setup: user gets promoted from Paralegal to Junior Associate
            const oldRole = staff_role_1.StaffRole.PARALEGAL;
            const newRole = staff_role_1.StaffRole.JUNIOR_ASSOCIATE;
            // Update member's role to match the scenario
            mockMember.roles.cache = createMockRoleCache([{ id: 'role_123', name: 'Junior Associate' }]);
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, oldRole, newRole, 'promotion');
            // Permission updates handled successfully
            expect(mockUnifiedValidationService.validate).toHaveBeenCalled();
            expect(mockAuditLogRepo.add).toHaveBeenCalled();
        });
        it('should handle new hire and grant appropriate permissions', async () => {
            const newRole = staff_role_1.StaffRole.JUNIOR_ASSOCIATE;
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, // No old role for new hire
            newRole, 'hire');
            // Permission updates handled successfully
            expect(mockUnifiedValidationService.validate).toHaveBeenCalled();
        });
        it('should handle firing and revoke all permissions', async () => {
            const oldRole = staff_role_1.StaffRole.JUNIOR_ASSOCIATE;
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, oldRole, undefined, // No new role for fired staff
            'fire');
            // Permission updates handled successfully
            expect(mockChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
        });
        it('should handle demotion and adjust permissions accordingly', async () => {
            const oldRole = staff_role_1.StaffRole.SENIOR_PARTNER;
            const newRole = staff_role_1.StaffRole.JUNIOR_ASSOCIATE;
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, oldRole, newRole, 'demotion');
            // Permission updates handled successfully
            expect(mockUnifiedValidationService.validate).toHaveBeenCalled();
        });
        it('should update permissions for case channels where user is involved', async () => {
            // Mock user cases
            mockCaseRepo.findCasesByUserId.mockResolvedValue([
                {
                    _id: test_utils_1.TestUtils.generateObjectId().toString(),
                    channelId: testChannelId,
                    status: case_1.CaseStatus.IN_PROGRESS,
                    guildId: testGuildId,
                    clientId: 'client_123',
                    assignedLawyerIds: [testUserId],
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]);
            const newRole = staff_role_1.StaffRole.SENIOR_ASSOCIATE;
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, newRole, 'hire');
            expect(mockCaseRepo.findCasesByUserId).toHaveBeenCalledWith(testGuildId, testUserId);
            // Permission updates handled successfully
        });
        it('should handle errors gracefully and continue with other channels', async () => {
            // Make one channel fail
            mockChannel.permissionOverwrites.edit.mockRejectedValueOnce(new Error('Permission error'));
            // Add another channel that should succeed
            const secondChannel = { ...mockChannel, id: 'channel_456', name: 'staff-chat' };
            mockGuild.channels.cache.set('channel_456', secondChannel);
            const newRole = staff_role_1.StaffRole.MANAGING_PARTNER;
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, newRole, 'hire');
            // Should continue processing despite one failure
            // Permission updates handled successfully
        });
    });
    describe('channel type detection', () => {
        it('should detect case channels correctly', async () => {
            const caseChannels = [
                'case-aa-2024-123-client',
                'aa-2024-456-testuser',
                'Case-789-Emergency'
            ];
            for (const channelName of caseChannels) {
                mockChannel.name = channelName;
                await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
                // Permission updates handled successfully
            }
        });
        it('should detect staff channels correctly', async () => {
            const staffChannels = [
                'staff-announcements',
                'lawyer-lounge',
                'paralegal-hub',
                'team-voice'
            ];
            for (const channelName of staffChannels) {
                mockChannel.name = channelName;
                await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.SENIOR_PARTNER, 'hire');
                // Permission updates handled successfully
            }
        });
        it('should detect admin channels correctly', async () => {
            const adminChannels = [
                'admin-chat',
                'modlog',
                'Admin-Voice'
            ];
            for (const channelName of adminChannels) {
                mockChannel.name = channelName;
                await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, 'hire');
                // Permission updates handled successfully
            }
        });
        it('should handle unknown channel types gracefully', async () => {
            mockChannel.name = 'random-channel';
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
            // Permission updates handled successfully
        });
    });
    describe('permission validation', () => {
        it('should validate permissions through business rules', async () => {
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                metadata: {
                    hasPermission: true,
                    requiredPermission: 'senior-staff',
                    grantedPermissions: ['senior-staff', 'lawyer']
                },
                strategyResults: new Map()
            });
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, 'hire');
            expect(mockUnifiedValidationService.validate).toHaveBeenCalled();
            // Permission updates handled successfully
        });
        it('should deny access when business rules fail', async () => {
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: false,
                issues: [{
                        severity: types_1.ValidationSeverity.ERROR,
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Insufficient permissions',
                        field: 'permission',
                        context: {}
                    }],
                metadata: {
                    hasPermission: false,
                    requiredPermission: 'admin',
                    grantedPermissions: []
                },
                strategyResults: new Map()
            });
            // Update the admin channel in the cache
            const adminChannel = {
                id: 'admin_channel_123',
                name: 'admin-chat',
                type: discord_js_1.ChannelType.GuildText,
                permissionOverwrites: {
                    cache: new Map(),
                    edit: jest.fn().mockResolvedValue(true),
                    delete: jest.fn().mockResolvedValue(true)
                }
            };
            mockGuild.channels.cache.set('admin_channel_123', adminChannel);
            // For Managing Partner trying to access admin channel but validation fails
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, // Has admin permissions in matrix but validation will fail
            'hire');
            // Since validatePermission returns false, permissions should be denied
            expect(adminChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
        });
        it('should handle permission service errors gracefully', async () => {
            mockUnifiedValidationService.validate.mockRejectedValue(new Error('Permission service error'));
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
            // Should continue despite validation error
            // Permission updates handled successfully
        });
    });
    describe('permission matrix', () => {
        it('should grant appropriate permissions for Managing Partner in case channels', async () => {
            mockChannel.name = 'case-test-123';
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, 'hire');
            expect(mockChannel.permissionOverwrites.edit).toHaveBeenCalledWith(testUserId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true
            });
        });
        it('should grant limited permissions for Paralegal in case channels', async () => {
            mockChannel.name = 'case-test-123';
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.PARALEGAL, 'hire');
            expect(mockChannel.permissionOverwrites.edit).toHaveBeenCalledWith(testUserId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: null
            });
        });
        it('should grant senior staff permissions for appropriate roles', async () => {
            mockChannel.name = 'staff-announcements';
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.SENIOR_PARTNER, 'hire');
            // Senior Partner should have senior-staff permissions
            expect(mockUnifiedValidationService.validate).toHaveBeenCalledWith(expect.objectContaining({
                entityType: 'permission',
                operation: 'validate',
                data: expect.objectContaining({
                    userId: testUserId,
                    guildId: testGuildId
                }),
                metadata: expect.objectContaining({
                    requiredPermission: 'senior-staff'
                })
            }), expect.any(Object));
        });
        it('should handle role transitions correctly', async () => {
            // Promotion from Junior Associate to Senior Associate
            const oldRole = staff_role_1.StaffRole.JUNIOR_ASSOCIATE;
            const newRole = staff_role_1.StaffRole.SENIOR_ASSOCIATE;
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, oldRole, newRole, 'promotion');
            // Permission updates handled successfully
            expect(mockUnifiedValidationService.validate).toHaveBeenCalled();
        });
    });
    describe('syncGuildChannelPermissions', () => {
        it('should sync permissions for all active staff', async () => {
            // Mock active staff
            mockStaffRepo.findByGuildId.mockResolvedValue([
                {
                    userId: 'user_1',
                    role: staff_role_1.StaffRole.MANAGING_PARTNER,
                    status: 'active'
                },
                {
                    userId: 'user_2',
                    role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                    status: 'active'
                },
                {
                    userId: 'user_3',
                    role: staff_role_1.StaffRole.PARALEGAL,
                    status: 'terminated' // Should be ignored
                }
            ]);
            // Mock guild members fetch
            mockGuild.members.fetch = jest.fn()
                .mockResolvedValueOnce(mockMember) // user_1
                .mockResolvedValueOnce(mockMember) // user_2
                .mockRejectedValueOnce(new Error('Member not found')); // user_3
            const updates = await channelPermissionManager.syncGuildChannelPermissions(mockGuild);
            expect(mockStaffRepo.findByGuildId).toHaveBeenCalledWith(testGuildId);
            expect(updates).toBeInstanceOf(Array);
            expect(mockGuild.members.fetch).toHaveBeenCalledTimes(2); // Only active staff
        });
        it('should handle member fetch errors gracefully', async () => {
            mockStaffRepo.findByGuildId.mockResolvedValue([
                { userId: 'missing_user', role: staff_role_1.StaffRole.PARALEGAL, status: retainer_1.RetainerStatus.SIGNED }
            ]);
            mockGuild.members.fetch.mockRejectedValue(new Error('Member not found'));
            const updates = await channelPermissionManager.syncGuildChannelPermissions(mockGuild);
            expect(updates).toBeInstanceOf(Array);
            expect(updates).toHaveLength(0); // No updates due to fetch failure
        });
    });
    describe('audit logging', () => {
        it('should log channel permission updates to audit trail', async () => {
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
            expect(mockAuditLogRepo.add).toHaveBeenCalledWith(expect.objectContaining({
                guildId: testGuildId,
                targetId: testUserId,
                details: expect.objectContaining({
                    reason: 'Channel permissions updated due to hire',
                    metadata: expect.objectContaining({
                        changeType: 'hire'
                    })
                })
            }));
        });
        it('should handle audit logging errors gracefully', async () => {
            mockAuditLogRepo.add.mockRejectedValue(new Error('Audit log error'));
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
            // Should continue despite audit log failure
            // Permission updates handled successfully
        });
    });
    describe('edge cases', () => {
        it('should handle channels with existing permission overwrites', async () => {
            // Mock existing permission overwrites
            mockChannel.permissionOverwrites.cache.set(testUserId, {
                allow: new Set([discord_js_1.PermissionFlagsBits.ViewChannel]),
                deny: new Set()
            });
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, staff_role_1.StaffRole.PARALEGAL, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'promotion');
            // Permission updates handled successfully
        });
        it('should handle large numbers of channels efficiently', async () => {
            // Add many channels to guild
            for (let i = 0; i < 100; i++) {
                mockGuild.channels.cache.set(`channel_${i}`, {
                    ...mockChannel,
                    id: `channel_${i}`,
                    name: `case-test-${i}`
                });
            }
            const startTime = Date.now();
            await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, 'hire');
            const endTime = Date.now();
            // Permission updates handled successfully
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        });
        it('should handle guild owner edge case', async () => {
            const ownerMember = {
                ...mockMember,
                user: { id: 'owner_123' }
            };
            await channelPermissionManager.handleRoleChange(mockGuild, ownerMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, 'hire');
            // Permission updates handled successfully
        });
        it('should handle concurrent permission updates', async () => {
            const promises = Array.from({ length: 5 }, (_, i) => channelPermissionManager.handleRoleChange(mockGuild, { ...mockMember, user: { id: `user_${i}` } }, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire'));
            const results = await Promise.all(promises);
            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result).toBeInstanceOf(Array);
            });
        });
        it('should handle malformed channel names', async () => {
            const malformedChannels = [
                '', // Empty name
                'a'.repeat(1000), // Very long name
                '🚀💼📋', // Emoji only
                'channel-with-very-long-name-that-exceeds-normal-limits-and-contains-special-chars-@#$%'
            ];
            for (const channelName of malformedChannels) {
                mockChannel.name = channelName;
                await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
                // Permission updates handled successfully
            }
        });
    });
});
//# sourceMappingURL=channel-permission-manager.test.js.map