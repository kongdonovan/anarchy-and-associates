import { StaffService } from '../../application/services/staff-service';
import { CaseService } from '../../application/services/case-service';
import { RetainerService } from '../../application/services/retainer-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { GuildOwnerUtils } from '../../infrastructure/utils/guild-owner-utils';

import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { RobloxService } from '../../infrastructure/external/roblox-service';

import { StaffRole } from '../../domain/entities/staff-role';
import { CaseStatus, CasePriority } from '../../domain/entities/case';
import { RetainerStatus } from '../../domain/entities/retainer';
import { ObjectId } from 'mongodb';

// Mock all repositories and external services
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../infrastructure/repositories/case-counter-repository');
jest.mock('../../infrastructure/repositories/retainer-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../infrastructure/external/roblox-service');

describe('Business Rule Integration Tests', () => {
  let staffService: StaffService;
  let caseService: CaseService;
  let retainerService: RetainerService;
  let businessRuleValidationService: BusinessRuleValidationService;
  let permissionService: PermissionService;

  // Mock repositories
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockAuditLogRepo: jest.Mocked<AuditLogRepository>;
  let mockCaseRepo: jest.Mocked<CaseRepository>;
  let mockCaseCounterRepo: jest.Mocked<CaseCounterRepository>;
  let mockRetainerRepo: jest.Mocked<RetainerRepository>;
  let mockGuildConfigRepo: jest.Mocked<GuildConfigRepository>;
  let mockRobloxService: jest.Mocked<RobloxService>;

  // Test contexts
  const guildId = 'test_guild_123';
  const managingPartnerId = 'managing_partner_123';
  const seniorPartnerId = 'senior_partner_123';
  const juniorAssociateId = 'junior_associate_123';
  const regularUserId = 'regular_user_123';
  const clientId = 'client_123';

  const guildOwnerContext: PermissionContext = {
    guildId,
    userId: managingPartnerId,
    userRoles: ['managing_partner_role'],
    isGuildOwner: true };

  const seniorPartnerContext: PermissionContext = {
    guildId,
    userId: seniorPartnerId,
    userRoles: ['senior_partner_role'],
    isGuildOwner: false };

  const juniorAssociateContext: PermissionContext = {
    guildId,
    userId: juniorAssociateId,
    userRoles: ['junior_associate_role'],
    isGuildOwner: false };

  const regularUserContext: PermissionContext = {
    guildId,
    userId: regularUserId,
    userRoles: [],
    isGuildOwner: false };

  beforeEach(() => {
    // Initialize mocked repositories
    mockStaffRepo = new StaffRepository() as jest.Mocked<StaffRepository>;
    mockAuditLogRepo = new AuditLogRepository() as jest.Mocked<AuditLogRepository>;
    mockCaseRepo = new CaseRepository() as jest.Mocked<CaseRepository>;
    mockCaseCounterRepo = new CaseCounterRepository() as jest.Mocked<CaseCounterRepository>;
    mockRetainerRepo = new RetainerRepository() as jest.Mocked<RetainerRepository>;
    mockGuildConfigRepo = new GuildConfigRepository() as jest.Mocked<GuildConfigRepository>;
    mockRobloxService = {
      validateUsername: jest.fn(),
      updateGroup: jest.fn(),
      getUserByUsername: jest.fn(),
      getUserById: jest.fn(),
      getUsernameById: jest.fn(),
      formatUserForDisplay: jest.fn(),
      createProfileEmbed: jest.fn() } as any;

    // Setup guild config with new permission structure
    mockGuildConfigRepo.ensureGuildConfig.mockResolvedValue({
      guildId,
      adminUsers: [managingPartnerId],
      adminRoles: ['managing_partner_role'],
      permissions: {
        admin: ['managing_partner_role'],
        'senior-staff': ['managing_partner_role', 'senior_partner_role'],
        case: ['junior_associate_role', 'senior_associate_role', 'junior_partner_role', 'senior_partner_role', 'managing_partner_role'],
        config: ['managing_partner_role'],
        lawyer: ['junior_associate_role', 'senior_associate_role', 'junior_partner_role', 'senior_partner_role', 'managing_partner_role'],
        'lead-attorney': ['senior_associate_role', 'junior_partner_role', 'senior_partner_role', 'managing_partner_role'],
        repair: ['managing_partner_role'] } } as any);

    // Initialize services
    permissionService = new PermissionService(mockGuildConfigRepo);
    businessRuleValidationService = new BusinessRuleValidationService(
      mockGuildConfigRepo,
      mockStaffRepo,
      mockCaseRepo,
      permissionService
    );

    staffService = new StaffService(
      mockStaffRepo,
      mockAuditLogRepo,
      permissionService,
      businessRuleValidationService
    );

    caseService = new CaseService(
      mockCaseRepo,
      mockCaseCounterRepo,
      mockGuildConfigRepo,
      permissionService,
      businessRuleValidationService
    );

    retainerService = new RetainerService(
      mockRetainerRepo,
      mockGuildConfigRepo,
      mockRobloxService,
      permissionService
    );

    // Setup default staff members
    mockStaffRepo.findByUserId.mockImplementation(async (guildId, userId) => {
      const staffMembers: Record<string, any> = {
        [managingPartnerId]: {
          userId: managingPartnerId,
          guildId,
          role: StaffRole.MANAGING_PARTNER,
          status: 'active',
          robloxUsername: 'ManagingPartner1',
          hiredAt: new Date(),
          hiredBy: managingPartnerId,
          promotionHistory: [] },
        [seniorPartnerId]: {
          userId: seniorPartnerId,
          guildId,
          role: StaffRole.SENIOR_PARTNER,
          status: 'active',
          robloxUsername: 'SeniorPartner1',
          hiredAt: new Date(),
          hiredBy: managingPartnerId,
          promotionHistory: [] },
        [juniorAssociateId]: {
          userId: juniorAssociateId,
          guildId,
          role: StaffRole.JUNIOR_ASSOCIATE,
          status: 'active',
          robloxUsername: 'JuniorAssociate1',
          hiredAt: new Date(),
          hiredBy: seniorPartnerId,
          promotionHistory: [] } };
      return staffMembers[userId] || null;
    });

    // Setup default mocks
    mockAuditLogRepo.logAction.mockResolvedValue({} as any);
    mockAuditLogRepo.logRoleLimitBypass.mockResolvedValue({} as any);
    mockAuditLogRepo.logBusinessRuleViolation.mockResolvedValue({} as any);
  });

  describe('Staff Management Edge Cases', () => {
    describe('Role Limit Enforcement', () => {
      it('should enforce Managing Partner limit (1 max)', async () => {
        // Mock that there's already a Managing Partner
        mockStaffRepo.getStaffCountByRole.mockResolvedValue(1);
        mockStaffRepo.findByUserId.mockResolvedValue(null); // New user
        mockStaffRepo.findStaffByRobloxUsername.mockResolvedValue(null);

        const hireRequest = {
          guildId,
          userId: 'new_managing_partner',
          robloxUsername: 'NewManagingPartner',
          role: StaffRole.MANAGING_PARTNER,
          hiredBy: managingPartnerId,
          reason: 'Attempting to hire second Managing Partner' };

        // Should fail for senior partner (not guild owner)
        const result = await this.staffService.$1($2, hireRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Maximum limit of 1 reached');
      });

      it('should allow guild owner to bypass role limits with audit trail', async () => {
        // Mock that there's already a Managing Partner
        mockStaffRepo.getStaffCountByRole.mockResolvedValue(1);
        mockStaffRepo.findByUserId.mockResolvedValue(null);
        mockStaffRepo.findStaffByRobloxUsername.mockResolvedValue(null);
        mockStaffRepo.add.mockResolvedValue({} as any);

        const hireRequest = {
          guildId,
          userId: 'second_managing_partner',
          robloxUsername: 'SecondManagingPartner',
          role: StaffRole.MANAGING_PARTNER,
          hiredBy: managingPartnerId,
          reason: 'Emergency hire - guild owner bypass' };

        // Should succeed for guild owner
        const result = await this.staffService.$1($2, hireRequest);

        expect(result.success).toBe(true);
        expect(mockAuditLogRepo.logRoleLimitBypass).toHaveBeenCalledWith(
          guildId,
          managingPartnerId,
          'second_managing_partner',
          StaffRole.MANAGING_PARTNER,
          1,
          1,
          'Emergency hire - guild owner bypass'
        );
      });

      it('should enforce role hierarchy in hiring permissions', async () => {
        mockStaffRepo.getStaffCountByRole.mockResolvedValue(2); // Under limit
        mockStaffRepo.findByUserId.mockResolvedValue(null);
        mockStaffRepo.findStaffByRobloxUsername.mockResolvedValue(null);

        const hireRequest = {
          guildId,
          userId: 'new_senior_partner',
          robloxUsername: 'NewSeniorPartner',
          role: StaffRole.SENIOR_PARTNER,
          hiredBy: juniorAssociateId,
          reason: 'Junior Associate trying to hire Senior Partner' };

        // Junior Associate shouldn't be able to hire Senior Partner
        const result = await this.staffService.$1($2, hireRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('lower levels than your own role');
      });
    });

    describe('Permission System Integration', () => {
      it('should grant senior-staff permissions to appropriate roles', async () => {
        // Managing Partner should have senior-staff permission
        const mpHasSeniorStaff = await permissionService.hasSeniorStaffPermissionWithContext(guildOwnerContext);
        expect(mpHasSeniorStaff).toBe(true);

        // Senior Partner should have senior-staff permission
        const spHasSeniorStaff = await permissionService.hasSeniorStaffPermissionWithContext(seniorPartnerContext);
        expect(spHasSeniorStaff).toBe(true);

        // Junior Associate should NOT have senior-staff permission
        const jaHasSeniorStaff = await permissionService.hasSeniorStaffPermissionWithContext(juniorAssociateContext);
        expect(jaHasSeniorStaff).toBe(false);
      });

      it('should grant lawyer permissions to legal staff', async () => {
        // All legal staff should have lawyer permission
        const mpHasLawyer = await permissionService.hasLawyerPermissionWithContext(guildOwnerContext);
        expect(mpHasLawyer).toBe(true);

        const spHasLawyer = await permissionService.hasLawyerPermissionWithContext(seniorPartnerContext);
        expect(spHasLawyer).toBe(true);

        const jaHasLawyer = await permissionService.hasLawyerPermissionWithContext(juniorAssociateContext);
        expect(jaHasLawyer).toBe(true);

        // Regular user should NOT have lawyer permission
        const regularHasLawyer = await permissionService.hasLawyerPermissionWithContext(regularUserContext);
        expect(regularHasLawyer).toBe(false);
      });

      it('should enforce lead-attorney permissions for senior roles only', async () => {
        // Senior Partner should have lead-attorney permission
        const spHasLeadAttorney = await permissionService.hasLeadAttorneyPermissionWithContext(seniorPartnerContext);
        expect(spHasLeadAttorney).toBe(true);

        // Junior Associate should NOT have lead-attorney permission (too junior)
        const jaHasLeadAttorney = await permissionService.hasLeadAttorneyPermissionWithContext(juniorAssociateContext);
        expect(jaHasLeadAttorney).toBe(false);
      });
    });
  });

  describe('Case Management Edge Cases', () => {
    describe('Client Case Limits', () => {
      it('should enforce 5 active case limit per client', async () => {
        // Mock 5 active cases for client
        mockCaseRepo.findByClient.mockResolvedValue([
          { guildId, status: CaseStatus.IN_PROGRESS },
          { guildId, status: CaseStatus.PENDING },
          { guildId, status: CaseStatus.IN_PROGRESS },
          { guildId, status: CaseStatus.IN_PROGRESS },
          { guildId, status: CaseStatus.PENDING },
          { guildId, status: CaseStatus.CLOSED }, // Closed cases don't count
        ] as any[]);

        const caseRequest = {
          guildId,
          clientId,
          clientUsername: 'TestClient',
          title: 'Case that should be rejected',
          description: 'This should fail due to case limit',
          priority: CasePriority.MEDIUM };

        // Should fail due to case limit
        await expect(caseService.createCase(seniorPartnerContext, caseRequest))
          .rejects.toThrow('Client has reached maximum active case limit (5)');
      });

      it('should allow case creation when under limit', async () => {
        // Mock 3 active cases for client
        mockCaseRepo.findByClient.mockResolvedValue([
          { guildId, status: CaseStatus.IN_PROGRESS },
          { guildId, status: CaseStatus.PENDING },
          { guildId, status: CaseStatus.IN_PROGRESS },
          { guildId, status: CaseStatus.CLOSED }, // Closed cases don't count
        ] as any[]);

        mockCaseCounterRepo.getNextCaseNumber.mockResolvedValue(123);
        mockCaseRepo.add.mockResolvedValue({
          _id: new ObjectId(),
          caseNumber: 'AA-2024-123-TestClient',
          clientId,
          clientUsername: 'TestClient',
          title: 'Valid case',
          status: CaseStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
        } as any);

        const caseRequest = {
          guildId,
          clientId,
          clientUsername: 'TestClient',
          title: 'Valid case under limit',
          description: 'This should succeed',
          priority: CasePriority.MEDIUM };

        const result = await this.caseService.createCase(context, seniorPartnerContext, caseRequest);

        expect(result.caseNumber).toBe('AA-2024-123-TestClient');
        expect(result.status).toBe(CaseStatus.PENDING);
      });

      it('should show warnings when approaching case limit', async () => {
        // Mock 4 active cases (approaching limit)
        mockCaseRepo.findByClient.mockResolvedValue([
          { guildId, status: CaseStatus.IN_PROGRESS },
          { guildId, status: CaseStatus.PENDING },
          { guildId, status: CaseStatus.IN_PROGRESS },
          { guildId, status: CaseStatus.PENDING },
        ] as any[]);

        const validation = await businessRuleValidationService.validateClientCaseLimit(clientId, guildId);

        expect(validation.valid).toBe(true);
        expect(validation.warnings).toContain('Client has 4 active cases (limit: 5)');
      });
    });

    describe('Lead Attorney Validation', () => {
      it('should only allow qualified staff to be lead attorneys', async () => {
        const caseId = 'test_case_123';

        // Junior Associate shouldn't be able to set lead attorney
        await expect(caseService.setLeadAttorney(juniorAssociateContext, caseId, seniorPartnerId))
          .rejects.toThrow('You do not have permission to set lead attorney');

        // Senior Partner should be able to set lead attorney
        mockCaseRepo.findById.mockResolvedValue({
          _id: caseId,
          guildId,
          assignedLawyerIds: [seniorPartnerId],
        createdAt: new Date(),
        updatedAt: new Date()
        } as any);
        mockCaseRepo.update.mockResolvedValue({} as any);

        const result = await caseService.setLeadAttorney(seniorPartnerContext, caseId, seniorPartnerId);

        expect(result).toBeDefined();
      });

      it('should validate lead attorney permissions before assignment', async () => {
        const caseId = 'test_case_123';
        mockCaseRepo.findById.mockResolvedValue({
          _id: caseId,
          guildId,
          assignedLawyerIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
        } as any);

        // Try to assign regular user as lead attorney
        await expect(caseService.setLeadAttorney(seniorPartnerContext, caseId, regularUserId))
          .rejects.toThrow('User cannot be assigned as lead attorney');
      });

      it('should require lead-attorney permission to accept cases', async () => {
        const caseId = 'test_case_123';
        mockCaseRepo.findById.mockResolvedValue({
          _id: caseId,
          status: CaseStatus.PENDING,
          guildId,
        createdAt: new Date(),
        updatedAt: new Date()
        } as any);

        // Junior Associate shouldn't be able to accept cases (no lead-attorney permission)
        await expect(caseService.acceptCase(juniorAssociateContext, caseId))
          .rejects.toThrow('You do not have permission to accept cases as lead attorney');

        // Senior Partner should be able to accept cases
        mockCaseRepo.conditionalUpdate.mockResolvedValue({
          _id: caseId,
          status: CaseStatus.IN_PROGRESS,
          leadAttorneyId: seniorPartnerId,
        createdAt: new Date(),
        updatedAt: new Date()
        } as any);

        const result = await caseService.acceptCase(seniorPartnerContext, caseId);

        expect(result.status).toBe(CaseStatus.IN_PROGRESS);
        expect(result.leadAttorneyId).toBe(seniorPartnerId);
      });
    });
  });

  describe('Retainer Service Integration', () => {
    it('should use lawyer permission for retainer operations', async () => {
      const retainerRequest = {
        guildId,
        clientId,
        lawyerId: seniorPartnerId };

      mockRetainerRepo.hasPendingRetainer.mockResolvedValue(false);
      mockRetainerRepo.hasActiveRetainer.mockResolvedValue(false);
      mockRetainerRepo.add.mockResolvedValue({
        _id: new ObjectId(),
        status: 'pending',
        ...retainerRequest,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      // Senior Partner (has lawyer permission) should be able to create retainer
      const result = await this.retainerService.createRetainer(context, seniorPartnerContext, retainerRequest);

      expect(result.status).toBe('pending');
      expect(result.lawyerId).toBe(seniorPartnerId);

      // Regular user (no lawyer permission) should be rejected
      await expect(retainerService.createRetainer(regularUserContext, retainerRequest))
        .rejects.toThrow('You do not have permission to create retainer agreements');
    });
  });

  describe('Cross-Service Validation', () => {
    it('should maintain consistency across staff and case assignments', async () => {
      // Validate staff member has correct permissions for case work
      const staffValidation = await businessRuleValidationService.validateStaffMember(
        juniorAssociateContext,
        juniorAssociateId,
        ['lawyer']
      );

      expect(staffValidation.valid).toBe(true);
      expect(staffValidation.isActiveStaff).toBe(true);
      expect(staffValidation.hasRequiredPermissions).toBe(true);

      // But should not have lead-attorney permissions
      const leadAttorneyValidation = await businessRuleValidationService.validateStaffMember(
        juniorAssociateContext,
        juniorAssociateId,
        ['lead-attorney']
      );

      expect(leadAttorneyValidation.valid).toBe(false);
      expect(leadAttorneyValidation.hasRequiredPermissions).toBe(false);
    });

    it('should handle complex permission scenarios', async () => {
      // Test guild owner override
      const guildOwnerValidation = await businessRuleValidationService.validatePermission(
        guildOwnerContext,
        'any-permission'
      );

      expect(guildOwnerValidation.valid).toBe(true);
      expect(guildOwnerValidation.bypassAvailable).toBe(true);
      expect(guildOwnerValidation.bypassType).toBe('guild-owner');

      // Test permission inheritance
      const multipleValidations = await businessRuleValidationService.validateMultiple([
        businessRuleValidationService.validatePermission(seniorPartnerContext, 'lawyer'),
        businessRuleValidationService.validatePermission(seniorPartnerContext, 'lead-attorney'),
        businessRuleValidationService.validatePermission(seniorPartnerContext, 'senior-staff'),
      ]);

      expect(multipleValidations.valid).toBe(true);
    });
  });

  describe('Guild Owner Utils Integration', () => {
    it('should properly validate bypass eligibility', () => {
      const mockGuildOwnerInteraction = {
        user: { id: managingPartnerId },
        guild: { ownerId: managingPartnerId } } as any;

      const mockRegularUserInteraction = {
        user: { id: juniorAssociateId },
        guild: { ownerId: managingPartnerId } } as any;

      expect(GuildOwnerUtils.isEligibleForBypass(mockGuildOwnerInteraction)).toBe(true);
      expect(GuildOwnerUtils.isEligibleForBypass(mockRegularUserInteraction)).toBe(false);
    });

    it('should create proper bypass modals for role limits', () => {
      const validationResult = {
        valid: false,
        errors: ['Cannot hire Managing Partner. Maximum limit of 1 reached'],
        warnings: [],
        bypassAvailable: true,
        currentCount: 1,
        maxCount: 1,
        roleName: StaffRole.MANAGING_PARTNER,
        metadata: {} };

      const modal = GuildOwnerUtils.createRoleLimitBypassModal(managingPartnerId, validationResult);

      expect(modal).toBeDefined();
      // Modal creation is mocked, but this tests the call doesn't throw
    });

    it('should validate bypass confirmation correctly', () => {
      const mockModalInteraction = {
        user: { id: managingPartnerId },
        guildId,
        fields: {
          getTextInputValue: jest.fn()
            .mockReturnValueOnce('Confirm')
            .mockReturnValueOnce('Emergency hiring needed') } } as any;

      const result = GuildOwnerUtils.validateBypassConfirmation(mockModalInteraction);

      expect(result.confirmed).toBe(true);
      expect(result.reason).toBe('Emergency hiring needed');
    });
  });
});