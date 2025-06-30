import { EnhancedErrorContext } from '../../application/services/error-context-service';
/**
 * Utility class for convenient logging throughout the application
 */
export declare class LoggingUtils {
    /**
     * Log a service operation start
     */
    static logOperationStart(serviceName: string, operationName: string, context?: EnhancedErrorContext, metadata?: Record<string, any>): void;
    /**
     * Log a service operation completion
     */
    static logOperationComplete(serviceName: string, operationName: string, duration: number, context?: EnhancedErrorContext, metadata?: Record<string, any>): void;
    /**
     * Log a business rule validation
     */
    static logBusinessRuleValidation(rule: string, passed: boolean, context?: EnhancedErrorContext, details?: Record<string, any>): void;
    /**
     * Log a database operation
     */
    static logDatabaseOperation(operation: string, collection: string, duration: number, recordsAffected?: number, context?: EnhancedErrorContext): void;
    /**
     * Log a Discord API call
     */
    static logDiscordApiCall(endpoint: string, method: string, duration: number, statusCode?: number, context?: EnhancedErrorContext): void;
    /**
     * Log user action for audit purposes
     */
    static logUserAction(action: string, success: boolean, context?: EnhancedErrorContext, metadata?: Record<string, any>): void;
    /**
     * Log a permission check
     */
    static logPermissionCheck(action: string, resource: string, granted: boolean, requiredPermissions: string[], userPermissions: string[], context?: EnhancedErrorContext): void;
    /**
     * Log a rate limit event
     */
    static logRateLimit(limitType: string, identifier: string, limit: number, current: number, resetTime: Date, context?: EnhancedErrorContext): void;
    /**
     * Log application startup/shutdown events
     */
    static logApplicationEvent(event: 'startup' | 'shutdown' | 'ready', metadata?: Record<string, any>): void;
    /**
     * Log configuration changes
     */
    static logConfigurationChange(configType: string, changes: Record<string, {
        from: any;
        to: any;
    }>, context?: EnhancedErrorContext): void;
    /**
     * Log webhook events
     */
    static logWebhookEvent(webhookType: string, eventType: string, success: boolean, context?: EnhancedErrorContext, metadata?: Record<string, any>): void;
    /**
     * Log cache operations
     */
    static logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear', cacheKey: string, duration?: number, context?: EnhancedErrorContext): void;
    /**
     * Log external API calls
     */
    static logExternalApiCall(service: string, endpoint: string, method: string, duration: number, statusCode?: number, context?: EnhancedErrorContext): void;
    /**
     * Create a structured log entry for debugging complex operations
     */
    static createDebugSnapshot(operation: string, state: Record<string, any>, context?: EnhancedErrorContext): void;
    /**
     * Helper to create operation-scoped logger
     */
    static createOperationLogger(context: EnhancedErrorContext): {
        debug: (message: string, metadata?: Record<string, any>) => import("winston").Logger;
        info: (message: string, metadata?: Record<string, any>) => import("winston").Logger;
        warn: (message: string, metadata?: Record<string, any>) => import("winston").Logger;
        error: (message: string, error?: Error, metadata?: Record<string, any>) => void;
        logOperationStart: (serviceName: string, operationName: string, metadata?: Record<string, any>) => void;
        logOperationComplete: (serviceName: string, operationName: string, duration: number, metadata?: Record<string, any>) => void;
    };
}
//# sourceMappingURL=logging-utils.d.ts.map