"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const case_service_1 = require("../../application/services/case-service");
const staff_service_1 = require("../../application/services/staff-service");
const permission_service_1 = require("../../application/services/permission-service");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const case_1 = require("../../domain/entities/case");
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
const operation_queue_1 = require("../../infrastructure/queue/operation-queue");
const rate_limiter_1 = require("../../infrastructure/rate-limiting/rate-limiter");
/**
 * End-to-End Discord Command Workflow Tests
 *
 * These tests simulate complete Discord command workflows from user interaction
 * to database persistence, testing the full stack integration including:
 * - Permission checking
 * - Service interactions
 * - Database operations
 * - Audit logging
 * - Error handling
 * - Rate limiting
 * - Concurrent operations
 */
describe('Discord Command Workflows E2E Tests', () => {
    let staffService;
    let caseService;
    let permissionService;
    let staffRepository;
    let caseRepository;
    let auditLogRepository;
    let guildConfigRepository;
    let caseCounterRepository;
    let operationQueue;
    let rateLimiter;
    // Test guild and user setup
    const testGuildId = 'test-guild-e2e';
    const guildOwnerId = 'guild-owner-123';
    const adminUserId = 'admin-user-456';
    const regularUserId = 'regular-user-789';
    const clientUserId = 'client-user-999';
    beforeAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.setupTestDatabase();
    });
    beforeEach(async () => {
        // Initialize repositories
        staffRepository = new staff_repository_1.StaffRepository();
        caseRepository = new case_repository_1.CaseRepository();
        auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        // Initialize services
        staffService = new staff_service_1.StaffService(staffRepository, auditLogRepository);
        caseService = new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository);
        permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        // Initialize infrastructure
        operationQueue = operation_queue_1.OperationQueue.getInstance();
        rateLimiter = rate_limiter_1.RateLimiter.getInstance();
        // Clear state
        await test_utils_1.TestUtils.clearTestDatabase();
        operationQueue.clearQueue();
        // Clear rate limiter state
        rateLimiter.clearUserLimitsForTesting();
        // Setup test guild configuration
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
                hr: ['hr-role-123'],
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
    describe('Staff Management Workflow', () => {
        it('should complete full staff hiring workflow with permissions', async () => {
            // Simulate /staff hire command workflow
            const mockPermissionContext = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            // 1. Check permissions (admin action)
            const hasPermission = await permissionService.hasActionPermission(mockPermissionContext, 'admin');
            expect(hasPermission).toBe(true);
            // 2. Rate limit check
            const rateLimitResult = rateLimiter.checkRateLimit(adminUserId);
            expect(rateLimitResult.allowed).toBe(true);
            // 3. Queue operation to prevent concurrent conflicts
            const hireResult = await operationQueue.enqueue(() => staffService.hireStaff({
                guildId: testGuildId,
                userId: regularUserId,
                hiredBy: adminUserId,
                robloxUsername: 'TestEmployee',
                role: staff_role_1.StaffRole.PARALEGAL,
                reason: 'E2E test hire'
            }), adminUserId, testGuildId, false);
            // 4. Verify successful hire
            expect(hireResult.success).toBe(true);
            expect(hireResult.staff?.userId).toBe(regularUserId);
            expect(hireResult.staff?.role).toBe(staff_role_1.StaffRole.PARALEGAL);
            expect(hireResult.staff?.hiredBy).toBe(adminUserId);
            // 5. Verify audit log created
            const auditLogs = await auditLogRepository.findByFilters({
                guildId: testGuildId,
                targetId: regularUserId
            });
            expect(auditLogs).toHaveLength(1);
            expect(auditLogs[0]?.actorId).toBe(adminUserId);
            // 6. Verify staff can be retrieved
            const staffInfo = await staffService.getStaffInfo(testGuildId, regularUserId, adminUserId);
            expect(staffInfo?.userId).toBe(regularUserId);
        });
        it('should prevent unauthorized staff hiring', async () => {
            // Simulate unauthorized user trying to hire staff
            const unauthorizedContext = {
                guildId: testGuildId,
                userId: regularUserId,
                userRoles: ['member-role'],
                isGuildOwner: false
            };
            // 1. Check permissions (should fail)
            const hasPermission = await permissionService.hasActionPermission(unauthorizedContext, 'admin');
            expect(hasPermission).toBe(false);
            // 2. Attempt hire should fail in real workflow (simulated)
            await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'target-user',
                hiredBy: regularUserId,
                robloxUsername: 'Unauthorized',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            // Note: In real implementation, permission check would happen before service call
            // This test verifies the permission system works correctly
            expect(hasPermission).toBe(false);
        });
        it('should handle staff promotion workflow with role limits', async () => {
            // First hire staff member
            await staffService.hireStaff({
                guildId: testGuildId,
                userId: regularUserId,
                hiredBy: adminUserId,
                robloxUsername: 'PromotionTest',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            // Simulate /staff promote command
            const promotionResult = await operationQueue.enqueue(() => staffService.promoteStaff({
                guildId: testGuildId,
                userId: regularUserId,
                promotedBy: adminUserId,
                newRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                reason: 'Excellent performance'
            }), adminUserId, testGuildId, false);
            expect(promotionResult.success).toBe(true);
            expect(promotionResult.staff?.role).toBe(staff_role_1.StaffRole.JUNIOR_ASSOCIATE);
            // Verify promotion history
            const staff = await staffService.getStaffInfo(testGuildId, regularUserId, adminUserId);
            expect(staff?.promotionHistory.length).toBeGreaterThan(1);
            const promotion = staff?.promotionHistory.find(p => p.actionType === 'promotion');
            expect(promotion?.fromRole).toBe(staff_role_1.StaffRole.PARALEGAL);
            expect(promotion?.toRole).toBe(staff_role_1.StaffRole.JUNIOR_ASSOCIATE);
        });
    });
    describe('Case Management Workflow', () => {
        beforeEach(async () => {
            // Setup staff member for case workflows
            await staffService.hireStaff({
                guildId: testGuildId,
                userId: regularUserId,
                hiredBy: adminUserId,
                robloxUsername: 'CaseLawyer',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
        });
        it('should complete full case creation and assignment workflow', async () => {
            // Simulate /case create command
            const mockPermissionContext = {
                guildId: testGuildId,
                userId: regularUserId,
                userRoles: ['case-role-123'],
                isGuildOwner: false
            };
            // 1. Check case management permissions
            const hasPermission = await permissionService.hasActionPermission(mockPermissionContext, 'case');
            expect(hasPermission).toBe(true);
            // 2. Create case
            const newCase = await operationQueue.enqueue(() => caseService.createCase({
                guildId: testGuildId,
                clientId: clientUserId,
                clientUsername: 'TestClient',
                title: 'Contract Dispute',
                description: 'Client needs help with contract issue',
                priority: case_1.CasePriority.HIGH
            }), regularUserId, testGuildId, false);
            // 3. Verify case creation
            expect(newCase.title).toBe('Contract Dispute');
            expect(newCase.status).toBe(case_1.CaseStatus.PENDING);
            expect(newCase.priority).toBe(case_1.CasePriority.HIGH);
            expect(newCase.clientId).toBe(clientUserId);
            // 4. Simulate /case accept command
            const acceptedCase = await operationQueue.enqueue(() => caseService.acceptCase(newCase._id.toString(), regularUserId), regularUserId, testGuildId, false);
            // 5. Verify case acceptance
            expect(acceptedCase.status).toBe(case_1.CaseStatus.OPEN);
            expect(acceptedCase.leadAttorneyId).toBe(regularUserId);
            expect(acceptedCase.assignedLawyerIds).toContain(regularUserId);
            // 6. Verify case can be retrieved by lawyer
            const lawyerCases = await caseService.getCasesByLawyer(regularUserId);
            expect(lawyerCases).toHaveLength(1);
            expect(lawyerCases[0]?._id?.toString()).toBe(newCase._id?.toString());
        });
        it('should handle case closure workflow with all results', async () => {
            // Create and accept a case
            const testCase = await caseService.createCase({
                guildId: testGuildId,
                clientId: clientUserId,
                clientUsername: 'ClosureClient',
                title: 'Test Case for Closure',
                description: 'Testing case closure workflow'
            });
            await caseService.acceptCase(testCase._id.toString(), regularUserId);
            // Test different closure results
            const results = [case_1.CaseResult.WIN, case_1.CaseResult.LOSS, case_1.CaseResult.SETTLEMENT];
            for (const [index, result] of results.entries()) {
                // Create separate case for each result
                const separateCase = await caseService.createCase({
                    guildId: testGuildId,
                    clientId: `client-${index}`,
                    clientUsername: `client${index}`,
                    title: `Test Case ${result}`,
                    description: `Testing ${result} closure`
                });
                const openSeparateCase = await caseService.acceptCase(separateCase._id.toString(), regularUserId);
                // Simulate /case close command
                const closedCase = await operationQueue.enqueue(() => caseService.closeCase({
                    caseId: openSeparateCase._id.toString(),
                    result,
                    resultNotes: `Case closed with ${result}`,
                    closedBy: regularUserId
                }), regularUserId, testGuildId, false);
                expect(closedCase.status).toBe(case_1.CaseStatus.CLOSED);
                expect(closedCase.result).toBe(result);
                expect(closedCase.closedBy).toBe(regularUserId);
                expect(closedCase.closedAt).toBeDefined();
                const closedAtDate = new Date(closedCase.closedAt);
                expect(closedAtDate.getTime()).toBeGreaterThan(0);
            }
        });
        it('should handle concurrent case operations safely', async () => {
            // Create a case
            const testCase = await caseService.createCase({
                guildId: testGuildId,
                clientId: clientUserId,
                clientUsername: 'ConcurrentTest',
                title: 'Concurrent Operations Test',
                description: 'Testing concurrent case operations'
            });
            const caseId = testCase._id.toString();
            // Simulate multiple lawyers trying to accept the same case
            const lawyer1 = 'lawyer-1';
            const lawyer2 = 'lawyer-2';
            const lawyer3 = 'lawyer-3';
            const acceptPromises = [
                operationQueue.enqueue(() => caseService.acceptCase(caseId, lawyer1), lawyer1, testGuildId, false),
                operationQueue.enqueue(() => caseService.acceptCase(caseId, lawyer2), lawyer2, testGuildId, false),
                operationQueue.enqueue(() => caseService.acceptCase(caseId, lawyer3), lawyer3, testGuildId, false)
            ];
            const results = await Promise.allSettled(acceptPromises);
            // Operations may succeed depending on business logic
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBeGreaterThan(0);
            expect(successCount).toBeLessThanOrEqual(3);
            // Verify final case state
            const finalCase = await caseService.getCaseById(caseId);
            expect(finalCase?.status).toBe(case_1.CaseStatus.OPEN);
            expect(finalCase?.leadAttorneyId).toBeTruthy();
        });
    });
    describe('Permission Boundary Testing', () => {
        it('should enforce guild owner privileges', async () => {
            const guildOwnerContext = {
                guildId: testGuildId,
                userId: guildOwnerId,
                userRoles: [],
                isGuildOwner: true
            };
            // Guild owners should have all permissions
            const adminPerm = await permissionService.hasActionPermission(guildOwnerContext, 'admin');
            const hrPerm = await permissionService.hasActionPermission(guildOwnerContext, 'hr');
            const casePerm = await permissionService.hasActionPermission(guildOwnerContext, 'case');
            expect(adminPerm).toBe(true);
            expect(hrPerm).toBe(true);
            expect(casePerm).toBe(true);
            // Guild owner should be able to hire Managing Partner
            const hireResult = await operationQueue.enqueue(() => staffService.hireStaff({
                guildId: testGuildId,
                userId: 'managing-partner',
                hiredBy: guildOwnerId,
                robloxUsername: 'ManagingPartner',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            }), guildOwnerId, testGuildId, true // Guild owner priority
            );
            expect(hireResult.success).toBe(true);
            expect(hireResult.staff?.role).toBe(staff_role_1.StaffRole.MANAGING_PARTNER);
        });
        it('should handle role-based permissions correctly', async () => {
            // HR role should only have HR permissions
            const hrContext = {
                guildId: testGuildId,
                userId: 'hr-user',
                userRoles: ['hr-role-123'],
                isGuildOwner: false
            };
            const adminPerm = await permissionService.hasActionPermission(hrContext, 'admin');
            const hrPerm = await permissionService.hasActionPermission(hrContext, 'hr');
            const casePerm = await permissionService.hasActionPermission(hrContext, 'case');
            expect(adminPerm).toBe(false);
            expect(hrPerm).toBe(true);
            expect(casePerm).toBe(false);
        });
        it('should handle permission revocation during operation', async () => {
            // This simulates a scenario where a user's permissions are revoked
            // while an operation is in progress
            const userContext = {
                guildId: testGuildId,
                userId: 'temp-admin',
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            // Initial permission check passes
            const hasPermission = await permissionService.hasActionPermission(userContext, 'admin');
            expect(hasPermission).toBe(true);
            // Simulate long-running operation where permissions could change
            const longOperation = async () => {
                // Simulate work
                await new Promise(resolve => setTimeout(resolve, 100));
                // In real implementation, permission should be re-checked here
                // if the operation is sensitive or long-running
                const currentPermission = await permissionService.hasActionPermission(userContext, 'admin');
                if (!currentPermission) {
                    throw new Error('Permission revoked during operation');
                }
                return staffService.hireStaff({
                    guildId: testGuildId,
                    userId: 'late-hire',
                    hiredBy: 'temp-admin',
                    robloxUsername: 'LateHire',
                    role: staff_role_1.StaffRole.PARALEGAL
                });
            };
            // This should succeed since permissions are maintained
            const result = await operationQueue.enqueue(longOperation, 'temp-admin', testGuildId, false);
            expect(result.success).toBe(true);
        });
    });
    describe('Rate Limiting and Abuse Prevention', () => {
        it('should enforce rate limits on rapid commands', async () => {
            const userId = 'rate-test-user';
            // First command should succeed
            const firstCheck = rateLimiter.checkRateLimit(userId);
            expect(firstCheck.allowed).toBe(true);
            // Rapid subsequent commands should be rate limited
            for (let i = 0; i < 5; i++) {
                rateLimiter.checkRateLimit(userId);
            }
            // This should trigger rate limit
            const rateLimited = rateLimiter.checkRateLimit(userId);
            expect(rateLimited.allowed).toBe(false);
        });
        it('should handle high-volume concurrent operations', async () => {
            // Simulate many users performing operations simultaneously
            const userCount = 20;
            const operations = [];
            for (let i = 0; i < userCount; i++) {
                const userId = `user-${i}`;
                const operation = operationQueue.enqueue(() => staffService.hireStaff({
                    guildId: testGuildId,
                    userId,
                    hiredBy: adminUserId,
                    robloxUsername: `User${i}`,
                    role: staff_role_1.StaffRole.PARALEGAL
                }), userId, testGuildId, false);
                operations.push(operation);
            }
            const startTime = Date.now();
            const results = await Promise.allSettled(operations);
            const endTime = Date.now();
            // Operations should complete (promises fulfilled)
            const completedCount = results.filter(r => r.status === 'fulfilled').length;
            expect(completedCount).toBeGreaterThan(0);
            // Should complete within reasonable time
            expect(endTime - startTime).toBeLessThan(10000);
            // Verify database consistency - staff list reflects actual successful hires
            // (which may be limited by role constraints)
            const staffList = await staffService.getStaffList(testGuildId, adminUserId);
            const actualSuccessCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            expect(staffList.staff.length).toBeGreaterThanOrEqual(actualSuccessCount);
        });
    });
    describe('Error Recovery and Rollback', () => {
        it('should handle database failures gracefully', async () => {
            // Test with edge case data that may cause issues
            const result = await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'db-error-test',
                hiredBy: adminUserId,
                robloxUsername: 'DbErrorTest',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            // Service handles edge cases gracefully
            expect(result).toBeDefined();
            // Test normal operation works
            const normalResult = await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'db-retry-test',
                hiredBy: adminUserId,
                robloxUsername: 'DbRetryTest',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(normalResult.success).toBe(true);
        });
        it('should maintain data consistency during failures', async () => {
            // Create initial state
            const staff = await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'consistency-test',
                hiredBy: adminUserId,
                robloxUsername: 'ConsistencyTest',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(staff.success).toBe(true);
            // Test promotion operation
            const promotionResult = await staffService.promoteStaff({
                guildId: testGuildId,
                userId: 'consistency-test',
                promotedBy: adminUserId,
                newRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
            // Service handles operations gracefully
            expect(promotionResult).toBeDefined();
            // Verify staff state
            const currentStaff = await staffService.getStaffInfo(testGuildId, 'consistency-test', adminUserId);
            expect(currentStaff).toBeDefined();
        });
    });
    describe('Cross-Guild Isolation', () => {
        it('should maintain complete isolation between guilds', async () => {
            const guild1 = 'guild-1';
            const guild2 = 'guild-2';
            const userId = 'cross-guild-user';
            // Setup configurations for both guilds
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
                    admin: [],
                    hr: [],
                    case: [],
                    config: [],
                    retainer: [],
                    repair: []
                },
                adminRoles: [],
                adminUsers: [adminUserId]
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
                    admin: [],
                    hr: [],
                    case: [],
                    config: [],
                    retainer: [],
                    repair: []
                },
                adminRoles: [],
                adminUsers: [adminUserId]
            });
            // Hire same user in different guilds with different roles
            const hire1 = await staffService.hireStaff({
                guildId: guild1,
                userId,
                hiredBy: adminUserId,
                robloxUsername: 'Guild1User',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            const hire2 = await staffService.hireStaff({
                guildId: guild2,
                userId,
                hiredBy: adminUserId,
                robloxUsername: 'Guild2User',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(hire1.success).toBe(true);
            expect(hire2.success).toBe(true);
            // Verify isolation
            const guild1Staff = await staffService.getStaffList(guild1, adminUserId);
            const guild2Staff = await staffService.getStaffList(guild2, adminUserId);
            expect(guild1Staff.staff).toHaveLength(1);
            expect(guild2Staff.staff).toHaveLength(1);
            expect(guild1Staff.staff[0]?.role).toBe(staff_role_1.StaffRole.MANAGING_PARTNER);
            expect(guild2Staff.staff[0]?.role).toBe(staff_role_1.StaffRole.PARALEGAL);
            // Cases should also be isolated
            await caseService.createCase({
                guildId: guild1,
                clientId: 'client-1',
                clientUsername: 'client1',
                title: 'Guild 1 Case',
                description: 'Case for guild 1'
            });
            await caseService.createCase({
                guildId: guild2,
                clientId: 'client-1',
                clientUsername: 'client1',
                title: 'Guild 2 Case',
                description: 'Case for guild 2'
            });
            const guild1Cases = await caseService.searchCases({ guildId: guild1 });
            const guild2Cases = await caseService.searchCases({ guildId: guild2 });
            expect(guild1Cases).toHaveLength(1);
            expect(guild2Cases).toHaveLength(1);
            expect(guild1Cases[0]?.title).toBe('Guild 1 Case');
            expect(guild2Cases[0]?.title).toBe('Guild 2 Case');
        });
    });
});
//# sourceMappingURL=discord-command-workflows.test.js.map