import { BusinessRuleValidationService, RoleLimitValidationResult, CaseLimitValidationResult, StaffValidationResult, PermissionValidationResult } from '../../application/services/business-rule-validation-service';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { StaffRole } from '../../domain/entities/staff-role';
import { CaseStatus } from '../../domain/entities/case';
import { RetainerStatus } from '../../domain/entities/retainer';

// Mock all dependencies
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../application/services/permission-service');

describe('BusinessRuleValidationService', () => {
  let service: BusinessRuleValidationService;
  let mockGuildConfigRepo: jest.Mocked<GuildConfigRepository>;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockCaseRepo: jest.Mocked<CaseRepository>;
  let mockPermissionService: jest.Mocked<PermissionService>;

  const testContext: PermissionContext = {
    guildId: 'test_guild_123',
    userId: 'user_123',
    userRoles: ['role_1'],
    isGuildOwner: false,
  };

  const guildOwnerContext: PermissionContext = {
    ...testContext,
    isGuildOwner: true,
  };

  beforeEach(() => {
    mockGuildConfigRepo = new GuildConfigRepository() as jest.Mocked<GuildConfigRepository>;
    mockStaffRepo = new StaffRepository() as jest.Mocked<StaffRepository>;
    mockCaseRepo = new CaseRepository() as jest.Mocked<CaseRepository>;
    mockPermissionService = new PermissionService(mockGuildConfigRepo) as jest.Mocked<PermissionService>;

    service = new BusinessRuleValidationService(
      mockGuildConfigRepo,
      mockStaffRepo,
      mockCaseRepo,
      mockPermissionService
    );
  });

  describe('validateRoleLimit', () => {
    beforeEach(() => {
      mockStaffRepo.getStaffCountByRole.mockResolvedValue(3);
    });

    it('should allow hiring when under role limit', async () => {
      const result: RoleLimitValidationResult = await service.validateRoleLimit(testContext, StaffRole.PARALEGAL);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.currentCount).toBe(3);
      expect(result.maxCount).toBe(10); // Paralegal limit
      expect(result.bypassAvailable).toBe(false);
    });

    it('should deny hiring when at role limit for regular user', async () => {
      mockStaffRepo.getStaffCountByRole.mockResolvedValue(10);
      
      const result: RoleLimitValidationResult = await service.validateRoleLimit(testContext, StaffRole.PARALEGAL);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot hire Paralegal. Maximum limit of 10 reached (current: 10)');
      expect(result.bypassAvailable).toBe(false);
    });

    it('should allow bypass for guild owner when at role limit', async () => {
      mockStaffRepo.getStaffCountByRole.mockResolvedValue(10);
      
      const result: RoleLimitValidationResult = await service.validateRoleLimit(guildOwnerContext, StaffRole.PARALEGAL);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot hire Paralegal. Maximum limit of 10 reached (current: 10)');
      expect(result.bypassAvailable).toBe(true);
      expect(result.bypassType).toBe('guild-owner');
    });

    it('should handle Managing Partner limit (1 max)', async () => {
      mockStaffRepo.getStaffCountByRole.mockResolvedValue(1);
      
      const result: RoleLimitValidationResult = await service.validateRoleLimit(testContext, StaffRole.MANAGING_PARTNER);

      expect(result.valid).toBe(false);
      expect(result.maxCount).toBe(1);
      expect(result.errors).toContain('Cannot hire Managing Partner. Maximum limit of 1 reached (current: 1)');
    });

    it('should handle repository errors gracefully', async () => {
      mockStaffRepo.getStaffCountByRole.mockRejectedValue(new Error('Database error'));
      
      const result: RoleLimitValidationResult = await service.validateRoleLimit(testContext, StaffRole.PARALEGAL);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Failed to validate role limits');
      expect(result.currentCount).toBe(0);
      expect(result.maxCount).toBe(0);
    });
  });

  describe('validateClientCaseLimit', () => {
    const clientId = 'client_123';
    const guildId = 'guild_123';

    beforeEach(() => {
      mockCaseRepo.findByClient.mockResolvedValue([
        { guildId, status: CaseStatus.IN_PROGRESS },
        { guildId, status: CaseStatus.PENDING },
        { guildId, status: CaseStatus.CLOSED },
      ] as any[]);
    });

    it('should allow case creation when under limit', async () => {
      const result: CaseLimitValidationResult = await service.validateClientCaseLimit(clientId, guildId);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.currentCases).toBe(2); // Only IN_PROGRESS and PENDING count
      expect(result.maxCases).toBe(5);
    });

    it('should show warnings when approaching limit', async () => {
      mockCaseRepo.findByClient.mockResolvedValue([
        { guildId, status: CaseStatus.IN_PROGRESS },
        { guildId, status: CaseStatus.PENDING },
        { guildId, status: CaseStatus.IN_PROGRESS },
        { guildId, status: CaseStatus.CLOSED },
      ] as any[]);

      const result: CaseLimitValidationResult = await service.validateClientCaseLimit(clientId, guildId);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Client has 3 active cases (limit: 5)');
      expect(result.currentCases).toBe(3);
    });

    it('should deny case creation when at limit', async () => {
      mockCaseRepo.findByClient.mockResolvedValue([
        { guildId, status: CaseStatus.IN_PROGRESS },
        { guildId, status: CaseStatus.PENDING },
        { guildId, status: CaseStatus.IN_PROGRESS },
        { guildId, status: CaseStatus.PENDING },
        { guildId, status: CaseStatus.IN_PROGRESS },
      ] as any[]);

      const result: CaseLimitValidationResult = await service.validateClientCaseLimit(clientId, guildId);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Client has reached maximum active case limit (5). Current active cases: 5');
      expect(result.bypassAvailable).toBe(false); // No bypass for case limits
    });

    it('should filter cases by guild ID', async () => {
      mockCaseRepo.findByClient.mockResolvedValue([
        { guildId: 'other_guild', status: CaseStatus.IN_PROGRESS },
        { guildId, status: CaseStatus.IN_PROGRESS },
        { guildId, status: CaseStatus.PENDING },
      ] as any[]);

      const result: CaseLimitValidationResult = await service.validateClientCaseLimit(clientId, guildId);

      expect(result.currentCases).toBe(2); // Only cases from the specific guild
    });
  });

  describe('validateStaffMember', () => {
    const userId = 'user_123';

    beforeEach(() => {
      mockStaffRepo.findByUserId.mockResolvedValue({
        userId,
        role: StaffRole.JUNIOR_ASSOCIATE,
        status: RetainerStatus.SIGNED,
      } as any);
    });

    it('should validate active staff with required permissions', async () => {
      const result: StaffValidationResult = await service.validateStaffMember(testContext, userId, ['lawyer']);

      expect(result.valid).toBe(true);
      expect(result.isActiveStaff).toBe(true);
      expect(result.currentRole).toBe(StaffRole.JUNIOR_ASSOCIATE);
      expect(result.hasRequiredPermissions).toBe(true);
    });

    it('should reject inactive staff', async () => {
      mockStaffRepo.findByUserId.mockResolvedValue({
        userId,
        status: 'inactive',
      } as any);

      const result: StaffValidationResult = await service.validateStaffMember(testContext, userId);

      expect(result.valid).toBe(false);
      expect(result.isActiveStaff).toBe(false);
      expect(result.errors).toContain('User is not an active staff member');
    });

    it('should reject non-staff users', async () => {
      mockStaffRepo.findByUserId.mockResolvedValue(null);

      const result: StaffValidationResult = await service.validateStaffMember(testContext, userId);

      expect(result.valid).toBe(false);
      expect(result.isActiveStaff).toBe(false);
      expect(result.errors).toContain('User is not an active staff member');
    });

    it('should validate permission requirements', async () => {
      // Mock that user doesn't have admin permission
      mockStaffRepo.findByUserId.mockResolvedValue({
        userId,
        role: StaffRole.PARALEGAL, // Low level role
        status: RetainerStatus.SIGNED,
      } as any);

      const result: StaffValidationResult = await service.validateStaffMember(testContext, userId, ['admin']);

      expect(result.valid).toBe(false);
      expect(result.hasRequiredPermissions).toBe(false);
      expect(result.errors).toContain('User lacks required permissions: admin');
    });

    it('should allow guild owner bypass', async () => {
      mockStaffRepo.findByUserId.mockResolvedValue(null);

      const result: StaffValidationResult = await service.validateStaffMember(guildOwnerContext, userId);

      expect(result.bypassAvailable).toBe(true);
      expect(result.bypassType).toBe('guild-owner');
    });
  });

  describe('validatePermission', () => {
    it('should always allow guild owner', async () => {
      const result: PermissionValidationResult = await service.validatePermission(guildOwnerContext, 'admin');

      expect(result.valid).toBe(true);
      expect(result.hasPermission).toBe(true);
      expect(result.bypassAvailable).toBe(true);
      expect(result.bypassType).toBe('guild-owner');
    });

    it('should validate enhanced permissions', async () => {
      mockPermissionService.hasSeniorStaffPermissionWithContext.mockResolvedValue(true);

      const result: PermissionValidationResult = await service.validatePermission(testContext, 'senior-staff');

      expect(result.valid).toBe(true);
      expect(result.hasPermission).toBe(true);
    });

    it('should reject insufficient permissions', async () => {
      mockPermissionService.hasActionPermission.mockResolvedValue(false);

      const result: PermissionValidationResult = await service.validatePermission(testContext, 'admin');

      expect(result.valid).toBe(false);
      expect(result.hasPermission).toBe(false);
      expect(result.errors).toContain('Missing required permission: admin');
    });

    it('should handle permission service errors', async () => {
      mockPermissionService.hasActionPermission.mockRejectedValue(new Error('Permission error'));
      mockPermissionService.getPermissionSummary.mockRejectedValue(new Error('Permission error'));
      mockPermissionService.hasSeniorStaffPermissionWithContext.mockRejectedValue(new Error('Permission error'));

      const result: PermissionValidationResult = await service.validatePermission(testContext, 'admin');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required permission: admin');
    });
  });

  describe('validateMultiple', () => {
    it('should pass when all validations pass', async () => {
      const validations = [
        Promise.resolve({ valid: true, errors: [], warnings: [], bypassAvailable: false }),
        Promise.resolve({ valid: true, errors: [], warnings: [], bypassAvailable: false }),
      ];

      const result = await service.validateMultiple(validations);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when any validation fails', async () => {
      const validations = [
        Promise.resolve({ valid: true, errors: [], warnings: [], bypassAvailable: false }),
        Promise.resolve({ valid: false, errors: ['Validation failed'], warnings: [], bypassAvailable: false }),
      ];

      const result = await service.validateMultiple(validations);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Validation failed');
    });

    it('should aggregate warnings from all validations', async () => {
      const validations = [
        Promise.resolve({ valid: true, errors: [], warnings: ['Warning 1'], bypassAvailable: false }),
        Promise.resolve({ valid: true, errors: [], warnings: ['Warning 2'], bypassAvailable: false }),
      ];

      const result = await service.validateMultiple(validations);

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(['Warning 1', 'Warning 2']);
    });

    it('should detect bypass availability', async () => {
      const validations = [
        Promise.resolve({ valid: false, errors: ['Error'], warnings: [], bypassAvailable: true }),
        Promise.resolve({ valid: true, errors: [], warnings: [], bypassAvailable: false }),
      ];

      const result = await service.validateMultiple(validations);

      expect(result.bypassAvailable).toBe(true);
      expect(result.bypassType).toBe('guild-owner');
    });
  });

  describe('edge cases', () => {
    it('should handle empty role assignments', async () => {
      const emptyContext: PermissionContext = {
        guildId: 'test_guild',
        userId: 'test_user',
        userRoles: [],
        isGuildOwner: false,
      };

      // Mock permission service to return false for empty roles
      mockPermissionService.hasActionPermission.mockResolvedValue(false);
      mockPermissionService.getPermissionSummary.mockResolvedValue({
        isAdmin: false,
        isGuildOwner: false,
        permissions: { admin: false },
      } as any);

      const result = await service.validatePermission(emptyContext, 'admin');

      expect(result.valid).toBe(false);
      expect(result.hasPermission).toBe(false);
    });

    it('should handle malformed guild/user IDs gracefully', async () => {
      const malformedContext: PermissionContext = {
        guildId: '',
        userId: '',
        userRoles: [],
        isGuildOwner: false,
      };

      mockStaffRepo.getStaffCountByRole.mockRejectedValue(new Error('Invalid ID'));

      const result = await service.validateRoleLimit(malformedContext, StaffRole.PARALEGAL);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Failed to validate role limits');
    });

    it('should handle concurrent role limit checks', async () => {
      // Simulate race condition where role count changes between calls
      let callCount = 0;
      mockStaffRepo.getStaffCountByRole.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? 9 : 10; // First call returns 9, second returns 10
      });

      const [result1, result2] = await Promise.all([
        service.validateRoleLimit(testContext, StaffRole.PARALEGAL),
        service.validateRoleLimit(testContext, StaffRole.PARALEGAL),
      ]);

      // Both should work with their respective counts
      expect(result1.valid).toBe(true);
      expect(result1.currentCount).toBe(9);
      expect(result2.valid).toBe(false);
      expect(result2.currentCount).toBe(10);
    });
  });
});