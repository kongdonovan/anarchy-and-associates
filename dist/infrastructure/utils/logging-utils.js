"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingUtils = void 0;
const enhanced_logger_1 = require("../logger/enhanced-logger");
/**
 * Utility class for convenient logging throughout the application
 */
class LoggingUtils {
    /**
     * Log a service operation start
     */
    static logOperationStart(serviceName, operationName, context, metadata) {
        enhanced_logger_1.EnhancedLogger.getLogger().debug(`Starting ${serviceName}.${operationName}`, {
            operationType: 'service_operation_start',
            serviceName,
            operationName,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            userId: context?.userId,
            ...metadata
        });
    }
    /**
     * Log a service operation completion
     */
    static logOperationComplete(serviceName, operationName, duration, context, metadata) {
        enhanced_logger_1.EnhancedLogger.getLogger().info(`Completed ${serviceName}.${operationName}`, {
            operationType: 'service_operation_complete',
            serviceName,
            operationName,
            duration,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            userId: context?.userId,
            ...metadata
        });
    }
    /**
     * Log a business rule validation
     */
    static logBusinessRuleValidation(rule, passed, context, details) {
        const level = passed ? 'debug' : 'warn';
        const message = `Business rule validation: ${rule} - ${passed ? 'PASSED' : 'FAILED'}`;
        enhanced_logger_1.EnhancedLogger.getLogger().log(level, message, {
            operationType: 'business_rule_validation',
            rule,
            passed,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            userId: context?.userId,
            ...details
        });
    }
    /**
     * Log a database operation
     */
    static logDatabaseOperation(operation, collection, duration, recordsAffected, context) {
        enhanced_logger_1.EnhancedLogger.getLogger().debug(`Database operation: ${operation} on ${collection}`, {
            operationType: 'database_operation',
            operation,
            collection,
            duration,
            recordsAffected,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId
        });
    }
    /**
     * Log a Discord API call
     */
    static logDiscordApiCall(endpoint, method, duration, statusCode, context) {
        const level = statusCode && statusCode >= 400 ? 'warn' : 'debug';
        enhanced_logger_1.EnhancedLogger.getLogger().log(level, `Discord API: ${method} ${endpoint}`, {
            operationType: 'discord_api_call',
            endpoint,
            method,
            duration,
            statusCode,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId
        });
    }
    /**
     * Log user action for audit purposes
     */
    static logUserAction(action, success, context, metadata) {
        const level = success ? 'info' : 'warn';
        const message = `User action: ${action} - ${success ? 'SUCCESS' : 'FAILED'}`;
        enhanced_logger_1.EnhancedLogger.getLogger().log(level, message, {
            operationType: 'user_action',
            action,
            success,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            userId: context?.userId,
            commandName: context?.commandName,
            ...metadata
        });
    }
    /**
     * Log a permission check
     */
    static logPermissionCheck(action, resource, granted, requiredPermissions, userPermissions, context) {
        const level = granted ? 'debug' : 'warn';
        const message = `Permission check: ${action} on ${resource} - ${granted ? 'GRANTED' : 'DENIED'}`;
        enhanced_logger_1.EnhancedLogger.getLogger().log(level, message, {
            operationType: 'permission_check',
            action,
            resource,
            granted,
            requiredPermissions,
            userPermissions,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            userId: context?.userId
        });
        // Log security event for denied permissions
        if (!granted) {
            enhanced_logger_1.EnhancedLogger.logSecurityEvent(`Permission denied: ${action} on ${resource}`, 'low', context, {
                requiredPermissions,
                userPermissions,
                action,
                resource
            });
        }
    }
    /**
     * Log a rate limit event
     */
    static logRateLimit(limitType, identifier, limit, current, resetTime, context) {
        enhanced_logger_1.EnhancedLogger.getLogger().warn(`Rate limit: ${limitType} for ${identifier}`, {
            operationType: 'rate_limit',
            limitType,
            identifier,
            limit,
            current,
            resetTime: resetTime.toISOString(),
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            userId: context?.userId
        });
    }
    /**
     * Log application startup/shutdown events
     */
    static logApplicationEvent(event, metadata) {
        enhanced_logger_1.EnhancedLogger.getLogger().info(`Application ${event}`, {
            operationType: 'application_lifecycle',
            event,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version,
            ...metadata
        });
    }
    /**
     * Log configuration changes
     */
    static logConfigurationChange(configType, changes, context) {
        enhanced_logger_1.EnhancedLogger.getLogger().info(`Configuration change: ${configType}`, {
            operationType: 'configuration_change',
            configType,
            changes,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            userId: context?.userId
        });
    }
    /**
     * Log webhook events
     */
    static logWebhookEvent(webhookType, eventType, success, context, metadata) {
        const level = success ? 'info' : 'error';
        const message = `Webhook ${webhookType}: ${eventType} - ${success ? 'SUCCESS' : 'FAILED'}`;
        enhanced_logger_1.EnhancedLogger.getLogger().log(level, message, {
            operationType: 'webhook_event',
            webhookType,
            eventType,
            success,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            ...metadata
        });
    }
    /**
     * Log cache operations
     */
    static logCacheOperation(operation, cacheKey, duration, context) {
        enhanced_logger_1.EnhancedLogger.getLogger().debug(`Cache ${operation}: ${cacheKey}`, {
            operationType: 'cache_operation',
            operation,
            cacheKey,
            duration,
            correlationId: context?.correlationId,
            operationId: context?.operationId
        });
    }
    /**
     * Log external API calls
     */
    static logExternalApiCall(service, endpoint, method, duration, statusCode, context) {
        const level = statusCode && statusCode >= 400 ? 'warn' : 'debug';
        enhanced_logger_1.EnhancedLogger.getLogger().log(level, `External API: ${service} ${method} ${endpoint}`, {
            operationType: 'external_api_call',
            service,
            endpoint,
            method,
            duration,
            statusCode,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId
        });
    }
    /**
     * Create a structured log entry for debugging complex operations
     */
    static createDebugSnapshot(operation, state, context) {
        enhanced_logger_1.EnhancedLogger.getLogger().debug(`Debug snapshot: ${operation}`, {
            operationType: 'debug_snapshot',
            operation,
            state,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            userId: context?.userId,
            timestamp: Date.now()
        });
    }
    /**
     * Helper to create operation-scoped logger
     */
    static createOperationLogger(context) {
        return {
            debug: (message, metadata) => enhanced_logger_1.EnhancedLogger.getLogger().debug(message, {
                correlationId: context.correlationId,
                operationId: context.operationId,
                guildId: context.guildId,
                userId: context.userId,
                ...metadata
            }),
            info: (message, metadata) => enhanced_logger_1.EnhancedLogger.getLogger().info(message, {
                correlationId: context.correlationId,
                operationId: context.operationId,
                guildId: context.guildId,
                userId: context.userId,
                ...metadata
            }),
            warn: (message, metadata) => enhanced_logger_1.EnhancedLogger.getLogger().warn(message, {
                correlationId: context.correlationId,
                operationId: context.operationId,
                guildId: context.guildId,
                userId: context.userId,
                ...metadata
            }),
            error: (message, error, metadata) => enhanced_logger_1.EnhancedLogger.logError(error || new Error(message), context, metadata),
            logOperationStart: (serviceName, operationName, metadata) => LoggingUtils.logOperationStart(serviceName, operationName, context, metadata),
            logOperationComplete: (serviceName, operationName, duration, metadata) => LoggingUtils.logOperationComplete(serviceName, operationName, duration, context, metadata)
        };
    }
}
exports.LoggingUtils = LoggingUtils;
//# sourceMappingURL=logging-utils.js.map