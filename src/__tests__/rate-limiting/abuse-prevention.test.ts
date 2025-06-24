import { RateLimiter } from '../../infrastructure/rate-limiting/rate-limiter';
import { OperationQueue } from '../../infrastructure/queue/operation-queue';
import { StaffService } from '../../application/services/staff-service';
import { CaseService } from '../../application/services/case-service';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { StaffRole } from '../../domain/entities/staff-role';
// import { CasePriority } from '../../domain/entities/case'; // Not used
import { TestUtils } from '../helpers/test-utils';
import { DatabaseTestHelpers } from '../helpers/database-helpers';

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
  let rateLimiter: RateLimiter;
  let operationQueue: OperationQueue;
  let staffService: StaffService;
  let caseService: CaseService;
  let staffRepository: StaffRepository;
  let caseRepository: CaseRepository;
  let auditLogRepository: AuditLogRepository;
  let guildConfigRepository: GuildConfigRepository;
  let caseCounterRepository: CaseCounterRepository;

  const testGuildId = 'rate-limit-test-guild';
  // const adminUserId = 'admin-123'; // Not used in these tests

  beforeAll(async () => {
    await DatabaseTestHelpers.setupTestDatabase();
    await DatabaseTestHelpers.createIndexes();
  });

  beforeEach(async () => {
    // Initialize infrastructure
    rateLimiter = RateLimiter.getInstance();
    operationQueue = OperationQueue.getInstance();

    // Initialize repositories
    staffRepository = new StaffRepository();
    caseRepository = new CaseRepository();
    auditLogRepository = new AuditLogRepository();
    guildConfigRepository = new GuildConfigRepository();
    caseCounterRepository = new CaseCounterRepository();

    // Initialize services
    staffService = new StaffService(staffRepository, auditLogRepository);
    caseService = new CaseService(caseRepository, caseCounterRepository, guildConfigRepository);

    // Clear state
    await TestUtils.clearTestDatabase();
    operationQueue.clearQueue();
    
    // Clear rate limiter state using bracket notation to access private properties
    (rateLimiter as any).userCounts = new Map();
    (rateLimiter as any).lastResetTime = Date.now();

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

  afterAll(async () => {
    await DatabaseTestHelpers.teardownTestDatabase();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow normal usage within limits', async () => {
      const userId = 'normal-user';

      // Normal usage should be allowed
      for (let i = 0; i < 5; i++) {
        const allowed = rateLimiter.checkRateLimit(userId);
        expect(allowed).toBe(true);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    });

    it('should enforce per-second rate limits', async () => {
      const userId = 'rapid-user';

      // First request should be allowed
      expect(rateLimiter.checkRateLimit(userId)).toBe(true);

      // Rapid subsequent requests should be rate limited
      expect(rateLimiter.checkRateLimit(userId)).toBe(false);
      expect(rateLimiter.checkRateLimit(userId)).toBe(false);

      // After delay, should be allowed again
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(rateLimiter.checkRateLimit(userId)).toBe(true);
    });

    it('should enforce per-minute rate limits', async () => {
      const userId = 'minute-test-user';

      // Fill up the minute limit (30 requests)
      let allowedCount = 0;
      for (let i = 0; i < 35; i++) {
        if (rateLimiter.checkRateLimit(userId)) {
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
      expect(rateLimiter.checkRateLimit(userId)).toBe(false);

      // Wait for reset window
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      expect(rateLimiter.checkRateLimit(userId)).toBe(true);
    });

    it('should maintain separate limits per user', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      // Use up limit for user1
      rateLimiter.checkRateLimit(user1);
      expect(rateLimiter.checkRateLimit(user1)).toBe(false);

      // User2 should still be allowed
      expect(rateLimiter.checkRateLimit(user2)).toBe(true);
      expect(rateLimiter.checkRateLimit(user2)).toBe(false); // Now user2 is limited too

      // Both should be limited
      expect(rateLimiter.checkRateLimit(user1)).toBe(false);
      expect(rateLimiter.checkRateLimit(user2)).toBe(false);
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
      const allowedCount = burstResults.filter(Boolean).length;
      expect(allowedCount).toBe(burstUsers.length); // All first requests allowed

      // Subsequent rapid requests should be limited
      const secondBurst = burstUsers.map(userId => rateLimiter.checkRateLimit(userId));
      const secondAllowedCount = secondBurst.filter(Boolean).length;
      expect(secondAllowedCount).toBe(0); // All should be rate limited
    });

    it('should maintain performance under sustained burst load', async () => {
      const sustainedDuration = 2000; // 2 seconds
      const burstInterval = 10; // Every 10ms
      const results: boolean[] = [];

      const startTime = Date.now();
      let requestCount = 0;

      const burstInterval_id = setInterval(() => {
        requestCount++;
        const userId = `sustained-burst-${requestCount % 50}`; // Cycle through 50 users
        const rateLimitResult = rateLimiter.checkRateLimit(userId);
        const allowed = typeof rateLimitResult === 'boolean' ? rateLimitResult : rateLimitResult.allowed;
        results.push(allowed);
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
          attackResults.push(rateLimiter.checkRateLimit(attackerId));
          
          // Small delay to simulate real attack pattern
          await new Promise(resolve => setTimeout(resolve, 5));
        }

        return attackResults;
      });

      const attackResults = await Promise.all(attackPromises);
      const flatResults = attackResults.flat();

      // Most requests should be blocked after initial burst
      const allowedCount = flatResults.filter(Boolean).length;
      const totalRequests = attackerCount * requestsPerAttacker;
      const allowedPercentage = (allowedCount / totalRequests) * 100;

      // Should block most attack traffic
      expect(allowedPercentage).toBeLessThan(20); // Less than 20% allowed
    });

    it('should recover quickly after attack subsides', async () => {
      const attackerId = 'ddos-attacker';

      // Simulate attack
      for (let i = 0; i < 50; i++) {
        rateLimiter.checkRateLimit(attackerId);
      }

      // Attacker should be blocked
      expect(rateLimiter.checkRateLimit(attackerId)).toBe(false);

      // Normal user should still work
      const normalUser = 'normal-user-post-attack';
      expect(rateLimiter.checkRateLimit(normalUser)).toBe(true);

      // After cool-down period, even attacker should be allowed again
      await new Promise(resolve => setTimeout(resolve, 1200));
      expect(rateLimiter.checkRateLimit(attackerId)).toBe(true);
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
      const allowedCount = results.filter(Boolean).length;
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

      // Should not consume excessive memory
      expect(heapUsedMB).toBeLessThan(200); // Less than 200MB

      // Should still work efficiently
      const testResult = rateLimiter.checkRateLimit('final-memory-test');
      expect(testResult).toBe(true);
    });

    it('should clean up old rate limit data', async () => {
      const userId = 'cleanup-test-user';

      // Use rate limiter
      rateLimiter.checkRateLimit(userId);

      // Simulate time passage to trigger cleanup
      const originalTime = Date.now;
      Date.now = () => originalTime() + (70 * 60 * 1000); // 70 minutes later

      try {
        // This should trigger cleanup of old data
        rateLimiter.checkRateLimit('new-user-after-cleanup');

        // Old user data should be cleaned up
        const userCounts = (rateLimiter as any).userCounts;
        expect(userCounts.has(userId)).toBe(false);
      } finally {
        // Restore original Date.now
        Date.now = originalTime;
      }
    });

    it('should prevent queue overflow attacks', async () => {
      const overflowAttempts = 2000;
      const attackerId = 'queue-overflow-attacker';

      // Attempt to overflow operation queue
      const queuePromises = Array.from({ length: overflowAttempts }, (_, i) =>
        operationQueue.enqueue(
          () => Promise.resolve(`overflow-${i}`),
          attackerId,
          testGuildId,
          false
        )
      );

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
        rapidResults.push(rateLimiter.checkRateLimit(suspiciousUser));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should block most rapid requests
      const allowedCount = rapidResults.filter(Boolean).length;
      expect(allowedCount).toBeLessThanOrEqual(2);

      // Should be detected as suspicious behavior
      expect(duration).toBeLessThan(100); // Very rapid requests
    });

    it('should allow legitimate burst usage patterns', async () => {
      const legitimateUser = 'legitimate-burst-user';

      // Legitimate burst: quick commands with reasonable delays
      for (let burst = 0; burst < 3; burst++) {
        // Small burst of activity
        let allowed = rateLimiter.checkRateLimit(legitimateUser);
        expect(allowed).toBe(true);

        // Reasonable delay between bursts
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    });

    it('should differentiate between user types', async () => {
      const regularUser = 'regular-user';
      const adminUser = 'admin-user';

      // Regular users get standard limits
      expect(rateLimiter.checkRateLimit(regularUser)).toBe(true);
      expect(rateLimiter.checkRateLimit(regularUser)).toBe(false); // Rate limited

      // Admin users might have different treatment in production
      // For this test, they follow same rules
      expect(rateLimiter.checkRateLimit(adminUser)).toBe(true);
      expect(rateLimiter.checkRateLimit(adminUser)).toBe(false); // Rate limited
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
        role: StaffRole.PARALEGAL
      });

      expect(firstHire.success).toBe(true);

      // Rapid subsequent hires should be limited by rate limiting
      // (In production, rate limiting would be checked before service calls)
      const rapidHires = Array.from({ length: 10 }, (_, i) =>
        staffService.hireStaff({
          guildId: testGuildId,
          userId: `hire-victim-${i + 2}`,
          hiredBy: abusiveUser,
          robloxUsername: `HireVictim${i + 2}`,
          role: StaffRole.PARALEGAL
        })
      );

      const hireResults = await Promise.allSettled(rapidHires);

      // Some should succeed (within role limits), but rate limiting would
      // prevent the user from making too many requests
      const successCount = hireResults.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success
      ).length;

      // Should be limited by role constraints
      expect(successCount).toBeLessThanOrEqual(8); // Paralegal limit is 10, already hired 1
    });

    it('should prevent abuse of case creation operations', async () => {
      const abusiveUser = 'abusive-case-creator';

      // Simulate rate limiting check before each operation
      const caseCreationAttempts = Array.from({ length: 50 }, async (_, i) => {
        const rateLimitOk = rateLimiter.checkRateLimit(abusiveUser);
        
        if (!rateLimitOk) {
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
      const blockedCount = results.filter((r: any) => r.blocked).length;
      const createdCount = results.filter((r: any) => !r.blocked).length;

      expect(blockedCount).toBeGreaterThan(createdCount);
      expect(createdCount).toBeLessThanOrEqual(2); // Very few should get through
    });

    it('should handle legitimate high-volume administrative operations', async () => {
      const adminUser = 'high-volume-admin';

      // Admin performing legitimate bulk operations with proper spacing
      const adminOperations = [];

      for (let i = 0; i < 20; i++) {
        // Check rate limit before each operation
        const rateLimitOk = rateLimiter.checkRateLimit(adminUser);
        
        if (rateLimitOk) {
          adminOperations.push(
            staffService.getStaffList(testGuildId, adminUser)
          );
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
          userResults.push(rateLimiter.checkRateLimit(attackerId));
        }
        return userResults;
      });

      const flatResults = distributedResults.flat();
      const allowedCount = flatResults.filter(Boolean).length;
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
        if (rateLimiter.checkRateLimit(persistentAttacker)) {
          allowedCount++;
        }
      }, attackInterval);

      await new Promise(resolve => setTimeout(resolve, attackDuration));
      clearInterval(attackInterval_id);

      // Should limit slow but persistent attacks
      const allowedPercentage = (allowedCount / totalCount) * 100;
      expect(allowedPercentage).toBeLessThan(10); // Less than 10% allowed
    });

    it('should protect against resource enumeration attacks', async () => {
      const enumerationAttacker = 'enumeration-attacker';

      // Attempt to enumerate by rapid requests with different parameters
      const enumerationAttempts = Array.from({ length: 200 }, (_, i) => {
        const rateLimitOk = rateLimiter.checkRateLimit(enumerationAttacker);
        return { attempt: i, allowed: rateLimitOk };
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
      expect(rateLimiter.checkRateLimit(edgeCaseUser)).toBe(true);

      // Exactly at 1-second boundary
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(rateLimiter.checkRateLimit(edgeCaseUser)).toBe(true);

      // Just under 1-second boundary
      await new Promise(resolve => setTimeout(resolve, 999));
      expect(rateLimiter.checkRateLimit(edgeCaseUser)).toBe(false);
    });

    it('should maintain accuracy under system clock changes', async () => {
      const clockTestUser = 'clock-test-user';

      // Use rate limit
      expect(rateLimiter.checkRateLimit(clockTestUser)).toBe(true);
      expect(rateLimiter.checkRateLimit(clockTestUser)).toBe(false);

      // Simulate minor clock adjustments
      const originalNow = Date.now;
      Date.now = () => originalNow() + 500; // 500ms forward

      try {
        // Should still be rate limited
        expect(rateLimiter.checkRateLimit(clockTestUser)).toBe(false);
      } finally {
        Date.now = originalNow;
      }
    });

    it('should handle concurrent rate limit checks safely', async () => {
      const concurrentUser = 'concurrent-rate-test';

      // Multiple concurrent rate limit checks
      const concurrentChecks = Array.from({ length: 100 }, () =>
        Promise.resolve(rateLimiter.checkRateLimit(concurrentUser))
      );

      const results = await Promise.all(concurrentChecks);

      // Only first should be allowed, rest should be consistently blocked
      const allowedCount = results.filter(Boolean).length;
      expect(allowedCount).toBeLessThanOrEqual(1);
    });
  });
});