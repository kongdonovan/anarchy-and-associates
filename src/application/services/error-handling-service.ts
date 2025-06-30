import { CommandInteraction } from 'discord.js';
import { 
  BaseError, 
  ErrorCode,
  ErrorContext,
  DiscordError,
  BusinessRuleError,
  ValidationError,
  PermissionError,
  DatabaseError,
  DatabaseOperation
} from '../../domain/errors';
import { ErrorHandlerMiddleware, DiscordErrorContext } from '../../infrastructure/middleware/error-handler-middleware';
import { logger } from '../../infrastructure/logger';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { AuditAction } from '../../domain/entities/audit-log';

/**
 * Centralized error handling service
 */
export class ErrorHandlingService {
  private auditLogRepository: AuditLogRepository;
  private errorMetrics: Map<string, number> = new Map();

  constructor(auditLogRepository: AuditLogRepository) {
    this.auditLogRepository = auditLogRepository;
  }

  /**
   * Handles Discord command errors
   */
  public async handleDiscordError(
    error: Error,
    interaction: CommandInteraction,
    additionalContext?: Partial<DiscordErrorContext>
  ): Promise<void> {
    // Convert Discord.js errors to our custom types
    const processedError = this.processError(error, interaction);
    
    // Track error metrics
    this.trackErrorMetrics(processedError);
    
    // Log to audit trail if it's a significant error
    await this.auditError(processedError, interaction);
    
    // Use middleware to handle the error
    await ErrorHandlerMiddleware.handleError(processedError, interaction, additionalContext);
  }

  /**
   * Handles service-level errors (non-Discord)
   */
  public async handleServiceError(
    error: Error,
    context: ErrorContext
  ): Promise<void> {
    const processedError = this.processError(error, null, context);
    
    // Track error metrics
    this.trackErrorMetrics(processedError);
    
    // Log error
    logger.error('Service error occurred:', {
      error: processedError instanceof BaseError ? processedError.serialize() : {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    });
    
    // Re-throw for calling code to handle
    throw processedError;
  }

  /**
   * Processes and converts errors to appropriate types
   */
  private processError(
    error: Error, 
    interaction?: CommandInteraction | null,
    context?: ErrorContext
  ): Error {
    // If it's already a BaseError, return as-is
    if (error instanceof BaseError) {
      return error;
    }

    // Try to convert Discord.js errors
    if (this.isDiscordJSError(error)) {
      return DiscordError.fromDiscordJSError(error, context);
    }

    // Try to convert MongoDB errors
    if (this.isMongoError(error)) {
      return this.convertMongoError(error, context);
    }

    // Try to convert validation errors
    if (this.isValidationError(error)) {
      return this.convertValidationError(error, context);
    }

    // For unknown errors, wrap in appropriate type
    if (interaction) {
      return new DiscordError(
        error.message,
        ErrorCode.SYS_INTERNAL_ERROR,
        context
      );
    }

    // Return as-is if we can't convert it
    return error;
  }

  /**
   * Checks if error is from Discord.js
   */
  private isDiscordJSError(error: Error): boolean {
    return error.name === 'DiscordAPIError' || 
           error.name === 'HTTPError' ||
           'code' in error ||
           'status' in error;
  }

  /**
   * Checks if error is from MongoDB
   */
  private isMongoError(error: Error): boolean {
    return error.name === 'MongoError' ||
           error.name === 'MongoServerError' ||
           error.name === 'MongoNetworkError' ||
           error.name === 'MongoTimeoutError' ||
           'code' in error && typeof (error as any).code === 'number';
  }

  /**
   * Checks if error is a validation error
   */
  private isValidationError(error: Error): boolean {
    return error.name === 'ValidationError' ||
           error.message.includes('validation') ||
           error.message.includes('required') ||
           error.message.includes('invalid');
  }

  /**
   * Converts MongoDB errors to DatabaseError
   */
  private convertMongoError(error: Error, context?: ErrorContext): DatabaseError {
    const mongoError = error as any;
    
    let errorCode = ErrorCode.DB_QUERY_FAILED;
    let message = 'Database operation failed';

    if (mongoError.code === 11000) {
      errorCode = ErrorCode.DB_CONSTRAINT_VIOLATION;
      message = 'Duplicate entry detected';
    } else if (mongoError.name === 'MongoNetworkError') {
      errorCode = ErrorCode.DB_CONNECTION_FAILED;
      message = 'Database connection failed';
    } else if (mongoError.name === 'MongoTimeoutError') {
      errorCode = ErrorCode.DB_TIMEOUT;
      message = 'Database operation timed out';
    }

    return new DatabaseError(message, errorCode, DatabaseOperation.FIND, context);
  }

  /**
   * Converts validation errors to ValidationError
   */
  private convertValidationError(error: Error, context?: ErrorContext): ValidationError {
    return new ValidationError(
      error.message,
      ErrorCode.VAL_INVALID_INPUT,
      context
    );
  }

  /**
   * Tracks error metrics for monitoring
   */
  private trackErrorMetrics(error: Error): void {
    const errorType = error.constructor.name;
    const errorCode = error instanceof BaseError ? error.errorCode : 'UNKNOWN';
    
    const key = `${errorType}:${errorCode}`;
    const current = this.errorMetrics.get(key) || 0;
    this.errorMetrics.set(key, current + 1);
    
    // Log metrics periodically (every 100 errors)
    const total = Array.from(this.errorMetrics.values()).reduce((a, b) => a + b, 0);
    if (total % 100 === 0) {
      logger.info('Error metrics summary:', Object.fromEntries(this.errorMetrics));
    }
  }

  /**
   * Audits significant errors
   */
  private async auditError(error: Error, interaction: CommandInteraction): Promise<void> {
    try {
      // Only audit certain types of errors
      if (error instanceof PermissionError || 
          error instanceof BusinessRuleError ||
          (error instanceof BaseError && !error.isOperational)) {
        
        await this.auditLogRepository.add({
          guildId: interaction.guildId || 'unknown',
          actorId: interaction.user.id,
          action: AuditAction.SYSTEM_REPAIR, // We could add a new audit action for errors
          targetId: interaction.user.id,
          details: {
            reason: 'Error occurred during command execution',
            metadata: {
              errorType: error.constructor.name,
              errorCode: error instanceof BaseError ? error.errorCode : 'UNKNOWN',
              commandName: interaction.commandName,
              errorMessage: error.message
            }
          },
          timestamp: new Date()
        });
      }
    } catch (auditError) {
      logger.error('Failed to audit error:', auditError);
    }
  }

  /**
   * Gets error metrics for monitoring
   */
  public getErrorMetrics(): Record<string, number> {
    return Object.fromEntries(this.errorMetrics);
  }

  /**
   * Resets error metrics
   */
  public resetErrorMetrics(): void {
    this.errorMetrics.clear();
  }

  /**
   * Creates error context from interaction
   */
  public static createContextFromInteraction(
    interaction: CommandInteraction,
    additionalContext?: Partial<ErrorContext>
  ): ErrorContext {
    return {
      guildId: interaction.guildId || undefined,
      userId: interaction.user.id,
      commandName: interaction.commandName,
      metadata: {
        interactionId: interaction.id,
        channelId: interaction.channelId,
        createdTimestamp: interaction.createdTimestamp,
        ...additionalContext?.metadata
      },
      ...additionalContext
    };
  }
}

/**
 * Global error handler for uncaught errors
 */
export class GlobalErrorHandler {
  // Error handling service could be used for advanced error handling in the future

  public static initialize(_errorHandlingService: ErrorHandlingService): void {
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      
      // Don't exit for operational errors
      if (error instanceof BaseError && error.isOperational) {
        return;
      }
      
      // Exit for non-operational errors after a delay
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      
      if (reason instanceof BaseError && reason.isOperational) {
        return;
      }
      
      // Exit for non-operational errors after a delay
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
  }
}