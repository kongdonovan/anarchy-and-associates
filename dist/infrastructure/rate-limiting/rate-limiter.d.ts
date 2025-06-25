export declare class RateLimiter {
    private static instance;
    private userLimits;
    private readonly COMMAND_INTERVAL_MS;
    private readonly WINDOW_SIZE_MS;
    private readonly MAX_COMMANDS_PER_WINDOW;
    private cleanupInterval?;
    private constructor();
    static getInstance(): RateLimiter;
    checkRateLimit(userId: string): {
        allowed: boolean;
        message?: string;
        retryAfter?: number;
    };
    resetUserRateLimit(userId: string): void;
    getUserRateLimitInfo(userId: string): {
        commandCount: number;
        windowStart: Date;
        lastCommand: Date;
    } | null;
    private cleanupOldEntries;
    clearAllRateLimits(): void;
    getRateLimitStats(): {
        totalUsers: number;
        activeUsers: number;
        entries: Array<{
            userId: string;
            commandCount: number;
            lastCommand: Date;
            windowStart: Date;
        }>;
    };
    clearUserLimitsForTesting(): void;
    manualCleanupForTesting(): void;
    destroy(): void;
}
//# sourceMappingURL=rate-limiter.d.ts.map