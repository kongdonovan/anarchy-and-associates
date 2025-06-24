"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const permission_service_1 = require("../../application/services/permission-service");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
// Mock the repository
jest.mock('../../infrastructure/repositories/guild-config-repository');
describe('PermissionService', () => {
    let permissionService;
    let mockRepository;
    const testContext = {
        guildId: 'test_guild_123',
        userId: 'user_123',
        userRoles: ['role_1', 'role_2'],
        isGuildOwner: false,
    };
    const mockConfig = {
        guildId: 'test_guild_123',
        adminUsers: ['admin_user_1'],
        adminRoles: ['admin_role_1'],
        permissions: {
            admin: ['admin_role_1'],
            hr: ['hr_role_1'],
            case: ['case_role_1'],
            config: ['config_role_1'],
            retainer: ['retainer_role_1'],
            repair: ['repair_role_1'],
        },
    };
    beforeEach(() => {
        mockRepository = new guild_config_repository_1.GuildConfigRepository();
        permissionService = new permission_service_1.PermissionService(mockRepository);
        mockRepository.ensureGuildConfig.mockResolvedValue(mockConfig);
    });
    describe('hasActionPermission', () => {
        it('should grant permission to guild owner', async () => {
            const ownerContext = { ...testContext, isGuildOwner: true };
            const result = await permissionService.hasActionPermission(ownerContext, 'hr');
            expect(result).toBe(true);
        });
        it('should grant permission to admin user', async () => {
            const adminContext = { ...testContext, userId: 'admin_user_1' };
            const result = await permissionService.hasActionPermission(adminContext, 'hr');
            expect(result).toBe(true);
        });
        it('should grant permission to user with admin role', async () => {
            const adminRoleContext = { ...testContext, userRoles: ['admin_role_1'] };
            const result = await permissionService.hasActionPermission(adminRoleContext, 'hr');
            expect(result).toBe(true);
        });
        it('should grant permission to user with specific action role', async () => {
            const hrContext = { ...testContext, userRoles: ['hr_role_1'] };
            const result = await permissionService.hasActionPermission(hrContext, 'hr');
            expect(result).toBe(true);
        });
        it('should deny permission to user without proper roles', async () => {
            const result = await permissionService.hasActionPermission(testContext, 'hr');
            expect(result).toBe(false);
        });
        it('should handle repository errors gracefully', async () => {
            mockRepository.ensureGuildConfig.mockRejectedValue(new Error('Database error'));
            const result = await permissionService.hasActionPermission(testContext, 'hr');
            expect(result).toBe(false);
        });
    });
    describe('isAdmin', () => {
        it('should return true for guild owner', async () => {
            const ownerContext = { ...testContext, isGuildOwner: true };
            const result = await permissionService.isAdmin(ownerContext);
            expect(result).toBe(true);
        });
        it('should return true for admin user', async () => {
            const adminContext = { ...testContext, userId: 'admin_user_1' };
            const result = await permissionService.isAdmin(adminContext);
            expect(result).toBe(true);
        });
        it('should return true for user with admin role', async () => {
            const adminRoleContext = { ...testContext, userRoles: ['admin_role_1'] };
            const result = await permissionService.isAdmin(adminRoleContext);
            expect(result).toBe(true);
        });
        it('should return false for regular user', async () => {
            const result = await permissionService.isAdmin(testContext);
            expect(result).toBe(false);
        });
    });
    describe('getPermissionSummary', () => {
        it('should return complete permission summary', async () => {
            const summary = await permissionService.getPermissionSummary(testContext);
            expect(summary.isAdmin).toBe(false);
            expect(summary.isGuildOwner).toBe(false);
            expect(summary.permissions).toBeDefined();
            expect(summary.permissions.admin).toBe(false);
            expect(summary.permissions.hr).toBe(false);
        });
        it('should return admin summary for admin user', async () => {
            const adminContext = { ...testContext, userId: 'admin_user_1' };
            const summary = await permissionService.getPermissionSummary(adminContext);
            expect(summary.isAdmin).toBe(true);
            expect(summary.permissions.admin).toBe(true);
        });
    });
});
//# sourceMappingURL=permission-service.test.js.map