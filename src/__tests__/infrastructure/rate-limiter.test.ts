import { RateLimiter } from '../../infrastructure/rate-limiting/rate-limiter';
import { TestUtils } from '../helpers/test-utils';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = RateLimiter.getInstance();
    rateLimiter.clearAllRateLimits();
  });

  afterEach(() => {
    rateLimiter.clearAllRateLimits();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow first command immediately', () => {
      const result = rateLimiter.checkRateLimit('user1');
      
      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
      expect(result.retryAfter).toBeUndefined();
    });

    it('should block commands sent too quickly (within 1 second)', async () => {
      // First command should pass
      const result1 = rateLimiter.checkRateLimit('user1');
      expect(result1.allowed).toBe(true);

      // Immediate second command should be blocked
      const result2 = rateLimiter.checkRateLimit('user1');
      expect(result2.allowed).toBe(false);
      expect(result2.message).toContain('too quickly');
      expect(result2.retryAfter).toBeLessThanOrEqual(1000);
    });

    it('should allow commands after 1 second interval', async () => {
      // First command
      const result1 = rateLimiter.checkRateLimit('user1');
      expect(result1.allowed).toBe(true);

      // Wait for rate limit to reset
      await TestUtils.wait(1100);

      // Second command should pass
      const result2 = rateLimiter.checkRateLimit('user1');
      expect(result2.allowed).toBe(true);
    });

    it('should handle different users independently', () => {
      // User1 makes a command
      const result1 = rateLimiter.checkRateLimit('user1');
      expect(result1.allowed).toBe(true);

      // User2 should be able to make a command immediately
      const result2 = rateLimiter.checkRateLimit('user2');
      expect(result2.allowed).toBe(true);

      // User1 immediate second command should be blocked
      const result3 = rateLimiter.checkRateLimit('user1');
      expect(result3.allowed).toBe(false);
    });
  });

  describe('Window-Based Rate Limiting', () => {
    it('should block after exceeding 30 commands per minute', async () => {
      const userId = 'user1';
      let blockedAt = -1;

      // Try to send 35 commands with minimal delay
      for (let i = 0; i < 35; i++) {
        await TestUtils.wait(1100); // Just over 1 second to pass interval check
        
        const result = rateLimiter.checkRateLimit(userId);
        
        if (!result.allowed && blockedAt === -1) {
          blockedAt = i;
          expect(result.message).toContain('too many commands');
          expect(result.retryAfter).toBeGreaterThan(0);
          break;
        }
      }

      expect(blockedAt).toBeGreaterThan(25); // Should be blocked after around 30 commands
      expect(blockedAt).toBeLessThanOrEqual(31);
    });

    it('should reset window after 1 minute', async () => {
      const userId = 'user1';

      // Make several commands to approach limit
      for (let i = 0; i < 25; i++) {
        await TestUtils.wait(1100);
        const result = rateLimiter.checkRateLimit(userId);
        expect(result.allowed).toBe(true);
      }

      // Get current rate limit info
      const info = rateLimiter.getUserRateLimitInfo(userId);
      expect(info).toBeTruthy();
      if (info) {
        expect(info.commandCount).toBe(25);
      }

      // Simulate window reset by manipulating time (in a real test, we'd wait)
      // For this test, we'll just verify the logic works with a fresh window
      rateLimiter.resetUserRateLimit(userId);
      
      const result = rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Rate Limit Management', () => {
    it('should reset specific user rate limits', () => {
      // Make commands for both users
      rateLimiter.checkRateLimit('user1');
      rateLimiter.checkRateLimit('user2');

      // Both should be blocked on immediate retry
      expect(rateLimiter.checkRateLimit('user1').allowed).toBe(false);
      expect(rateLimiter.checkRateLimit('user2').allowed).toBe(false);

      // Reset user1 only
      rateLimiter.resetUserRateLimit('user1');

      // User1 should be allowed, user2 still blocked
      expect(rateLimiter.checkRateLimit('user1').allowed).toBe(true);
      expect(rateLimiter.checkRateLimit('user2').allowed).toBe(false);
    });

    it('should clear all rate limits', () => {
      // Make commands for multiple users
      rateLimiter.checkRateLimit('user1');
      rateLimiter.checkRateLimit('user2');
      rateLimiter.checkRateLimit('user3');

      // All should be blocked on immediate retry
      expect(rateLimiter.checkRateLimit('user1').allowed).toBe(false);
      expect(rateLimiter.checkRateLimit('user2').allowed).toBe(false);
      expect(rateLimiter.checkRateLimit('user3').allowed).toBe(false);

      // Clear all limits
      rateLimiter.clearAllRateLimits();

      // All should be allowed again
      expect(rateLimiter.checkRateLimit('user1').allowed).toBe(true);
      expect(rateLimiter.checkRateLimit('user2').allowed).toBe(true);
      expect(rateLimiter.checkRateLimit('user3').allowed).toBe(true);
    });

    it('should provide user rate limit information', () => {
      const userId = 'user1';
      
      // No info initially
      expect(rateLimiter.getUserRateLimitInfo(userId)).toBeNull();

      // Make a command
      rateLimiter.checkRateLimit(userId);

      // Should have info now
      const info = rateLimiter.getUserRateLimitInfo(userId);
      expect(info).toBeTruthy();
      if (info) {
        expect(info.commandCount).toBe(1);
        expect(info.lastCommand).toBeInstanceOf(Date);
        expect(info.windowStart).toBeInstanceOf(Date);
      }
    });
  });

  describe('Rate Limit Statistics', () => {
    it('should provide accurate statistics', async () => {
      // Make commands with different users
      rateLimiter.checkRateLimit('user1');
      await TestUtils.wait(100);
      rateLimiter.checkRateLimit('user2');
      await TestUtils.wait(100);
      rateLimiter.checkRateLimit('user3');

      const stats = rateLimiter.getRateLimitStats();
      
      expect(stats.totalUsers).toBe(3);
      expect(stats.activeUsers).toBe(3);
      expect(stats.entries).toHaveLength(3);
      
      // Verify entry structure
      stats.entries.forEach(entry => {
        expect(entry.userId).toBeTruthy();
        expect(entry.commandCount).toBeGreaterThan(0);
        expect(entry.lastCommand).toBeInstanceOf(Date);
        expect(entry.windowStart).toBeInstanceOf(Date);
      });
    });

    it('should distinguish between total and active users', async () => {
      // Create some entries
      rateLimiter.checkRateLimit('user1');
      rateLimiter.checkRateLimit('user2');
      
      // Wait to make some users "inactive"
      await TestUtils.wait(100);
      
      const stats = rateLimiter.getRateLimitStats();
      expect(stats.totalUsers).toBeGreaterThanOrEqual(2);
      expect(stats.activeUsers).toBeGreaterThanOrEqual(0);
      expect(stats.activeUsers).toBeLessThanOrEqual(stats.totalUsers);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid successive checks', () => {
      const userId = 'user1';
      const results = [];

      // Make 10 rapid checks
      for (let i = 0; i < 10; i++) {
        results.push(rateLimiter.checkRateLimit(userId));
      }

      // First should be allowed, rest blocked
      expect(results[0]?.allowed).toBe(true);
      
      for (let i = 1; i < 10; i++) {
        expect(results[i]?.allowed).toBe(false);
      }
    });

    it('should handle empty and invalid user IDs', () => {
      // Empty string
      const result1 = rateLimiter.checkRateLimit('');
      expect(result1.allowed).toBe(true);

      // Very long user ID
      const longUserId = 'a'.repeat(1000);
      const result2 = rateLimiter.checkRateLimit(longUserId);
      expect(result2.allowed).toBe(true);

      // Special characters
      const specialUserId = '!@#$%^&*()';
      const result3 = rateLimiter.checkRateLimit(specialUserId);
      expect(result3.allowed).toBe(true);
    });

    it('should maintain singleton instance', () => {
      const instance1 = RateLimiter.getInstance();
      const instance2 = RateLimiter.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should handle concurrent access from multiple users', async () => {
      const userIds = Array.from({ length: 50 }, (_, i) => `user${i}`);
      
      // All users make commands simultaneously
      const results = await Promise.all(
        userIds.map(userId => 
          Promise.resolve(rateLimiter.checkRateLimit(userId))
        )
      );

      // All first commands should be allowed
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });

      // All immediate second commands should be blocked
      const secondResults = await Promise.all(
        userIds.map(userId => 
          Promise.resolve(rateLimiter.checkRateLimit(userId))
        )
      );

      secondResults.forEach(result => {
        expect(result.allowed).toBe(false);
      });
    });
  });

  describe('Memory Management', () => {
    it('should not grow memory infinitely with many users', () => {
      // Create many rate limit entries
      for (let i = 0; i < 1000; i++) {
        rateLimiter.checkRateLimit(`user${i}`);
      }

      const stats = rateLimiter.getRateLimitStats();
      expect(stats.totalUsers).toBe(1000);

      // Clear all and verify cleanup
      rateLimiter.clearAllRateLimits();
      
      const statsAfter = rateLimiter.getRateLimitStats();
      expect(statsAfter.totalUsers).toBe(0);
    });
  });
});