import { CommandInteraction } from 'discord.js';
import { ErrorHandlerMiddleware } from '../../infrastructure/middleware/error-handler-middleware';
import { ErrorHandlingService } from '../../application/services/error-handling-service';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { 
  BaseError,
  DiscordError,
  ValidationError,
  PermissionError,
  BusinessRuleError,
  ErrorCode
} from '../../domain/errors';
import { logger } from '../../infrastructure/logger';

/**
 * Global error handling service instance
 */
let globalErrorHandlingService: ErrorHandlingService | null = null;

/**
 * Initialize the global error handling service
 */
export function initializeErrorHandling(_target?: any): void {
  const auditLogRepository = new AuditLogRepository();
  globalErrorHandlingService = new ErrorHandlingService(auditLogRepository);
}

/**
 * Decorator for automatic error handling in Discord commands
 */
export function HandleDiscordErrors(_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      // Find the interaction parameter
      const interaction = args.find(arg => 
        arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
      ) as CommandInteraction;

      if (interaction) {
        // Use global error handling service if available
        if (globalErrorHandlingService) {
          await globalErrorHandlingService.handleDiscordError(error as Error, interaction);
        } else {
          // Fallback to middleware directly
          await ErrorHandlerMiddleware.handleError(error as Error, interaction);
        }
      } else {
        // Log error if no interaction found
        logger.error(`Error in ${_propertyName} (no interaction found):`, error);
        throw error;
      }
    }
  };

  return descriptor;
}

/**
 * Decorator for handling specific error types with custom behavior
 */
export function HandleSpecificErrors(errorTypes: (new (...args: any[]) => Error)[]) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        // Check if error is one of the specified types
        const isSpecificError = errorTypes.some(ErrorType => error instanceof ErrorType);
        
        if (isSpecificError) {
          const interaction = args.find(arg => 
            arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
          ) as CommandInteraction;

          if (interaction) {
            if (globalErrorHandlingService) {
              await globalErrorHandlingService.handleDiscordError(error as Error, interaction);
            } else {
              await ErrorHandlerMiddleware.handleError(error as Error, interaction);
            }
            return; // Don't re-throw for handled errors
          }
        }
        
        // Re-throw if not a specific error type or no interaction
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for permission error handling with custom messages
 */
export function HandlePermissionErrors(customMessage?: string) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        if (error instanceof PermissionError) {
          const interaction = args.find(arg => 
            arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
          ) as CommandInteraction;

          if (interaction) {
            // Create custom permission error if message provided
            if (customMessage) {
              const customError = new PermissionError(
                customMessage,
                error.errorCode as ErrorCode,
                {
                  ...error.context,
                  metadata: {
                    ...error.context.metadata,
                    customMessage
                  }
                }
              );
              
              if (globalErrorHandlingService) {
                await globalErrorHandlingService.handleDiscordError(customError, interaction);
              } else {
                await ErrorHandlerMiddleware.handleError(customError, interaction);
              }
            } else {
              if (globalErrorHandlingService) {
                await globalErrorHandlingService.handleDiscordError(error, interaction);
              } else {
                await ErrorHandlerMiddleware.handleError(error, interaction);
              }
            }
            return;
          }
        }
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for validation error handling with field details
 */
export function HandleValidationErrors(_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      if (error instanceof ValidationError) {
        const interaction = args.find(arg => 
          arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
        ) as CommandInteraction;

        if (interaction) {
          if (globalErrorHandlingService) {
            await globalErrorHandlingService.handleDiscordError(error, interaction);
          } else {
            await ErrorHandlerMiddleware.handleError(error, interaction);
          }
          return;
        }
      }
      
      throw error;
    }
  };

  return descriptor;
}

/**
 * Decorator for business rule error handling with bypass options
 */
export function HandleBusinessRuleErrors(allowBypass: boolean = false) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        if (error instanceof BusinessRuleError) {
          const interaction = args.find(arg => 
            arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
          ) as CommandInteraction;

          if (interaction) {
            // Add bypass information if allowed
            if (allowBypass && interaction.guild?.ownerId === interaction.user.id) {
              error.enrichContext({
                metadata: {
                  ...error.context.metadata,
                  bypassAllowed: true,
                  bypassMessage: 'As guild owner, you can override this business rule.'
                }
              });
            }

            if (globalErrorHandlingService) {
              await globalErrorHandlingService.handleDiscordError(error, interaction);
            } else {
              await ErrorHandlerMiddleware.handleError(error, interaction);
            }
            return;
          }
        }
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator that converts common errors to domain errors
 */
export function ConvertErrors(_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      const interaction = args.find(arg => 
        arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
      ) as CommandInteraction;

      let convertedError = error;

      // Convert common errors to domain errors
      if (!(error instanceof BaseError)) {
        if (error instanceof TypeError && error.message.includes('Cannot read')) {
          convertedError = new ValidationError(
            'Invalid input provided',
            ErrorCode.VAL_INVALID_INPUT,
            { 
              commandName: interaction?.commandName,
              metadata: {
                originalError: (error as Error).message
              }
            }
          );
        } else if ((error as Error).message?.includes('Missing permissions') || (error as Error).message?.includes('Forbidden')) {
          convertedError = new PermissionError(
            'Insufficient permissions',
            ErrorCode.PERM_INSUFFICIENT_PERMISSIONS,
            { 
              commandName: interaction?.commandName,
              metadata: {
                originalError: (error as Error).message
              }
            }
          );
        } else if ((error as Error).message?.includes('Unknown') && interaction) {
          convertedError = DiscordError.fromDiscordJSError(error, {
            commandName: interaction.commandName,
            guildId: interaction.guildId || undefined,
            userId: interaction.user.id
          });
        }
      }

      if (interaction && convertedError !== error) {
        if (globalErrorHandlingService) {
          await globalErrorHandlingService.handleDiscordError(convertedError as Error, interaction);
        } else {
          await ErrorHandlerMiddleware.handleError(convertedError as Error, interaction);
        }
        return;
      }

      throw convertedError;
    }
  };

  return descriptor;
}

/**
 * Composite decorator that combines all error handling decorators
 */
export function HandleAllErrors(options?: {
  allowBusinessRuleBypass?: boolean;
  customPermissionMessage?: string;
  convertCommonErrors?: boolean;
}) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    // Apply error conversion if requested
    if (options?.convertCommonErrors !== false) {
      descriptor = ConvertErrors(_target, _propertyName, descriptor);
    }

    // Apply business rule handling
    descriptor = HandleBusinessRuleErrors(options?.allowBusinessRuleBypass)(_target, _propertyName, descriptor);
    
    // Apply validation error handling
    descriptor = HandleValidationErrors(_target, _propertyName, descriptor);
    
    // Apply permission error handling
    descriptor = HandlePermissionErrors(options?.customPermissionMessage)(_target, _propertyName, descriptor);
    
    // Apply general error handling
    descriptor = HandleDiscordErrors(_target, _propertyName, descriptor);

    return descriptor;
  };
}

/**
 * Method to get error handling service
 */
export function getErrorHandlingService(): ErrorHandlingService | null {
  return globalErrorHandlingService;
}