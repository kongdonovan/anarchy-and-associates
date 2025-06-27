"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const staff_service_1 = require("../../application/services/staff-service");
const case_service_1 = require("../../application/services/case-service");
const retainer_service_1 = require("../../application/services/retainer-service");
const business_rule_validation_service_1 = require("../../application/services/business-rule-validation-service");
const permission_service_1 = require("../../application/services/permission-service");
const guild_owner_utils_1 = require("../../infrastructure/utils/guild-owner-utils");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const retainer_repository_1 = require("../../infrastructure/repositories/retainer-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const case_1 = require("../../domain/entities/case");
const mongodb_1 = require("mongodb");
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
    let staffService;
    let caseService;
    let retainerService;
    let businessRuleValidationService;
    let permissionService;
    // Mock repositories
    let mockStaffRepo;
    let mockAuditLogRepo;
    let mockCaseRepo;
    let mockCaseCounterRepo;
    let mockRetainerRepo;
    let mockGuildConfigRepo;
    let mockRobloxService;
    // Test contexts
    const guildId = 'test_guild_123';
    const managingPartnerId = 'managing_partner_123';
    const seniorPartnerId = 'senior_partner_123';
    const juniorAssociateId = 'junior_associate_123';
    const regularUserId = 'regular_user_123';
    const clientId = 'client_123';
    const guildOwnerContext = {
        guildId,
        userId: managingPartnerId,
        userRoles: ['managing_partner_role'],
        isGuildOwner: true
    };
    const seniorPartnerContext = {
        guildId,
        userId: seniorPartnerId,
        userRoles: ['senior_partner_role'],
        isGuildOwner: false
    };
    const juniorAssociateContext = {
        guildId,
        userId: juniorAssociateId,
        userRoles: ['junior_associate_role'],
        isGuildOwner: false
    };
    const regularUserContext = {
        guildId,
        userId: regularUserId,
        userRoles: [],
        isGuildOwner: false
    };
    beforeEach(() => {
        // Initialize mocked repositories
        mockStaffRepo = new staff_repository_1.StaffRepository();
        mockAuditLogRepo = new audit_log_repository_1.AuditLogRepository();
        mockCaseRepo = new case_repository_1.CaseRepository();
        mockCaseCounterRepo = new case_counter_repository_1.CaseCounterRepository();
        mockRetainerRepo = new retainer_repository_1.RetainerRepository();
        mockGuildConfigRepo = new guild_config_repository_1.GuildConfigRepository();
        mockRobloxService = {
            validateUsername: jest.fn(),
            updateGroup: jest.fn(),
            getUserByUsername: jest.fn(),
            getUserById: jest.fn(),
            getUsernameById: jest.fn(),
            formatUserForDisplay: jest.fn(),
            createProfileEmbed: jest.fn()
        };
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
                repair: ['managing_partner_role']
            }
        });
        // Initialize services
        permissionService = new permission_service_1.PermissionService(mockGuildConfigRepo);
        businessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(mockGuildConfigRepo, mockStaffRepo, mockCaseRepo, permissionService);
        staffService = new staff_service_1.StaffService(mockStaffRepo, mockAuditLogRepo, permissionService, businessRuleValidationService);
        caseService = new case_service_1.CaseService(mockCaseRepo, mockCaseCounterRepo, mockGuildConfigRepo, permissionService, businessRuleValidationService);
        retainerService = new retainer_service_1.RetainerService(mockRetainerRepo, mockGuildConfigRepo, mockRobloxService, permissionService);
        // Setup default staff members
        mockStaffRepo.findByUserId.mockImplementation(async (guildId, userId) => {
            const staffMembers = {
                [managingPartnerId]: {
                    userId: managingPartnerId,
                    guildId,
                    role: staff_role_1.StaffRole.MANAGING_PARTNER,
                    status: 'active',
                    robloxUsername: 'ManagingPartner1',
                    hiredAt: new Date(),
                    hiredBy: managingPartnerId,
                    promotionHistory: []
                },
                [seniorPartnerId]: {
                    userId: seniorPartnerId,
                    guildId,
                    role: staff_role_1.StaffRole.SENIOR_PARTNER,
                    status: 'active',
                    robloxUsername: 'SeniorPartner1',
                    hiredAt: new Date(),
                    hiredBy: managingPartnerId,
                    promotionHistory: []
                },
                [juniorAssociateId]: {
                    userId: juniorAssociateId,
                    guildId,
                    role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                    status: 'active',
                    robloxUsername: 'JuniorAssociate1',
                    hiredAt: new Date(),
                    hiredBy: seniorPartnerId,
                    promotionHistory: []
                }
            };
            return staffMembers[userId] || null;
        });
        // Setup default mocks
        mockAuditLogRepo.logAction.mockResolvedValue({});
        mockAuditLogRepo.logRoleLimitBypass.mockResolvedValue({});
        mockAuditLogRepo.logBusinessRuleViolation.mockResolvedValue({});
        // Mock permission validation for users based on their roles
        businessRuleValidationService.validatePermission = jest.fn().mockImplementation(async (context, permission) => {
            // Guild owner has all permissions
            if (context.isGuildOwner) {
                return {
                    valid: true,
                    errors: [],
                    warnings: [],
                    bypassAvailable: true,
                    bypassType: 'guild-owner',
                    hasPermission: true,
                    requiredPermission: permission,
                    grantedPermissions: [permission],
                    metadata: {
                        ruleType: 'permission-validation',
                        requiredPermission: permission,
                        bypassReason: 'guild-owner'
                    }
                };
            }
            // For lead attorney validation when setting lead attorney
            if (permission === 'lead-attorney' && context.userId === seniorPartnerId) {
                return {
                    valid: true,
                    errors: [],
                    warnings: [],
                    bypassAvailable: false,
                    hasPermission: true,
                    requiredPermission: permission,
                    grantedPermissions: [permission]
                };
            }
            // Senior Partner permissions
            if (context.userId === seniorPartnerId) {
                const validPermissions = ['lawyer', 'lead-attorney', 'senior-staff'];
                if (validPermissions.includes(permission)) {
                    return {
                        valid: true,
                        errors: [],
                        warnings: [],
                        bypassAvailable: false,
                        hasPermission: true,
                        requiredPermission: permission,
                        grantedPermissions: [permission]
                    };
                }
            }
            // For regular user, no lead-attorney permission
            if (permission === 'lead-attorney' && context.userId === regularUserId) {
                return {
                    valid: false,
                    errors: ['Missing required permission: lead-attorney'],
                    warnings: [],
                    bypassAvailable: false,
                    hasPermission: false,
                    requiredPermission: permission,
                    grantedPermissions: []
                };
            }
            // Default mock implementation
            return {
                valid: false,
                errors: [`Missing required permission: ${permission}`],
                warnings: [],
                bypassAvailable: false,
                hasPermission: false,
                requiredPermission: permission,
                grantedPermissions: []
            };
        });
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
                    role: staff_role_1.StaffRole.MANAGING_PARTNER,
                    hiredBy: managingPartnerId,
                    reason: 'Attempting to hire second Managing Partner'
                };
                // Should fail for senior partner (not guild owner)
                const result = await staffService.hireStaff(seniorPartnerContext, hireRequest);
                expect(result.success).toBe(false);
                expect(result.error).toContain('Maximum limit of 1 reached');
            });
            it('should allow guild owner to bypass role limits with audit trail', async () => {
                // Mock that there's already a Managing Partner
                mockStaffRepo.getStaffCountByRole.mockResolvedValue(1);
                mockStaffRepo.findByUserId.mockResolvedValue(null);
                mockStaffRepo.findStaffByRobloxUsername.mockResolvedValue(null);
                mockStaffRepo.add.mockResolvedValue({
                    _id: new mongodb_1.ObjectId(),
                    userId: 'second_managing_partner',
                    guildId,
                    role: staff_role_1.StaffRole.MANAGING_PARTNER,
                    status: 'active',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                // Mock the validateRobloxUsername method that StaffService uses internally
                jest.spyOn(staffService, 'validateRobloxUsername').mockResolvedValue({
                    isValid: true,
                    username: 'SecondManagingPartner'
                });
                const hireRequest = {
                    guildId,
                    userId: 'second_managing_partner',
                    robloxUsername: 'SecondManagingPartner',
                    role: staff_role_1.StaffRole.MANAGING_PARTNER,
                    hiredBy: managingPartnerId,
                    reason: 'Emergency hire - guild owner bypass',
                    isGuildOwner: true
                };
                // Should succeed for guild owner
                const result = await staffService.hireStaff(guildOwnerContext, hireRequest);
                expect(result.success).toBe(true);
                expect(mockAuditLogRepo.logRoleLimitBypass).toHaveBeenCalledWith(guildId, managingPartnerId, 'second_managing_partner', staff_role_1.StaffRole.MANAGING_PARTNER, 1, 1, 'Emergency hire - guild owner bypass');
            });
            it('should enforce role hierarchy in hiring permissions', async () => {
                mockStaffRepo.getStaffCountByRole.mockResolvedValue(2); // Under limit
                mockStaffRepo.findByUserId.mockResolvedValue(null);
                mockStaffRepo.findStaffByRobloxUsername.mockResolvedValue(null);
                const hireRequest = {
                    guildId,
                    userId: 'new_senior_partner',
                    robloxUsername: 'NewSeniorPartner',
                    role: staff_role_1.StaffRole.SENIOR_PARTNER,
                    hiredBy: juniorAssociateId,
                    reason: 'Junior Associate trying to hire Senior Partner'
                };
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
                    { guildId, status: case_1.CaseStatus.IN_PROGRESS },
                    { guildId, status: case_1.CaseStatus.PENDING },
                    { guildId, status: case_1.CaseStatus.IN_PROGRESS },
                    { guildId, status: case_1.CaseStatus.IN_PROGRESS },
                    { guildId, status: case_1.CaseStatus.PENDING },
                    { guildId, status: case_1.CaseStatus.CLOSED }, // Closed cases don't count
                ]);
                const caseRequest = {
                    guildId,
                    clientId,
                    clientUsername: 'TestClient',
                    title: 'Case that should be rejected',
                    description: 'This should fail due to case limit',
                    priority: case_1.CasePriority.MEDIUM
                };
                // Should fail due to case limit
                await expect(caseService.createCase(seniorPartnerContext, caseRequest))
                    .rejects.toThrow('Client has reached maximum active case limit (5)');
            });
            it('should allow case creation when under limit', async () => {
                // Mock 3 active cases for client
                mockCaseRepo.findByClient.mockResolvedValue([
                    { guildId, status: case_1.CaseStatus.IN_PROGRESS },
                    { guildId, status: case_1.CaseStatus.PENDING },
                    { guildId, status: case_1.CaseStatus.IN_PROGRESS },
                    { guildId, status: case_1.CaseStatus.CLOSED }, // Closed cases don't count
                ]);
                mockCaseCounterRepo.getNextCaseNumber.mockResolvedValue(123);
                mockCaseRepo.add.mockResolvedValue({
                    _id: new mongodb_1.ObjectId(),
                    caseNumber: 'AA-2024-123-TestClient',
                    clientId,
                    clientUsername: 'TestClient',
                    title: 'Valid case',
                    status: case_1.CaseStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                const caseRequest = {
                    guildId,
                    clientId,
                    clientUsername: 'TestClient',
                    title: 'Valid case under limit',
                    description: 'This should succeed',
                    priority: case_1.CasePriority.MEDIUM
                };
                const result = await caseService.createCase(seniorPartnerContext, caseRequest);
                expect(result.caseNumber).toBe('AA-2024-123-TestClient');
                expect(result.status).toBe(case_1.CaseStatus.PENDING);
            });
            it('should show warnings when approaching case limit', async () => {
                // Mock 4 active cases (approaching limit)
                mockCaseRepo.findByClient.mockResolvedValue([
                    { guildId, status: case_1.CaseStatus.IN_PROGRESS },
                    { guildId, status: case_1.CaseStatus.PENDING },
                    { guildId, status: case_1.CaseStatus.IN_PROGRESS },
                    { guildId, status: case_1.CaseStatus.PENDING },
                ]);
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
                });
                mockCaseRepo.update.mockResolvedValue({
                    _id: caseId,
                    guildId,
                    assignedLawyerIds: [seniorPartnerId],
                    leadAttorneyId: seniorPartnerId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                const result = await caseService.setLeadAttorney(seniorPartnerContext, caseId, seniorPartnerId);
                expect(result).toBeDefined();
                expect(result.leadAttorneyId).toBe(seniorPartnerId);
            });
            it('should validate lead attorney permissions before assignment', async () => {
                const caseId = 'test_case_123';
                mockCaseRepo.findById.mockResolvedValue({
                    _id: caseId,
                    guildId,
                    assignedLawyerIds: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                // Try to assign regular user as lead attorney
                await expect(caseService.setLeadAttorney(seniorPartnerContext, caseId, regularUserId))
                    .rejects.toThrow('User cannot be assigned as lead attorney');
            });
            it('should require lead-attorney permission to accept cases', async () => {
                const caseId = 'test_case_123';
                mockCaseRepo.findById.mockResolvedValue({
                    _id: caseId,
                    status: case_1.CaseStatus.PENDING,
                    guildId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                // Junior Associate shouldn't be able to accept cases (no lead-attorney permission)
                await expect(caseService.acceptCase(juniorAssociateContext, caseId))
                    .rejects.toThrow('You do not have permission to accept cases as lead attorney');
                // Senior Partner should be able to accept cases
                mockCaseRepo.conditionalUpdate.mockResolvedValue({
                    _id: caseId,
                    status: case_1.CaseStatus.IN_PROGRESS,
                    leadAttorneyId: seniorPartnerId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                const result = await caseService.acceptCase(seniorPartnerContext, caseId);
                expect(result.status).toBe(case_1.CaseStatus.IN_PROGRESS);
                expect(result.leadAttorneyId).toBe(seniorPartnerId);
            });
        });
    });
    describe('Retainer Service Integration', () => {
        it('should use lawyer permission for retainer operations', async () => {
            const retainerRequest = {
                guildId,
                clientId,
                lawyerId: seniorPartnerId
            };
            mockRetainerRepo.hasPendingRetainer.mockResolvedValue(false);
            mockRetainerRepo.hasActiveRetainer.mockResolvedValue(false);
            mockRetainerRepo.add.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
                status: 'pending',
                ...retainerRequest,
                createdAt: new Date(),
                updatedAt: new Date()
            });
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
            const staffValidation = await businessRuleValidationService.validateStaffMember(juniorAssociateContext, juniorAssociateId, ['lawyer']);
            expect(staffValidation.valid).toBe(true);
            expect(staffValidation.isActiveStaff).toBe(true);
            expect(staffValidation.hasRequiredPermissions).toBe(true);
            // But should not have lead-attorney permissions
            const leadAttorneyValidation = await businessRuleValidationService.validateStaffMember(juniorAssociateContext, juniorAssociateId, ['lead-attorney']);
            expect(leadAttorneyValidation.valid).toBe(false);
            expect(leadAttorneyValidation.hasRequiredPermissions).toBe(false);
        });
        it('should handle complex permission scenarios', async () => {
            // Test guild owner override
            const guildOwnerValidation = await businessRuleValidationService.validatePermission(guildOwnerContext, 'any-permission');
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
                guild: { ownerId: managingPartnerId }
            };
            const mockRegularUserInteraction = {
                user: { id: juniorAssociateId },
                guild: { ownerId: managingPartnerId }
            };
            expect(guild_owner_utils_1.GuildOwnerUtils.isEligibleForBypass(mockGuildOwnerInteraction)).toBe(true);
            expect(guild_owner_utils_1.GuildOwnerUtils.isEligibleForBypass(mockRegularUserInteraction)).toBe(false);
        });
        it('should create proper bypass modals for role limits', () => {
            const validationResult = {
                valid: false,
                errors: ['Cannot hire Managing Partner. Maximum limit of 1 reached'],
                warnings: [],
                bypassAvailable: true,
                currentCount: 1,
                maxCount: 1,
                roleName: staff_role_1.StaffRole.MANAGING_PARTNER,
                metadata: {}
            };
            const modal = guild_owner_utils_1.GuildOwnerUtils.createRoleLimitBypassModal(managingPartnerId, validationResult);
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
                        .mockReturnValueOnce('Emergency hiring needed')
                }
            };
            const result = guild_owner_utils_1.GuildOwnerUtils.validateBypassConfirmation(mockModalInteraction);
            expect(result.confirmed).toBe(true);
            expect(result.reason).toBe('Emergency hiring needed');
        });
    });
});
//# sourceMappingURL=business-rule-integration.test.js.map