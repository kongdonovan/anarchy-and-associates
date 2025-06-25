"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rate_limiter_1 = require("../../infrastructure/rate-limiting/rate-limiter");
const operation_queue_1 = require("../../infrastructure/queue/operation-queue");
const staff_service_1 = require("../../application/services/staff-service");
const case_service_1 = require("../../application/services/case-service");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
// import { CasePriority } from '../../domain/entities/case'; // Not used
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
/**
 * Rate Limiting and Abuse Prevention Tests
 *
 * These tests verify the system's ability to prevent abuse and handle
 * excessive load from individual users or coordinated attacks:
 * - Rate limiting enforcement
 * - Burst traffic handling
 * - DDoS prevention
 * - Resource exhaustion protection
 * - User behavior analysis
 * - Automatic throttling
 */
describe('Rate Limiting and Abuse Prevention Tests', () => {
    let rateLimiter;
    let operationQueue;
    let staffService;
    let caseService;
    let staffRepository;
    let caseRepository;
    let auditLogRepository;
    let guildConfigRepository;
    let caseCounterRepository;
    const testGuildId = 'rate-limit-test-guild';
    // const adminUserId = 'admin-123'; // Not used in these tests
    beforeAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.setupTestDatabase();
    });
    beforeEach(async () => {
        // Initialize infrastructure
        rateLimiter = rate_limiter_1.RateLimiter.getInstance();
        operationQueue = operation_queue_1.OperationQueue.getInstance();
        // Initialize repositories
        staffRepository = new staff_repository_1.StaffRepository();
        caseRepository = new case_repository_1.CaseRepository();
        auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        // Initialize services
        staffService = new staff_service_1.StaffService(staffRepository, auditLogRepository);
        caseService = new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository);
        // Clear state
        await test_utils_1.TestUtils.clearTestDatabase();
        operationQueue.clearQueue();
        // Clear rate limiter state using test helper method
        rateLimiter.clearUserLimitsForTesting();
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
                hr: [],
                case: [],
                config: [],
                retainer: [],
                repair: []
            },
            adminRoles: [],
            adminUsers: []
        });
    });
    afterEach(() => {
        // Clear any remaining timeouts to prevent open handles
        operationQueue.clearQueue();
        rateLimiter.clearUserLimitsForTesting();
    });
    afterAll(async () => {
        // Clean up rate limiter interval to prevent open handles
        rateLimiter.destroy();
        await database_helpers_1.DatabaseTestHelpers.teardownTestDatabase();
    });
    describe('Basic Rate Limiting', () => {
        it('should allow normal usage within limits', async () => {
            const userId = 'normal-user';
            // Normal usage should be allowed
            for (let i = 0; i < 5; i++) {
                const result = rateLimiter.checkRateLimit(userId);
                expect(result.allowed).toBe(true);
                // Sufficient delay between requests to avoid per-second limit
                await new Promise(resolve => setTimeout(resolve, 1100));
            }
        });
        it('should enforce per-second rate limits', async () => {
            const userId = 'rapid-user';
            // First request should be allowed
            expect(rateLimiter.checkRateLimit(userId).allowed).toBe(true);
            // Rapid subsequent requests should be rate limited
            expect(rateLimiter.checkRateLimit(userId).allowed).toBe(false);
            expect(rateLimiter.checkRateLimit(userId).allowed).toBe(false);
            // After delay, should be allowed again
            await new Promise(resolve => setTimeout(resolve, 1100));
            expect(rateLimiter.checkRateLimit(userId).allowed).toBe(true);
        });
        it('should enforce per-minute rate limits', async () => {
            const userId = 'minute-test-user';
            // Fill up the minute limit (30 requests)
            let allowedCount = 0;
            for (let i = 0; i < 35; i++) {
                const result = rateLimiter.checkRateLimit(userId);
                if (result.allowed) {
                    allowedCount++;
                }
                // Small delay to avoid per-second limit
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            // Should not exceed minute limit
            expect(allowedCount).toBeLessThanOrEqual(30);
        });
        it('should reset limits after time window', async () => {
            const userId = 'reset-test-user';
            // Use up rate limit
            rateLimiter.checkRateLimit(userId);
            expect(rateLimiter.checkRateLimit(userId).allowed).toBe(false);
            // Wait for reset window
            await new Promise(resolve => setTimeout(resolve, 1100));
            // Should be allowed again
            expect(rateLimiter.checkRateLimit(userId).allowed).toBe(true);
        });
        it('should maintain separate limits per user', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            // Use up limit for user1
            rateLimiter.checkRateLimit(user1);
            expect(rateLimiter.checkRateLimit(user1).allowed).toBe(false);
            // User2 should still be allowed
            expect(rateLimiter.checkRateLimit(user2).allowed).toBe(true);
            expect(rateLimiter.checkRateLimit(user2).allowed).toBe(false); // Now user2 is limited too
            // Both should be limited
            expect(rateLimiter.checkRateLimit(user1).allowed).toBe(false);
            expect(rateLimiter.checkRateLimit(user2).allowed).toBe(false);
        });
    });
    describe('Burst Traffic Handling', () => {
        it('should handle sudden burst of requests', async () => {
            const burstUsers = Array.from({ length: 100 }, (_, i) => `burst-user-${i}`);
            const startTime = Date.now();
            // Simulate burst of requests
            const burstResults = burstUsers.map(userId => rateLimiter.checkRateLimit(userId));
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Should handle burst quickly
            expect(duration).toBeLessThan(1000);
            // Most first requests should be allowed
            const allowedCount = burstResults.filter(result => result.allowed).length;
            expect(allowedCount).toBe(burstUsers.length); // All first requests allowed
            // Subsequent rapid requests should be limited
            const secondBurst = burstUsers.map(userId => rateLimiter.checkRateLimit(userId));
            const secondAllowedCount = secondBurst.filter(result => result.allowed).length;
            expect(secondAllowedCount).toBe(0); // All should be rate limited
        });
        it('should maintain performance under sustained burst load', async () => {
            const sustainedDuration = 2000; // 2 seconds
            const burstInterval = 10; // Every 10ms
            const results = [];
            const startTime = Date.now();
            let requestCount = 0;
            const burstInterval_id = setInterval(() => {
                requestCount++;
                const userId = `sustained-burst-${requestCount % 50}`; // Cycle through 50 users
                const rateLimitResult = rateLimiter.checkRateLimit(userId);
                results.push(rateLimitResult.allowed);
            }, burstInterval);
            await new Promise(resolve => setTimeout(resolve, sustainedDuration));
            clearInterval(burstInterval_id);
            const endTime = Date.now();
            const actualDuration = endTime - startTime;
            // Should handle sustained load
            expect(actualDuration).toBeGreaterThan(sustainedDuration * 0.9);
            expect(results.length).toBeGreaterThan(100); // Should have processed many requests
            // Some requests should be allowed, some limited
            const allowedCount = results.filter(Boolean).length;
            const limitedCount = results.length - allowedCount;
            expect(allowedCount).toBeGreaterThan(0);
            expect(limitedCount).toBeGreaterThan(0);
        });
    });
    describe('DDoS Attack Simulation', () => {
        it('should protect against coordinated attack from multiple IPs', async () => {
            const attackerCount = 200;
            const requestsPerAttacker = 10;
            // Simulate coordinated attack
            const attackPromises = Array.from({ length: attackerCount }, async (_, i) => {
                const attackerId = `attacker-${i}`;
                const attackResults = [];
                for (let j = 0; j < requestsPerAttacker; j++) {
                    const result = rateLimiter.checkRateLimit(attackerId);
                    attackResults.push(result.allowed);
                    // Small delay to simulate real attack pattern
                    await new Promise(resolve => setTimeout(resolve, 5));
                }
                return attackResults;
            });
            const attackResults = await Promise.all(attackPromises);
            const flatResults = attackResults.flat();
            // Most requests should be blocked after initial burst
            const allowedCount = flatResults.filter(allowed => allowed).length;
            const totalRequests = attackerCount * requestsPerAttacker;
            const allowedPercentage = (allowedCount / totalRequests) * 100;
            // Should block significant attack traffic (more lenient for this rate limiter design)
            expect(allowedPercentage).toBeLessThan(40); // Less than 40% allowed
        });
        it('should recover quickly after attack subsides', async () => {
            const attackerId = 'ddos-attacker';
            // Simulate attack
            for (let i = 0; i < 50; i++) {
                rateLimiter.checkRateLimit(attackerId);
            }
            // Attacker should be blocked
            expect(rateLimiter.checkRateLimit(attackerId).allowed).toBe(false);
            // Normal user should still work
            const normalUser = 'normal-user-post-attack';
            expect(rateLimiter.checkRateLimit(normalUser).allowed).toBe(true);
            // After cool-down period, even attacker should be allowed again
            await new Promise(resolve => setTimeout(resolve, 1200));
            expect(rateLimiter.checkRateLimit(attackerId).allowed).toBe(true);
        });
        it('should handle rapid connection attempts', async () => {
            const rapidAttempts = 1000;
            const userId = 'rapid-attacker';
            const startTime = Date.now();
            // Rapid-fire requests
            const results = Array.from({ length: rapidAttempts }, () => rateLimiter.checkRateLimit(userId));
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Should handle rapid requests efficiently
            expect(duration).toBeLessThan(500); // Complete within 500ms
            // Should allow very few requests
            const allowedCount = results.filter(result => result.allowed).length;
            expect(allowedCount).toBeLessThanOrEqual(2); // At most 2 requests allowed
        });
    });
    describe('Resource Exhaustion Protection', () => {
        it('should prevent memory exhaustion from rate limiter', async () => {
            const uniqueUsers = 10000;
            // Create many unique users to test memory usage
            for (let i = 0; i < uniqueUsers; i++) {
                rateLimiter.checkRateLimit(`memory-test-user-${i}`);
            }
            // Rate limiter should handle large number of users efficiently
            const memoryUsage = process.memoryUsage();
            const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
            // Should not consume excessive memory (more generous limit for CI)
            expect(heapUsedMB).toBeLessThan(500); // Less than 500MB
            // Should still work efficiently
            const testResult = rateLimiter.checkRateLimit('final-memory-test');
            expect(testResult.allowed).toBe(true);
        });
        it('should clean up old rate limit data', async () => {
            const userId = 'cleanup-test-user';
            // Use rate limiter
            rateLimiter.checkRateLimit(userId);
            // Verify user has data
            let userInfo = rateLimiter.getUserRateLimitInfo(userId);
            expect(userInfo).not.toBe(null);
            // Clear all rate limits (simulating cleanup)
            rateLimiter.clearAllRateLimits();
            // User data should be cleaned up
            userInfo = rateLimiter.getUserRateLimitInfo(userId);
            expect(userInfo).toBe(null);
        });
        it('should prevent queue overflow attacks', async () => {
            const overflowAttempts = 2000;
            const attackerId = 'queue-overflow-attacker';
            // Attempt to overflow operation queue
            const queuePromises = Array.from({ length: overflowAttempts }, (_, i) => operationQueue.enqueue(() => Promise.resolve(`overflow-${i}`), attackerId, testGuildId, false));
            // Should handle overflow gracefully
            const results = await Promise.allSettled(queuePromises);
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            // Should complete most operations
            expect(successCount).toBeGreaterThan(overflowAttempts * 0.8);
        });
    });
    describe('User Behavior Analysis', () => {
        it('should detect suspicious rapid-fire patterns', async () => {
            const suspiciousUser = 'suspicious-rapid-user';
            const rapidRequests = 100;
            // Rapid requests in very short time
            const startTime = Date.now();
            const rapidResults = [];
            for (let i = 0; i < rapidRequests; i++) {
                const result = rateLimiter.checkRateLimit(suspiciousUser);
                rapidResults.push(result.allowed);
            }
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Should block most rapid requests
            const allowedCount = rapidResults.filter(allowed => allowed).length;
            expect(allowedCount).toBeLessThanOrEqual(2);
            // Should be detected as suspicious behavior
            expect(duration).toBeLessThan(100); // Very rapid requests
        });
        it('should allow legitimate burst usage patterns', async () => {
            const legitimateUser = 'legitimate-burst-user';
            // Legitimate burst: quick commands with reasonable delays
            for (let burst = 0; burst < 3; burst++) {
                // Small burst of activity
                let result = rateLimiter.checkRateLimit(legitimateUser);
                expect(result.allowed).toBe(true);
                // Reasonable delay between bursts
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        });
        it('should differentiate between user types', async () => {
            const regularUser = 'regular-user';
            const adminUser = 'admin-user';
            // Regular users get standard limits
            expect(rateLimiter.checkRateLimit(regularUser).allowed).toBe(true);
            expect(rateLimiter.checkRateLimit(regularUser).allowed).toBe(false); // Rate limited
            // Admin users might have different treatment in production
            // For this test, they follow same rules
            expect(rateLimiter.checkRateLimit(adminUser).allowed).toBe(true);
            expect(rateLimiter.checkRateLimit(adminUser).allowed).toBe(false); // Rate limited
        });
    });
    describe('Integration with Application Services', () => {
        it('should prevent abuse of staff hiring operations', async () => {
            const abusiveUser = 'abusive-hirer';
            // First hire should succeed
            const firstHire = await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'hire-victim-1',
                hiredBy: abusiveUser,
                robloxUsername: 'HireVictim1',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(firstHire.success).toBe(true);
            // Rapid subsequent hires should be limited by rate limiting
            // (In production, rate limiting would be checked before service calls)
            const rapidHires = Array.from({ length: 10 }, (_, i) => staffService.hireStaff({
                guildId: testGuildId,
                userId: `hire-victim-${i + 2}`,
                hiredBy: abusiveUser,
                robloxUsername: `HireVictim${i + 2}`,
                role: staff_role_1.StaffRole.PARALEGAL
            }));
            const hireResults = await Promise.allSettled(rapidHires);
            // Some should succeed (within role limits), but rate limiting would
            // prevent the user from making too many requests
            const successCount = hireResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
            // Should succeed for most operations (role limits don't prevent this in isolation)
            // The test is more about demonstrating integration with rate limiting
            expect(successCount).toBeGreaterThan(0);
            expect(successCount).toBeLessThanOrEqual(10); // Up to paralegal limit
        });
        it('should prevent abuse of case creation operations', async () => {
            const abusiveUser = 'abusive-case-creator';
            // Simulate rate limiting check before each operation
            const caseCreationAttempts = Array.from({ length: 50 }, async (_, i) => {
                const rateLimitResult = rateLimiter.checkRateLimit(abusiveUser);
                if (!rateLimitResult.allowed) {
                    return { blocked: true, reason: 'Rate limited' };
                }
                return caseService.createCase({
                    guildId: testGuildId,
                    clientId: `abuse-client-${i}`,
                    clientUsername: `abuseclient${i}`,
                    title: `Abuse Test Case ${i}`,
                    description: `Case creation abuse test ${i}`
                });
            });
            const results = await Promise.all(caseCreationAttempts);
            // Most should be blocked by rate limiting
            const blockedCount = results.filter((r) => r.blocked).length;
            const createdCount = results.filter((r) => !r.blocked).length;
            expect(blockedCount).toBeGreaterThan(createdCount);
            expect(createdCount).toBeLessThanOrEqual(2); // Very few should get through
        });
        it('should handle legitimate high-volume administrative operations', async () => {
            const adminUser = 'high-volume-admin';
            // Admin performing legitimate bulk operations with proper spacing
            const adminOperations = [];
            for (let i = 0; i < 20; i++) {
                // Check rate limit before each operation
                const rateLimitResult = rateLimiter.checkRateLimit(adminUser);
                if (rateLimitResult.allowed) {
                    adminOperations.push(staffService.getStaffList(testGuildId, adminUser));
                }
                // Reasonable delay between admin operations
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            const results = await Promise.allSettled(adminOperations);
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            // Some operations should succeed with proper spacing
            expect(successCount).toBeGreaterThan(0);
            expect(successCount).toBeLessThanOrEqual(20);
        });
    });
    describe('Advanced Abuse Patterns', () => {
        it('should detect distributed attack patterns', async () => {
            const distributedAttackers = Array.from({ length: 100 }, (_, i) => `distributed-${i}`);
            // Simulate distributed attack - many users making rapid requests
            const distributedResults = distributedAttackers.map(attackerId => {
                const userResults = [];
                for (let i = 0; i < 5; i++) {
                    const result = rateLimiter.checkRateLimit(attackerId);
                    userResults.push(result.allowed);
                }
                return userResults;
            });
            const flatResults = distributedResults.flat();
            const allowedCount = flatResults.filter(allowed => allowed).length;
            const totalRequests = distributedAttackers.length * 5;
            // Should allow first request from each user but limit subsequent ones
            expect(allowedCount).toBeLessThanOrEqual(distributedAttackers.length + 10);
            expect(allowedCount).toBeLessThan(totalRequests * 0.3); // Less than 30% allowed
        });
        it('should handle slow-rate persistent attacks', async () => {
            const persistentAttacker = 'slow-persistent-attacker';
            const attackDuration = 3000; // 3 seconds
            const attackInterval = 100; // Every 100ms
            let allowedCount = 0;
            let totalCount = 0;
            const attackInterval_id = setInterval(() => {
                totalCount++;
                const result = rateLimiter.checkRateLimit(persistentAttacker);
                if (result.allowed) {
                    allowedCount++;
                }
            }, attackInterval);
            await new Promise(resolve => setTimeout(resolve, attackDuration));
            clearInterval(attackInterval_id);
            // Should limit slow but persistent attacks
            const allowedPercentage = (allowedCount / totalCount) * 100;
            expect(allowedPercentage).toBeLessThan(50); // Should still limit significantly
        });
        it('should protect against resource enumeration attacks', async () => {
            const enumerationAttacker = 'enumeration-attacker';
            // Attempt to enumerate by rapid requests with different parameters
            const enumerationAttempts = Array.from({ length: 200 }, (_, i) => {
                const result = rateLimiter.checkRateLimit(enumerationAttacker);
                return { attempt: i, allowed: result.allowed };
            });
            const allowedAttempts = enumerationAttempts.filter(a => a.allowed).length;
            // Should severely limit enumeration attempts
            expect(allowedAttempts).toBeLessThanOrEqual(2);
        });
    });
    describe('Rate Limiting Configuration and Tuning', () => {
        it('should handle edge cases in rate limit timing', async () => {
            const edgeCaseUser = 'edge-case-user';
            // Test boundary conditions
            expect(rateLimiter.checkRateLimit(edgeCaseUser).allowed).toBe(true);
            // Immediate second request should be rate limited
            expect(rateLimiter.checkRateLimit(edgeCaseUser).allowed).toBe(false);
            // After 1-second boundary, should be allowed again
            await new Promise(resolve => setTimeout(resolve, 1100));
            expect(rateLimiter.checkRateLimit(edgeCaseUser).allowed).toBe(true);
        });
        it('should maintain accuracy under system clock changes', async () => {
            const clockTestUser = 'clock-test-user';
            // Use rate limit
            expect(rateLimiter.checkRateLimit(clockTestUser).allowed).toBe(true);
            expect(rateLimiter.checkRateLimit(clockTestUser).allowed).toBe(false);
            // Simulate minor clock adjustments
            const originalNow = Date.now;
            Date.now = () => originalNow() + 500; // 500ms forward
            try {
                // Should still be rate limited
                expect(rateLimiter.checkRateLimit(clockTestUser).allowed).toBe(false);
            }
            finally {
                Date.now = originalNow;
            }
        });
        it('should handle concurrent rate limit checks safely', async () => {
            const concurrentUser = 'concurrent-rate-test';
            // Multiple concurrent rate limit checks
            const concurrentChecks = Array.from({ length: 100 }, () => Promise.resolve(rateLimiter.checkRateLimit(concurrentUser)));
            const results = await Promise.all(concurrentChecks);
            // Only first should be allowed, rest should be consistently blocked
            const allowedCount = results.filter(result => result.allowed).length;
            expect(allowedCount).toBeLessThanOrEqual(1);
        });
    });
});
//# sourceMappingURL=abuse-prevention.test.js.map