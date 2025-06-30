"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorBoundary = exports.ErrorHandlerMiddleware = void 0;
exports.HandleErrors = HandleErrors;
const errors_1 = require("../../domain/errors");
const embed_utils_1 = require("../utils/embed-utils");
const error_embed_utils_1 = require("../utils/error-embed-utils");
const error_context_service_1 = require("../../application/services/error-context-service");
const logger_1 = require("../logger");
/**
 * Error handler middleware for Discord commands
 */
class ErrorHandlerMiddleware {
    /**
     * Main error handling method for Discord interactions
     */
    static async handleError(error, interaction, context) {
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
                error_context_service_1.ErrorContextService.completeOperation(enrichedContext.operationId);
            }
        }
        catch (handlingError) {
            // Fallback error handling if the middleware itself fails
            logger_1.logger.error('Error handler middleware failed:', handlingError);
            await this.sendFallbackResponse(interaction);
        }
    }
    /**
     * Enriches error context with Discord interaction data using enhanced context service
     */
    static async enrichErrorContext(error, interaction, additionalContext) {
        // Create enhanced context using the context service
        const enhancedContext = await error_context_service_1.ErrorContextService.createFromInteraction(interaction, `error_handling.${interaction.commandName}`);
        const baseContext = {
            ...enhancedContext,
            interaction,
            metadata: {
                ...enhancedContext.metadata,
                errorHandlingStarted: Date.now(),
                ...additionalContext?.metadata
            }
        };
        // If it's a BaseError, enrich its context
        if (error instanceof errors_1.BaseError) {
            error.enrichContext(baseContext);
            // Create correlation chain if this error has parent errors
            if (error.context.metadata?.parentErrors) {
                const correlationChain = error_context_service_1.ErrorContextService.createCorrelationChain(error.context.metadata.parentErrors, baseContext);
                baseContext.metadata.correlationChain = correlationChain;
            }
            return { ...baseContext, ...error.context };
        }
        return { ...baseContext, ...additionalContext };
    }
    /**
     * Logs error using enhanced logger with full context and correlation tracking
     */
    static logError(error, context) {
        // Use enhanced logger for better error tracking and correlation
        logger_1.EnhancedLogger.logError(error, context, {
            source: 'error_handler_middleware',
            interactionId: context.interaction?.id,
            channelType: context.discordContext?.channelType,
            memberRoles: context.discordContext?.memberRoles,
            permissions: context.discordContext?.permissions
        });
        // Log security events for permission errors
        if (error instanceof errors_1.BaseError && error.errorCode.startsWith('PERM_')) {
            logger_1.EnhancedLogger.logSecurityEvent(`Permission error: ${error.message}`, 'medium', context, {
                attemptedAction: context.action,
                requiredPermissions: context.permissions,
                userRoles: context.discordContext?.memberRoles
            });
        }
        // Log performance metrics if available
        if (context.performanceMetrics) {
            logger_1.EnhancedLogger.logPerformanceMetrics(`Discord Command: ${context.commandName}`, {
                duration: context.performanceMetrics.duration || 0,
                memoryUsage: context.performanceMetrics.memoryUsage,
                resourcesAccessed: context.performanceMetrics.resourcesAccessed,
                operationType: context.performanceMetrics.operationType
            }, context);
        }
    }
    /**
     * Creates appropriate error embed based on error type
     */
    static createErrorEmbed(error, context) {
        return error_embed_utils_1.ErrorEmbedUtils.createErrorEmbed(error, {
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
    static async sendErrorResponse(interaction, errorEmbed) {
        const responseOptions = {
            embeds: [errorEmbed],
            ephemeral: true
        };
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(responseOptions);
        }
        else {
            await interaction.reply(responseOptions);
        }
    }
    /**
     * Sends fallback response when error handling fails
     */
    static async sendFallbackResponse(interaction) {
        const fallbackEmbed = embed_utils_1.EmbedUtils.createErrorEmbed('System Error', 'A critical error occurred. Please contact an administrator.');
        const responseOptions = {
            embeds: [fallbackEmbed],
            ephemeral: true
        };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply(responseOptions);
            }
            else {
                await interaction.reply(responseOptions);
            }
        }
        catch (fallbackError) {
            logger_1.logger.error('Complete error handling failure:', fallbackError);
        }
    }
}
exports.ErrorHandlerMiddleware = ErrorHandlerMiddleware;
/**
 * Decorator for automatic error handling in Discord commands
 */
function HandleErrors(_target, propertyName, descriptor) {
    const method = descriptor.value;
    descriptor.value = async function (...args) {
        try {
            return await method.apply(this, args);
        }
        catch (error) {
            // Find the interaction parameter (usually first or second parameter)
            const interaction = args.find(arg => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
            if (interaction) {
                await ErrorHandlerMiddleware.handleError(error, interaction);
            }
            else {
                // Log error if no interaction found
                logger_1.logger.error(`Error in ${propertyName} (no interaction found):`, error);
                throw error;
            }
        }
    };
    return descriptor;
}
/**
 * Error boundary for non-Discord errors
 */
class ErrorBoundary {
    /**
     * Wraps async functions with error handling
     */
    static wrap(fn, context) {
        return (async (...args) => {
            try {
                return await fn(...args);
            }
            catch (error) {
                logger_1.logger.error('Error boundary caught error:', { error, context });
                throw error;
            }
        });
    }
    /**
     * Handles uncaught errors in the application
     */
    static handleUncaughtError(error) {
        logger_1.logger.error('Uncaught error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        // Don't exit the process for operational errors
        if (error instanceof errors_1.BaseError && error.isOperational) {
            return;
        }
        // For non-operational errors, log and potentially exit
        logger_1.logger.error('Non-operational error detected. Application stability may be compromised.');
    }
}
exports.ErrorBoundary = ErrorBoundary;
//# sourceMappingURL=error-handler-middleware.js.map