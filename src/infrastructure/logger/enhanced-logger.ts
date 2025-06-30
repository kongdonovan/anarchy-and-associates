import winston from 'winston';
import { BaseError, ErrorCode } from '../../domain/errors/base-error';
import { EnhancedErrorContext } from '../../application/services/error-context-service';

/**
 * Enhanced logger with specialized error handling capabilities
 */
export class EnhancedLogger {
  private static instance: winston.Logger;
  private static errorCorrelations = new Map<string, ErrorLogEntry[]>();

  /**
   * Initialize the enhanced logger
   */
  public static initialize(): winston.Logger {
    if (this.instance) {
      return this.instance;
    }

    const logLevel = process.env.LOG_LEVEL || 'info';
    const isProduction = process.env.NODE_ENV === 'production';

    // Custom format for error correlation
    const errorCorrelationFormat = winston.format((info) => {
      if (info.correlationId) {
        // Track error in correlation map
        const logEntry: ErrorLogEntry = {
          timestamp: new Date().toISOString(),
          level: info.level as string,
          message: info.message as string,
          correlationId: info.correlationId as string,
          operationId: info.operationId as string,
          metadata: info
        };

        if (!this.errorCorrelations.has(info.correlationId as string)) {
          this.errorCorrelations.set(info.correlationId as string, []);
        }
        this.errorCorrelations.get(info.correlationId as string)!.push(logEntry);

        // Clean up old correlations (older than 1 hour)
        this.cleanupOldCorrelations();
      }
      return info;
    });

    // Custom format for sensitive data redaction
    const sensitiveDataRedactionFormat = winston.format((info) => {
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'bearer'];
      
      const redactSensitiveData = (obj: any): any => {
        if (typeof obj !== 'object' || obj === null) {
          return obj;
        }
        
        if (Array.isArray(obj)) {
          return obj.map(redactSensitiveData);
        }
        
        const redacted = { ...obj };
        for (const [key, value] of Object.entries(redacted)) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            redacted[key] = '[REDACTED]';
          } else if (typeof value === 'object') {
            redacted[key] = redactSensitiveData(value);
          }
        }
        return redacted;
      };

      return redactSensitiveData(info);
    });

    // Custom format for error enrichment
    const errorEnrichmentFormat = winston.format((info) => {
      if (info.error instanceof BaseError) {
        info.enrichedError = {
          ...info.error.serialize(),
          clientMessage: info.error.toClientError().message
        };
      }
      return info;
    });

    this.instance = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        errorCorrelationFormat(),
        sensitiveDataRedactionFormat(),
        errorEnrichmentFormat(),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'anarchy-associates-bot',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      transports: [
        // Error-specific log file
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format.printf((info) => {
              return JSON.stringify({
                ...info,
                errorCorrelationChain: info.correlationId ? 
                  this.getCorrelationChain(info.correlationId as string) : undefined
              }, null, 2);
            })
          )
        }),
        
        // Operational errors log file
        new winston.transports.File({ 
          filename: 'logs/operational.log',
          level: 'warn',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format((info) => {
              // Only log operational errors to this file
              if (info.isOperational === true) {
                return info;
              }
              return false;
            })()
          )
        }),
        
        // Performance metrics log file
        new winston.transports.File({ 
          filename: 'logs/performance.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format((info) => {
              // Only log entries with performance metrics
              if (info.performanceMetrics) {
                return info;
              }
              return false;
            })()
          )
        }),
        
        // Combined log file
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format.prettyPrint()
          )
        }),
        
        // Security events log file
        new winston.transports.File({ 
          filename: 'logs/security.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format((info) => {
              // Log security-related events
              const securityKeywords = ['permission', 'auth', 'access', 'security', 'unauthorized'];
              const message = info.message as string || '';
              const errorCode = info.errorCode as string || '';
              const action = info.action as string || '';
              
              const isSecurityEvent = securityKeywords.some(keyword => 
                message.toLowerCase().includes(keyword) ||
                errorCode.includes('PERM_') ||
                action.includes('security')
              );
              
              if (isSecurityEvent) {
                return info;
              }
              return false;
            })()
          )
        })
      ],
    });

    // Add console transport for non-production
    if (!isProduction) {
      this.instance.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf((info) => {
            const correlationId = info.correlationId ? ` [${(info.correlationId as string).slice(-8)}]` : '';
            const operationId = info.operationId ? ` {${(info.operationId as string).slice(-6)}}` : '';
            
            return `${info.timestamp} ${info.level}${correlationId}${operationId}: ${info.message}`;
          })
        )
      }));
    }

    return this.instance;
  }

  /**
   * Get the logger instance
   */
  public static getLogger(): winston.Logger {
    if (!this.instance) {
      return this.initialize();
    }
    return this.instance;
  }

  /**
   * Log error with enhanced context
   */
  public static logError(
    error: Error,
    context?: EnhancedErrorContext,
    additionalMetadata?: Record<string, any>
  ): void {
    const logger = this.getLogger();
    
    const logData = {
      error,
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error instanceof BaseError ? error.errorCode : ErrorCode.SYS_INTERNAL_ERROR,
      stack: error.stack,
      isOperational: error instanceof BaseError ? error.isOperational : false,
      correlationId: context?.correlationId,
      operationId: context?.operationId,
      parentOperationId: context?.parentOperationId,
      guildId: context?.guildId,
      userId: context?.userId,
      commandName: context?.commandName,
      breadcrumbs: context ? this.createBreadcrumbs(context) : [],
      performanceMetrics: context?.performanceMetrics,
      discordContext: context?.discordContext,
      operationStack: context?.operationStack,
      ...context?.metadata,
      ...additionalMetadata
    };

    if (error instanceof BaseError && error.isOperational) {
      logger.warn('Operational error occurred', logData);
    } else {
      logger.error('System error occurred', logData);
    }
  }

  /**
   * Log operational warning with context
   */
  public static logOperationalWarning(
    message: string,
    context?: EnhancedErrorContext,
    metadata?: Record<string, any>
  ): void {
    const logger = this.getLogger();
    
    logger.warn(message, {
      isOperational: true,
      correlationId: context?.correlationId,
      operationId: context?.operationId,
      guildId: context?.guildId,
      userId: context?.userId,
      commandName: context?.commandName,
      ...context?.metadata,
      ...metadata
    });
  }

  /**
   * Log performance metrics
   */
  public static logPerformanceMetrics(
    operationName: string,
    metrics: {
      duration: number;
      memoryUsage?: NodeJS.MemoryUsage;
      resourcesAccessed?: string[];
      operationType: string;
    },
    context?: EnhancedErrorContext
  ): void {
    const logger = this.getLogger();
    
    logger.info(`Performance: ${operationName}`, {
      performanceMetrics: metrics,
      correlationId: context?.correlationId,
      operationId: context?.operationId,
      guildId: context?.guildId,
      ...context?.metadata
    });
  }

  /**
   * Log security event
   */
  public static logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: EnhancedErrorContext,
    metadata?: Record<string, any>
  ): void {
    const logger = this.getLogger();
    
    const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    
    logger.log(logLevel, `Security Event: ${event}`, {
      securityEvent: true,
      severity,
      correlationId: context?.correlationId,
      operationId: context?.operationId,
      guildId: context?.guildId,
      userId: context?.userId,
      action: context?.action,
      permissions: context?.discordContext?.permissions,
      ...context?.metadata,
      ...metadata
    });
  }

  /**
   * Get correlation chain for an error
   */
  private static getCorrelationChain(correlationId: string): ErrorLogEntry[] {
    return this.errorCorrelations.get(correlationId) || [];
  }

  /**
   * Create breadcrumbs from context
   */
  private static createBreadcrumbs(context: EnhancedErrorContext): string[] {
    const breadcrumbs: string[] = [];
    
    if (context.discordContext?.guildName) {
      breadcrumbs.push(`Guild: ${context.discordContext.guildName}`);
    }
    
    if (context.commandName) {
      breadcrumbs.push(`Command: ${context.commandName}`);
    }
    
    if (context.metadata?.serviceName) {
      breadcrumbs.push(`Service: ${context.metadata.serviceName}`);
    }
    
    if (context.metadata?.operation) {
      breadcrumbs.push(`Operation: ${context.metadata.operation}`);
    }
    
    return breadcrumbs;
  }

  /**
   * Clean up old correlation entries
   */
  private static cleanupOldCorrelations(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [correlationId, entries] of this.errorCorrelations.entries()) {
      const hasRecentEntries = entries.some(entry => 
        new Date(entry.timestamp) > oneHourAgo
      );
      
      if (!hasRecentEntries) {
        this.errorCorrelations.delete(correlationId);
      }
    }
  }

  /**
   * Get error statistics for monitoring
   */
  public static getErrorStatistics(): ErrorStatistics {
    const stats: ErrorStatistics = {
      totalErrors: 0,
      operationalErrors: 0,
      systemErrors: 0,
      errorsByType: {},
      errorsByGuild: {},
      recentErrors: []
    };

    for (const entries of this.errorCorrelations.values()) {
      for (const entry of entries) {
        if (entry.level === 'error' || entry.level === 'warn') {
          stats.totalErrors++;
          
          if (entry.metadata.isOperational) {
            stats.operationalErrors++;
          } else {
            stats.systemErrors++;
          }
          
          // Count by error type
          const errorCode = entry.metadata.errorCode || 'UNKNOWN';
          stats.errorsByType[errorCode] = (stats.errorsByType[errorCode] || 0) + 1;
          
          // Count by guild
          if (entry.metadata.guildId) {
            stats.errorsByGuild[entry.metadata.guildId] = 
              (stats.errorsByGuild[entry.metadata.guildId] || 0) + 1;
          }
          
          // Add to recent errors (last 10)
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (new Date(entry.timestamp) > oneHourAgo) {
            stats.recentErrors.push({
              timestamp: entry.timestamp,
              message: entry.message,
              errorCode: entry.metadata.errorCode,
              correlationId: entry.correlationId
            });
          }
        }
      }
    }

    // Sort recent errors by timestamp
    stats.recentErrors.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 10);

    return stats;
  }
}

/**
 * Error log entry for correlation tracking
 */
interface ErrorLogEntry {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  operationId?: string;
  metadata: any;
}

/**
 * Error statistics for monitoring
 */
export interface ErrorStatistics {
  totalErrors: number;
  operationalErrors: number;
  systemErrors: number;
  errorsByType: Record<string, number>;
  errorsByGuild: Record<string, number>;
  recentErrors: Array<{
    timestamp: string;
    message: string;
    errorCode?: string;
    correlationId?: string;
  }>;
}