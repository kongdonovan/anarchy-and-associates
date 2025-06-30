import { CommandInteraction } from 'discord.js';
import { BaseCommand } from './base-command';
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

/**
 * Enhanced base command with automatic error handling
 */
export abstract class EnhancedBaseCommand extends BaseCommand {
  protected errorHandlingService: ErrorHandlingService;

  constructor() {
    super();
    
    // Initialize error handling service
    const auditLogRepository = new AuditLogRepository();
    this.errorHandlingService = new ErrorHandlingService(auditLogRepository);
  }

  /**
   * Execute command with automatic error handling
   */
  protected async executeWithErrorHandling<T>(
    interaction: CommandInteraction,
    commandFunction: () => Promise<T>,
    operationName?: string
  ): Promise<T | void> {
    try {
      this.logCommandExecution(interaction, operationName || 'command execution started');
      const result = await commandFunction();
      this.logCommandExecution(interaction, operationName || 'command execution completed');
      return result;
    } catch (error) {
      this.logCommandError(interaction, operationName || 'command execution', error);
      await this.errorHandlingService.handleDiscordError(error as Error, interaction);
    }
  }

  /**
   * Execute command with specific error type handling
   */
  protected async executeWithSpecificErrorHandling<T>(
    interaction: CommandInteraction,
    commandFunction: () => Promise<T>,
    errorTypes: (new (...args: any[]) => Error)[],
    operationName?: string
  ): Promise<T | void> {
    try {
      this.logCommandExecution(interaction, operationName || 'command execution started');
      const result = await commandFunction();
      this.logCommandExecution(interaction, operationName || 'command execution completed');
      return result;
    } catch (error) {
      this.logCommandError(interaction, operationName || 'command execution', error);
      
      // Check if error is one of the specified types
      const isSpecificError = errorTypes.some(ErrorType => error instanceof ErrorType);
      
      if (isSpecificError) {
        await this.errorHandlingService.handleDiscordError(error as Error, interaction);
        return;
      }
      
      // Re-throw if not a specific error type
      throw error;
    }
  }

  /**
   * Execute command with permission error handling
   */
  protected async executeWithPermissionHandling<T>(
    interaction: CommandInteraction,
    commandFunction: () => Promise<T>,
    customPermissionMessage?: string,
    operationName?: string
  ): Promise<T | void> {
    try {
      this.logCommandExecution(interaction, operationName || 'command execution started');
      const result = await commandFunction();
      this.logCommandExecution(interaction, operationName || 'command execution completed');
      return result;
    } catch (error) {
      this.logCommandError(interaction, operationName || 'command execution', error);
      
      if (error instanceof PermissionError) {
        // Create custom permission error if message provided
        if (customPermissionMessage) {
          const customError = new PermissionError(
            customPermissionMessage,
            error.errorCode as ErrorCode,
            {
              ...error.context,
              metadata: {
                ...error.context.metadata,
                customMessage: customPermissionMessage
              }
            }
          );
          await this.errorHandlingService.handleDiscordError(customError, interaction);
        } else {
          await this.errorHandlingService.handleDiscordError(error, interaction);
        }
        return;
      }
      
      throw error;
    }
  }

  /**
   * Execute command with business rule error handling
   */
  protected async executeWithBusinessRuleHandling<T>(
    interaction: CommandInteraction,
    commandFunction: () => Promise<T>,
    allowBypass: boolean = false,
    operationName?: string
  ): Promise<T | void> {
    try {
      this.logCommandExecution(interaction, operationName || 'command execution started');
      const result = await commandFunction();
      this.logCommandExecution(interaction, operationName || 'command execution completed');
      return result;
    } catch (error) {
      this.logCommandError(interaction, operationName || 'command execution', error);
      
      if (error instanceof BusinessRuleError) {
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

        await this.errorHandlingService.handleDiscordError(error, interaction);
        return;
      }
      
      throw error;
    }
  }

  /**
   * Execute command with automatic error conversion
   */
  protected async executeWithErrorConversion<T>(
    interaction: CommandInteraction,
    commandFunction: () => Promise<T>,
    operationName?: string
  ): Promise<T | void> {
    try {
      this.logCommandExecution(interaction, operationName || 'command execution started');
      const result = await commandFunction();
      this.logCommandExecution(interaction, operationName || 'command execution completed');
      return result;
    } catch (error) {
      this.logCommandError(interaction, operationName || 'command execution', error as Error);
      
      let convertedError = error as Error;

      // Convert common errors to domain errors
      if (!(convertedError instanceof BaseError)) {
        if (convertedError instanceof TypeError && convertedError.message.includes('Cannot read')) {
          convertedError = new ValidationError(
            'Invalid input provided',
            ErrorCode.VAL_INVALID_INPUT,
            { 
              commandName: interaction.commandName,
              guildId: interaction.guildId || undefined,
              userId: interaction.user.id,
              metadata: {
                originalError: convertedError.message,
                errorType: 'TypeError'
              }
            }
          );
        } else if (convertedError.message?.includes('Missing permissions') || convertedError.message?.includes('Forbidden')) {
          convertedError = new PermissionError(
            'Insufficient permissions to perform this action',
            ErrorCode.PERM_INSUFFICIENT_PERMISSIONS,
            { 
              commandName: interaction.commandName,
              guildId: interaction.guildId || undefined,
              userId: interaction.user.id,
              metadata: {
                originalError: convertedError.message,
                errorType: 'PermissionError'
              }
            }
          );
        } else if (convertedError.message?.includes('Unknown') || 
                   convertedError.name === 'DiscordAPIError' || 
                   'code' in convertedError) {
          convertedError = DiscordError.fromDiscordJSError(convertedError, {
            commandName: interaction.commandName,
            guildId: interaction.guildId || undefined,
            userId: interaction.user.id
          });
        }
      }

      await this.errorHandlingService.handleDiscordError(convertedError as Error, interaction);
    }
  }

  /**
   * Safe execution wrapper that handles all types of errors
   */
  protected async safeExecute<T>(
    interaction: CommandInteraction,
    commandFunction: () => Promise<T>,
    options?: {
      allowBusinessRuleBypass?: boolean;
      customPermissionMessage?: string;
      convertCommonErrors?: boolean;
      operationName?: string;
    }
  ): Promise<T | void> {
    const operationName = options?.operationName || 'safe command execution';
    
    try {
      this.logCommandExecution(interaction, `${operationName} started`);
      
      // Pre-execution validation if available
      if (this.commandValidationService) {
        const validationResult = await this.validateCommand(interaction);
        if (!validationResult.isValid) {
          const validationError = new ValidationError(
            validationResult.errors.join('; '),
            ErrorCode.VAL_INVALID_INPUT,
            {
              commandName: interaction.commandName,
              guildId: interaction.guildId || undefined,
              userId: interaction.user.id,
              metadata: {
                validationErrors: validationResult.errors,
                validationWarnings: validationResult.warnings
              }
            }
          );
          throw validationError;
        }
      }
      
      const result = await commandFunction();
      this.logCommandExecution(interaction, `${operationName} completed successfully`);
      return result;
      
    } catch (error) {
      this.logCommandError(interaction, operationName, error as Error);
      
      let processedError = error as Error;

      // Convert common errors if requested
      if (options?.convertCommonErrors !== false && !(processedError instanceof BaseError)) {
        processedError = this.convertCommonError(processedError, interaction);
      }

      // Add bypass information for business rule errors
      if (processedError instanceof BusinessRuleError && 
          options?.allowBusinessRuleBypass && 
          interaction.guild?.ownerId === interaction.user.id) {
        (processedError as BusinessRuleError).enrichContext({
          metadata: {
            ...processedError.context.metadata,
            bypassAllowed: true,
            bypassMessage: 'As guild owner, you can override this business rule.'
          }
        });
      }

      // Add custom message for permission errors
      if (processedError instanceof PermissionError && options?.customPermissionMessage) {
        processedError = new PermissionError(
          options.customPermissionMessage,
          processedError.errorCode as ErrorCode,
          {
            ...processedError.context,
            metadata: {
              ...processedError.context.metadata,
              customMessage: options.customPermissionMessage
            }
          }
        );
      }

      await this.errorHandlingService.handleDiscordError(processedError as Error, interaction);
    }
  }

  /**
   * Convert common errors to domain errors
   */
  private convertCommonError(error: Error, interaction: CommandInteraction): Error {
    if (error instanceof TypeError && error.message.includes('Cannot read')) {
      return new ValidationError(
        'Invalid input provided',
        ErrorCode.VAL_INVALID_INPUT,
        { 
          commandName: interaction.commandName,
          guildId: interaction.guildId || undefined,
          userId: interaction.user.id,
          metadata: {
            originalError: error.message,
            errorType: 'TypeError'
          }
        }
      );
    }
    
    if (error.message?.includes('Missing permissions') || error.message?.includes('Forbidden')) {
      return new PermissionError(
        'Insufficient permissions to perform this action',
        ErrorCode.PERM_INSUFFICIENT_PERMISSIONS,
        { 
          commandName: interaction.commandName,
          guildId: interaction.guildId || undefined,
          userId: interaction.user.id,
          metadata: {
            originalError: error.message,
            errorType: 'PermissionError'
          }
        }
      );
    }
    
    if (error.message?.includes('Unknown') || 
        error.name === 'DiscordAPIError' || 
        'code' in error) {
      return DiscordError.fromDiscordJSError(error, {
        commandName: interaction.commandName,
        guildId: interaction.guildId || undefined,
        userId: interaction.user.id
      });
    }

    return error;
  }
}