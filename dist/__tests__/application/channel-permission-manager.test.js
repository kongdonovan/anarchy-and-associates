"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const channel_permission_manager_1 = require("../../application/services/channel-permission-manager");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const permission_service_1 = require("../../application/services/permission-service");
const business_rule_validation_service_1 = require("../../application/services/business-rule-validation-service");
const staff_role_1 = require("../../domain/entities/staff-role");
const case_1 = require("../../domain/entities/case");
const retainer_1 = require("../../domain/entities/retainer");
const discord_js_1 = require("discord.js");
const mongodb_1 = require("mongodb");
// Mock all dependencies
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../application/services/permission-service');
jest.mock('../../application/services/business-rule-validation-service');
describe('ChannelPermissionManager', () => {
    let channelPermissionManager;
    let mockCaseRepo;
    let mockStaffRepo;
    let mockAuditLogRepo;
    let mockGuildConfigRepo;
    let mockPermissionService;
    let mockBusinessRuleValidationService;
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
        mockGuildConfigRepo = new guild_config_repository_1.GuildConfigRepository();
        mockPermissionService = new permission_service_1.PermissionService(mockGuildConfigRepo);
        mockBusinessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(mockGuildConfigRepo, mockStaffRepo, mockCaseRepo, mockPermissionService);
        channelPermissionManager = new channel_permission_manager_1.ChannelPermissionManager(mockCaseRepo, mockStaffRepo, mockAuditLogRepo, mockGuildConfigRepo, mockPermissionService, mockBusinessRuleValidationService);
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
                cache: new Map([['role_123', { id: 'role_123', name: 'Managing Partner' }]])
            }
        };
        mockGuild = {
            id: testGuildId,
            ownerId: 'owner_123',
            channels: {
                cache: new Map([
                    [testChannelId, mockChannel],
                    ['category_123', mockCategory]
                ])
            },
            members: {
                fetch: jest.fn().mockResolvedValue(mockMember)
            }
        };
        // Setup default mocks
        mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
            valid: true,
            errors: [],
            warnings: [],
            bypassAvailable: false,
            hasPermission: true,
            requiredPermission: 'lawyer',
            grantedPermissions: ['lawyer']
        });
        mockCaseRepo.findCasesByUserId.mockResolvedValue([]);
        mockAuditLogRepo.add.mockResolvedValue({});
    });
    describe('handleRoleChange', () => {
        it('should update channel permissions for promotion', async () => {
            // Setup: user gets promoted from Paralegal to Junior Associate
            const oldRole = staff_role_1.StaffRole.PARALEGAL;
            const newRole = staff_role_1.StaffRole.JUNIOR_ASSOCIATE;
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, oldRole, newRole, 'promotion');
            expect(updates).toBeInstanceOf(Array);
            expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
            expect(mockAuditLogRepo.add).toHaveBeenCalled();
        });
        it('should handle new hire and grant appropriate permissions', async () => {
            const newRole = staff_role_1.StaffRole.JUNIOR_ASSOCIATE;
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, // No old role for new hire
            newRole, 'hire');
            expect(updates).toBeInstanceOf(Array);
            expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
        });
        it('should handle firing and revoke all permissions', async () => {
            const oldRole = staff_role_1.StaffRole.JUNIOR_ASSOCIATE;
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, oldRole, undefined, // No new role for fired staff
            'fire');
            expect(updates).toBeInstanceOf(Array);
            expect(mockChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
        });
        it('should handle demotion and adjust permissions accordingly', async () => {
            const oldRole = staff_role_1.StaffRole.SENIOR_PARTNER;
            const newRole = staff_role_1.StaffRole.JUNIOR_ASSOCIATE;
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, oldRole, newRole, 'demotion');
            expect(updates).toBeInstanceOf(Array);
            expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
        });
        it('should update permissions for case channels where user is involved', async () => {
            // Mock user cases
            mockCaseRepo.findCasesByUserId.mockResolvedValue([
                {
                    _id: new mongodb_1.ObjectId(),
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
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, newRole, 'hire');
            expect(mockCaseRepo.findCasesByUserId).toHaveBeenCalledWith(testGuildId, testUserId);
            expect(updates).toBeInstanceOf(Array);
        });
        it('should handle errors gracefully and continue with other channels', async () => {
            // Make one channel fail
            mockChannel.permissionOverwrites.edit.mockRejectedValueOnce(new Error('Permission error'));
            // Add another channel that should succeed
            const secondChannel = { ...mockChannel, id: 'channel_456', name: 'staff-chat' };
            mockGuild.channels.cache.set('channel_456', secondChannel);
            const newRole = staff_role_1.StaffRole.MANAGING_PARTNER;
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, newRole, 'hire');
            // Should continue processing despite one failure
            expect(updates).toBeInstanceOf(Array);
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
                const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
                expect(updates).toBeInstanceOf(Array);
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
                const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.SENIOR_PARTNER, 'hire');
                expect(updates).toBeInstanceOf(Array);
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
                const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, 'hire');
                expect(updates).toBeInstanceOf(Array);
            }
        });
        it('should handle unknown channel types gracefully', async () => {
            mockChannel.name = 'random-channel';
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
            expect(updates).toBeInstanceOf(Array);
        });
    });
    describe('permission validation', () => {
        it('should validate permissions through business rules', async () => {
            mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
                bypassAvailable: false,
                hasPermission: true,
                requiredPermission: 'senior-staff',
                grantedPermissions: ['senior-staff', 'lawyer']
            });
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, 'hire');
            expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
            expect(updates).toBeInstanceOf(Array);
        });
        it('should deny access when business rules fail', async () => {
            mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
                valid: false,
                errors: ['Insufficient permissions'],
                warnings: [],
                bypassAvailable: false,
                hasPermission: false,
                requiredPermission: 'admin',
                grantedPermissions: []
            });
            mockChannel.name = 'admin-chat'; // Admin channel
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.PARALEGAL, // Low-level role
            'hire');
            expect(mockChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
        });
        it('should handle permission service errors gracefully', async () => {
            mockBusinessRuleValidationService.validatePermission.mockRejectedValue(new Error('Permission service error'));
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
            // Should continue despite validation error
            expect(updates).toBeInstanceOf(Array);
        });
    });
    describe('permission matrix', () => {
        it('should grant appropriate permissions for Managing Partner in case channels', async () => {
            mockChannel.name = 'case-test-123';
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, 'hire');
            expect(mockChannel.permissionOverwrites.edit).toHaveBeenCalledWith(testUserId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true
            });
        });
        it('should grant limited permissions for Paralegal in case channels', async () => {
            mockChannel.name = 'case-test-123';
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.PARALEGAL, 'hire');
            expect(mockChannel.permissionOverwrites.edit).toHaveBeenCalledWith(testUserId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: false
            });
        });
        it('should grant senior staff permissions for appropriate roles', async () => {
            mockChannel.name = 'staff-announcements';
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.SENIOR_PARTNER, 'hire');
            // Senior Partner should have senior-staff permissions
            expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalledWith(expect.objectContaining({
                userId: testUserId,
                guildId: testGuildId
            }), 'senior-staff');
        });
        it('should handle role transitions correctly', async () => {
            // Promotion from Junior Associate to Senior Associate
            const oldRole = staff_role_1.StaffRole.JUNIOR_ASSOCIATE;
            const newRole = staff_role_1.StaffRole.SENIOR_ASSOCIATE;
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, oldRole, newRole, 'promotion');
            expect(updates).toBeInstanceOf(Array);
            expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
        });
    });
    describe('syncGuildChannelPermissions', () => {
        it('should sync permissions for all active staff', async () => {
            // Mock active staff
            mockStaffRepo.findByGuildId.mockResolvedValue([
                {
                    userId: 'user_1',
                    role: staff_role_1.StaffRole.MANAGING_PARTNER,
                    status: retainer_1.RetainerStatus.SIGNED
                },
                {
                    userId: 'user_2',
                    role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                    status: retainer_1.RetainerStatus.SIGNED
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
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
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
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
            // Should continue despite audit log failure
            expect(updates).toBeInstanceOf(Array);
        });
    });
    describe('edge cases', () => {
        it('should handle channels with existing permission overwrites', async () => {
            // Mock existing permission overwrites
            mockChannel.permissionOverwrites.cache.set(testUserId, {
                allow: new Set([discord_js_1.PermissionFlagsBits.ViewChannel]),
                deny: new Set()
            });
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, staff_role_1.StaffRole.PARALEGAL, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'promotion');
            expect(updates).toBeInstanceOf(Array);
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
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, 'hire');
            const endTime = Date.now();
            expect(updates).toBeInstanceOf(Array);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        });
        it('should handle guild owner edge case', async () => {
            const ownerMember = {
                ...mockMember,
                user: { id: 'owner_123' }
            };
            const updates = await channelPermissionManager.handleRoleChange(mockGuild, ownerMember, undefined, staff_role_1.StaffRole.MANAGING_PARTNER, 'hire');
            expect(updates).toBeInstanceOf(Array);
        });
        it('should handle concurrent permission updates', async () => {
            const promises = Array.from({ length: 5 }, (_, i) => channelPermissionManager.handleRoleChange(mockGuild, { ...mockMember, user: { id: `user_${i}` } }, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire'));
            const results = await Promise.all(promises);
            expect(results).toHaveLength(5);
            results.forEach(updates => {
                expect(updates).toBeInstanceOf(Array);
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
                const updates = await channelPermissionManager.handleRoleChange(mockGuild, mockMember, undefined, staff_role_1.StaffRole.JUNIOR_ASSOCIATE, 'hire');
                expect(updates).toBeInstanceOf(Array);
            }
        });
    });
});
//# sourceMappingURL=channel-permission-manager.test.js.map