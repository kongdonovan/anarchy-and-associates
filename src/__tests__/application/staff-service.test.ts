import { StaffService } from '../../application/services/staff-service';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { StaffRole } from '../../domain/entities/staff-role';

// Mock the repositories and services
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../application/services/permission-service');
jest.mock('../../application/services/business-rule-validation-service');

describe('StaffService', () => {
  let staffService: StaffService;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  let mockPermissionService: jest.Mocked<PermissionService>;
  let mockBusinessRuleValidationService: jest.Mocked<BusinessRuleValidationService>;
  let mockGuildConfigRepository: jest.Mocked<GuildConfigRepository>;
  let mockCaseRepository: jest.Mocked<CaseRepository>;

  const testContext: PermissionContext = {
    guildId: 'guild123',
    userId: 'admin123',
    userRoles: ['admin_role'],
    isGuildOwner: false,
  };

  const guildOwnerContext: PermissionContext = {
    ...testContext,
    isGuildOwner: true,
  };

  beforeEach(() => {
    mockStaffRepository = new StaffRepository() as jest.Mocked<StaffRepository>;
    mockAuditLogRepository = new AuditLogRepository() as jest.Mocked<AuditLogRepository>;
    mockGuildConfigRepository = new GuildConfigRepository() as jest.Mocked<GuildConfigRepository>;
    mockCaseRepository = new CaseRepository() as jest.Mocked<CaseRepository>;
    mockPermissionService = new PermissionService(mockGuildConfigRepository) as jest.Mocked<PermissionService>;
    mockBusinessRuleValidationService = new BusinessRuleValidationService(
      mockGuildConfigRepository,
      mockStaffRepository,
      mockCaseRepository,
      mockPermissionService
    ) as jest.Mocked<BusinessRuleValidationService>;

    staffService = new StaffService(
      mockStaffRepository,
      mockAuditLogRepository,
      mockPermissionService,
      mockBusinessRuleValidationService
    );

    // Default permission service mocks
    mockPermissionService.hasSeniorStaffPermissionWithContext.mockResolvedValue(true);
    mockPermissionService.isAdmin.mockResolvedValue(false);
  });

  describe('validateRobloxUsername', () => {
    it('should validate correct Roblox usernames', async () => {
      const validUsernames = ['TestUser123', 'User_Name', 'ValidName'];
      
      for (const username of validUsernames) {
        const result = await staffService.validateRobloxUsername(username);
        expect(result.isValid).toBe(true);
        expect(result.username).toBe(username);
        expect(result.error).toBeUndefined();
      }
    });

    it('should reject usernames that are too short', async () => {
      const result = await staffService.validateRobloxUsername('ab');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('3-20 characters');
    });

    it('should reject usernames that are too long', async () => {
      const result = await staffService.validateRobloxUsername('a'.repeat(21));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('3-20 characters');
    });

    it('should reject usernames with invalid characters', async () => {
      const invalidUsernames = ['user-name', 'user@name', 'user name', 'user!'];
      
      for (const username of invalidUsernames) {
        const result = await staffService.validateRobloxUsername(username);
        expect(result.isValid).toBe(false);
      }
    });

    it('should reject usernames starting or ending with underscore', async () => {
      const result1 = await staffService.validateRobloxUsername('_username');
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('cannot start or end with an underscore');

      const result2 = await staffService.validateRobloxUsername('username_');
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('cannot start or end with an underscore');
    });
  });

  describe('hireStaff', () => {
    const hireRequest = {
      guildId: 'guild123',
      userId: 'user123',
      robloxUsername: 'TestUser',
      role: StaffRole.PARALEGAL,
      hiredBy: 'admin123',
      reason: 'Test hire',
      isGuildOwner: false,
    };

    beforeEach(() => {
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockStaffRepository.findStaffByRobloxUsername.mockResolvedValue(null);
      mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        currentCount: 3,
        maxCount: 10,
        roleName: StaffRole.PARALEGAL,
        metadata: {},
      });
      mockAuditLogRepository.logAction.mockResolvedValue({} as any);
    });

    it('should successfully hire a new staff member', async () => {
      const mockStaff = {
        _id: {} as any,
        ...hireRequest,
        hiredAt: new Date(),
        promotionHistory: [],
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStaffRepository.add.mockResolvedValue(mockStaff);

      const result = await staffService.hireStaff(testContext, hireRequest);

      expect(result.success).toBe(true);
      expect(result.staff).toBeDefined();
      expect(mockBusinessRuleValidationService.validateRoleLimit).toHaveBeenCalledWith(
        testContext,
        StaffRole.PARALEGAL
      );
      expect(mockStaffRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: hireRequest.userId,
          role: hireRequest.role,
          robloxUsername: hireRequest.robloxUsername,
          status: 'active',
        })
      );
      expect(mockAuditLogRepository.logAction).toHaveBeenCalled();
    });

    it('should check senior-staff permission before hiring', async () => {
      mockPermissionService.hasSeniorStaffPermissionWithContext.mockResolvedValue(false);

      const result = await staffService.hireStaff(testContext, hireRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission to hire staff members');
      expect(mockStaffRepository.add).not.toHaveBeenCalled();
    });

    it('should reject invalid Roblox username', async () => {
      const invalidRequest = { ...hireRequest, robloxUsername: 'ab' };
      
      const result = await staffService.hireStaff(testContext, invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('3-20 characters');
      expect(mockStaffRepository.add).not.toHaveBeenCalled();
    });

    it('should reject if user is already staff', async () => {
      mockStaffRepository.findByUserId.mockResolvedValue({
        status: 'active',
      } as any);

      const result = await staffService.hireStaff(testContext, hireRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already an active staff member');
      expect(mockStaffRepository.add).not.toHaveBeenCalled();
    });

    it('should reject if Roblox username is already used', async () => {
      mockStaffRepository.findStaffByRobloxUsername.mockResolvedValue({} as any);

      const result = await staffService.hireStaff(testContext, hireRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already associated with another staff member');
      expect(mockStaffRepository.add).not.toHaveBeenCalled();
    });

    it('should reject if role limit reached for regular user', async () => {
      mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
        valid: false,
        errors: ['Cannot hire Paralegal. Maximum limit of 10 reached'],
        warnings: [],
        bypassAvailable: false,
        currentCount: 10,
        maxCount: 10,
        roleName: StaffRole.PARALEGAL,
        metadata: {},
      });

      const result = await staffService.hireStaff(testContext, hireRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum limit of 10 reached');
      expect(mockStaffRepository.add).not.toHaveBeenCalled();
    });

    it('should allow guild owner to bypass role limits', async () => {
      mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
        valid: false,
        errors: ['Cannot hire Managing Partner. Maximum limit of 1 reached'],
        warnings: [],
        bypassAvailable: true,
        bypassType: 'guild-owner',
        currentCount: 1,
        maxCount: 1,
        roleName: StaffRole.MANAGING_PARTNER,
        metadata: {},
      });

      const mockStaff = {
        _id: {} as any,
        ...hireRequest,
        role: StaffRole.MANAGING_PARTNER,
        hiredAt: new Date(),
        promotionHistory: [],
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStaffRepository.add.mockResolvedValue(mockStaff);
      mockAuditLogRepository.logRoleLimitBypass.mockResolvedValue({} as any);

      const guildOwnerRequest = { ...hireRequest, role: StaffRole.MANAGING_PARTNER };
      const result = await staffService.hireStaff(guildOwnerContext, guildOwnerRequest);

      expect(result.success).toBe(true);
      expect(mockAuditLogRepository.logRoleLimitBypass).toHaveBeenCalledWith(
        'guild123',
        'admin123',
        'user123',
        StaffRole.MANAGING_PARTNER,
        1,
        1,
        'Test hire'
      );
      expect(mockStaffRepository.add).toHaveBeenCalled();
    });
  });

  describe('promoteStaff', () => {
    const promotionRequest = {
      guildId: 'guild123',
      userId: 'user123',
      newRole: StaffRole.JUNIOR_ASSOCIATE,
      promotedBy: 'admin123',
      reason: 'Good performance',
    };

    const mockStaff = {
      _id: {} as any,
      userId: 'user123',
      guildId: 'guild123',
      role: StaffRole.PARALEGAL,
      status: 'active' as const,
      robloxUsername: 'TestUser',
      hiredAt: new Date(),
      hiredBy: 'admin123',
      promotionHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockStaffRepository.findByUserId.mockResolvedValue(mockStaff);
      mockStaffRepository.canHireRole.mockResolvedValue(true);
      mockAuditLogRepository.logAction.mockResolvedValue({} as any);
    });

    it('should successfully promote a staff member', async () => {
      const updatedStaff = { ...mockStaff, role: promotionRequest.newRole };
      mockStaffRepository.updateStaffRole.mockResolvedValue(updatedStaff);

      const result = await staffService.promoteStaff(promotionRequest);

      expect(result.success).toBe(true);
      expect(result.staff?.role).toBe(promotionRequest.newRole);
      expect(mockStaffRepository.updateStaffRole).toHaveBeenCalledWith(
        promotionRequest.guildId,
        promotionRequest.userId,
        promotionRequest.newRole,
        promotionRequest.promotedBy,
        promotionRequest.reason
      );
      expect(mockAuditLogRepository.logAction).toHaveBeenCalled();
    });

    it('should reject if staff member not found', async () => {
      mockStaffRepository.findByUserId.mockResolvedValue(null);

      const result = await staffService.promoteStaff(promotionRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found or inactive');
      expect(mockStaffRepository.updateStaffRole).not.toHaveBeenCalled();
    });

    it('should reject if new role is not higher', async () => {
      const invalidRequest = { ...promotionRequest, newRole: StaffRole.PARALEGAL };

      const result = await staffService.promoteStaff(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be higher than current role');
      expect(mockStaffRepository.updateStaffRole).not.toHaveBeenCalled();
    });

    it('should reject if role limit reached for new role', async () => {
      mockStaffRepository.canHireRole.mockResolvedValue(false);

      const result = await staffService.promoteStaff(promotionRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum limit');
      expect(mockStaffRepository.updateStaffRole).not.toHaveBeenCalled();
    });
  });
});