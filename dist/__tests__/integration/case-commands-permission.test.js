"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const permission_service_1 = require("../../application/services/permission-service");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const permission_utils_1 = require("../../infrastructure/utils/permission-utils");
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
/**
 * Integration tests for case command permissions
 * Tests the permission checking logic used by /case reassign and /case unassign commands
 */
describe('Case Commands Permission Integration Tests', () => {
    let permissionService;
    let guildConfigRepository;
    const testGuildId = 'test-guild-permissions';
    const guildOwnerId = 'guild-owner-123';
    const adminUserId = 'admin-user-456';
    const caseManagerUserId = 'case-manager-789';
    const regularUserId = 'regular-user-999';
    // Mock Discord interaction for permission testing
    const createMockInteraction = (userId, userRoles = [], isGuildOwner = false) => ({
        guildId: testGuildId,
        user: { id: userId },
        guild: {
            ownerId: isGuildOwner ? userId : guildOwnerId,
            members: {
                cache: {
                    get: () => ({
                        roles: {
                            cache: {
                                map: () => userRoles
                            }
                        }
                    })
                }
            }
        }
    });
    beforeAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.setupTestDatabase();
    });
    beforeEach(async () => {
        guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        await test_utils_1.TestUtils.clearTestDatabase();
        // Setup test guild configuration
        await guildConfigRepository.add({
            guildId: testGuildId,
            feedbackChannelId: 'feedback-channel-123',
            retainerChannelId: 'retainer-channel-123',
            caseReviewCategoryId: 'case-review-123',
            caseArchiveCategoryId: 'case-archive-123',
            modlogChannelId: 'modlog-123',
            applicationChannelId: 'application-123',
            clientRoleId: 'client-role-123',
            permissions: {
                admin: ['admin-role-123'],
                'senior-staff': ['hr-role-123'],
                case: ['case-role-123'],
                config: ['config-role-123'],
                lawyer: ['retainer-role-123'],
                'lead-attorney': ['lead-attorney-role-123'],
                repair: ['repair-role-123']
            },
            adminRoles: ['admin-role-123'],
            adminUsers: [adminUserId]
        });
    });
    afterAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.teardownTestDatabase();
    });
    describe('Guild Owner Permissions', () => {
        it('should grant case permissions to guild owner (reassign command)', async () => {
            const interaction = createMockInteraction(guildOwnerId, [], true);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            expect(context.isGuildOwner).toBe(true);
            expect(context.userId).toBe(guildOwnerId);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(true);
        });
        it('should grant case permissions to guild owner (unassign command)', async () => {
            const interaction = createMockInteraction(guildOwnerId, [], true);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(true);
        });
    });
    describe('Admin User Permissions', () => {
        it('should NOT grant case permissions to admin users (admin ≠ case permission)', async () => {
            const interaction = createMockInteraction(adminUserId, []);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            expect(context.isGuildOwner).toBe(false);
            expect(context.userId).toBe(adminUserId);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false); // Admin users do NOT automatically get case permissions
            // But they should have admin permissions
            const hasAdminPermission = await permissionService.hasActionPermission(context, 'admin');
            expect(hasAdminPermission).toBe(true);
        });
        it('should NOT grant case permissions to users with admin roles', async () => {
            const interaction = createMockInteraction('user-with-admin-role', ['admin-role-123']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false); // Admin role does NOT grant case permissions
            // But they should have admin permissions  
            const hasAdminPermission = await permissionService.hasActionPermission(context, 'admin');
            expect(hasAdminPermission).toBe(true);
        });
    });
    describe('Case Manager Permissions', () => {
        it('should grant case permissions to users with case role', async () => {
            const interaction = createMockInteraction(caseManagerUserId, ['case-role-123']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            expect(context.userRoles).toContain('case-role-123');
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(true);
        });
        it('should grant case permissions to users with multiple relevant roles', async () => {
            const interaction = createMockInteraction(caseManagerUserId, ['case-role-123', 'hr-role-123']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(true);
        });
    });
    describe('Regular User Permissions', () => {
        it('should deny case permissions to regular users', async () => {
            const interaction = createMockInteraction(regularUserId, []);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            expect(context.isGuildOwner).toBe(false);
            expect(context.userRoles).toEqual([]);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false);
        });
        it('should deny case permissions to users with unrelated roles', async () => {
            const interaction = createMockInteraction(regularUserId, ['some-other-role-456']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false);
        });
    });
    describe('Permission Context Creation', () => {
        it('should correctly extract user roles from interaction', async () => {
            const userRoles = ['case-role-123', 'hr-role-123', 'another-role'];
            const interaction = createMockInteraction(caseManagerUserId, userRoles);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            expect(context.guildId).toBe(testGuildId);
            expect(context.userId).toBe(caseManagerUserId);
            expect(context.userRoles).toEqual(userRoles);
            expect(context.isGuildOwner).toBe(false);
        });
        it('should correctly identify guild ownership', async () => {
            const interaction = createMockInteraction(guildOwnerId, ['some-role'], true);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            expect(context.isGuildOwner).toBe(true);
            expect(context.userId).toBe(guildOwnerId);
        });
        it('should handle empty role arrays correctly', async () => {
            const interaction = createMockInteraction(regularUserId, []);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            expect(context.userRoles).toEqual([]);
            expect(context.isGuildOwner).toBe(false);
        });
    });
    describe('Command Guard Simulation', () => {
        it('should simulate the reassign command permission guard for guild owner', async () => {
            // Simulate the exact logic used in the case reassign command guard
            const interaction = createMockInteraction(guildOwnerId, [], true);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            // This is what the guard checks
            expect(hasPermission).toBe(true);
            // If this was false, the guard would call interaction.reply with error message
            // and return early without calling next()
        });
        it('should simulate the unassign command permission guard for case manager', async () => {
            // Simulate the exact logic used in the case unassign command guard
            const interaction = createMockInteraction(caseManagerUserId, ['case-role-123']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(true);
        });
        it('should simulate permission denial for regular users', async () => {
            // Simulate what happens when a regular user tries to use the commands
            const interaction = createMockInteraction(regularUserId, ['irrelevant-role']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false);
            // In the real command, this would trigger:
            // await interaction.reply({
            //   content: '❌ You do not have permission to manage cases. Case permission required.',
            //   ephemeral: true,
            // });
            // return; // Guard blocks execution
        });
    });
    describe('Permission System Edge Cases', () => {
        it('should handle guild configuration with empty permissions', async () => {
            // Clear the test database and create a completely new guild config with empty permissions
            await test_utils_1.TestUtils.clearTestDatabase();
            await guildConfigRepository.add({
                guildId: testGuildId,
                feedbackChannelId: 'feedback-channel-123',
                retainerChannelId: 'retainer-channel-123',
                caseReviewCategoryId: 'case-review-123',
                caseArchiveCategoryId: 'case-archive-123',
                modlogChannelId: 'modlog-123',
                applicationChannelId: 'application-123',
                clientRoleId: 'client-role-123',
                permissions: {
                    admin: ['admin-role-123'],
                    'senior-staff': ['hr-role-123'],
                    case: [], // Empty case permissions - the role won't be found here
                    config: ['config-role-123'],
                    lawyer: ['retainer-role-123'],
                    'lead-attorney': ['lead-attorney-role-123'],
                    repair: ['repair-role-123']
                },
                adminRoles: ['admin-role-123'],
                adminUsers: [adminUserId]
            });
            // Create a fresh permission service instance to ensure it gets the new config
            const freshPermissionService = new permission_service_1.PermissionService(new guild_config_repository_1.GuildConfigRepository());
            const interaction = createMockInteraction(caseManagerUserId, ['case-role-123']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const hasPermission = await freshPermissionService.hasActionPermission(context, 'case');
            // Should be denied because case permissions array is empty and role isn't in it
            expect(hasPermission).toBe(false);
        });
        it('should still grant permissions to guild owner even with empty config', async () => {
            // Update config to have empty permissions
            await guildConfigRepository.update(testGuildId, {
                permissions: {
                    admin: [],
                    'senior-staff': [],
                    case: [],
                    config: [],
                    lawyer: [],
                    'lead-attorney': [],
                    repair: []
                },
                adminUsers: [],
                adminRoles: []
            });
            const interaction = createMockInteraction(guildOwnerId, [], true);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            // Guild owner should always have permissions regardless of configuration
            expect(hasPermission).toBe(true);
        });
        it('should handle missing guild configuration gracefully', async () => {
            // Clear the guild config
            await test_utils_1.TestUtils.clearTestDatabase();
            const interaction = createMockInteraction(regularUserId, ['case-role-123']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            // Should not throw an error
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false);
        });
    });
});
//# sourceMappingURL=case-commands-permission.test.js.map