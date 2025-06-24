import { logger } from '../logger';

interface RateLimitEntry {
  lastCommand: Date;
  commandCount: number;
  windowStart: Date;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private userLimits: Map<string, RateLimitEntry> = new Map();
  private readonly COMMAND_INTERVAL_MS = 1000; // 1 second between commands
  private readonly WINDOW_SIZE_MS = 60000; // 1 minute window
  private readonly MAX_COMMANDS_PER_WINDOW = 30; // Max 30 commands per minute

  private constructor() {
    // Clean up old entries every 5 minutes
    setInterval(() => {
      this.cleanupOldEntries();
    }, 5 * 60 * 1000);
  }

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  public checkRateLimit(userId: string): {
    allowed: boolean;
    message?: string;
    retryAfter?: number;
  } {
    const now = new Date();
    const entry = this.userLimits.get(userId);

    if (!entry) {
      // First command for this user
      this.userLimits.set(userId, {
        lastCommand: now,
        commandCount: 1,
        windowStart: now
      });
      
      logger.debug('Rate limit check passed - first command', { userId });
      return { allowed: true };
    }

    // Check if enough time has passed since last command
    const timeSinceLastCommand = now.getTime() - entry.lastCommand.getTime();
    if (timeSinceLastCommand < this.COMMAND_INTERVAL_MS) {
      const retryAfter = this.COMMAND_INTERVAL_MS - timeSinceLastCommand;
      
      logger.warn('Rate limit exceeded - too frequent', {
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
    } else {
      entry.commandCount++;
      
      if (entry.commandCount > this.MAX_COMMANDS_PER_WINDOW) {
        const retryAfter = this.WINDOW_SIZE_MS - windowElapsed;
        
        logger.warn('Rate limit exceeded - too many commands in window', {
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
    
    logger.debug('Rate limit check passed', {
      userId,
      commandCount: entry.commandCount,
      windowElapsed
    });
    
    return { allowed: true };
  }

  public resetUserRateLimit(userId: string): void {
    this.userLimits.delete(userId);
    logger.info('Rate limit reset for user', { userId });
  }

  public getUserRateLimitInfo(userId: string): {
    commandCount: number;
    windowStart: Date;
    lastCommand: Date;
  } | null {
    const entry = this.userLimits.get(userId);
    return entry ? { ...entry } : null;
  }

  private cleanupOldEntries(): void {
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
      logger.debug('Cleaned up old rate limit entries', {
        cleanedCount,
        remainingEntries: this.userLimits.size
      });
    }
  }

  public clearAllRateLimits(): void {
    const count = this.userLimits.size;
    this.userLimits.clear();
    logger.info('All rate limits cleared', { clearedCount: count });
  }

  public getRateLimitStats(): {
    totalUsers: number;
    activeUsers: number;
    entries: Array<{
      userId: string;
      commandCount: number;
      lastCommand: Date;
      windowStart: Date;
    }>;
  } {
    const now = new Date();
    const activeThreshold = now.getTime() - this.WINDOW_SIZE_MS;
    
    const entries = Array.from(this.userLimits.entries()).map(([userId, entry]) => ({
      userId,
      commandCount: entry.commandCount,
      lastCommand: entry.lastCommand,
      windowStart: entry.windowStart
    }));
    
    const activeUsers = entries.filter(entry => 
      entry.lastCommand.getTime() > activeThreshold
    ).length;
    
    return {
      totalUsers: this.userLimits.size,
      activeUsers,
      entries
    };
  }
}