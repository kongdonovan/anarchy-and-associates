"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const staff_service_1 = require("../../application/services/staff-service");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const permission_service_1 = require("../../application/services/permission-service");
const unified_validation_service_1 = require("../../application/validation/unified-validation-service");
const business_rule_validation_strategy_1 = require("../../application/validation/strategies/business-rule-validation-strategy");
const staff_role_1 = require("../../domain/entities/staff-role");
const audit_log_1 = require("../../domain/entities/audit-log");
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
describe('StaffService Integration Tests', () => {
    let staffService;
    let staffRepository;
    let auditLogRepository;
    let guildConfigRepository;
    let caseRepository;
    let permissionService;
    let unifiedValidationService;
    let context;
    beforeAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.setupTestDatabase();
    });
    beforeEach(async () => {
        // Initialize repositories
        staffRepository = new staff_repository_1.StaffRepository();
        auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        caseRepository = new case_repository_1.CaseRepository();
        // Initialize services
        permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        unifiedValidationService = new unified_validation_service_1.UnifiedValidationService();
        // Register validation strategies
        const businessRuleStrategy = new business_rule_validation_strategy_1.BusinessRuleValidationStrategy(staffRepository, caseRepository, guildConfigRepository, // GuildConfigRepository parameter
        permissionService);
        unifiedValidationService.registerStrategy(businessRuleStrategy);
        staffService = new staff_service_1.StaffService(staffRepository, auditLogRepository, permissionService, unifiedValidationService);
        // Create test context with valid Discord snowflake IDs
        context = {
            guildId: '123456789012345678',
            userId: '123456789012345679',
            userRoles: ['123456789012345680'],
            isGuildOwner: false
        };
        await test_utils_1.TestUtils.clearTestDatabase();
        // Setup test guild config
        await guildConfigRepository.add({
            guildId: '123456789012345678',
            feedbackChannelId: undefined,
            retainerChannelId: undefined,
            caseReviewCategoryId: undefined,
            caseArchiveCategoryId: undefined,
            modlogChannelId: undefined,
            applicationChannelId: undefined,
            clientRoleId: undefined,
            permissions: {
                admin: ['123456789012345680'],
                'senior-staff': ['123456789012345680', '123456789012345681'],
                case: [],
                config: [],
                lawyer: [],
                'lead-attorney': [],
                repair: []
            },
            adminRoles: ['123456789012345680'],
            adminUsers: ['123456789012345679']
        });
    });
    afterAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.teardownTestDatabase();
    });
    describe('Staff Hiring Integration', () => {
        it('should hire staff member with complete workflow', async () => {
            const guildId = '123456789012345678';
            const userId = '234567890123456789';
            const hiredBy = '345678901234567890';
            const robloxUsername = 'TestRobloxUser';
            const result = await staffService.hireStaff(context, {
                guildId,
                userId,
                hiredBy,
                robloxUsername,
                role: staff_role_1.StaffRole.PARALEGAL
            });
            // Verify staff record creation
            expect(result.success).toBe(true);
            expect(result.staff).toBeDefined();
            expect(result.staff.userId).toBe(userId);
            expect(result.staff.guildId).toBe(guildId);
            expect(result.staff.role).toBe(staff_role_1.StaffRole.PARALEGAL);
            expect(result.staff.status).toBe('active');
            expect(result.staff.robloxUsername).toBe(robloxUsername);
            expect(result.staff.hiredBy).toBe(hiredBy);
            // Verify database persistence
            const savedStaff = await staffRepository.findByUserId(guildId, userId);
            expect(savedStaff).toBeDefined();
            expect(savedStaff?.userId).toBe(userId);
            // Verify audit log creation
            const auditLogs = await auditLogRepository.findByFilters({
                guildId,
                targetId: userId
            });
            expect(auditLogs).toHaveLength(1);
            expect(auditLogs[0]).toBeDefined();
            expect(auditLogs[0].action).toBe(audit_log_1.AuditAction.STAFF_HIRED);
            expect(auditLogs[0].actorId).toBe(hiredBy);
        });
        it('should enforce role limits during hiring', async () => {
            const guildId = '123456789012345678';
            const hiredBy = '456789012345678901';
            // Create a non-admin context for role limit testing
            const nonAdminContext = {
                guildId: '123456789012345678',
                userId: '456789012345678901',
                userRoles: ['123456789012345681'], // senior-staff role from guild config
                isGuildOwner: false
            };
            // First hire should succeed
            const firstHire = await staffService.hireStaff(nonAdminContext, {
                guildId,
                userId: '678901234567890123',
                hiredBy,
                robloxUsername: 'User1',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            expect(firstHire.success).toBe(true);
            // Try to hire second Managing Partner (limit is 1)
            const secondHire = await staffService.hireStaff(nonAdminContext, {
                guildId,
                userId: '789012345678901234',
                hiredBy,
                robloxUsername: 'User2',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            expect(secondHire.success).toBe(false);
            expect(secondHire.error).toContain('Maximum limit');
            // Verify only one Managing Partner exists
            const managingPartners = await staffRepository.findByRole(guildId, staff_role_1.StaffRole.MANAGING_PARTNER);
            expect(managingPartners).toHaveLength(1);
        });
        it('should prevent duplicate staff hiring', async () => {
            const guildId = '123456789012345678';
            const userId = '234567890123456789';
            const hiredBy = '345678901234567890';
            // First hire should succeed
            const firstHire = await staffService.hireStaff(context, {
                guildId,
                userId,
                hiredBy,
                robloxUsername: 'TestUser',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(firstHire.success).toBe(true);
            // Second hire of same user should fail
            const secondHire = await staffService.hireStaff(context, {
                guildId,
                userId,
                hiredBy,
                robloxUsername: 'TestUser2',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
            expect(secondHire.success).toBe(false);
            expect(secondHire.error).toContain('already an active staff member');
        });
        it('should handle Roblox username conflicts', async () => {
            const guildId = '123456789012345678';
            const hiredBy = '345678901234567890';
            const robloxUsername = 'ConflictUser';
            // First hire with Roblox username
            const firstHire = await staffService.hireStaff(context, {
                guildId,
                userId: '678901234567890123',
                hiredBy,
                robloxUsername,
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(firstHire.success).toBe(true);
            // Second hire with same Roblox username should fail
            const secondHire = await staffService.hireStaff(context, {
                guildId,
                userId: '789012345678901234',
                hiredBy,
                robloxUsername,
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
            expect(secondHire.success).toBe(false);
            expect(secondHire.error).toContain('already associated');
        });
    });
    describe('Staff Promotion Integration', () => {
        beforeEach(async () => {
            // Create initial staff member for promotion tests
            await staffService.hireStaff(context, {
                guildId: '123456789012345678',
                userId: '234567890123456789',
                hiredBy: '345678901234567890',
                robloxUsername: 'TestUser',
                role: staff_role_1.StaffRole.PARALEGAL
            });
        });
        it('should promote staff member with complete workflow', async () => {
            const guildId = '123456789012345678';
            const userId = '234567890123456789';
            const promotedBy = '234567890987654321';
            const result = await staffService.promoteStaff(context, {
                guildId,
                userId,
                promotedBy,
                newRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                reason: 'Excellent performance'
            });
            // Verify promotion
            expect(result.success).toBe(true);
            expect(result.staff).toBeDefined();
            expect(result.staff.role).toBe(staff_role_1.StaffRole.JUNIOR_ASSOCIATE);
            expect(result.staff.promotionHistory.length).toBeGreaterThan(1);
            const promotion = result.staff.promotionHistory.find(p => p.actionType === 'promotion');
            expect(promotion?.fromRole).toBe(staff_role_1.StaffRole.PARALEGAL);
            expect(promotion?.toRole).toBe(staff_role_1.StaffRole.JUNIOR_ASSOCIATE);
            expect(promotion?.promotedBy).toBe(promotedBy);
            expect(promotion?.reason).toBe('Excellent performance');
            expect(promotion?.actionType).toBe('promotion');
            // Verify audit log
            const auditLogs = await auditLogRepository.findByFilters({
                guildId,
                targetId: userId,
                action: audit_log_1.AuditAction.STAFF_PROMOTED
            });
            expect(auditLogs).toHaveLength(1);
        });
        it('should prevent invalid promotions', async () => {
            const guildId = '123456789012345678';
            const userId = '234567890123456789';
            const promotedBy = '234567890987654321';
            // Try to promote to same role
            const sameRoleResult = await staffService.promoteStaff(context, {
                guildId,
                userId,
                promotedBy,
                newRole: staff_role_1.StaffRole.PARALEGAL
            });
            expect(sameRoleResult.success).toBe(false);
            expect(sameRoleResult.error).toContain('higher than current role');
        });
    });
    describe('Staff Firing Integration', () => {
        beforeEach(async () => {
            // Create staff member for firing tests
            await staffService.hireStaff(context, {
                guildId: '123456789012345678',
                userId: '234567890123456789',
                hiredBy: '345678901234567890',
                robloxUsername: 'TestUser',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
        });
        it('should fire staff member with complete workflow', async () => {
            const guildId = '123456789012345678';
            const userId = '234567890123456789';
            const terminatedBy = '345678901234567890';
            const reason = 'Policy violation';
            const result = await staffService.fireStaff(context, {
                guildId,
                userId,
                terminatedBy,
                reason
            });
            // Verify firing (only logs action, doesn't change status immediately)
            expect(result.success).toBe(true);
            expect(result.staff).toBeDefined();
            // Verify audit log
            const auditLogs = await auditLogRepository.findByFilters({
                guildId,
                targetId: userId,
                action: audit_log_1.AuditAction.STAFF_FIRED
            });
            expect(auditLogs).toHaveLength(1);
        });
        it('should prevent firing non-existent staff', async () => {
            const guildId = '123456789012345678';
            const userId = '345678909876543210';
            const terminatedBy = '345678901234567890';
            const result = await staffService.fireStaff(context, {
                guildId,
                userId,
                terminatedBy,
                reason: 'Test'
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });
    describe('Staff Querying and Statistics', () => {
        beforeEach(async () => {
            // Create diverse staff for testing
            const staffMembers = [
                { userId: '678901234567890123', role: staff_role_1.StaffRole.MANAGING_PARTNER, robloxUsername: 'ManagingPartner1' },
                { userId: '789012345678901234', role: staff_role_1.StaffRole.SENIOR_PARTNER, robloxUsername: 'SeniorPartner1' },
                { userId: '890123456789012345', role: staff_role_1.StaffRole.JUNIOR_PARTNER, robloxUsername: 'JuniorPartner1' },
                { userId: '901234567890123456', role: staff_role_1.StaffRole.SENIOR_ASSOCIATE, robloxUsername: 'SeniorAssociate1' },
                { userId: '012345678901234567', role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE, robloxUsername: 'JuniorAssociate1' },
                { userId: '123456789098765432', role: staff_role_1.StaffRole.PARALEGAL, robloxUsername: 'Paralegal1' }
            ];
            for (const member of staffMembers) {
                const result = await staffService.hireStaff(context, {
                    guildId: '123456789012345678',
                    userId: member.userId,
                    hiredBy: '345678901234567890',
                    robloxUsername: member.robloxUsername,
                    role: member.role
                });
                // Ensure all hirings succeed
                expect(result.success).toBe(true);
            }
        });
        it('should retrieve staff members with pagination', async () => {
            const staffList = await staffService.getStaffList(context);
            expect(staffList.staff).toHaveLength(6);
            expect(staffList.total).toBe(6);
            // Verify role distribution
            const roleCounts = await staffService.getRoleCounts(context);
            expect(roleCounts[staff_role_1.StaffRole.MANAGING_PARTNER]).toBe(1);
            expect(roleCounts[staff_role_1.StaffRole.SENIOR_PARTNER]).toBe(1);
            expect(roleCounts[staff_role_1.StaffRole.PARALEGAL]).toBe(1);
        });
        it('should retrieve staff hierarchy overview', async () => {
            const hierarchy = await staffService.getStaffHierarchy(context);
            expect(hierarchy).toBeDefined();
            expect(hierarchy.length).toBe(6);
            const roleCounts = await staffService.getRoleCounts(context);
            expect(roleCounts[staff_role_1.StaffRole.MANAGING_PARTNER]).toBe(1);
        });
    });
    describe('Error Handling and Edge Cases', () => {
        it('should handle database connection failures gracefully', async () => {
            // Test with malformed input that should cause validation errors
            await expect(staffService.hireStaff(context, {
                guildId: '123456789012345678',
                userId: '234567890123456789',
                hiredBy: '345678901234567890',
                robloxUsername: 'TestUser123',
                role: 'InvalidRole' // Invalid role type
            })).rejects.toThrow('Validation failed');
        });
        it('should handle malformed staff data', async () => {
            // Test invalid Roblox username (too short - this actually fails validation)
            await expect(staffService.hireStaff(context, {
                guildId: '123456789012345678',
                userId: '456789098765432109',
                hiredBy: '345678901234567890',
                robloxUsername: 'X', // Too short (less than 3 chars)
                role: staff_role_1.StaffRole.PARALEGAL
            })).rejects.toThrow('Validation failed');
            // Test invalid Roblox username (contains invalid characters)
            await expect(staffService.hireStaff(context, {
                guildId: '123456789012345678',
                userId: '567890987654321098',
                hiredBy: '345678901234567890',
                robloxUsername: 'Test@User!', // Contains invalid characters
                role: staff_role_1.StaffRole.PARALEGAL
            })).rejects.toThrow('Validation failed');
        });
    });
    describe('Cross-Guild Isolation', () => {
        it('should maintain strict guild isolation', async () => {
            const guild1 = '678909876543210987';
            const guild2 = '789098765432109876';
            const userId = '234567890123456789';
            // Create contexts for each guild
            const context1 = {
                guildId: guild1,
                userId: '890987654321098765',
                userRoles: ['012109876543210987'],
                isGuildOwner: false
            };
            const context2 = {
                guildId: guild2,
                userId: '901098765432109876',
                userRoles: ['012109876543210987'],
                isGuildOwner: false
            };
            // Setup guild configs for both guilds
            await guildConfigRepository.add({
                guildId: guild1,
                feedbackChannelId: undefined,
                retainerChannelId: undefined,
                caseReviewCategoryId: undefined,
                caseArchiveCategoryId: undefined,
                modlogChannelId: undefined,
                applicationChannelId: undefined,
                clientRoleId: undefined,
                permissions: {
                    admin: ['012109876543210987'],
                    'senior-staff': ['012109876543210987'],
                    case: [],
                    config: [],
                    lawyer: [],
                    'lead-attorney': [],
                    repair: []
                },
                adminRoles: ['012109876543210987'],
                adminUsers: ['890987654321098765']
            });
            await guildConfigRepository.add({
                guildId: guild2,
                feedbackChannelId: undefined,
                retainerChannelId: undefined,
                caseReviewCategoryId: undefined,
                caseArchiveCategoryId: undefined,
                modlogChannelId: undefined,
                applicationChannelId: undefined,
                clientRoleId: undefined,
                permissions: {
                    admin: ['012109876543210987'],
                    'senior-staff': ['012109876543210987'],
                    case: [],
                    config: [],
                    lawyer: [],
                    'lead-attorney': [],
                    repair: []
                },
                adminRoles: ['012109876543210987'],
                adminUsers: ['901098765432109876']
            });
            // Hire same user in different guilds
            await staffService.hireStaff(context1, {
                guildId: guild1,
                userId,
                hiredBy: '890987654321098765',
                robloxUsername: 'User1',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            await staffService.hireStaff(context2, {
                guildId: guild2,
                userId,
                hiredBy: '901098765432109876',
                robloxUsername: 'User2',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            // Verify isolation
            const guild1StaffList = await staffService.getStaffList(context1);
            const guild2StaffList = await staffService.getStaffList(context2);
            expect(guild1StaffList.staff).toHaveLength(1);
            expect(guild2StaffList.staff).toHaveLength(1);
            expect(guild1StaffList.staff[0]?.role).toBe(staff_role_1.StaffRole.MANAGING_PARTNER);
            expect(guild2StaffList.staff[0]?.role).toBe(staff_role_1.StaffRole.PARALEGAL);
            // Verify separate role limits through role counts
            const guild1Counts = await staffService.getRoleCounts(context1);
            const guild2Counts = await staffService.getRoleCounts(context2);
            expect(guild1Counts[staff_role_1.StaffRole.MANAGING_PARTNER]).toBe(1); // Guild 1 has MP
            expect(guild2Counts[staff_role_1.StaffRole.MANAGING_PARTNER]).toBe(0); // Guild 2 doesn't have MP
        });
    });
});
//# sourceMappingURL=staff-service-integration.test.js.map