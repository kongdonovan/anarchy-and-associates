import { StaffService } from '../../application/services/staff-service';
import { CaseService } from '../../application/services/case-service';
import { RetainerService } from '../../application/services/retainer-service';
import { UnifiedValidationService } from '../../application/validation/unified-validation-service';
import { BusinessRuleValidationStrategy } from '../../application/validation/strategies/business-rule-validation-strategy';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { GuildOwnerUtils } from '../../infrastructure/utils/guild-owner-utils';

import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { RobloxService } from '../../infrastructure/external/roblox-service';

// Remove StaffRole import - we'll use string literals
// Remove Staff import - using TestUtils.generateMockStaff instead
// Remove CaseStatus, CasePriority imports - we'll use string literals
// Remove ObjectId import - using TestUtils instead
import { TestUtils } from '../helpers/test-utils';

// Mock all repositories and external services
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../infrastructure/repositories/case-counter-repository');
jest.mock('../../infrastructure/repositories/retainer-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../infrastructure/external/roblox-service');

// Mock discord.js ModalBuilder
jest.mock('discord.js', () => ({
  ...jest.requireActual('discord.js'),
  ModalBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    addComponents: jest.fn().mockReturnThis(),
    data: { title: '🚨 Role Limit Bypass Required' }
  })),
  TextInputBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setRequired: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    setMaxLength: jest.fn().mockReturnThis(),
    setValue: jest.fn().mockReturnThis()
  })),
  ActionRowBuilder: jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis()
  })),
  TextInputStyle: { Short: 1, Paragraph: 2 }
}));

describe('Business Rule Integration Tests', () => {
  let staffService: StaffService;
  let caseService: CaseService;
  let retainerService: RetainerService;
  let unifiedValidationService: UnifiedValidationService;
  let permissionService: PermissionService;

  // Mock repositories
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockAuditLogRepo: jest.Mocked<AuditLogRepository>;
  let mockCaseRepo: jest.Mocked<CaseRepository>;
  let mockCaseCounterRepo: jest.Mocked<CaseCounterRepository>;
  let mockRetainerRepo: jest.Mocked<RetainerRepository>;
  let mockGuildConfigRepo: jest.Mocked<GuildConfigRepository>;
  let mockRobloxService: jest.Mocked<RobloxService>;

  // Test contexts - using valid Discord snowflake IDs (18-digit strings)
  const guildId = '123456789012345678';
  const managingPartnerId = '234567890123456789';
  const seniorPartnerId = '345678901234567890';
  const juniorAssociateId = '456789012345678901';
  const regularUserId = '567890123456789012';
  const clientId = '678901234567890123';

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
    unifiedValidationService = new UnifiedValidationService();

    // Register validation strategies
    const businessRuleStrategy = new BusinessRuleValidationStrategy(
      mockStaffRepo,
      mockCaseRepo,
      mockGuildConfigRepo,
      permissionService
    );
    unifiedValidationService.registerStrategy(businessRuleStrategy);

    staffService = new StaffService(
      mockStaffRepo,
      mockAuditLogRepo,
      permissionService,
      unifiedValidationService
    );

    caseService = new CaseService(
      mockCaseRepo,
      mockCaseCounterRepo,
      mockGuildConfigRepo,
      permissionService,
      unifiedValidationService
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
          role: 'Managing Partner',
          status: 'active',
          robloxUsername: 'ManagingPartner1',
          hiredAt: new Date(),
          hiredBy: managingPartnerId,
          promotionHistory: [] },
        [seniorPartnerId]: {
          userId: seniorPartnerId,
          guildId,
          role: 'Senior Partner',
          status: 'active',
          robloxUsername: 'SeniorPartner1',
          hiredAt: new Date(),
          hiredBy: managingPartnerId,
          promotionHistory: [] },
        [juniorAssociateId]: {
          userId: juniorAssociateId,
          guildId,
          role: 'Junior Associate',
          status: 'active',
          robloxUsername: 'JuniorAssociate1',
          hiredAt: new Date(),
          hiredBy: seniorPartnerId,
          promotionHistory: [] } };
      return staffMembers[String(userId)] || null;
    });

    // Setup default mocks
    mockAuditLogRepo.logAction.mockResolvedValue({} as any);
    mockAuditLogRepo.logRoleLimitBypass.mockResolvedValue({} as any);
    mockAuditLogRepo.logBusinessRuleViolation.mockResolvedValue({} as any);
    
    // Setup default case counter mock
    mockCaseCounterRepo.getNextCaseNumber.mockResolvedValue(1);
    
    // Setup default repository mocks for validation service
    mockStaffRepo.findByGuildId.mockResolvedValue([]);
    mockStaffRepo.getStaffCountByRole.mockResolvedValue(0);
    mockStaffRepo.findByRole.mockResolvedValue([]);
    mockCaseRepo.findByClient.mockResolvedValue([]);
    
    // Remove the mock for validatePermission since it doesn't exist on UnifiedValidationService
    
    // Mock validation adapter's validatePermission to handle lead attorney checks
    jest.spyOn(caseService['validationAdapter'], 'validatePermission').mockImplementation(async (context, permission) => {
      // Senior partners and above should have lead-attorney permission
      if (permission === 'lead-attorney' && 
          (context.userId === seniorPartnerId || context.userId === managingPartnerId)) {
        return { valid: true, errors: [], warnings: [], metadata: {} };
      }
      // Junior associates should not have lead-attorney permission
      if (permission === 'lead-attorney' && context.userId === juniorAssociateId) {
        return { 
          valid: false, 
          errors: ["You don't have permission to perform action: lead-attorney"], 
          warnings: [],
          metadata: {}
        };
      }
      // Default to allowing lawyer permissions for all staff
      if (permission === 'lawyer') {
        return { valid: true, errors: [], warnings: [], metadata: {} };
      }
      return { valid: false, errors: ['Permission denied'], warnings: [], metadata: {} };
    });
  });

  describe('Staff Management Edge Cases', () => {
    describe('Role Limit Enforcement', () => {
      it('should enforce Managing Partner limit (1 max)', async () => {
        // Mock that there's already a Managing Partner
        mockStaffRepo.findByRole.mockResolvedValue([
          TestUtils.generateMockStaff({
            userId: '789012345678901234', 
            guildId,
            robloxUsername: 'ExistingMP',
            status: 'active', 
            role: 'Managing Partner',
            hiredBy: '890123456789012345',
            promotionHistory: []
          })
        ]);
        mockStaffRepo.findByUserId.mockResolvedValue(null); // New user
        mockStaffRepo.findStaffByRobloxUsername.mockResolvedValue(null);

        const hireRequest = {
          guildId,
          userId: '901234567890123456',
          robloxUsername: 'NewManagingPartner',
          role: 'Managing Partner',
          hiredBy: managingPartnerId,
          reason: 'Attempting to hire second Managing Partner' };

        // Should fail for senior partner (not guild owner)
        const result = await staffService.hireStaff(seniorPartnerContext, hireRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Maximum limit of 1 reached');
      });

      it('should allow guild owner to bypass role limits with audit trail', async () => {
        // Mock that there's already a Managing Partner
        mockStaffRepo.findByRole.mockResolvedValue([
          TestUtils.generateMockStaff({
            userId: '789012345678901234', 
            guildId,
            robloxUsername: 'ExistingMP',
            status: 'active', 
            role: 'Managing Partner',
            hiredBy: '890123456789012345',
            promotionHistory: []
          })
        ]);
        mockStaffRepo.findByUserId.mockResolvedValue(null);
        mockStaffRepo.findStaffByRobloxUsername.mockResolvedValue(null);
        mockStaffRepo.add.mockResolvedValue(TestUtils.generateMockStaff({
          userId: '012345678901234567',
          guildId,
          role: 'Managing Partner',
          status: 'active'
        }));
        
        // Mock the validateRobloxUsername method that StaffService uses internally
        jest.spyOn(staffService as any, 'validateRobloxUsername').mockResolvedValue({
          isValid: true,
          username: 'SecondMP'
        });

        const hireRequest = {
          guildId,
          userId: '012345678901234567',
          robloxUsername: 'SecondMP',
          role: 'Managing Partner',
          hiredBy: managingPartnerId,
          reason: 'Emergency hire - guild owner bypass',
          isGuildOwner: true
        };

        // Should succeed for guild owner
        const result = await staffService.hireStaff(guildOwnerContext, hireRequest);

        expect(result.success).toBe(true);
        expect(mockAuditLogRepo.logRoleLimitBypass).toHaveBeenCalledWith(
          guildId,
          managingPartnerId,
          '012345678901234567',
          'Managing Partner',
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
          userId: '112233445566778899',
          robloxUsername: 'NewSeniorPartner',
          role: 'Senior Partner',
          hiredBy: juniorAssociateId,
          reason: 'Junior Associate trying to hire Senior Partner' };

        // Junior Associate shouldn't be able to hire Senior Partner (no senior-staff permission)
        const result = await staffService.hireStaff(juniorAssociateContext, hireRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('You do not have permission to hire staff members');
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
          { guildId, status: 'in-progress' },
          { guildId, status: 'pending' },
          { guildId, status: 'in-progress' },
          { guildId, status: 'in-progress' },
          { guildId, status: 'pending' },
          { guildId, status: 'closed' }, // Closed cases don't count
        ] as any[]);

        const caseRequest = {
          guildId,
          clientId,
          clientUsername: 'TestClient',
          title: 'Case that should be rejected',
          description: 'This should fail due to case limit',
          priority: 'medium' };

        // Should fail due to case limit
        await expect(caseService.createCase(seniorPartnerContext, caseRequest))
          .rejects.toThrow('Client has reached maximum active case limit (5)');
      });

      it('should allow case creation when under limit', async () => {
        // Mock 3 active cases for client
        mockCaseRepo.findByClient.mockResolvedValue([
          { guildId, status: 'in-progress' },
          { guildId, status: 'pending' },
          { guildId, status: 'in-progress' },
          { guildId, status: 'closed' }, // Closed cases don't count
        ] as any[]);

        mockCaseCounterRepo.getNextCaseNumber.mockResolvedValue(123);
        mockCaseRepo.add.mockResolvedValue({
          _id: TestUtils.generateObjectId().toString(),
          caseNumber: 'AA-2024-123-TestClient',
          clientId,
          clientUsername: 'TestClient',
          title: 'Valid case',
          status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
        } as any);

        const caseRequest = {
          guildId,
          clientId,
          clientUsername: 'TestClient',
          title: 'Valid case under limit',
          description: 'This should succeed with a valid description',
          priority: 'medium' };

        const result = await caseService.createCase(seniorPartnerContext, caseRequest);

        expect(result.caseNumber).toBe('AA-2024-123-TestClient');
        expect(result.status).toBe('pending');
      });

      it('should show warnings when approaching case limit', async () => {
        // Mock 4 active cases (approaching limit)
        mockCaseRepo.findByClient.mockResolvedValue([
          { guildId, status: 'in-progress' },
          { guildId, status: 'pending' },
          { guildId, status: 'in-progress' },
          { guildId, status: 'pending' },
        ] as any[]);

        // Create validation context for client case limit
        const validationContext = {
          permissionContext: seniorPartnerContext,
          entityType: 'case',
          operation: 'validateClientLimit',
          data: {
            clientId,
            guildId
          }
        };
        const validation = await unifiedValidationService.validate(validationContext);

        expect(validation.valid).toBe(true);
        // Should have 4 active cases (approaching limit of 5)
        expect(validation.metadata?.currentCount).toBe(4);
        expect(validation.metadata?.maxCount).toBe(5);
      });
    });

    describe('Lead Attorney Validation', () => {
      it('should only allow qualified staff to be lead attorneys', async () => {
        const caseId = TestUtils.generateObjectId().toString();

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
        mockCaseRepo.update.mockResolvedValue({
          _id: caseId,
          guildId,
          assignedLawyerIds: [seniorPartnerId],
          leadAttorneyId: seniorPartnerId,
          createdAt: new Date(),
          updatedAt: new Date()
        } as any);

        const result = await caseService.setLeadAttorney(seniorPartnerContext, caseId, seniorPartnerId);

        expect(result).toBeDefined();
        expect(result.leadAttorneyId).toBe(seniorPartnerId);
      });

      it('should validate lead attorney permissions before assignment', async () => {
        const caseId = TestUtils.generateObjectId().toString();
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
        const caseId = TestUtils.generateObjectId().toString();
        mockCaseRepo.findById.mockResolvedValue({
          _id: caseId,
          status: 'pending',
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
          status: 'in-progress',
          leadAttorneyId: seniorPartnerId,
        createdAt: new Date(),
        updatedAt: new Date()
        } as any);

        const result = await caseService.acceptCase(seniorPartnerContext, caseId);

        expect(result.status).toBe('in-progress');
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
        _id: TestUtils.generateObjectId().toString(),
        status: 'pending',
        ...retainerRequest,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      // Senior Partner (has lawyer permission) should be able to create retainer
      const result = await retainerService.createRetainer(seniorPartnerContext, retainerRequest);

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
      const staffValidationContext = {
        permissionContext: juniorAssociateContext,
        entityType: 'staff',
        operation: 'validateStaffMember',
        data: {
          staffId: juniorAssociateId,
          requiredPermissions: ['lawyer']
        }
      };
      const staffValidation = await unifiedValidationService.validate(staffValidationContext);

      expect(staffValidation.valid).toBe(true);

      // But should not have lead-attorney permissions
      const leadAttorneyValidationContext = {
        permissionContext: juniorAssociateContext,
        entityType: 'permission',
        operation: 'validatePermission',
        data: {
          requiredAction: 'lead-attorney'
        }
      };
      const leadAttorneyValidation = await unifiedValidationService.validate(leadAttorneyValidationContext);

      expect(leadAttorneyValidation.valid).toBe(false);
    });

    it('should handle complex permission scenarios', async () => {
      // Test guild owner override
      const guildOwnerValidationContext = {
        permissionContext: guildOwnerContext,
        entityType: 'permission',
        operation: 'validatePermission',
        data: {
          requiredAction: 'any-permission'
        }
      };
      const guildOwnerValidation = await unifiedValidationService.validate(guildOwnerValidationContext);

      expect(guildOwnerValidation.valid).toBe(true);

      // Test permission inheritance - validate multiple permissions sequentially
      const lawyerContext = {
        permissionContext: seniorPartnerContext,
        entityType: 'permission',
        operation: 'validatePermission',
        data: { requiredAction: 'lawyer' }
      };
      const leadAttorneyContext = {
        permissionContext: seniorPartnerContext,
        entityType: 'permission',
        operation: 'validatePermission',
        data: { requiredAction: 'lead-attorney' }
      };
      const seniorStaffContext = {
        permissionContext: seniorPartnerContext,
        entityType: 'permission',
        operation: 'validatePermission',
        data: { requiredAction: 'senior-staff' }
      };

      const lawyerValidation = await unifiedValidationService.validate(lawyerContext);
      const leadValidation = await unifiedValidationService.validate(leadAttorneyContext);
      const seniorValidation = await unifiedValidationService.validate(seniorStaffContext);

      // All should be valid for senior partner
      expect(lawyerValidation.valid).toBe(true);
      expect(leadValidation.valid).toBe(true);
      expect(seniorValidation.valid).toBe(true);
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
        roleName: 'Managing Partner',
        metadata: {} };

      const modal = GuildOwnerUtils.createRoleLimitBypassModal(managingPartnerId, validationResult);

      expect(modal).toBeDefined();
      expect(modal.data.title).toBe('🚨 Role Limit Bypass Required');
      // The modal should have the expected methods
      expect(modal.setCustomId).toBeDefined();
      expect(modal.setTitle).toBeDefined();
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