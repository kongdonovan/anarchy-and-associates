import { BaseError, SerializedError } from './base-error';
import { BusinessRuleError } from './business-rule-error';
import { ValidationError } from './validation-error';
import { PermissionError } from './permission-error';
import { NotFoundError } from './not-found-error';
import { DatabaseError } from './database-error';
import { logger } from '../../infrastructure/logger';

/**
 * Error serialization system for structured logging
 */
export class ErrorSerializer {
  // Fields that should be filtered from logs for security
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'token',
    'cookie',
    'authorization',
    'secret',
    'apiKey',
    'privateKey',
    'creditCard',
    'ssn'
  ];

  /**
   * Serializes an error for Winston logging with appropriate log level
   */
  public static serializeForLogging(error: unknown): {
    level: string;
    error: SerializedError | Record<string, any>;
    tags: string[];
  } {
    if (error instanceof BaseError) {
      return {
        level: this.determineLogLevel(error),
        error: this.sanitizeError(error.serialize()),
        tags: this.generateTags(error)
      };
    }

    // Handle non-custom errors
    if (error instanceof Error) {
      return {
        level: 'error',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
        tags: ['unhandled-error']
      };
    }

    // Handle unknown error types
    return {
      level: 'error',
      error: {
        message: String(error),
        type: typeof error,
        timestamp: new Date().toISOString()
      },
      tags: ['unknown-error']
    };
  }

  /**
   * Determines the appropriate log level based on error type
   */
  private static determineLogLevel(error: BaseError): string {
    // Permission errors should be logged as warnings (potential security events)
    if (error instanceof PermissionError) {
      return 'warn';
    }

    // Not found errors are typically info level
    if (error instanceof NotFoundError) {
      return 'info';
    }

    // Database errors are critical
    if (error instanceof DatabaseError) {
      return error.isRetryable ? 'warn' : 'error';
    }

    // Validation errors are warnings
    if (error instanceof ValidationError) {
      return 'warn';
    }

    // Business rule errors depend on if they're operational
    if (error instanceof BusinessRuleError) {
      return error.isOperational ? 'warn' : 'error';
    }

    return 'error';
  }

  /**
   * Sanitizes error data to remove sensitive information
   */
  private static sanitizeError(error: SerializedError): SerializedError {
    const sanitized = { ...error };

    // Sanitize context metadata
    if (sanitized.context?.metadata) {
      sanitized.context.metadata = this.sanitizeObject(sanitized.context.metadata);
    }

    // Remove sensitive data from message
    sanitized.message = this.sanitizeString(sanitized.message);

    // Limit stack trace in production
    if (process.env.NODE_ENV === 'production' && sanitized.stack) {
      sanitized.stack = sanitized.stack.split('\n').slice(0, 5).join('\n') + '\n...';
    }

    return sanitized;
  }

  /**
   * Recursively sanitizes an object to remove sensitive fields
   */
  private static sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if key contains sensitive field names
      const isKeySensitive = this.SENSITIVE_FIELDS.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );

      if (isKeySensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = Array.isArray(value) 
          ? value.map(item => typeof item === 'object' ? this.sanitizeObject(item) : item)
          : this.sanitizeObject(value);
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitizes a string to remove potential sensitive data
   */
  private static sanitizeString(str: string): string {
    // Redact potential tokens (long alphanumeric strings)
    return str.replace(/\b[A-Za-z0-9]{32,}\b/g, '[REDACTED-TOKEN]');
  }

  /**
   * Generates tags for error categorization and searching
   */
  private static generateTags(error: BaseError): string[] {
    const tags: string[] = [error.constructor.name.toLowerCase()];

    // Add error code category
    if (error.errorCode) {
      const codePrefix = error.errorCode.split('_')[0];
      if (codePrefix) {
        tags.push(`error-category:${codePrefix.toLowerCase()}`);
      }
    }

    // Add context-based tags
    if (error.context.guildId) {
      tags.push('has-guild-context');
    }

    if (error.context.userId) {
      tags.push('has-user-context');
    }

    if (error.context.commandName) {
      tags.push(`command:${error.context.commandName}`);
    }

    // Add specific error type tags
    if (error instanceof DatabaseError) {
      tags.push(`db-operation:${error.operation.toLowerCase()}`);
      if (error.isRetryable) {
        tags.push('retryable');
      }
    }

    if (error instanceof PermissionError) {
      tags.push('security-event');
      if (error.action) {
        tags.push(`action:${error.action}`);
      }
    }

    if (error instanceof ValidationError && error.field) {
      tags.push(`field:${error.field}`);
    }

    return tags;
  }

  /**
   * Logs an error with appropriate formatting and context
   */
  public static logError(error: unknown, additionalContext?: Record<string, any>): void {
    const { level, error: serializedError, tags } = this.serializeForLogging(error);
    
    const logData = {
      ...serializedError,
      tags,
      additionalContext: additionalContext ? this.sanitizeObject(additionalContext) : undefined
    };

    // Use appropriate Winston log level
    switch (level) {
      case 'info':
        logger.info('Error logged', logData);
        break;
      case 'warn':
        logger.warn('Warning logged', logData);
        break;
      case 'error':
      default:
        logger.error('Error logged', logData);
        break;
    }
  }

  /**
   * Creates a structured error response for audit logging
   */
  public static serializeForAudit(error: BaseError): Record<string, any> {
    return {
      errorType: error.constructor.name,
      errorCode: error.errorCode,
      message: error.message,
      context: {
        guildId: error.context.guildId,
        userId: error.context.userId,
        commandName: error.context.commandName,
        action: error.context.action
      },
      timestamp: error.timestamp.toISOString(),
      isOperational: error.isOperational
    };
  }
}