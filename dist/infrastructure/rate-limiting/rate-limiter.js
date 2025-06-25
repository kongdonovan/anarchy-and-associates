"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
const logger_1 = require("../logger");
class RateLimiter {
    constructor() {
        this.userLimits = new Map();
        this.COMMAND_INTERVAL_MS = 1000; // 1 second between commands
        this.WINDOW_SIZE_MS = 60000; // 1 minute window
        this.MAX_COMMANDS_PER_WINDOW = 30; // Max 30 commands per minute
        // Clean up old entries every 5 minutes (only in production)
        if (process.env.NODE_ENV !== 'test') {
            this.cleanupInterval = setInterval(() => {
                this.cleanupOldEntries();
            }, 5 * 60 * 1000);
        }
    }
    static getInstance() {
        if (!RateLimiter.instance) {
            RateLimiter.instance = new RateLimiter();
        }
        return RateLimiter.instance;
    }
    checkRateLimit(userId) {
        const now = new Date();
        const entry = this.userLimits.get(userId);
        if (!entry) {
            // First command for this user
            this.userLimits.set(userId, {
                lastCommand: now,
                commandCount: 1,
                windowStart: now
            });
            logger_1.logger.debug('Rate limit check passed - first command', { userId });
            return { allowed: true };
        }
        // Check if enough time has passed since last command
        const timeSinceLastCommand = now.getTime() - entry.lastCommand.getTime();
        if (timeSinceLastCommand < this.COMMAND_INTERVAL_MS) {
            const retryAfter = this.COMMAND_INTERVAL_MS - timeSinceLastCommand;
            logger_1.logger.warn('Rate limit exceeded - too frequent', {
                userId,
                timeSinceLastCommand,
                retryAfter
            });
            return {
                allowed: false,
                message: 'You are sending commands too quickly. Please wait a moment.',
                retryAfter
            };
        }
        // Check window-based rate limiting
        const windowElapsed = now.getTime() - entry.windowStart.getTime();
        if (windowElapsed >= this.WINDOW_SIZE_MS) {
            // Reset window
            entry.windowStart = now;
            entry.commandCount = 1;
        }
        else {
            entry.commandCount++;
            if (entry.commandCount > this.MAX_COMMANDS_PER_WINDOW) {
                const retryAfter = this.WINDOW_SIZE_MS - windowElapsed;
                logger_1.logger.warn('Rate limit exceeded - too many commands in window', {
                    userId,
                    commandCount: entry.commandCount,
                    windowElapsed,
                    retryAfter
                });
                return {
                    allowed: false,
                    message: 'You have sent too many commands recently. Please wait before trying again.',
                    retryAfter
                };
            }
        }
        // Update last command time
        entry.lastCommand = now;
        logger_1.logger.debug('Rate limit check passed', {
            userId,
            commandCount: entry.commandCount,
            windowElapsed
        });
        return { allowed: true };
    }
    resetUserRateLimit(userId) {
        this.userLimits.delete(userId);
        logger_1.logger.info('Rate limit reset for user', { userId });
    }
    getUserRateLimitInfo(userId) {
        const entry = this.userLimits.get(userId);
        return entry ? { ...entry } : null;
    }
    cleanupOldEntries() {
        const now = new Date();
        const cutoff = now.getTime() - (this.WINDOW_SIZE_MS * 2); // Keep entries for 2 windows
        let cleanedCount = 0;
        for (const [userId, entry] of this.userLimits.entries()) {
            if (entry.lastCommand.getTime() < cutoff) {
                this.userLimits.delete(userId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger_1.logger.debug('Cleaned up old rate limit entries', {
                cleanedCount,
                remainingEntries: this.userLimits.size
            });
        }
    }
    clearAllRateLimits() {
        const count = this.userLimits.size;
        this.userLimits.clear();
        logger_1.logger.info('All rate limits cleared', { clearedCount: count });
    }
    getRateLimitStats() {
        const now = new Date();
        const activeThreshold = now.getTime() - this.WINDOW_SIZE_MS;
        const entries = Array.from(this.userLimits.entries()).map(([userId, entry]) => ({
            userId,
            commandCount: entry.commandCount,
            lastCommand: entry.lastCommand,
            windowStart: entry.windowStart
        }));
        const activeUsers = entries.filter(entry => entry.lastCommand.getTime() > activeThreshold).length;
        return {
            totalUsers: this.userLimits.size,
            activeUsers,
            entries
        };
    }
    // Test helper methods - only for testing purposes
    clearUserLimitsForTesting() {
        if (process.env.NODE_ENV === 'test') {
            this.userLimits.clear();
        }
    }
    manualCleanupForTesting() {
        if (process.env.NODE_ENV === 'test') {
            this.cleanupOldEntries();
        }
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rate-limiter.js.map