import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { GuildConfig } from '../../domain/entities/guild-config';

// Mock the repository
jest.mock('../../infrastructure/repositories/guild-config-repository');

describe('PermissionService', () => {
  let permissionService: PermissionService;
  let mockRepository: jest.Mocked<GuildConfigRepository>;

  const testContext: PermissionContext = {
    guildId: 'test_guild_123',
    userId: 'user_123',
    userRoles: ['role_1', 'role_2'],
    isGuildOwner: false,
  };

  const mockConfig: Partial<GuildConfig> = {
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
    mockRepository = new GuildConfigRepository() as jest.Mocked<GuildConfigRepository>;
    permissionService = new PermissionService(mockRepository);
    
    mockRepository.ensureGuildConfig.mockResolvedValue(mockConfig as GuildConfig);
  });

  describe('hasActionPermission', () => {
    it('should grant permission to guild owner', async () => {
      const ownerContext = { ...testContext, isGuildOwner: true };
      
      const result = await permissionService.hasActionPermission(ownerContext, 'hr');
      
      expect(result).toBe(true);
    });

    it('should not grant unrelated permission to user', async () => {
      const adminContext = { ...testContext, userId: 'admin_user_1' };
      
      const result = await permissionService.hasActionPermission(adminContext, 'hr');
      
      expect(result).toBe(false);
    });

    it('should not grant unrelated permission to user with unrelated role', async () => {
      const adminRoleContext = { ...testContext, userRoles: ['admin_role_1'] };
      
      const result = await permissionService.hasActionPermission(adminRoleContext, 'hr');
      
      expect(result).toBe(false);
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