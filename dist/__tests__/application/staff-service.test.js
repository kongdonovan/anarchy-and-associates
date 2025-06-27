"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const staff_service_1 = require("../../application/services/staff-service");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const permission_service_1 = require("../../application/services/permission-service");
const business_rule_validation_service_1 = require("../../application/services/business-rule-validation-service");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const mongodb_1 = require("mongodb");
// Mock the repositories and services
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../application/services/permission-service');
jest.mock('../../application/services/business-rule-validation-service');
describe('StaffService', () => {
    let staffService;
    let mockStaffRepository;
    let mockAuditLogRepository;
    let mockPermissionService;
    let mockBusinessRuleValidationService;
    let mockGuildConfigRepository;
    let mockCaseRepository;
    const testContext = {
        guildId: 'guild123',
        userId: 'admin123',
        userRoles: ['admin_role'],
        isGuildOwner: false
    };
    const guildOwnerContext = {
        ...testContext,
        isGuildOwner: true
    };
    beforeEach(() => {
        mockStaffRepository = new staff_repository_1.StaffRepository();
        mockAuditLogRepository = new audit_log_repository_1.AuditLogRepository();
        mockGuildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        mockCaseRepository = new case_repository_1.CaseRepository();
        mockPermissionService = new permission_service_1.PermissionService(mockGuildConfigRepository);
        mockBusinessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(mockGuildConfigRepository, mockStaffRepository, mockCaseRepository, mockPermissionService);
        staffService = new staff_service_1.StaffService(mockStaffRepository, mockAuditLogRepository, mockPermissionService, mockBusinessRuleValidationService);
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
            role: staff_role_1.StaffRole.PARALEGAL,
            hiredBy: 'admin123',
            reason: 'Test hire',
            isGuildOwner: false
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
                roleName: staff_role_1.StaffRole.PARALEGAL,
                metadata: {}
            });
            mockAuditLogRepository.logAction.mockResolvedValue({});
        });
        it('should successfully hire a new staff member', async () => {
            const mockStaff = {
                _id: new mongodb_1.ObjectId(),
                ...hireRequest,
                hiredAt: new Date(),
                promotionHistory: [],
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.add.mockResolvedValue(mockStaff);
            const result = await staffService.hireStaff(testContext, hireRequest);
            expect(result.success).toBe(true);
            expect(result.staff).toBeDefined();
            expect(mockBusinessRuleValidationService.validateRoleLimit).toHaveBeenCalledWith(testContext, staff_role_1.StaffRole.PARALEGAL);
            expect(mockStaffRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                userId: hireRequest.userId,
                role: hireRequest.role,
                robloxUsername: hireRequest.robloxUsername,
                status: 'active'
            }));
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
                status: 'active'
            });
            const result = await staffService.hireStaff(testContext, hireRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('already an active staff member');
            expect(mockStaffRepository.add).not.toHaveBeenCalled();
        });
        it('should reject if Roblox username is already used', async () => {
            mockStaffRepository.findStaffByRobloxUsername.mockResolvedValue({});
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
                roleName: staff_role_1.StaffRole.PARALEGAL,
                metadata: {}
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
                roleName: staff_role_1.StaffRole.MANAGING_PARTNER,
                metadata: {}
            });
            const mockStaff = {
                _id: new mongodb_1.ObjectId(),
                ...hireRequest,
                role: staff_role_1.StaffRole.MANAGING_PARTNER,
                hiredAt: new Date(),
                promotionHistory: [],
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.add.mockResolvedValue(mockStaff);
            mockAuditLogRepository.logRoleLimitBypass.mockResolvedValue({});
            const guildOwnerRequest = { ...hireRequest, role: staff_role_1.StaffRole.MANAGING_PARTNER };
            const result = await staffService.hireStaff(guildOwnerContext, guildOwnerRequest);
            expect(result.success).toBe(true);
            expect(mockAuditLogRepository.logRoleLimitBypass).toHaveBeenCalledWith('guild123', 'admin123', 'user123', staff_role_1.StaffRole.MANAGING_PARTNER, 1, 1, 'Test hire');
            expect(mockStaffRepository.add).toHaveBeenCalled();
        });
    });
    describe('promoteStaff', () => {
        const promotionRequest = {
            guildId: 'guild123',
            userId: 'user123',
            newRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            promotedBy: 'admin123',
            reason: 'Good performance'
        };
        const mockStaff = {
            _id: new mongodb_1.ObjectId(),
            userId: 'user123',
            guildId: 'guild123',
            role: staff_role_1.StaffRole.PARALEGAL,
            status: 'active',
            robloxUsername: 'TestUser',
            hiredAt: new Date(),
            hiredBy: 'admin123',
            promotionHistory: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        beforeEach(() => {
            mockStaffRepository.findByUserId.mockResolvedValue(mockStaff);
            mockStaffRepository.canHireRole.mockResolvedValue(true);
            mockAuditLogRepository.logAction.mockResolvedValue({});
            // Add default mock for validateRoleLimit
            mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
                bypassAvailable: false,
                currentCount: 3,
                maxCount: 10,
                roleName: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                metadata: {}
            });
        });
        it('should successfully promote a staff member', async () => {
            const updatedStaff = { ...mockStaff, role: promotionRequest.newRole };
            mockStaffRepository.updateStaffRole.mockResolvedValue(updatedStaff);
            const result = await staffService.promoteStaff(testContext, promotionRequest);
            expect(result.success).toBe(true);
            expect(result.staff?.role).toBe(promotionRequest.newRole);
            expect(mockStaffRepository.updateStaffRole).toHaveBeenCalledWith(promotionRequest.guildId, promotionRequest.userId, promotionRequest.newRole, promotionRequest.promotedBy, promotionRequest.reason);
            expect(mockAuditLogRepository.logAction).toHaveBeenCalled();
        });
        it('should reject if staff member not found', async () => {
            mockStaffRepository.findByUserId.mockResolvedValue(null);
            const result = await staffService.promoteStaff(testContext, promotionRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found or inactive');
            expect(mockStaffRepository.updateStaffRole).not.toHaveBeenCalled();
        });
        it('should reject if new role is not higher', async () => {
            const invalidRequest = { ...promotionRequest, newRole: staff_role_1.StaffRole.PARALEGAL };
            const result = await staffService.promoteStaff(testContext, invalidRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('must be higher than current role');
            expect(mockStaffRepository.updateStaffRole).not.toHaveBeenCalled();
        });
        it('should reject if role limit reached for new role', async () => {
            mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
                valid: false,
                errors: ['Cannot promote to Junior Associate. Maximum limit of 10 reached'],
                warnings: [],
                bypassAvailable: false,
                currentCount: 10,
                maxCount: 10,
                roleName: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                metadata: {}
            });
            const result = await staffService.promoteStaff(testContext, promotionRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Maximum limit');
            expect(mockStaffRepository.updateStaffRole).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=staff-service.test.js.map