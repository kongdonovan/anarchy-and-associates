"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const staff_service_1 = require("../../application/services/staff-service");
const case_service_1 = require("../../application/services/case-service");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const operation_queue_1 = require("../../infrastructure/queue/operation-queue");
const staff_role_1 = require("../../domain/entities/staff-role");
const case_1 = require("../../domain/entities/case");
const audit_log_1 = require("../../domain/entities/audit-log");
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
const permission_service_1 = require("../../application/services/permission-service");
const business_rule_validation_service_1 = require("../../application/services/business-rule-validation-service");
/**
 * Concurrency and Race Condition Tests
 *
 * These tests specifically target race conditions that could occur in a
 * Discord bot environment where multiple users may be executing commands
 * simultaneously. Tests cover:
 * - Concurrent staff hiring/firing
 * - Simultaneous case acceptance
 * - Role limit enforcement under load
 * - Database consistency during concurrent operations
 * - Queue system reliability
 * - Resource contention scenarios
 */
describe('Concurrency and Race Condition Tests', () => {
    let staffService;
    let caseService;
    let staffRepository;
    let caseRepository;
    let auditLogRepository;
    let guildConfigRepository;
    let caseCounterRepository;
    let operationQueue;
    let permissionService;
    let businessRuleValidationService;
    const testGuildId = 'concurrency-test-guild';
    const adminUserId = 'admin-123';
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
        permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        businessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(guildConfigRepository, staffRepository, caseRepository, permissionService);
        staffService = new staff_service_1.StaffService(staffRepository, auditLogRepository, permissionService, businessRuleValidationService);
        caseService = new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository, permissionService, businessRuleValidationService);
        // Initialize queue
        operationQueue = operation_queue_1.OperationQueue.getInstance();
        // Clear state
        await test_utils_1.TestUtils.clearTestDatabase();
        operationQueue.clearQueue();
        // Setup test guild with admin permissions
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
                'senior-staff': ['admin-role'],
                case: ['admin-role', 'case-role'],
                config: ['admin-role'],
                lawyer: ['admin-role'],
                'lead-attorney': ['admin-role'],
                repair: ['admin-role']
            },
            adminRoles: ['admin-role'],
            adminUsers: [adminUserId]
        });
    });
    afterAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.teardownTestDatabase();
    });
    describe('Concurrent Staff Operations', () => {
        it('should handle concurrent staff hiring with role limits', async () => {
            const concurrentHires = 15; // More than the paralegal limit of 10
            const operations = [];
            // Create concurrent hire operations
            for (let i = 0; i < concurrentHires; i++) {
                const operation = operationQueue.enqueue(() => {
                    const context = {
                        guildId: testGuildId,
                        userId: adminUserId,
                        userRoles: ['admin-role'],
                        isGuildOwner: false
                    };
                    return staffService.hireStaff(context, {
                        guildId: testGuildId,
                        userId: `concurrent-user-${i}`,
                        hiredBy: adminUserId,
                        robloxUsername: `ConcurrentUser${i}`,
                        role: staff_role_1.StaffRole.PARALEGAL
                    });
                }, `user-${i}`, testGuildId, false);
                operations.push(operation);
            }
            const results = await Promise.allSettled(operations);
            // Count successful hires
            const successfulHires = results.filter(r => r.status === 'fulfilled' && r.value.success === true).length;
            // Should not exceed role limit (10 paralegals max)
            expect(successfulHires).toBeLessThanOrEqual(10);
            // Verify database consistency
            const paralegals = await staffRepository.findByFilters({ guildId: testGuildId, role: staff_role_1.StaffRole.PARALEGAL });
            expect(paralegals.length).toBe(successfulHires);
            expect(paralegals.length).toBeLessThanOrEqual(10);
            // Verify no duplicate userIds
            const userIds = paralegals.map(s => s.userId);
            const uniqueUserIds = new Set(userIds);
            expect(uniqueUserIds.size).toBe(paralegals.length);
        });
        it('should handle concurrent role promotions safely', async () => {
            // First hire some staff
            const staffMembers = [];
            for (let i = 0; i < 5; i++) {
                const context = {
                    guildId: testGuildId,
                    userId: adminUserId,
                    userRoles: ['admin-role'],
                    isGuildOwner: false
                };
                const hire = await staffService.hireStaff(context, {
                    guildId: testGuildId,
                    userId: `promotion-test-${i}`,
                    hiredBy: adminUserId,
                    robloxUsername: `PromotionTest${i}`,
                    role: staff_role_1.StaffRole.PARALEGAL
                });
                staffMembers.push(hire.staff);
            }
            // Try to promote multiple paralegals to Junior Associate simultaneously
            const promotionOperations = staffMembers.map((staff, index) => operationQueue.enqueue(() => {
                const context = {
                    guildId: testGuildId,
                    userId: adminUserId,
                    userRoles: ['admin-role'],
                    isGuildOwner: false
                };
                return staffService.promoteStaff(context, {
                    guildId: testGuildId,
                    userId: staff.userId,
                    promotedBy: adminUserId,
                    newRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                    reason: `Concurrent promotion ${index}`
                });
            }, `promoter-${index}`, testGuildId, false));
            const results = await Promise.allSettled(promotionOperations);
            // All should succeed since there's no limit conflict
            const successfulPromotions = results.filter(r => r.status === 'fulfilled' && r.value.success === true).length;
            expect(successfulPromotions).toBe(5);
            // Verify database consistency
            const juniorAssociates = await staffRepository.findByFilters({ guildId: testGuildId, role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE });
            expect(juniorAssociates.length).toBe(5);
            const remainingParalegals = await staffRepository.findByRole(testGuildId, staff_role_1.StaffRole.PARALEGAL);
            expect(remainingParalegals.length).toBe(0);
        });
        it('should prevent double hiring of same user', async () => {
            const userId = 'double-hire-test';
            // Try to hire the same user multiple times concurrently
            const duplicateHires = Array.from({ length: 5 }, (_, i) => operationQueue.enqueue(() => {
                const context = {
                    guildId: testGuildId,
                    userId: adminUserId,
                    userRoles: ['admin-role'],
                    isGuildOwner: false
                };
                return staffService.hireStaff(context, {
                    guildId: testGuildId,
                    userId,
                    hiredBy: adminUserId,
                    robloxUsername: `DuplicateUser${i}`,
                    role: staff_role_1.StaffRole.PARALEGAL
                });
            }, `hirer-${i}`, testGuildId, false));
            const results = await Promise.allSettled(duplicateHires);
            // Only one should succeed
            const successfulHires = results.filter(r => r.status === 'fulfilled' && r.value.success === true).length;
            expect(successfulHires).toBe(1);
            // Verify only one staff record exists
            const staffRecords = await staffRepository.findByUserId(testGuildId, userId);
            expect(staffRecords).toBeDefined();
            const allStaff = await staffRepository.findByFilters({ guildId: testGuildId, userId });
            expect(allStaff.length).toBeLessThanOrEqual(1);
        });
    });
    describe('Concurrent Case Operations', () => {
        it('should handle concurrent case creation with sequential numbering', async () => {
            const concurrentCases = 20;
            const operations = [];
            // Create concurrent case creation operations
            for (let i = 0; i < concurrentCases; i++) {
                const operation = operationQueue.enqueue(() => {
                    const context = {
                        guildId: testGuildId,
                        userId: adminUserId,
                        userRoles: ['admin-role', 'case-role'],
                        isGuildOwner: false
                    };
                    return caseService.createCase(context, {
                        guildId: testGuildId,
                        clientId: `client-${i}`,
                        clientUsername: `client${i}`,
                        title: `Concurrent Case ${i}`,
                        description: `Test case created concurrently ${i}`,
                        priority: case_1.CasePriority.MEDIUM
                    });
                }, `creator-${i}`, testGuildId, false);
                operations.push(operation);
            }
            const results = await Promise.all(operations);
            // All should succeed
            expect(results.length).toBe(concurrentCases);
            // Verify sequential numbering
            const caseNumbers = results.map(c => c.caseNumber).sort();
            const currentYear = new Date().getFullYear();
            for (let i = 0; i < concurrentCases; i++) {
                const expectedNumber = String(i + 1).padStart(4, '0');
                const expectedPattern = `${currentYear}-${expectedNumber}-`;
                expect(caseNumbers[i]).toContain(expectedPattern);
            }
            // Verify all cases are unique
            const uniqueCaseNumbers = new Set(caseNumbers);
            expect(uniqueCaseNumbers.size).toBe(concurrentCases);
        });
        it('should handle concurrent case acceptance properly', async () => {
            // Create a case first
            const context = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role', 'case-role'],
                isGuildOwner: false
            };
            const testCase = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId: 'concurrent-client',
                clientUsername: 'concurrentclient',
                title: 'Concurrent Acceptance Test',
                description: 'Testing concurrent case acceptance'
            });
            const caseId = testCase._id.toString();
            // Multiple lawyers try to accept the same case
            const lawyerIds = ['lawyer-1', 'lawyer-2', 'lawyer-3', 'lawyer-4', 'lawyer-5'];
            const acceptanceOperations = lawyerIds.map(lawyerId => operationQueue.enqueue(() => {
                const context = {
                    guildId: testGuildId,
                    userId: lawyerId,
                    userRoles: ['admin-role', 'case-role'],
                    isGuildOwner: false
                };
                return caseService.acceptCase(context, caseId);
            }, lawyerId, testGuildId, false));
            const results = await Promise.allSettled(acceptanceOperations);
            // Only one should succeed
            const successfulAcceptances = results.filter(r => r.status === 'fulfilled').length;
            expect(successfulAcceptances).toBe(1);
            // Verify final case state
            const verifyContext = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role', 'case-role'],
                isGuildOwner: false
            };
            const finalCase = await caseService.getCaseById(verifyContext, caseId);
            expect(finalCase?.status).toBe(case_1.CaseStatus.IN_PROGRESS);
            expect(finalCase?.leadAttorneyId).toBeTruthy();
            expect(lawyerIds.includes(finalCase.leadAttorneyId)).toBe(true);
        });
        it('should handle concurrent case closures', async () => {
            // Create and accept a case
            const createContext = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role', 'case-role'],
                isGuildOwner: false
            };
            const testCase = await caseService.createCase(createContext, {
                guildId: testGuildId,
                clientId: 'closure-client',
                clientUsername: 'closureclient',
                title: 'Concurrent Closure Test',
                description: 'Testing concurrent case closure'
            });
            const acceptContext = {
                guildId: testGuildId,
                userId: 'lead-lawyer',
                userRoles: ['admin-role', 'case-role'],
                isGuildOwner: false
            };
            const openCase = await caseService.acceptCase(acceptContext, testCase._id.toString());
            const caseId = openCase._id.toString();
            // Multiple users try to close the same case
            const closureOperations = Array.from({ length: 3 }, (_, i) => operationQueue.enqueue(() => {
                const context = {
                    guildId: testGuildId,
                    userId: `closer-${i}`,
                    userRoles: ['admin-role', 'case-role'],
                    isGuildOwner: false
                };
                return caseService.closeCase(context, {
                    caseId,
                    result: i === 0 ? case_1.CaseResult.WIN : i === 1 ? case_1.CaseResult.LOSS : case_1.CaseResult.SETTLEMENT,
                    resultNotes: `Closed by concurrent operation ${i}`,
                    closedBy: `closer-${i}`
                });
            }, `closer-${i}`, testGuildId, false));
            const results = await Promise.allSettled(closureOperations);
            // Only one should succeed
            const successfulClosures = results.filter(r => r.status === 'fulfilled').length;
            expect(successfulClosures).toBe(1);
            // Verify case is closed
            const finalContext = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role', 'case-role'],
                isGuildOwner: false
            };
            const finalCase = await caseService.getCaseById(finalContext, caseId);
            expect(finalCase?.status).toBe('closed');
            expect(finalCase?.closedBy).toBeTruthy();
        });
    });
    describe('Database Consistency Under Load', () => {
        it('should maintain audit log consistency during concurrent operations', async () => {
            const operationCount = 50;
            const operations = [];
            // Mix of different operations
            for (let i = 0; i < operationCount; i++) {
                if (i % 2 === 0) {
                    // Staff hire
                    operations.push(operationQueue.enqueue(() => {
                        const context = {
                            guildId: testGuildId,
                            userId: adminUserId,
                            userRoles: ['admin-role'],
                            isGuildOwner: false
                        };
                        return staffService.hireStaff(context, {
                            guildId: testGuildId,
                            userId: `audit-test-${i}`,
                            hiredBy: adminUserId,
                            robloxUsername: `AuditTest${i}`,
                            role: staff_role_1.StaffRole.PARALEGAL
                        });
                    }, `user-${i}`, testGuildId, false));
                }
                else {
                    // Case creation
                    operations.push(operationQueue.enqueue(() => {
                        const context = {
                            guildId: testGuildId,
                            userId: adminUserId,
                            userRoles: ['admin-role', 'case-role'],
                            isGuildOwner: false
                        };
                        return caseService.createCase(context, {
                            guildId: testGuildId,
                            clientId: `audit-client-${i}`,
                            clientUsername: `auditclient${i}`,
                            title: `Audit Test Case ${i}`,
                            description: `Case for audit testing ${i}`
                        });
                    }, `user-${i}`, testGuildId, false));
                }
            }
            await Promise.allSettled(operations);
            // Verify audit logs are consistent
            const allAuditLogs = await auditLogRepository.findByFilters({ guildId: testGuildId });
            // Should have audit logs for successful staff hires
            const staffHireLogs = allAuditLogs.filter(log => log.action === audit_log_1.AuditAction.STAFF_HIRED);
            // Count successful staff hires
            const staffCount = await staffRepository.findByFilters({ guildId: testGuildId });
            // Audit logs should match successful operations
            expect(staffHireLogs.length).toBe(staffCount.length);
            // Verify no duplicate audit log IDs
            const logIds = allAuditLogs.map(log => log._id?.toString()).filter(Boolean);
            const uniqueLogIds = new Set(logIds);
            expect(uniqueLogIds.size).toBe(logIds.length);
        });
        it('should handle high-volume concurrent operations without data corruption', async () => {
            const highVolumeOperations = 100;
            const operations = [];
            // Create many operations of different types
            for (let i = 0; i < highVolumeOperations; i++) {
                const operationType = i % 4;
                switch (operationType) {
                    case 0: // Staff hire
                        operations.push(operationQueue.enqueue(() => {
                            const context = {
                                guildId: testGuildId,
                                userId: adminUserId,
                                userRoles: ['admin-role'],
                                isGuildOwner: false
                            };
                            return staffService.hireStaff(context, {
                                guildId: testGuildId,
                                userId: `volume-staff-${i}`,
                                hiredBy: adminUserId,
                                robloxUsername: `VolumeStaff${i}`,
                                role: staff_role_1.StaffRole.PARALEGAL
                            });
                        }, `volume-user-${i}`, testGuildId, false));
                        break;
                    case 1: // Case creation
                        operations.push(operationQueue.enqueue(() => {
                            const context = {
                                guildId: testGuildId,
                                userId: 'system',
                                userRoles: ['admin-role'],
                                isGuildOwner: false
                            };
                            return caseService.createCase(context, {
                                guildId: testGuildId,
                                clientId: `volume-client-${i}`,
                                clientUsername: `volumeclient${i}`,
                                title: `Volume Case ${i}`,
                                description: `High volume test case ${i}`
                            });
                        }, `volume-user-${i}`, testGuildId, false));
                        break;
                    case 2: // Staff info retrieval
                        operations.push(operationQueue.enqueue(() => {
                            const context = {
                                guildId: testGuildId,
                                userId: `requester-${i}`,
                                userRoles: ['admin-role'],
                                isGuildOwner: false
                            };
                            return staffService.getStaffList(context, undefined);
                        }, `volume-user-${i}`, testGuildId, false));
                        break;
                    case 3: // Case search
                        operations.push(operationQueue.enqueue(() => {
                            const context = {
                                guildId: testGuildId,
                                userId: `volume-user-${i}`,
                                userRoles: ['admin-role'],
                                isGuildOwner: false
                            };
                            return caseService.searchCases(context, { guildId: testGuildId });
                        }, `volume-user-${i}`, testGuildId, false));
                        break;
                }
            }
            const startTime = Date.now();
            await Promise.allSettled(operations);
            const endTime = Date.now();
            // Should complete within reasonable time (30 seconds for 100 operations)
            expect(endTime - startTime).toBeLessThan(30000);
            // Verify database consistency
            const allStaff = await staffRepository.findByFilters({ guildId: testGuildId });
            const allCases = await caseRepository.findByFilters({ guildId: testGuildId });
            // Check for data integrity
            expect(allStaff.length).toBeGreaterThan(0);
            expect(allCases.length).toBeGreaterThan(0);
            // Verify no duplicate IDs
            const staffIds = allStaff.map(s => s._id?.toString()).filter(Boolean);
            const uniqueStaffIds = new Set(staffIds);
            expect(uniqueStaffIds.size).toBe(staffIds.length);
            const caseIds = allCases.map(c => c._id?.toString()).filter(Boolean);
            const uniqueCaseIds = new Set(caseIds);
            expect(uniqueCaseIds.size).toBe(caseIds.length);
        });
    });
    describe('Queue System Stress Testing', () => {
        it('should handle queue overflow gracefully', async () => {
            const overflowOperations = 1000;
            const operations = [];
            // Create more operations than typical queue capacity
            for (let i = 0; i < overflowOperations; i++) {
                operations.push(operationQueue.enqueue(() => Promise.resolve(`operation-${i}`), `user-${i}`, testGuildId, false));
            }
            const results = await Promise.allSettled(operations);
            // All operations should complete (queue should scale)
            const completedOperations = results.filter(r => r.status === 'fulfilled').length;
            expect(completedOperations).toBe(overflowOperations);
        });
        it('should respect priority ordering under load', async () => {
            const normalOperations = 50;
            const priorityOperations = 10;
            const results = [];
            // Add normal priority operations
            for (let i = 0; i < normalOperations; i++) {
                operationQueue.enqueue(async () => {
                    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
                    results.push(`normal-${i}`);
                    return `normal-${i}`;
                }, `user-${i}`, testGuildId, false);
            }
            // Add high priority operations (guild owner)
            for (let i = 0; i < priorityOperations; i++) {
                operationQueue.enqueue(async () => {
                    results.push(`priority-${i}`);
                    return `priority-${i}`;
                }, `owner-${i}`, testGuildId, true // High priority
                );
            }
            // Wait for all operations to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Priority operations should appear early in results
            const priorityResultsAtStart = results.slice(0, priorityOperations)
                .filter(r => r.startsWith('priority')).length;
            expect(priorityResultsAtStart).toBeGreaterThan(0);
        });
        it('should handle operation timeouts correctly', async () => {
            // Create operations that will timeout
            const timeoutOperations = [
                operationQueue.enqueue(() => new Promise(resolve => setTimeout(resolve, 35000)), // Longer than 30s timeout
                'timeout-user-1', testGuildId, false),
                operationQueue.enqueue(() => new Promise(resolve => setTimeout(resolve, 35000)), 'timeout-user-2', testGuildId, false)
            ];
            const results = await Promise.allSettled(timeoutOperations);
            // Operations should timeout and be rejected
            const timeoutCount = results.filter(r => r.status === 'rejected').length;
            expect(timeoutCount).toBe(2);
        }, 40000);
    });
    describe('Resource Contention Scenarios', () => {
        it('should handle database connection limits', async () => {
            // Simulate many concurrent database operations
            const dbOperations = Array.from({ length: 200 }, (_, i) => {
                const context = {
                    guildId: testGuildId,
                    userId: `requester-${i}`,
                    userRoles: ['admin-role'],
                    isGuildOwner: false
                };
                return staffService.getStaffList(context, undefined);
            });
            const results = await Promise.allSettled(dbOperations);
            // Most operations should succeed despite connection limits
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBeGreaterThan(150); // Allow some failures due to limits
        });
        it('should handle rapid sequential operations on same entity', async () => {
            // Create a staff member
            const hireContext = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role'],
                isGuildOwner: false
            };
            const initialHire = await staffService.hireStaff(hireContext, {
                guildId: testGuildId,
                userId: 'rapid-test-user',
                hiredBy: adminUserId,
                robloxUsername: 'RapidTestUser',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(initialHire.success).toBe(true);
            // Perform rapid operations on the same staff member
            const rapidOperations = [
                () => {
                    const context = {
                        guildId: testGuildId,
                        userId: adminUserId,
                        userRoles: ['admin-role'],
                        isGuildOwner: false
                    };
                    return staffService.getStaffInfo(context, 'rapid-test-user');
                },
                () => {
                    const context = {
                        guildId: testGuildId,
                        userId: adminUserId,
                        userRoles: ['admin-role'],
                        isGuildOwner: false
                    };
                    return staffService.promoteStaff(context, {
                        guildId: testGuildId,
                        userId: 'rapid-test-user',
                        promotedBy: adminUserId,
                        newRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
                    });
                },
                () => {
                    const context = {
                        guildId: testGuildId,
                        userId: adminUserId,
                        userRoles: ['admin-role'],
                        isGuildOwner: false
                    };
                    return staffService.getStaffInfo(context, 'rapid-test-user');
                },
                () => {
                    const context = {
                        guildId: testGuildId,
                        userId: adminUserId,
                        userRoles: ['admin-role'],
                        isGuildOwner: false
                    };
                    return staffService.demoteStaff(context, {
                        guildId: testGuildId,
                        userId: 'rapid-test-user',
                        promotedBy: adminUserId,
                        newRole: staff_role_1.StaffRole.PARALEGAL
                    });
                },
                () => {
                    const context = {
                        guildId: testGuildId,
                        userId: adminUserId,
                        userRoles: ['admin-role'],
                        isGuildOwner: false
                    };
                    return staffService.getStaffInfo(context, 'rapid-test-user');
                }
            ];
            const queuedOperations = rapidOperations.map((op, i) => operationQueue.enqueue(op, `rapid-requester-${i}`, testGuildId, false));
            const results = await Promise.allSettled(queuedOperations);
            // All read operations should succeed, write operations may have conflicts
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBeGreaterThan(2); // At least reads should work
            // Final state should be consistent
            const finalContext = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role'],
                isGuildOwner: false
            };
            const finalState = await staffService.getStaffInfo(finalContext, 'rapid-test-user');
            expect(finalState).toBeDefined();
            expect(finalState?.status).toBe('active');
        });
    });
});
//# sourceMappingURL=race-condition.test.js.map