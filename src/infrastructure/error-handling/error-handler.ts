import { logger } from '../logger';
import { EmbedUtils } from '../utils/embed-utils';

export enum ErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DISCORD_API_ERROR = 'DISCORD_API_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  QUEUE_TIMEOUT = 'QUEUE_TIMEOUT',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION'
}

export interface ApplicationError extends Error {
  type: ErrorType;
  userMessage: string;
  details?: any;
  userId?: string;
  guildId?: string;
  originalError?: Error;
}

export class ApplicationErrorHandler {
  private static instance: ApplicationErrorHandler;

  private constructor() {}

  public static getInstance(): ApplicationErrorHandler {
    if (!ApplicationErrorHandler.instance) {
      ApplicationErrorHandler.instance = new ApplicationErrorHandler();
    }
    return ApplicationErrorHandler.instance;
  }

  public createError(
    type: ErrorType,
    message: string,
    userMessage: string,
    details?: any,
    originalError?: Error
  ): ApplicationError {
    const error = new Error(message) as ApplicationError;
    error.type = type;
    error.userMessage = userMessage;
    error.details = details;
    error.originalError = originalError;
    
    return error;
  }

  public handleError(error: Error | ApplicationError, context?: {
    userId?: string;
    guildId?: string;
    command?: string;
  }): {
    embed: any;
    ephemeral: boolean;
  } {
    const appError = this.normalizeError(error);
    
    // Log the error with context
    logger.error('Application error occurred', {
      type: appError.type,
      message: appError.message,
      userMessage: appError.userMessage,
      details: appError.details,
      userId: context?.userId || appError.userId,
      guildId: context?.guildId || appError.guildId,
      command: context?.command,
      stack: appError.stack
    });

    // Create user-friendly embed based on error type
    const embed = this.createErrorEmbed(appError);
    
    return {
      embed,
      ephemeral: this.shouldBeEphemeral(appError.type)
    };
  }

  private normalizeError(error: Error | ApplicationError): ApplicationError {
    if (this.isApplicationError(error)) {
      return error;
    }

    // Convert generic errors to application errors
    if (error.message.includes('Permission')) {
      return this.createError(
        ErrorType.PERMISSION_DENIED,
        error.message,
        'You do not have permission to perform this action.',
        undefined,
        error
      );
    }

    if (error.message.includes('not found') || error.message.includes('Not Found')) {
      return this.createError(
        ErrorType.RESOURCE_NOT_FOUND,
        error.message,
        'The requested resource could not be found.',
        undefined,
        error
      );
    }

    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return this.createError(
        ErrorType.VALIDATION_ERROR,
        error.message,
        'The provided information is not valid. Please check your input and try again.',
        undefined,
        error
      );
    }

    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return this.createError(
        ErrorType.QUEUE_TIMEOUT,
        error.message,
        'The operation took too long to complete. Please try again.',
        undefined,
        error
      );
    }

    // Default system error
    return this.createError(
      ErrorType.SYSTEM_ERROR,
      error.message,
      'A system error occurred. Please try again later.',
      undefined,
      error
    );
  }

  private isApplicationError(error: any): error is ApplicationError {
    return error && typeof error === 'object' && 'type' in error && 'userMessage' in error;
  }

  private createErrorEmbed(error: ApplicationError): any {
    switch (error.type) {
      case ErrorType.PERMISSION_DENIED:
        return EmbedUtils.createErrorEmbed(
          '🚫 Permission Denied',
          error.userMessage
        );

      case ErrorType.VALIDATION_ERROR:
        return EmbedUtils.createErrorEmbed(
          '⚠️ Validation Error',
          error.userMessage
        );

      case ErrorType.RESOURCE_NOT_FOUND:
        return EmbedUtils.createErrorEmbed(
          '🔍 Not Found',
          error.userMessage
        );

      case ErrorType.RATE_LIMIT_EXCEEDED:
        return EmbedUtils.createErrorEmbed(
          '⏱️ Rate Limit Exceeded',
          error.userMessage
        );

      case ErrorType.DATABASE_ERROR:
        return EmbedUtils.createErrorEmbed(
          '💾 Service Temporarily Unavailable',
          'Our services are temporarily unavailable. Please try again in a few moments.'
        );

      case ErrorType.DISCORD_API_ERROR:
        return EmbedUtils.createErrorEmbed(
          '🤖 Discord Service Issue',
          'There was an issue communicating with Discord. Please try again.'
        );

      case ErrorType.EXTERNAL_SERVICE_ERROR:
        return EmbedUtils.createErrorEmbed(
          '🌐 External Service Issue',
          'An external service is temporarily unavailable. Please try again later.'
        );

      case ErrorType.QUEUE_TIMEOUT:
        return EmbedUtils.createErrorEmbed(
          '⏰ Operation Timeout',
          error.userMessage
        );

      case ErrorType.CONCURRENT_MODIFICATION:
        return EmbedUtils.createErrorEmbed(
          '🔄 Concurrent Modification',
          'Another operation is currently in progress. Please try again in a moment.'
        );

      default:
        return EmbedUtils.createErrorEmbed(
          '❌ System Error',
          'A system error occurred. Please try again later.'
        );
    }
  }

  private shouldBeEphemeral(errorType: ErrorType): boolean {
    switch (errorType) {
      case ErrorType.PERMISSION_DENIED:
      case ErrorType.VALIDATION_ERROR:
      case ErrorType.RATE_LIMIT_EXCEEDED:
        return true;
      
      case ErrorType.DATABASE_ERROR:
      case ErrorType.DISCORD_API_ERROR:
      case ErrorType.EXTERNAL_SERVICE_ERROR:
      case ErrorType.SYSTEM_ERROR:
        return false;
      
      default:
        return true;
    }
  }

  public async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context?: {
      userId?: string;
      guildId?: string;
      command?: string;
    }
  ): Promise<{ success: true; result: T } | { success: false; error: ApplicationError }> {
    try {
      const result = await operation();
      return { success: true, result };
    } catch (error) {
      const appError = this.normalizeError(error as Error);
      
      // Add context to error
      if (context) {
        appError.userId = context.userId;
        appError.guildId = context.guildId;
      }
      
      return { success: false, error: appError };
    }
  }
}