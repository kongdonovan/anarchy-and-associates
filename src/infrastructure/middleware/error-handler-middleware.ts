import { CommandInteraction, EmbedBuilder } from 'discord.js';
import { 
  BaseError, 
  ErrorContext
} from '../../domain/errors';
import { EmbedUtils } from '../utils/embed-utils';
import { ErrorEmbedUtils } from '../utils/error-embed-utils';
import { ErrorContextService, EnhancedErrorContext } from '../../application/services/error-context-service';
import { logger, EnhancedLogger } from '../logger';

/**
 * Discord-specific error context (extends EnhancedErrorContext)
 */
export interface DiscordErrorContext extends EnhancedErrorContext {
  interaction?: CommandInteraction;
}

/**
 * Error handler middleware for Discord commands
 */
export class ErrorHandlerMiddleware {
  /**
   * Main error handling method for Discord interactions
   */
  public static async handleError(
    error: Error,
    interaction: CommandInteraction,
    context?: Partial<DiscordErrorContext>
  ): Promise<void> {
    try {
      // Enrich context with Discord interaction data
      const enrichedContext = await this.enrichErrorContext(error, interaction, context);
      
      // Log the error with full context including breadcrumbs
      this.logError(error, enrichedContext);
      
      // Create user-friendly response
      const errorEmbed = this.createErrorEmbed(error, enrichedContext);
      
      // Send error response to user
      await this.sendErrorResponse(interaction, errorEmbed);
      
      // Complete any active operations for this context
      if (enrichedContext.operationId) {
        ErrorContextService.completeOperation(enrichedContext.operationId);
      }
      
    } catch (handlingError) {
      // Fallback error handling if the middleware itself fails
      logger.error('Error handler middleware failed:', handlingError);
      await this.sendFallbackResponse(interaction);
    }
  }

  /**
   * Enriches error context with Discord interaction data using enhanced context service
   */
  private static async enrichErrorContext(
    error: Error,
    interaction: CommandInteraction,
    additionalContext?: Partial<DiscordErrorContext>
  ): Promise<DiscordErrorContext> {
    // Create enhanced context using the context service
    const enhancedContext = await ErrorContextService.createFromInteraction(
      interaction,
      `error_handling.${interaction.commandName}`
    );

    const baseContext: DiscordErrorContext = {
      ...enhancedContext,
      interaction,
      metadata: {
        ...enhancedContext.metadata,
        errorHandlingStarted: Date.now(),
        ...additionalContext?.metadata
      }
    };

    // If it's a BaseError, enrich its context
    if (error instanceof BaseError) {
      error.enrichContext(baseContext);
      
      // Create correlation chain if this error has parent errors
      if (error.context.metadata?.parentErrors) {
        const correlationChain = ErrorContextService.createCorrelationChain(
          error.context.metadata.parentErrors,
          baseContext
        );
        baseContext.metadata!.correlationChain = correlationChain;
      }

      return { ...baseContext, ...error.context };
    }

    return { ...baseContext, ...additionalContext };
  }

  /**
   * Logs error using enhanced logger with full context and correlation tracking
   */
  private static logError(error: Error, context: DiscordErrorContext): void {
    // Use enhanced logger for better error tracking and correlation
    EnhancedLogger.logError(error, context, {
      source: 'error_handler_middleware',
      interactionId: context.interaction?.id,
      channelType: context.discordContext?.channelType,
      memberRoles: context.discordContext?.memberRoles,
      permissions: context.discordContext?.permissions
    });

    // Log security events for permission errors
    if (error instanceof BaseError && error.errorCode.startsWith('PERM_')) {
      EnhancedLogger.logSecurityEvent(
        `Permission error: ${error.message}`,
        'medium',
        context,
        {
          attemptedAction: context.action,
          requiredPermissions: context.permissions,
          userRoles: context.discordContext?.memberRoles
        }
      );
    }

    // Log performance metrics if available
    if (context.performanceMetrics) {
      EnhancedLogger.logPerformanceMetrics(
        `Discord Command: ${context.commandName}`,
        {
          duration: context.performanceMetrics.duration || 0,
          memoryUsage: context.performanceMetrics.memoryUsage,
          resourcesAccessed: context.performanceMetrics.resourcesAccessed,
          operationType: context.performanceMetrics.operationType
        },
        context
      );
    }
  }

  /**
   * Creates appropriate error embed based on error type
   */
  private static createErrorEmbed(error: Error, context: DiscordErrorContext): EmbedBuilder {
    return ErrorEmbedUtils.createErrorEmbed(error, {
      guildId: context.guildId,
      userId: context.userId,
      commandName: context.commandName,
      showTechnicalDetails: false, // Don't show technical details to users by default
      includeErrorId: true
    });
  }

  // Removed - now using ErrorEmbedUtils.createErrorEmbed()

  // Removed - now using ErrorEmbedUtils.createErrorEmbed()

  // Removed - colors now defined in ErrorEmbedUtils

  /**
   * Sends error response to user
   */
  private static async sendErrorResponse(
    interaction: CommandInteraction,
    errorEmbed: EmbedBuilder
  ): Promise<void> {
    const responseOptions = {
      embeds: [errorEmbed],
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(responseOptions);
    } else {
      await interaction.reply(responseOptions);
    }
  }

  /**
   * Sends fallback response when error handling fails
   */
  private static async sendFallbackResponse(interaction: CommandInteraction): Promise<void> {
    const fallbackEmbed = EmbedUtils.createErrorEmbed(
      'System Error',
      'A critical error occurred. Please contact an administrator.'
    );

    const responseOptions = {
      embeds: [fallbackEmbed],
      ephemeral: true
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(responseOptions);
      } else {
        await interaction.reply(responseOptions);
      }
    } catch (fallbackError) {
      logger.error('Complete error handling failure:', fallbackError);
    }
  }

  // Removed - error ID generation moved to ErrorEmbedUtils
}

/**
 * Decorator for automatic error handling in Discord commands
 */
export function HandleErrors(_target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      // Find the interaction parameter (usually first or second parameter)
      const interaction = args.find(arg => 
        arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
      );

      if (interaction) {
        await ErrorHandlerMiddleware.handleError(error as Error, interaction);
      } else {
        // Log error if no interaction found
        logger.error(`Error in ${propertyName} (no interaction found):`, error);
        throw error;
      }
    }
  };

  return descriptor;
}

/**
 * Error boundary for non-Discord errors
 */
export class ErrorBoundary {
  /**
   * Wraps async functions with error handling
   */
  public static wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: Partial<ErrorContext>
  ): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        logger.error('Error boundary caught error:', { error, context });
        throw error;
      }
    }) as T;
  }

  /**
   * Handles uncaught errors in the application
   */
  public static handleUncaughtError(error: Error): void {
    logger.error('Uncaught error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    // Don't exit the process for operational errors
    if (error instanceof BaseError && error.isOperational) {
      return;
    }

    // For non-operational errors, log and potentially exit
    logger.error('Non-operational error detected. Application stability may be compromised.');
  }
}