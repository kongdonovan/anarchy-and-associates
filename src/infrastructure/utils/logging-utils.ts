import { EnhancedErrorContext } from '../../application/services/error-context-service';
import { EnhancedLogger } from '../logger/enhanced-logger';

/**
 * Utility class for convenient logging throughout the application
 */
export class LoggingUtils {
  /**
   * Log a service operation start
   */
  public static logOperationStart(
    serviceName: string,
    operationName: string,
    context?: EnhancedErrorContext,
    metadata?: Record<string, any>
  ): void {
    EnhancedLogger.getLogger().debug(`Starting ${serviceName}.${operationName}`, {
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
  public static logOperationComplete(
    serviceName: string,
    operationName: string,
    duration: number,
    context?: EnhancedErrorContext,
    metadata?: Record<string, any>
  ): void {
    EnhancedLogger.getLogger().info(`Completed ${serviceName}.${operationName}`, {
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
  public static logBusinessRuleValidation(
    rule: string,
    passed: boolean,
    context?: EnhancedErrorContext,
    details?: Record<string, any>
  ): void {
    const level = passed ? 'debug' : 'warn';
    const message = `Business rule validation: ${rule} - ${passed ? 'PASSED' : 'FAILED'}`;
    
    EnhancedLogger.getLogger().log(level, message, {
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
  public static logDatabaseOperation(
    operation: string,
    collection: string,
    duration: number,
    recordsAffected?: number,
    context?: EnhancedErrorContext
  ): void {
    EnhancedLogger.getLogger().debug(`Database operation: ${operation} on ${collection}`, {
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
  public static logDiscordApiCall(
    endpoint: string,
    method: string,
    duration: number,
    statusCode?: number,
    context?: EnhancedErrorContext
  ): void {
    const level = statusCode && statusCode >= 400 ? 'warn' : 'debug';
    
    EnhancedLogger.getLogger().log(level, `Discord API: ${method} ${endpoint}`, {
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
  public static logUserAction(
    action: string,
    success: boolean,
    context?: EnhancedErrorContext,
    metadata?: Record<string, any>
  ): void {
    const level = success ? 'info' : 'warn';
    const message = `User action: ${action} - ${success ? 'SUCCESS' : 'FAILED'}`;
    
    EnhancedLogger.getLogger().log(level, message, {
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
  public static logPermissionCheck(
    action: string,
    resource: string,
    granted: boolean,
    requiredPermissions: string[],
    userPermissions: string[],
    context?: EnhancedErrorContext
  ): void {
    const level = granted ? 'debug' : 'warn';
    const message = `Permission check: ${action} on ${resource} - ${granted ? 'GRANTED' : 'DENIED'}`;
    
    EnhancedLogger.getLogger().log(level, message, {
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
      EnhancedLogger.logSecurityEvent(
        `Permission denied: ${action} on ${resource}`,
        'low',
        context,
        {
          requiredPermissions,
          userPermissions,
          action,
          resource
        }
      );
    }
  }

  /**
   * Log a rate limit event
   */
  public static logRateLimit(
    limitType: string,
    identifier: string,
    limit: number,
    current: number,
    resetTime: Date,
    context?: EnhancedErrorContext
  ): void {
    EnhancedLogger.getLogger().warn(`Rate limit: ${limitType} for ${identifier}`, {
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
  public static logApplicationEvent(
    event: 'startup' | 'shutdown' | 'ready',
    metadata?: Record<string, any>
  ): void {
    EnhancedLogger.getLogger().info(`Application ${event}`, {
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
  public static logConfigurationChange(
    configType: string,
    changes: Record<string, { from: any; to: any }>,
    context?: EnhancedErrorContext
  ): void {
    EnhancedLogger.getLogger().info(`Configuration change: ${configType}`, {
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
  public static logWebhookEvent(
    webhookType: string,
    eventType: string,
    success: boolean,
    context?: EnhancedErrorContext,
    metadata?: Record<string, any>
  ): void {
    const level = success ? 'info' : 'error';
    const message = `Webhook ${webhookType}: ${eventType} - ${success ? 'SUCCESS' : 'FAILED'}`;
    
    EnhancedLogger.getLogger().log(level, message, {
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
  public static logCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear',
    cacheKey: string,
    duration?: number,
    context?: EnhancedErrorContext
  ): void {
    EnhancedLogger.getLogger().debug(`Cache ${operation}: ${cacheKey}`, {
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
  public static logExternalApiCall(
    service: string,
    endpoint: string,
    method: string,
    duration: number,
    statusCode?: number,
    context?: EnhancedErrorContext
  ): void {
    const level = statusCode && statusCode >= 400 ? 'warn' : 'debug';
    
    EnhancedLogger.getLogger().log(level, `External API: ${service} ${method} ${endpoint}`, {
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
  public static createDebugSnapshot(
    operation: string,
    state: Record<string, any>,
    context?: EnhancedErrorContext
  ): void {
    EnhancedLogger.getLogger().debug(`Debug snapshot: ${operation}`, {
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
  public static createOperationLogger(context: EnhancedErrorContext) {
    return {
      debug: (message: string, metadata?: Record<string, any>) =>
        EnhancedLogger.getLogger().debug(message, {
          correlationId: context.correlationId,
          operationId: context.operationId,
          guildId: context.guildId,
          userId: context.userId,
          ...metadata
        }),
      
      info: (message: string, metadata?: Record<string, any>) =>
        EnhancedLogger.getLogger().info(message, {
          correlationId: context.correlationId,
          operationId: context.operationId,
          guildId: context.guildId,
          userId: context.userId,
          ...metadata
        }),
      
      warn: (message: string, metadata?: Record<string, any>) =>
        EnhancedLogger.getLogger().warn(message, {
          correlationId: context.correlationId,
          operationId: context.operationId,
          guildId: context.guildId,
          userId: context.userId,
          ...metadata
        }),
      
      error: (message: string, error?: Error, metadata?: Record<string, any>) =>
        EnhancedLogger.logError(error || new Error(message), context, metadata),
      
      logOperationStart: (serviceName: string, operationName: string, metadata?: Record<string, any>) =>
        LoggingUtils.logOperationStart(serviceName, operationName, context, metadata),
      
      logOperationComplete: (serviceName: string, operationName: string, duration: number, metadata?: Record<string, any>) =>
        LoggingUtils.logOperationComplete(serviceName, operationName, duration, context, metadata)
    };
  }
}