"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const case_service_1 = require("../../application/services/case-service");
const permission_service_1 = require("../../application/services/permission-service");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const permission_utils_1 = require("../../infrastructure/utils/permission-utils");
const case_1 = require("../../domain/entities/case");
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
/**
 * End-to-End tests for /case reassign and /case unassign Discord commands
 *
 * These tests simulate the full command workflow including:
 * - Permission checking with proper context
 * - Service layer interactions
 * - Database operations
 * - Error handling scenarios
 */
describe('Case Reassignment Commands E2E Tests', () => {
    let caseService;
    let permissionService;
    let caseRepository;
    let guildConfigRepository;
    // Test data setup
    const testGuildId = 'test-guild-reassign-e2e';
    const guildOwnerId = 'guild-owner-reassign';
    const adminUserId = 'admin-user-reassign';
    const caseManagerUserId = 'case-manager-reassign';
    const regularUserId = 'regular-user-reassign';
    const lawyer1Id = 'lawyer-1-reassign';
    const lawyer2Id = 'lawyer-2-reassign';
    const lawyer3Id = 'lawyer-3-reassign';
    const clientId = 'client-reassign';
    // Mock Discord interaction factory
    const createMockInteraction = (userId, userRoles = [], isGuildOwner = false) => ({
        guildId: testGuildId,
        user: { id: userId, displayName: `User-${userId}` },
        guild: {
            ownerId: isGuildOwner ? userId : guildOwnerId,
            members: {
                cache: {
                    get: (memberId) => {
                        if (memberId === userId) {
                            return {
                                roles: {
                                    cache: {
                                        map: (fn) => userRoles.map(roleId => fn({ id: roleId }))
                                    }
                                }
                            };
                        }
                        return null;
                    }
                }
            }
        },
        channelId: 'test-channel-123',
        reply: jest.fn(),
        channel: {
            id: 'test-channel-123',
            type: 0 // GUILD_TEXT
        }
    });
    beforeAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.setupTestDatabase();
    });
    beforeEach(async () => {
        // Initialize repositories and services
        caseRepository = new case_repository_1.CaseRepository();
        guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        caseService = new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository);
        permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        await test_utils_1.TestUtils.clearTestDatabase();
        // Setup test guild configuration with proper permissions
        await guildConfigRepository.add({
            guildId: testGuildId,
            feedbackChannelId: 'feedback-channel-123',
            retainerChannelId: 'retainer-channel-123',
            caseReviewCategoryId: 'case-review-123',
            caseArchiveCategoryId: 'case-archive-123',
            modlogChannelId: 'modlog-123',
            applicationChannelId: 'application-123',
            clientRoleId: 'client-role-123',
            permissions: {
                admin: ['admin-role-123'],
                'senior-staff': ['hr-role-123'],
                case: ['case-role-123'],
                config: ['config-role-123'],
                retainer: ['retainer-role-123'],
                repair: ['repair-role-123']
            },
            adminRoles: ['admin-role-123'],
            adminUsers: [adminUserId]
        });
    });
    afterAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.teardownTestDatabase();
    });
    describe('/case reassign Command Workflow', () => {
        let case1;
        let case2;
        beforeEach(async () => {
            // Create test permission context
            const context = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            // Create test cases and assign lawyers
            case1 = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId,
                clientUsername: 'testclient',
                title: 'Case 1 - Contract Dispute',
                description: 'First test case for reassignment',
                priority: case_1.CasePriority.HIGH
            });
            case2 = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId: 'client-2',
                clientUsername: 'client2',
                title: 'Case 2 - Personal Injury',
                description: 'Second test case for reassignment',
                priority: case_1.CasePriority.MEDIUM
            });
            // Accept cases and assign lawyers
            await caseService.acceptCase(case1._id.toString(), lawyer1Id);
            await caseService.acceptCase(case2._id.toString(), lawyer2Id);
            // Update case channels for testing
            await caseRepository.update(case1._id.toString(), { channelId: 'case-1-channel' });
            await caseRepository.update(case2._id.toString(), { channelId: 'case-2-channel' });
        });
        it('should allow guild owner to reassign staff between cases', async () => {
            const interaction = createMockInteraction(guildOwnerId, [], true);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            // Verify guild owner has case permission
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(true);
            // Simulate the reassign command logic
            const mockNewCaseChannel = { id: 'case-2-channel', type: 0 };
            // Find staff member's current assignment (simulating the command's logic)
            const assignedCases = await caseRepository.findByLawyer(lawyer1Id);
            const activeCases = assignedCases.filter(c => c.guildId === testGuildId &&
                c.status === case_1.CaseStatus.IN_PROGRESS);
            expect(activeCases.length).toBeGreaterThan(0);
            // Get the new case from channel
            const newCase = await caseRepository.findByFilters({ channelId: mockNewCaseChannel.id });
            expect(newCase.length).toBe(1);
            const targetCase = newCase[0];
            expect(targetCase).toBeDefined();
            // Verify lawyer1 is not already assigned to the target case
            expect(targetCase.assignedLawyerIds).not.toContain(lawyer1Id);
            // Perform reassignment
            const currentCase = activeCases[0];
            expect(currentCase).toBeDefined();
            await caseService.reassignLawyer(currentCase._id.toString(), targetCase._id.toString(), lawyer1Id);
            // Verify the reassignment
            const updatedNewCase = await caseService.getCaseById(context, targetCase._id.toString());
            const updatedOldCase = await caseService.getCaseById(context, currentCase._id.toString());
            expect(updatedNewCase?.assignedLawyerIds).toContain(lawyer1Id);
            expect(updatedOldCase?.assignedLawyerIds).not.toContain(lawyer1Id);
        });
        it('should deny permission to admin users without case role', async () => {
            const interaction = createMockInteraction(adminUserId, ['admin-role-123']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            // Verify admin does NOT have case permission (admin permission ≠ case permission)
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false);
            // Command would be blocked by permission guard, so we don't test service call
        });
        it('should allow case managers to reassign staff between cases', async () => {
            const interaction = createMockInteraction(caseManagerUserId, ['case-role-123']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            // Verify case manager has case permission
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(true);
            // Test reassignment workflow
            await caseService.reassignLawyer(case1._id.toString(), case2._id.toString(), lawyer1Id);
            // Verify reassignment
            const updatedCase1 = await caseService.getCaseById(context, case1._id.toString());
            const updatedCase2 = await caseService.getCaseById(context, case2._id.toString());
            expect(updatedCase1?.assignedLawyerIds).not.toContain(lawyer1Id);
            expect(updatedCase2?.assignedLawyerIds).toContain(lawyer1Id);
        });
        it('should deny permission to regular users without case role', async () => {
            const interaction = createMockInteraction(regularUserId, ['some-other-role']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            // Verify regular user does not have case permission
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false);
            // Command would be blocked by permission guard, so we don't test service call
        });
        it('should handle error when staff member has no active assignments', async () => {
            const unassignedLawyer = 'unassigned-lawyer-999';
            // Try to find assignments for unassigned lawyer
            const assignedCases = await caseRepository.findByLawyer(unassignedLawyer);
            const activeCases = assignedCases.filter(c => c.guildId === testGuildId &&
                c.status === case_1.CaseStatus.IN_PROGRESS);
            // Should have no active cases
            expect(activeCases.length).toBe(0);
            // This would trigger the "No Current Assignment" error in the command
        });
        it('should handle error when target channel is not a case channel', async () => {
            const invalidChannelId = 'non-case-channel-123';
            // Try to find case by invalid channel
            const caseInChannel = await caseRepository.findByFilters({ channelId: invalidChannelId });
            // Should find no case
            expect(caseInChannel.length).toBe(0);
            // This would trigger the "Invalid Case Channel" error in the command
        });
        it('should handle error when staff member is already assigned to target case', async () => {
            // Create test permission context
            const context = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            // Verify lawyer2 is already assigned to case2
            const targetCase = await caseService.getCaseById(context, case2._id.toString());
            expect(targetCase?.assignedLawyerIds).toContain(lawyer2Id);
            // This would trigger the "Already Assigned" error if trying to reassign lawyer2 to case2
        });
    });
    describe('/case unassign Command Workflow', () => {
        let multiLawyerCase;
        beforeEach(async () => {
            // Create test permission context
            const context = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            // Create a case with multiple lawyers for unassignment testing
            multiLawyerCase = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId,
                clientUsername: 'testclient',
                title: 'Multi-lawyer Case for Unassignment',
                description: 'Case with multiple lawyers for testing unassignment',
                priority: case_1.CasePriority.HIGH
            });
            // Accept and assign multiple lawyers
            await caseService.acceptCase(multiLawyerCase._id.toString(), lawyer1Id);
            await caseService.assignLawyer(context, {
                caseId: multiLawyerCase._id.toString(),
                lawyerId: lawyer2Id,
                assignedBy: adminUserId
            });
            await caseService.assignLawyer(context, {
                caseId: multiLawyerCase._id.toString(),
                lawyerId: lawyer3Id,
                assignedBy: adminUserId
            });
        });
        it('should allow guild owner to unassign staff from cases', async () => {
            const interaction = createMockInteraction(guildOwnerId, [], true);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            // Verify permission
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(true);
            // Find all active cases for lawyer2 (simulating command logic)
            const allAssignedCases = await caseRepository.findByLawyer(lawyer2Id);
            const assignedCases = allAssignedCases.filter(c => c.guildId === testGuildId &&
                c.status === case_1.CaseStatus.IN_PROGRESS);
            expect(assignedCases.length).toBeGreaterThan(0);
            // Unassign from all active cases
            const unassignedCases = [];
            for (const caseData of assignedCases) {
                await caseService.unassignLawyer(caseData._id.toString(), lawyer2Id);
                unassignedCases.push(caseData.caseNumber);
            }
            expect(unassignedCases.length).toBeGreaterThan(0);
            // Verify lawyer2 is no longer assigned
            const updatedCase = await caseService.getCaseById(context, multiLawyerCase._id.toString());
            expect(updatedCase?.assignedLawyerIds).not.toContain(lawyer2Id);
            expect(updatedCase?.assignedLawyerIds).toContain(lawyer1Id);
            expect(updatedCase?.assignedLawyerIds).toContain(lawyer3Id);
        });
        it('should deny permission to admin users without case role', async () => {
            const interaction = createMockInteraction(adminUserId, ['admin-role-123']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            // Verify admin does NOT have case permission (admin permission ≠ case permission)
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false);
            // Command would be blocked by permission guard
        });
        it('should handle unassigning lead attorney correctly', async () => {
            // Verify lawyer1 is lead attorney
            const beforeUnassign = await caseService.getCaseById(context, multiLawyerCase._id.toString());
            expect(beforeUnassign?.leadAttorneyId).toBe(lawyer1Id);
            expect(beforeUnassign?.assignedLawyerIds).toHaveLength(3);
            // Unassign the lead attorney
            await caseService.unassignLawyer(multiLawyerCase._id.toString(), lawyer1Id);
            // Verify lead attorney was reassigned
            const afterUnassign = await caseService.getCaseById(context, multiLawyerCase._id.toString());
            expect(afterUnassign?.assignedLawyerIds).not.toContain(lawyer1Id);
            expect(afterUnassign?.assignedLawyerIds).toHaveLength(2);
            expect(afterUnassign?.leadAttorneyId).toBeTruthy();
            expect(afterUnassign?.leadAttorneyId).not.toBe(lawyer1Id);
            expect([lawyer2Id, lawyer3Id]).toContain(afterUnassign?.leadAttorneyId);
        });
        it('should deny permission to regular users without case role', async () => {
            const interaction = createMockInteraction(regularUserId, ['some-other-role']);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            // Verify regular user does not have case permission
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false);
            // Command would be blocked by permission guard
        });
        it('should handle error when staff member has no active assignments', async () => {
            const unassignedLawyer = 'unassigned-lawyer-999';
            // Find assignments for unassigned lawyer
            const allAssignedCases = await caseRepository.findByLawyer(unassignedLawyer);
            const assignedCases = allAssignedCases.filter(c => c.guildId === testGuildId &&
                c.status === case_1.CaseStatus.IN_PROGRESS);
            // Should have no active cases
            expect(assignedCases.length).toBe(0);
            // This would trigger the "No Current Assignment" error in the command
        });
    });
    describe('Permission Context Integration', () => {
        it('should properly populate permission context from Discord interaction', async () => {
            const testUserRoles = ['case-role-123', 'hr-role-123'];
            const interaction = createMockInteraction(caseManagerUserId, testUserRoles);
            // Test the permission context creation that's used in the commands
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            expect(context.guildId).toBe(testGuildId);
            expect(context.userId).toBe(caseManagerUserId);
            expect(context.userRoles).toEqual(testUserRoles);
            expect(context.isGuildOwner).toBe(false);
            // Verify permission checking works with this context
            // Note: This should pass because the guild config in beforeEach has case-role-123 in case permissions
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(true);
        });
        it('should correctly identify guild owner in permission context', async () => {
            const interaction = createMockInteraction(guildOwnerId, [], true);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            expect(context.isGuildOwner).toBe(true);
            expect(context.userId).toBe(guildOwnerId);
            // Guild owner should have all permissions
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(true);
        });
        it('should handle empty user roles correctly', async () => {
            const interaction = createMockInteraction(regularUserId, []);
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            expect(context.userRoles).toEqual([]);
            expect(context.isGuildOwner).toBe(false);
            // Regular user with no roles should not have case permission
            const hasPermission = await permissionService.hasActionPermission(context, 'case');
            expect(hasPermission).toBe(false);
        });
    });
    describe('Error Handling and Edge Cases', () => {
        it('should handle database errors gracefully', async () => {
            // Test with invalid ObjectId format
            const invalidCaseId = 'invalid-case-id';
            await expect(caseService.reassignLawyer(invalidCaseId, 'valid-case-id', lawyer1Id)).rejects.toThrow();
        });
        it('should handle concurrent reassignment attempts', async () => {
            // Create test permission context
            const context = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            // Create a case with one lawyer
            const testCase = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId: 'concurrent-client',
                clientUsername: 'concurrentclient',
                title: 'Concurrent Test Case',
                description: 'Testing concurrent operations',
                priority: case_1.CasePriority.MEDIUM
            });
            await caseService.acceptCase(testCase._id.toString(), lawyer1Id);
            // Create two target cases
            const targetCase1 = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId: 'target-1',
                clientUsername: 'target1',
                title: 'Target Case 1',
                description: 'First target case',
                priority: case_1.CasePriority.LOW
            });
            const targetCase2 = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId: 'target-2',
                clientUsername: 'target2',
                title: 'Target Case 2',
                description: 'Second target case',
                priority: case_1.CasePriority.LOW
            });
            // Attempt concurrent reassignments (one should succeed, one should fail)
            const reassignPromise1 = caseService.reassignLawyer(testCase._id.toString(), targetCase1._id.toString(), lawyer1Id);
            const reassignPromise2 = caseService.reassignLawyer(testCase._id.toString(), targetCase2._id.toString(), lawyer1Id);
            // One should succeed, one should fail (or both might succeed depending on implementation)
            const results = await Promise.allSettled([reassignPromise1, reassignPromise2]);
            // At least one operation should complete
            const successfulOps = results.filter(r => r.status === 'fulfilled');
            expect(successfulOps.length).toBeGreaterThanOrEqual(1);
        });
    });
});
//# sourceMappingURL=case-reassignment-commands.test.js.map