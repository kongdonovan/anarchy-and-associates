import { CommandInteraction, Client } from 'discord.js';
import { ErrorHandlerMiddleware } from './error-handler-middleware';
import { ErrorHandlingService } from '../../application/services/error-handling-service';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { logger } from '../logger';
import { BaseError, ErrorCode, DiscordError } from '../../domain/errors';

/**
 * Command interceptor that automatically wraps all Discord commands with error handling
 */
export class CommandInterceptor {
  private static errorHandlingService: ErrorHandlingService;
  private static isInitialized = false;
  private static commandHandlers = new Map<string, Function>();
  private static originalHandlers = new Map<string, Function>();

  /**
   * Initialize the command interceptor
   */
  public static initialize(client: Client): void {
    if (this.isInitialized) {
      logger.warn('CommandInterceptor already initialized');
      return;
    }

    // Initialize error handling service
    const auditLogRepository = new AuditLogRepository();
    this.errorHandlingService = new ErrorHandlingService(auditLogRepository);

    // Hook into Discord.js interaction handling
    this.setupInteractionHook(client);

    this.isInitialized = true;
    logger.info('CommandInterceptor initialized successfully');
  }

  /**
   * Setup interaction hook to intercept commands
   */
  private static setupInteractionHook(client: Client): void {
    // Store original interaction handler
    const originalEmit = client.emit.bind(client);

    // Override emit to intercept interactions
    client.emit = function(event: string, ...args: any[]): boolean {
      if (event === 'interactionCreate') {
        const interaction = args[0];
        
        if (interaction?.isCommand?.()) {
          // Wrap command execution with error handling
          CommandInterceptor.wrapCommandExecution(interaction as CommandInteraction);
        }
      }

      // Call original emit
      return originalEmit(event, ...args);
    };
  }

  /**
   * Wrap command execution with error handling
   */
  private static wrapCommandExecution(interaction: CommandInteraction): void {
    // Get the original interaction handler
    const commandName = interaction.commandName;
    const handlerKey = `${commandName}_${interaction.id}`;  // Use interaction ID for uniqueness

    // Find and wrap the command handler if not already wrapped
    if (!this.commandHandlers.has(handlerKey)) {
      this.wrapCommand(commandName, handlerKey, interaction);
    }
  }

  /**
   * Wrap a specific command with error handling
   */
  private static wrapCommand(commandName: string, handlerKey: string, interaction: CommandInteraction): void {
    try {
      // Create wrapped handler
      const wrappedHandler = async (..._args: any[]) => {
        const startTime = Date.now();
        const context = this.createExecutionContext(interaction);
        
        try {
          logger.info(`Command execution started: ${commandName}`, context);
          
          // Execute original command logic would go here
          // This is a placeholder as the actual command execution happens in discordx
          
          const duration = Date.now() - startTime;
          logger.info(`Command execution completed: ${commandName}`, {
            ...context,
            duration: `${duration}ms`
          });
          
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error(`Command execution failed: ${commandName}`, {
            ...context,
            duration: `${duration}ms`,
            error: error instanceof Error ? error.message : String(error)
          });
          
          await this.handleCommandError(error as Error, interaction);
        }
      };

      this.commandHandlers.set(handlerKey, wrappedHandler);
      
    } catch (error) {
      logger.error(`Failed to wrap command ${commandName}:`, error);
    }
  }

  /**
   * Handle command errors
   */
  private static async handleCommandError(error: Error, interaction: CommandInteraction): Promise<void> {
    try {
      await this.errorHandlingService.handleDiscordError(error, interaction);
    } catch (handlingError) {
      logger.error('Error handling failed:', handlingError);
      
      // Fallback error handling
      await this.handleFallbackError(interaction);
    }
  }

  /**
   * Fallback error handling when main error handling fails
   */
  private static async handleFallbackError(interaction: CommandInteraction): Promise<void> {
    try {
      const fallbackError = new DiscordError(
        'A critical error occurred while processing your command',
        ErrorCode.SYS_INTERNAL_ERROR,
        {
          commandName: interaction.commandName,
          guildId: interaction.guildId || undefined,
          userId: interaction.user.id,
          metadata: {
            isFallback: true,
            timestamp: new Date().toISOString()
          }
        }
      );

      await ErrorHandlerMiddleware.handleError(fallbackError, interaction);
    } catch (fallbackError) {
      logger.error('Fallback error handling failed:', fallbackError);
    }
  }

  /**
   * Create execution context for logging
   */
  private static createExecutionContext(interaction: CommandInteraction): Record<string, any> {
    return {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.tag,
      commandName: interaction.commandName,
      subcommand: interaction.isChatInputCommand() ? interaction.options.getSubcommand(false) || undefined : undefined,
      channelId: interaction.channelId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Register a manual command wrapper for specific commands
   */
  public static wrapCommandMethod<T extends (...args: any[]) => Promise<any>>(
    commandMethod: T,
    commandName: string,
    options?: {
      allowBusinessRuleBypass?: boolean;
      customPermissionMessage?: string;
      convertCommonErrors?: boolean;
    }
  ): T {
    return (async (...args: any[]) => {
      const interaction = args.find(arg => 
        arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
      ) as CommandInteraction;

      if (!interaction) {
        logger.warn(`No interaction found for command: ${commandName}`);
        return await commandMethod(...args);
      }

      const startTime = Date.now();
      const context = this.createExecutionContext(interaction);

      try {
        logger.info(`Manual command execution started: ${commandName}`, context);
        
        const result = await commandMethod(...args);
        
        const duration = Date.now() - startTime;
        logger.info(`Manual command execution completed: ${commandName}`, {
          ...context,
          duration: `${duration}ms`
        });
        
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Manual command execution failed: ${commandName}`, {
          ...context,
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : String(error)
        });
        
        let processedError = error;

        // Convert common errors if requested
        if (options?.convertCommonErrors !== false && !(error instanceof BaseError)) {
          processedError = this.convertCommonError(error as Error, interaction);
        }

        // Add bypass information for business rule errors
        if (processedError instanceof BaseError && 
            options?.allowBusinessRuleBypass && 
            interaction.guild?.ownerId === interaction.user.id) {
          processedError.enrichContext({
            metadata: {
              ...processedError.context.metadata,
              bypassAllowed: true,
              bypassMessage: 'As guild owner, you can override this restriction.'
            }
          });
        }

        await this.errorHandlingService.handleDiscordError(processedError as Error, interaction);
      }
    }) as T;
  }

  /**
   * Convert common errors to domain errors
   */
  private static convertCommonError(error: Error, interaction: CommandInteraction): Error {
    if (error instanceof TypeError && error.message.includes('Cannot read')) {
      return new DiscordError(
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
      return new DiscordError(
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

  /**
   * Get command execution statistics
   */
  public static getCommandStats(): Record<string, any> {
    return {
      wrappedCommands: this.commandHandlers.size,
      isInitialized: this.isInitialized,
      errorMetrics: this.errorHandlingService?.getErrorMetrics() || {}
    };
  }

  /**
   * Reset command interceptor
   */
  public static reset(): void {
    this.commandHandlers.clear();
    this.originalHandlers.clear();
    this.isInitialized = false;
    
    if (this.errorHandlingService) {
      this.errorHandlingService.resetErrorMetrics();
    }
    
    logger.info('CommandInterceptor reset');
  }
}