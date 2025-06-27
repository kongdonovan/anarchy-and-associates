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
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
const permission_service_1 = require("../../application/services/permission-service");
const business_rule_validation_service_1 = require("../../application/services/business-rule-validation-service");
/**
 * Performance and Load Testing
 *
 * These tests verify system performance under various load conditions:
 * - High-volume operations
 * - Response time benchmarks
 * - Memory usage patterns
 * - Database query optimization
 * - Concurrent user simulation
 * - Scalability limits
 */
describe('Performance and Load Testing', () => {
    // Set longer timeout for performance tests
    jest.setTimeout(60000);
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
    // let rateLimiter: RateLimiter; // Commented out as not used
    const testGuildId = 'performance-test-guild';
    const adminUserId = 'admin-123';
    // Create a test context
    const context = {
        guildId: testGuildId,
        userId: adminUserId,
        userRoles: ['admin_role'],
        isGuildOwner: false
    };
    // Performance thresholds
    const PERFORMANCE_THRESHOLDS = {
        SINGLE_OPERATION_MS: 1000,
        BULK_OPERATION_MS: 10000,
        SEARCH_OPERATION_MS: 500,
        CONCURRENT_OPERATIONS_MS: 15000,
        MEMORY_USAGE_MB: 500
    };
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
        // Initialize infrastructure
        operationQueue = operation_queue_1.OperationQueue.getInstance();
        // rateLimiter = RateLimiter.getInstance(); // Not used in these tests
        // Clear state
        await test_utils_1.TestUtils.clearTestDatabase();
        operationQueue.clearQueue();
        // Setup test guild
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
                admin: [],
                'senior-staff': [],
                case: [],
                config: [],
                lawyer: [],
                'lead-attorney': [],
                repair: []
            },
            adminRoles: [],
            adminUsers: []
        });
    });
    afterAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.teardownTestDatabase();
    });
    describe('Single Operation Performance', () => {
        it('should complete staff hiring within performance threshold', async () => {
            const startTime = Date.now();
            const result = await staffService.hireStaff(context, {
                guildId: testGuildId,
                userId: 'perf-test-user',
                hiredBy: adminUserId,
                robloxUsername: 'PerfTestUser',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_OPERATION_MS);
        });
        it('should complete case creation within performance threshold', async () => {
            const startTime = Date.now();
            const testCase = await caseService.createCase(context, {
                guildId: testGuildId,
                clientId: 'perf-test-client',
                clientUsername: 'perftestclient',
                title: 'Performance Test Case',
                description: 'Testing case creation performance',
                priority: case_1.CasePriority.MEDIUM
            });
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(testCase).toBeDefined();
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_OPERATION_MS);
        });
        it('should complete staff promotion within performance threshold', async () => {
            // Setup: hire staff first
            await staffService.hireStaff(context, {
                guildId: testGuildId,
                userId: 'promotion-perf-test',
                hiredBy: adminUserId,
                robloxUsername: 'PromotionPerfTest',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            const startTime = Date.now();
            const result = await staffService.promoteStaff(context, {
                guildId: testGuildId,
                userId: 'promotion-perf-test',
                promotedBy: adminUserId,
                newRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_OPERATION_MS);
        });
    });
    describe('Bulk Operation Performance', () => {
        it('should handle bulk staff hiring efficiently', async () => {
            const bulkSize = 50;
            const startTime = Date.now();
            const hirePromises = Array.from({ length: bulkSize }, (_, i) => staffService.hireStaff(context, {
                guildId: testGuildId,
                userId: `bulk-staff-${i}`,
                hiredBy: adminUserId,
                robloxUsername: `BulkStaff${i}`,
                role: staff_role_1.StaffRole.PARALEGAL
            }));
            const results = await Promise.all(hirePromises);
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Verify all succeeded (within role limits)
            const successCount = results.filter(r => r.success).length;
            expect(successCount).toBeGreaterThan(0);
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_MS);
            // Verify performance per operation
            const avgTimePerOperation = duration / bulkSize;
            expect(avgTimePerOperation).toBeLessThan(200); // 200ms per operation
        });
        it('should handle bulk case creation efficiently', async () => {
            const bulkSize = 100;
            const startTime = Date.now();
            const casePromises = Array.from({ length: bulkSize }, (_, i) => caseService.createCase(context, {
                guildId: testGuildId,
                clientId: `bulk-client-${i}`,
                clientUsername: `bulkclient${i}`,
                title: `Bulk Case ${i}`,
                description: `Bulk test case ${i}`,
                priority: case_1.CasePriority.MEDIUM
            }));
            const results = await Promise.all(casePromises);
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(results.length).toBe(bulkSize);
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_MS);
            // Verify case number uniqueness
            const caseNumbers = results.map(c => c.caseNumber);
            const uniqueCaseNumbers = new Set(caseNumbers);
            expect(uniqueCaseNumbers.size).toBe(bulkSize);
        });
        it('should handle mixed bulk operations efficiently', async () => {
            const operationCount = 200;
            const startTime = Date.now();
            const mixedOperations = [];
            // Mix of staff and case operations
            for (let i = 0; i < operationCount; i++) {
                if (i % 2 === 0) {
                    // Staff operations
                    mixedOperations.push(staffService.hireStaff(context, {
                        guildId: testGuildId,
                        userId: `mixed-staff-${i}`,
                        hiredBy: adminUserId,
                        robloxUsername: `MixedStaff${i}`,
                        role: staff_role_1.StaffRole.PARALEGAL
                    }));
                }
                else {
                    // Case operations
                    mixedOperations.push(caseService.createCase(context, {
                        guildId: testGuildId,
                        clientId: `mixed-client-${i}`,
                        clientUsername: `mixedclient${i}`,
                        title: `Mixed Case ${i}`,
                        description: `Mixed operation test case ${i}`
                    }));
                }
            }
            const results = await Promise.allSettled(mixedOperations);
            const endTime = Date.now();
            const duration = endTime - startTime;
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBeGreaterThan(operationCount * 0.8); // At least 80% success
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_MS * 2);
        });
    });
    describe('Search and Query Performance', () => {
        beforeEach(async () => {
            // Setup test data for search performance
            const dataSetupPromises = [];
            // Create staff members
            for (let i = 0; i < 100; i++) {
                dataSetupPromises.push(staffService.hireStaff(context, {
                    guildId: testGuildId,
                    userId: `search-staff-${i}`,
                    hiredBy: adminUserId,
                    robloxUsername: `SearchStaff${i}`,
                    role: staff_role_1.StaffRole.PARALEGAL
                }));
            }
            // Create cases
            for (let i = 0; i < 200; i++) {
                dataSetupPromises.push(caseService.createCase(context, {
                    guildId: testGuildId,
                    clientId: `search-client-${i}`,
                    clientUsername: `searchclient${i}`,
                    title: `Search Test Case ${i}`,
                    description: `Case for search performance testing ${i}`,
                    priority: Object.values(case_1.CasePriority)[i % 4]
                }));
            }
            await Promise.allSettled(dataSetupPromises);
        });
        it('should perform staff search efficiently', async () => {
            const startTime = Date.now();
            const staffList = await staffService.getStaffList(context);
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(staffList.staff.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_OPERATION_MS);
        });
        it('should perform case search efficiently', async () => {
            const startTime = Date.now();
            const cases = await caseService.searchCases(context, {
                guildId: testGuildId,
                title: 'Search Test'
            });
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(cases.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_OPERATION_MS);
        });
        it('should perform filtered searches efficiently', async () => {
            const searchTests = [
                () => caseService.searchCases(context, { guildId: testGuildId, priority: case_1.CasePriority.HIGH }),
                () => caseService.searchCases(context, { guildId: testGuildId, status: case_1.CaseStatus.PENDING }),
                () => staffService.getStaffList(context, staff_role_1.StaffRole.PARALEGAL),
                () => staffService.getRoleCounts(context)
            ];
            for (const searchTest of searchTests) {
                const startTime = Date.now();
                const result = await searchTest();
                const endTime = Date.now();
                const duration = endTime - startTime;
                expect(result).toBeDefined();
                expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_OPERATION_MS);
            }
        });
        it('should handle complex search queries efficiently', async () => {
            const startTime = Date.now();
            const complexSearch = await caseService.searchCases(context, {
                guildId: testGuildId,
                title: 'Test',
                priority: case_1.CasePriority.MEDIUM,
                status: case_1.CaseStatus.PENDING
            });
            const endTime = Date.now();
            const duration = endTime - startTime;
            expect(complexSearch).toBeDefined();
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_OPERATION_MS);
        });
    });
    describe('Concurrent Load Testing', () => {
        it('should handle high concurrent read operations', async () => {
            const concurrentReads = 100;
            const startTime = Date.now();
            // Setup some data first
            await staffService.hireStaff(context, {
                guildId: testGuildId,
                userId: 'concurrent-read-test',
                hiredBy: adminUserId,
                robloxUsername: 'ConcurrentReadTest',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            // Concurrent read operations
            const readOperations = Array.from({ length: concurrentReads }, (_, i) => {
                const operation = i % 4;
                switch (operation) {
                    case 0:
                        return staffService.getStaffList(context);
                    case 1:
                        return staffService.getStaffInfo(context, 'concurrent-read-test');
                    case 2:
                        return caseService.searchCases(context, { guildId: testGuildId });
                    case 3:
                        return staffService.getRoleCounts(context);
                    default:
                        return staffService.getStaffList(context);
                }
            });
            const results = await Promise.allSettled(readOperations);
            const endTime = Date.now();
            const duration = endTime - startTime;
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBeGreaterThan(concurrentReads * 0.95); // 95% success rate
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS_MS);
        });
        it('should handle mixed concurrent read/write operations', async () => {
            const totalOperations = 50;
            const startTime = Date.now();
            const mixedOperations = Array.from({ length: totalOperations }, (_, i) => {
                if (i % 3 === 0) {
                    // Write operations (fewer)
                    return operationQueue.enqueue(() => staffService.hireStaff(context, {
                        guildId: testGuildId,
                        userId: `concurrent-mixed-${i}`,
                        hiredBy: adminUserId,
                        robloxUsername: `ConcurrentMixed${i}`,
                        role: staff_role_1.StaffRole.PARALEGAL
                    }), `user-${i}`, testGuildId, false);
                }
                else {
                    // Read operations (more frequent)
                    return staffService.getStaffList(context);
                }
            });
            const results = await Promise.allSettled(mixedOperations);
            const endTime = Date.now();
            const duration = endTime - startTime;
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBeGreaterThan(totalOperations * 0.8); // 80% success rate
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS_MS);
        });
        it('should maintain performance under sustained load', async () => {
            const sustainedDuration = 5000; // 5 seconds
            const operationInterval = 100; // Every 100ms
            const operations = [];
            const startTime = Date.now();
            let operationCount = 0;
            const sustainedLoadInterval = setInterval(() => {
                operationCount++;
                operations.push(staffService.getStaffList(context));
            }, operationInterval);
            // Run for sustained duration
            await new Promise(resolve => setTimeout(resolve, sustainedDuration));
            clearInterval(sustainedLoadInterval);
            const results = await Promise.allSettled(operations);
            const endTime = Date.now();
            const actualDuration = endTime - startTime;
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const successRate = successCount / operations.length;
            expect(successRate).toBeGreaterThan(0.9); // 90% success rate under sustained load
            expect(actualDuration).toBeGreaterThan(sustainedDuration * 0.9); // Should run for expected duration
        });
    });
    describe('Scalability Testing', () => {
        it('should scale with increasing data volume', async () => {
            const scalingTests = [10, 50, 100, 200];
            for (const dataSize of scalingTests) {
                // Clear previous test data
                await test_utils_1.TestUtils.clearTestDatabase();
                // Create test data
                const setupPromises = Array.from({ length: dataSize }, (_, i) => caseService.createCase(context, {
                    guildId: testGuildId,
                    clientId: `scale-client-${i}`,
                    clientUsername: `scaleclient${i}`,
                    title: `Scale Test Case ${i}`,
                    description: `Scalability test case ${i}`
                }));
                await Promise.all(setupPromises);
                // Test search performance with increasing data
                const startTime = Date.now();
                const searchResult = await caseService.searchCases(context, { guildId: testGuildId });
                const endTime = Date.now();
                const duration = endTime - startTime;
                expect(searchResult.length).toBe(dataSize);
                // Performance should degrade gracefully with data size
                const maxAcceptableDuration = Math.min(PERFORMANCE_THRESHOLDS.SEARCH_OPERATION_MS * (dataSize / 10), 5000 // Cap at 5 seconds
                );
                expect(duration).toBeLessThan(maxAcceptableDuration);
            }
        });
        it('should handle queue scaling efficiently', async () => {
            const queueSizes = [50, 100, 200, 500];
            for (const queueSize of queueSizes) {
                operationQueue.clearQueue();
                const startTime = Date.now();
                // Fill queue
                const queuedOperations = Array.from({ length: queueSize }, (_, i) => operationQueue.enqueue(() => Promise.resolve(`queued-operation-${i}`), `user-${i}`, testGuildId, false));
                await Promise.all(queuedOperations);
                const endTime = Date.now();
                const duration = endTime - startTime;
                // Queue processing should scale reasonably
                const maxAcceptableDuration = queueSize * 10; // 10ms per operation
                expect(duration).toBeLessThan(maxAcceptableDuration);
            }
        });
    });
    describe.skip('Memory and Resource Usage', () => {
        it('should maintain reasonable memory usage during bulk operations', async () => {
            const getMemoryUsage = () => {
                const usage = process.memoryUsage();
                return usage.heapUsed / 1024 / 1024; // Convert to MB
            };
            const initialMemory = getMemoryUsage();
            // Perform memory-intensive operations
            const bulkOperations = Array.from({ length: 1000 }, (_, i) => caseService.createCase(context, {
                guildId: testGuildId,
                clientId: `memory-client-${i}`,
                clientUsername: `memoryclient${i}`,
                title: `Memory Test Case ${i}`,
                description: `Memory usage test case with longer description to increase memory footprint ${i}`
            }));
            await Promise.allSettled(bulkOperations);
            const peakMemory = getMemoryUsage();
            const memoryIncrease = peakMemory - initialMemory;
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            const finalMemory = getMemoryUsage();
            expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB);
            expect(finalMemory).toBeLessThan(peakMemory); // Memory should be released
        });
        it('should handle resource cleanup efficiently', async () => {
            // Create and clean up resources
            for (let cycle = 0; cycle < 5; cycle++) {
                const cycleOperations = Array.from({ length: 100 }, () => staffService.getStaffList(context));
                await Promise.allSettled(cycleOperations);
                // Allow time for cleanup
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            // System should remain stable after multiple cycles
            const finalTest = await staffService.getStaffList(context);
            expect(finalTest).toBeDefined();
        });
    });
    describe('Database Query Optimization', () => {
        it('should perform efficient database queries', async () => {
            // Setup large dataset
            const setupSize = 500;
            const setupPromises = [];
            for (let i = 0; i < setupSize; i++) {
                if (i % 2 === 0) {
                    setupPromises.push(staffService.hireStaff(context, {
                        guildId: testGuildId,
                        userId: `query-staff-${i}`,
                        hiredBy: adminUserId,
                        robloxUsername: `QueryStaff${i}`,
                        role: staff_role_1.StaffRole.PARALEGAL
                    }));
                }
                else {
                    setupPromises.push(caseService.createCase(context, {
                        guildId: testGuildId,
                        clientId: `query-client-${i}`,
                        clientUsername: `queryclient${i}`,
                        title: `Query Test Case ${i}`,
                        description: `Database query optimization test ${i}`
                    }));
                }
            }
            await Promise.allSettled(setupPromises);
            // Test query performance
            const queryTests = [
                () => staffRepository.findByFilters({ guildId: testGuildId }),
                () => caseRepository.findByFilters({ guildId: testGuildId }),
                () => staffRepository.findByRole(testGuildId, staff_role_1.StaffRole.PARALEGAL),
                () => auditLogRepository.findByFilters({ guildId: testGuildId })
            ];
            for (const queryTest of queryTests) {
                const startTime = Date.now();
                const result = await queryTest();
                const endTime = Date.now();
                const duration = endTime - startTime;
                expect(result).toBeDefined();
                expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_OPERATION_MS);
            }
        });
    });
});
//# sourceMappingURL=load-testing.test.js.map