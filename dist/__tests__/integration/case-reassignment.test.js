"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const case_service_1 = require("../../application/services/case-service");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const permission_service_1 = require("../../application/services/permission-service");
const business_rule_validation_service_1 = require("../../application/services/business-rule-validation-service");
const case_1 = require("../../domain/entities/case");
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
const staff_role_1 = require("../../domain/entities/staff-role");
/**
 * Integration tests for case reassignment and unassignment functionality
 *
 * Tests the new /case reassign and /case unassign commands added to the system
 */
describe('Case Reassignment Integration Tests', () => {
    let caseService;
    let caseRepository;
    let caseCounterRepository;
    let guildConfigRepository;
    let staffRepository;
    let permissionService;
    let businessRuleValidationService;
    let context;
    const testGuildId = 'test-guild-reassign';
    const lawyer1Id = 'lawyer-1';
    const lawyer2Id = 'lawyer-2';
    const lawyer3Id = 'lawyer-3';
    const clientId = 'client-123';
    beforeAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.setupTestDatabase();
    });
    beforeEach(async () => {
        // Initialize repositories
        caseRepository = new case_repository_1.CaseRepository();
        caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        staffRepository = new staff_repository_1.StaffRepository();
        // Initialize services
        permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        businessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(guildConfigRepository, staffRepository, caseRepository, permissionService);
        caseService = new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository, permissionService, businessRuleValidationService);
        // Create test context
        context = {
            guildId: testGuildId,
            userId: 'admin-123',
            userRoles: ['admin-role', 'case-role'],
            isGuildOwner: false
        };
        await test_utils_1.TestUtils.clearTestDatabase();
        // Setup test guild config
        await guildConfigRepository.add({
            guildId: testGuildId,
            feedbackChannelId: undefined,
            retainerChannelId: undefined,
            caseReviewCategoryId: undefined,
            caseArchiveCategoryId: undefined,
            modlogChannelId: undefined,
            applicationChannelId: undefined,
            clientRoleId: undefined,
            permissions: {
                admin: ['admin-role'],
                'senior-staff': [],
                case: ['case-role'],
                config: [],
                lawyer: ['lawyer-role'],
                'lead-attorney': ['lawyer-role'],
                repair: []
            },
            adminRoles: ['admin-role'],
            adminUsers: ['admin-123']
        });
        // Create staff members for the lawyers so they have proper permissions
        await staffRepository.add({
            userId: lawyer1Id,
            guildId: testGuildId,
            role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            status: 'active',
            robloxUsername: 'Lawyer1',
            hiredAt: new Date(),
            hiredBy: 'admin-123',
            promotionHistory: []
        });
        await staffRepository.add({
            userId: lawyer2Id,
            guildId: testGuildId,
            role: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
            status: 'active',
            robloxUsername: 'Lawyer2',
            hiredAt: new Date(),
            hiredBy: 'admin-123',
            promotionHistory: []
        });
        await staffRepository.add({
            userId: lawyer3Id,
            guildId: testGuildId,
            role: staff_role_1.StaffRole.JUNIOR_PARTNER,
            status: 'active',
            robloxUsername: 'Lawyer3',
            hiredAt: new Date(),
            hiredBy: 'admin-123',
            promotionHistory: []
        });
        // Mock the validateLawyerPermissions method to always return valid for our test lawyers
        jest.spyOn(businessRuleValidationService, 'validatePermission').mockImplementation(async (context, permission) => {
            const lawyerIds = [lawyer1Id, lawyer2Id, lawyer3Id];
            if (permission === 'lawyer' && lawyerIds.includes(context.userId)) {
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
            // Default return for other cases
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
    afterAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.teardownTestDatabase();
    });
    describe('Case Reassignment (reassignLawyer)', () => {
        let case1;
        let case2;
        beforeEach(async () => {
            // Create two test cases
            case1 = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId,
                clientUsername: 'testclient',
                title: 'Case 1 - Contract Dispute',
                description: 'First test case',
                priority: case_1.CasePriority.HIGH
            });
            case2 = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId: 'client-456',
                clientUsername: 'otherclient',
                title: 'Case 2 - Personal Injury',
                description: 'Second test case',
                priority: case_1.CasePriority.MEDIUM
            });
            // Accept both cases and assign lawyers
            // Create contexts for different lawyers
            const lawyer1Context = { ...context, userId: lawyer1Id };
            const lawyer2Context = { ...context, userId: lawyer2Id };
            await caseService.acceptCase(lawyer1Context, case1._id.toString());
            await caseService.acceptCase(lawyer2Context, case2._id.toString());
        });
        it('should successfully reassign lawyer from one case to another', async () => {
            const fromCaseId = case1._id.toString();
            const toCaseId = case2._id.toString();
            // Verify initial state
            const initialCase1 = await caseService.getCaseById(context, fromCaseId);
            const initialCase2 = await caseService.getCaseById(context, toCaseId);
            expect(initialCase1?.assignedLawyerIds).toContain(lawyer1Id);
            expect(initialCase1?.leadAttorneyId).toBe(lawyer1Id);
            expect(initialCase2?.assignedLawyerIds).toContain(lawyer2Id);
            expect(initialCase2?.leadAttorneyId).toBe(lawyer2Id);
            // Perform reassignment
            const result = await caseService.reassignLawyer(context, fromCaseId, toCaseId, lawyer1Id);
            // Verify result structure
            expect(result).toBeDefined();
            expect(result.fromCase).toBeDefined();
            expect(result.toCase).toBeDefined();
            // Verify lawyer1 was removed from case1
            expect(result.fromCase?.assignedLawyerIds).not.toContain(lawyer1Id);
            expect(result.fromCase?.leadAttorneyId).toBeNull(); // Should be reassigned or null
            // Verify lawyer1 was added to case2
            expect(result.toCase?.assignedLawyerIds).toContain(lawyer1Id);
            expect(result.toCase?.assignedLawyerIds).toContain(lawyer2Id); // Original lawyer should remain
            // Check database state
            const finalCase1 = await caseService.getCaseById(context, fromCaseId);
            const finalCase2 = await caseService.getCaseById(context, toCaseId);
            expect(finalCase1?.assignedLawyerIds).not.toContain(lawyer1Id);
            expect(finalCase2?.assignedLawyerIds).toContain(lawyer1Id);
            expect(finalCase2?.assignedLawyerIds).toContain(lawyer2Id);
        });
        it('should handle lead attorney reassignment correctly', async () => {
            const fromCaseId = case1._id.toString();
            const toCaseId = case2._id.toString();
            // Add another lawyer to case1 first
            await caseService.assignLawyer(context, {
                caseId: fromCaseId,
                lawyerId: lawyer3Id,
                assignedBy: 'admin-123'
            });
            // Verify lawyer1 is still lead attorney
            const beforeReassign = await caseService.getCaseById(context, fromCaseId);
            expect(beforeReassign?.leadAttorneyId).toBe(lawyer1Id);
            expect(beforeReassign?.assignedLawyerIds).toHaveLength(2);
            // Reassign the lead attorney (lawyer1)
            const result = await caseService.reassignLawyer(context, fromCaseId, toCaseId, lawyer1Id);
            // Verify lead attorney was reassigned to remaining lawyer
            expect(result.fromCase?.leadAttorneyId).toBe(lawyer3Id);
            expect(result.fromCase?.assignedLawyerIds).toContain(lawyer3Id);
            expect(result.fromCase?.assignedLawyerIds).not.toContain(lawyer1Id);
            // Verify lawyer1 is assigned to case2 but lawyer2 remains lead
            expect(result.toCase?.leadAttorneyId).toBe(lawyer2Id);
            expect(result.toCase?.assignedLawyerIds).toContain(lawyer1Id);
            expect(result.toCase?.assignedLawyerIds).toContain(lawyer2Id);
        });
        it('should handle reassignment when target case has no assigned lawyers', async () => {
            // Create a third case with no assigned lawyers
            const case3 = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId: 'client-789',
                clientUsername: 'newclient',
                title: 'Case 3 - New Case',
                description: 'Unassigned case',
                priority: case_1.CasePriority.LOW
            });
            const fromCaseId = case1._id.toString();
            const toCaseId = case3._id.toString();
            // Reassign lawyer1 to empty case
            const result = await caseService.reassignLawyer(context, fromCaseId, toCaseId, lawyer1Id);
            // Verify lawyer1 becomes lead attorney of the new case
            expect(result.toCase?.leadAttorneyId).toBe(lawyer1Id);
            expect(result.toCase?.assignedLawyerIds).toContain(lawyer1Id);
            expect(result.toCase?.assignedLawyerIds).toHaveLength(1);
            // Verify lawyer1 was removed from original case
            expect(result.fromCase?.assignedLawyerIds).not.toContain(lawyer1Id);
        });
        it('should handle reassigning non-existent lawyer gracefully', async () => {
            const fromCaseId = case1._id.toString();
            const toCaseId = case2._id.toString();
            const nonExistentLawyer = 'non-existent-lawyer';
            // The service should handle this gracefully (idempotent operation)
            const result = await caseService.reassignLawyer(context, fromCaseId, toCaseId, nonExistentLawyer);
            // Non-existent lawyer should be added to target case (since assignLawyer is permissive)
            expect(result.toCase?.assignedLawyerIds).toContain(nonExistentLawyer);
            // Original case should be unchanged since lawyer wasn't assigned there
            expect(result.fromCase?.assignedLawyerIds).toContain(lawyer1Id);
        });
        it('should throw error when using non-existent case IDs', async () => {
            const nonExistentCaseId = 'non-existent-case';
            await expect(caseService.reassignLawyer(context, nonExistentCaseId, case2._id.toString(), lawyer1Id)).rejects.toThrow();
            await expect(caseService.reassignLawyer(context, case1._id.toString(), nonExistentCaseId, lawyer1Id)).rejects.toThrow();
        });
        it('should handle reassignment of only lawyer in case', async () => {
            const fromCaseId = case1._id.toString();
            const toCaseId = case2._id.toString();
            // Verify case1 has only lawyer1
            const beforeReassign = await caseService.getCaseById(context, fromCaseId);
            expect(beforeReassign?.assignedLawyerIds).toHaveLength(1);
            expect(beforeReassign?.leadAttorneyId).toBe(lawyer1Id);
            // Reassign the only lawyer
            const result = await caseService.reassignLawyer(context, fromCaseId, toCaseId, lawyer1Id);
            // Verify case1 has no assigned lawyers
            expect(result.fromCase?.assignedLawyerIds).toHaveLength(0);
            expect(result.fromCase?.leadAttorneyId).toBeNull();
            // Verify lawyer1 is added to case2
            expect(result.toCase?.assignedLawyerIds).toContain(lawyer1Id);
            expect(result.toCase?.assignedLawyerIds).toContain(lawyer2Id);
        });
    });
    describe('Lawyer Unassignment (unassignLawyer)', () => {
        let testCase;
        beforeEach(async () => {
            // Create and setup a test case with multiple lawyers
            testCase = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId,
                clientUsername: 'testclient',
                title: 'Multi-lawyer Case',
                description: 'Case with multiple assigned lawyers',
                priority: case_1.CasePriority.HIGH
            });
            // Accept case and assign multiple lawyers
            const lawyer1Context = { ...context, userId: lawyer1Id };
            await caseService.acceptCase(lawyer1Context, testCase._id.toString());
            await caseService.assignLawyer(context, {
                caseId: testCase._id.toString(),
                lawyerId: lawyer2Id,
                assignedBy: 'admin-123'
            });
            await caseService.assignLawyer(context, {
                caseId: testCase._id.toString(),
                lawyerId: lawyer3Id,
                assignedBy: 'admin-123'
            });
        });
        it('should successfully unassign non-lead lawyer', async () => {
            const caseId = testCase._id.toString();
            // Verify initial state
            const beforeUnassign = await caseService.getCaseById(context, caseId);
            expect(beforeUnassign?.assignedLawyerIds).toHaveLength(3);
            expect(beforeUnassign?.leadAttorneyId).toBe(lawyer1Id);
            expect(beforeUnassign?.assignedLawyerIds).toContain(lawyer2Id);
            // Unassign lawyer2 (non-lead)
            const result = await caseService.unassignLawyer(context, caseId, lawyer2Id);
            // Verify lawyer2 was removed but others remain
            expect(result.assignedLawyerIds).not.toContain(lawyer2Id);
            expect(result.assignedLawyerIds).toContain(lawyer1Id);
            expect(result.assignedLawyerIds).toContain(lawyer3Id);
            expect(result.assignedLawyerIds).toHaveLength(2);
            // Lead attorney should remain unchanged
            expect(result.leadAttorneyId).toBe(lawyer1Id);
        });
        it('should reassign lead attorney when unassigning current lead', async () => {
            const caseId = testCase._id.toString();
            // Verify lawyer1 is lead attorney
            const beforeUnassign = await caseService.getCaseById(context, caseId);
            expect(beforeUnassign?.leadAttorneyId).toBe(lawyer1Id);
            expect(beforeUnassign?.assignedLawyerIds).toHaveLength(3);
            // Unassign the lead attorney
            const result = await caseService.unassignLawyer(context, caseId, lawyer1Id);
            // Verify lawyer1 was removed
            expect(result.assignedLawyerIds).not.toContain(lawyer1Id);
            expect(result.assignedLawyerIds).toHaveLength(2);
            // Verify new lead attorney was assigned (should be lawyer2 as first remaining)
            expect(result.leadAttorneyId).toBeTruthy();
            expect(result.leadAttorneyId).not.toBe(lawyer1Id);
            expect([lawyer2Id, lawyer3Id]).toContain(result.leadAttorneyId);
        });
        it('should handle unassigning last lawyer in case', async () => {
            const caseId = testCase._id.toString();
            // First unassign lawyer2 and lawyer3
            await caseService.unassignLawyer(context, caseId, lawyer2Id);
            await caseService.unassignLawyer(context, caseId, lawyer3Id);
            // Verify only lawyer1 remains
            const beforeFinalUnassign = await caseService.getCaseById(context, caseId);
            expect(beforeFinalUnassign?.assignedLawyerIds).toHaveLength(1);
            expect(beforeFinalUnassign?.leadAttorneyId).toBe(lawyer1Id);
            // Unassign the last lawyer
            const result = await caseService.unassignLawyer(context, caseId, lawyer1Id);
            // Verify case has no assigned lawyers
            expect(result.assignedLawyerIds).toHaveLength(0);
            expect(result.leadAttorneyId).toBeNull();
        });
        it('should handle unassigning non-assigned lawyer gracefully', async () => {
            const caseId = testCase._id.toString();
            const unassignedLawyer = 'unassigned-lawyer-999';
            // Should complete without error (idempotent operation)
            const result = await caseService.unassignLawyer(context, caseId, unassignedLawyer);
            // Case should remain unchanged since lawyer wasn't assigned
            expect(result).toBeDefined();
            expect(result.assignedLawyerIds).toHaveLength(3); // Original lawyers still there
            expect(result.assignedLawyerIds).toContain(lawyer1Id);
            expect(result.assignedLawyerIds).toContain(lawyer2Id);
            expect(result.assignedLawyerIds).toContain(lawyer3Id);
            expect(result.assignedLawyerIds).not.toContain(unassignedLawyer);
        });
        it('should throw error when unassigning from non-existent case', async () => {
            const nonExistentCaseId = 'non-existent-case';
            await expect(caseService.unassignLawyer(context, nonExistentCaseId, lawyer1Id)).rejects.toThrow();
        });
    });
    describe('Case Assignment Status Tracking', () => {
        let multiCaseScenario;
        beforeEach(async () => {
            // Create multiple cases for complex assignment tracking
            multiCaseScenario = [];
            for (let i = 1; i <= 3; i++) {
                const testCase = await caseService.createCase(context, {
                    guildId: testGuildId,
                    clientId: `client-${i}`,
                    clientUsername: `client${i}`,
                    title: `Case ${i}`,
                    description: `Test case ${i}`,
                    priority: case_1.CasePriority.MEDIUM
                });
                const lawyer1Context = { ...context, userId: lawyer1Id };
                await caseService.acceptCase(lawyer1Context, testCase._id.toString());
                multiCaseScenario.push(testCase);
            }
        });
        it('should track lawyer assignments across multiple cases', async () => {
            // Verify lawyer1 is assigned to all 3 cases
            for (const testCase of multiCaseScenario) {
                const caseData = await caseService.getCaseById(context, testCase._id.toString());
                expect(caseData?.assignedLawyerIds).toContain(lawyer1Id);
                expect(caseData?.leadAttorneyId).toBe(lawyer1Id);
            }
            // Reassign lawyer1 from case 1 to case 2 (should add to case 2, remove from case 1)
            const case1Id = multiCaseScenario[0]._id.toString();
            const case2Id = multiCaseScenario[1]._id.toString();
            await caseService.reassignLawyer(context, case1Id, case2Id, lawyer1Id);
            // Verify final assignments
            const finalCase1 = await caseService.getCaseById(context, case1Id);
            const finalCase2 = await caseService.getCaseById(context, case2Id);
            const finalCase3 = await caseService.getCaseById(context, multiCaseScenario[2]._id.toString());
            expect(finalCase1?.assignedLawyerIds).not.toContain(lawyer1Id);
            expect(finalCase2?.assignedLawyerIds).toContain(lawyer1Id);
            expect(finalCase3?.assignedLawyerIds).toContain(lawyer1Id);
            // Case 2 should have lawyer1 listed once (not duplicated)
            const lawyer1Count = finalCase2?.assignedLawyerIds.filter(id => id === lawyer1Id).length;
            expect(lawyer1Count).toBe(1);
        });
        it('should handle complex reassignment chain', async () => {
            const case1Id = multiCaseScenario[0]._id.toString();
            const case2Id = multiCaseScenario[1]._id.toString();
            const case3Id = multiCaseScenario[2]._id.toString();
            // Add lawyer2 to case2 and lawyer3 to case3
            await caseService.assignLawyer(context, {
                caseId: case2Id,
                lawyerId: lawyer2Id,
                assignedBy: 'admin-123'
            });
            await caseService.assignLawyer(context, {
                caseId: case3Id,
                lawyerId: lawyer3Id,
                assignedBy: 'admin-123'
            });
            // Reassign lawyer1 from case1 to case2, then lawyer2 from case2 to case3
            await caseService.reassignLawyer(context, case1Id, case2Id, lawyer1Id);
            await caseService.reassignLawyer(context, case2Id, case3Id, lawyer2Id);
            // Verify final state
            const finalCase1 = await caseService.getCaseById(context, case1Id);
            const finalCase2 = await caseService.getCaseById(context, case2Id);
            const finalCase3 = await caseService.getCaseById(context, case3Id);
            expect(finalCase1?.assignedLawyerIds).toHaveLength(0);
            expect(finalCase2?.assignedLawyerIds).toContain(lawyer1Id);
            expect(finalCase2?.assignedLawyerIds).not.toContain(lawyer2Id);
            expect(finalCase3?.assignedLawyerIds).toContain(lawyer1Id);
            expect(finalCase3?.assignedLawyerIds).toContain(lawyer2Id);
            expect(finalCase3?.assignedLawyerIds).toContain(lawyer3Id);
        });
    });
});
//# sourceMappingURL=case-reassignment.test.js.map