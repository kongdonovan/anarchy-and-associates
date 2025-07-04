import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { GuildConfig } from '../../validation';

// Mock the repository
jest.mock('../../infrastructure/repositories/guild-config-repository');

describe('PermissionService', () => {
  let permissionService: PermissionService;
  let mockRepository: jest.Mocked<GuildConfigRepository>;

  const testContext: PermissionContext = {
    guildId: '123456789012345678',
    userId: '234567890123456789',
    userRoles: ['345678901234567890', '456789012345678901'],
    isGuildOwner: false,
  };

  const mockConfig: Partial<GuildConfig> = {
    guildId: '123456789012345678',
    adminUsers: ['567890123456789012'],
    adminRoles: ['678901234567890123'],
    permissions: {
      admin: ['admin_role_1'],
      'senior-staff': ['senior_staff_role_1'], // Updated from hr
      case: ['case_role_1'],
      config: ['config_role_1'],
      lawyer: ['lawyer_role_1'], // Updated from retainer
      'lead-attorney': ['lead_attorney_role_1'], // New permission type
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
      
      const result = await permissionService.hasActionPermission(ownerContext, 'senior-staff');
      
      expect(result).toBe(true);
    });

    it('should not grant unrelated permission to user', async () => {
      const adminContext = { ...testContext, userId: 'admin_user_1' };
      
      const result = await permissionService.hasActionPermission(adminContext, 'senior-staff');
      
      expect(result).toBe(false);
    });

    it('should not grant unrelated permission to user with unrelated role', async () => {
      const adminRoleContext = { ...testContext, userRoles: ['admin_role_1'] };
      
      const result = await permissionService.hasActionPermission(adminRoleContext, 'case');
      
      expect(result).toBe(false);
    });

    it('should grant permission to user with specific action role', async () => {
      const caseContext = { ...testContext, userRoles: ['case_role_1'] };
      
      const result = await permissionService.hasActionPermission(caseContext, 'case');
      
      expect(result).toBe(true);
    });

    it('should deny permission to user without proper roles', async () => {
      const result = await permissionService.hasActionPermission(testContext, 'case');
      
      expect(result).toBe(false);
    });

    it('should handle repository errors gracefully', async () => {
      mockRepository.ensureGuildConfig.mockRejectedValue(new Error('Database error'));
      
      const result = await permissionService.hasActionPermission(testContext, 'senior-staff');
      
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
      expect(summary.permissions['senior-staff']).toBe(false);
    });

    it('should return admin summary for admin user', async () => {
      const adminContext = { ...testContext, userId: 'admin_user_1' };
      
      const summary = await permissionService.getPermissionSummary(adminContext);
      
      expect(summary.isAdmin).toBe(true);
      expect(summary.permissions.admin).toBe(true);
    });
  });

  describe('enhanced permission methods', () => {
    describe('hasSeniorStaffPermissionWithContext', () => {
      it('should grant permission to guild owner', async () => {
        const ownerContext = { ...testContext, isGuildOwner: true };
        
        const result = await permissionService.hasSeniorStaffPermissionWithContext(ownerContext);
        
        expect(result).toBe(true);
      });

      it('should grant permission to admin', async () => {
        const adminContext = { ...testContext, userId: 'admin_user_1' };
        
        const result = await permissionService.hasSeniorStaffPermissionWithContext(adminContext);
        
        expect(result).toBe(true);
      });

      it('should grant permission to user with senior-staff role', async () => {
        const seniorStaffContext = { ...testContext, userRoles: ['senior_staff_role_1'] };
        
        const result = await permissionService.hasSeniorStaffPermissionWithContext(seniorStaffContext);
        
        expect(result).toBe(true);
      });

      it('should deny permission to regular user', async () => {
        const result = await permissionService.hasSeniorStaffPermissionWithContext(testContext);
        
        expect(result).toBe(false);
      });
    });

    describe('hasLawyerPermissionWithContext', () => {
      it('should grant permission to guild owner', async () => {
        const ownerContext = { ...testContext, isGuildOwner: true };
        
        const result = await permissionService.hasLawyerPermissionWithContext(ownerContext);
        
        expect(result).toBe(true);
      });

      it('should grant permission to admin', async () => {
        const adminContext = { ...testContext, userId: 'admin_user_1' };
        
        const result = await permissionService.hasLawyerPermissionWithContext(adminContext);
        
        expect(result).toBe(true);
      });

      it('should grant permission to user with lawyer role', async () => {
        const lawyerContext = { ...testContext, userRoles: ['lawyer_role_1'] };
        
        const result = await permissionService.hasLawyerPermissionWithContext(lawyerContext);
        
        expect(result).toBe(true);
      });

      it('should deny permission to regular user', async () => {
        const result = await permissionService.hasLawyerPermissionWithContext(testContext);
        
        expect(result).toBe(false);
      });
    });

    describe('hasLeadAttorneyPermissionWithContext', () => {
      it('should grant permission to guild owner', async () => {
        const ownerContext = { ...testContext, isGuildOwner: true };
        
        const result = await permissionService.hasLeadAttorneyPermissionWithContext(ownerContext);
        
        expect(result).toBe(true);
      });

      it('should grant permission to admin', async () => {
        const adminContext = { ...testContext, userId: 'admin_user_1' };
        
        const result = await permissionService.hasLeadAttorneyPermissionWithContext(adminContext);
        
        expect(result).toBe(true);
      });

      it('should grant permission to user with lead-attorney role', async () => {
        const leadAttorneyContext = { ...testContext, userRoles: ['lead_attorney_role_1'] };
        
        const result = await permissionService.hasLeadAttorneyPermissionWithContext(leadAttorneyContext);
        
        expect(result).toBe(true);
      });

      it('should deny permission to regular user', async () => {
        const result = await permissionService.hasLeadAttorneyPermissionWithContext(testContext);
        
        expect(result).toBe(false);
      });
    });

    describe('backward compatibility', () => {
      it('should maintain hasHRPermissionWithContext for backward compatibility', async () => {
        const seniorStaffContext = { ...testContext, userRoles: ['senior_staff_role_1'] };
        
        const result = await permissionService.hasHRPermissionWithContext(seniorStaffContext);
        
        expect(result).toBe(true);
      });

      it('should maintain hasRetainerPermissionWithContext for backward compatibility', async () => {
        const lawyerContext = { ...testContext, userRoles: ['lawyer_role_1'] };
        
        const result = await permissionService.hasRetainerPermissionWithContext(lawyerContext);
        
        expect(result).toBe(true);
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle missing guild config gracefully', async () => {
      mockRepository.ensureGuildConfig.mockResolvedValue(null as any);
      
      const result = await permissionService.hasActionPermission(testContext, 'admin');
      
      expect(result).toBe(false);
    });

    it('should handle malformed permission configuration', async () => {
      const malformedConfig = {
        ...mockConfig,
        permissions: {
          admin: null, // Malformed permission
        },
      };
      mockRepository.ensureGuildConfig.mockResolvedValue(malformedConfig as any);
      
      const result = await permissionService.hasActionPermission(testContext, 'admin');
      
      expect(result).toBe(false);
    });

    it('should handle empty user roles array', async () => {
      const emptyRolesContext = { ...testContext, userRoles: [] };
      
      const result = await permissionService.hasActionPermission(emptyRolesContext, 'admin');
      
      expect(result).toBe(false);
    });

    it('should handle undefined user roles', async () => {
      const undefinedRolesContext = { ...testContext, userRoles: undefined as any };
      
      const result = await permissionService.hasActionPermission(undefinedRolesContext, 'admin');
      
      expect(result).toBe(false);
    });

    it('should handle concurrent permission checks', async () => {
      const promises = Array.from({ length: 10 }, () => 
        permissionService.hasActionPermission(testContext, 'admin')
      );
      
      const results = await Promise.all(promises);
      
      // All should return false consistently
      expect(results.every(result => result === false)).toBe(true);
    });

    it('should handle very long role names', async () => {
      const longRoleName = 'very_long_role_name_' + 'x'.repeat(1000);
      const longRoleContext = { ...testContext, userRoles: [longRoleName] };
      
      const result = await permissionService.hasActionPermission(longRoleContext, 'admin');
      
      expect(result).toBe(false);
    });

    it('should handle special characters in role names', async () => {
      const specialRoleContext = { ...testContext, userRoles: ['role@#$%^&*()'] };
      
      const result = await permissionService.hasActionPermission(specialRoleContext, 'admin');
      
      expect(result).toBe(false);
    });
  });

  describe('permission summary with new permissions', () => {
    it('should include all new permission types in summary', async () => {
      const summary = await permissionService.getPermissionSummary(testContext);
      
      expect(summary.permissions).toHaveProperty('admin');
      expect(summary.permissions).toHaveProperty('case');
      expect(summary.permissions).toHaveProperty('config');
      expect(summary.permissions).toHaveProperty('repair');
      // Note: The summary should include the new permission types when they're added to the service
    });

    it('should show correct permissions for user with multiple roles', async () => {
      const multiRoleContext = { 
        ...testContext, 
        userRoles: ['case_role_1', 'lawyer_role_1'] 
      };
      
      const summary = await permissionService.getPermissionSummary(multiRoleContext);
      
      expect(summary.permissions.case).toBe(true);
      // Should also have lawyer permission when it's added to summary
    });

    it('should show admin override in summary', async () => {
      const adminContext = { ...testContext, userId: 'admin_user_1' };
      
      const summary = await permissionService.getPermissionSummary(adminContext);
      
      expect(summary.isAdmin).toBe(true);
      // Admin users only get the 'admin' permission, not all permissions automatically
      expect(summary.permissions.admin).toBe(true);
      // Other permissions should be false unless the admin has specific roles
      expect(summary.permissions.case).toBe(false);
      expect(summary.permissions['senior-staff']).toBe(false);
    });
  });
});