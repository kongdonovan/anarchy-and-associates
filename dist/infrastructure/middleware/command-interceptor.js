"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandInterceptor = void 0;
const error_handler_middleware_1 = require("./error-handler-middleware");
const error_handling_service_1 = require("../../application/services/error-handling-service");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const logger_1 = require("../logger");
const errors_1 = require("../../domain/errors");
/**
 * Command interceptor that automatically wraps all Discord commands with error handling
 */
class CommandInterceptor {
    /**
     * Initialize the command interceptor
     */
    static initialize(client) {
        if (this.isInitialized) {
            logger_1.logger.warn('CommandInterceptor already initialized');
            return;
        }
        // Initialize error handling service
        const auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        this.errorHandlingService = new error_handling_service_1.ErrorHandlingService(auditLogRepository);
        // Hook into Discord.js interaction handling
        this.setupInteractionHook(client);
        this.isInitialized = true;
        logger_1.logger.info('CommandInterceptor initialized successfully');
    }
    /**
     * Setup interaction hook to intercept commands
     */
    static setupInteractionHook(client) {
        // Store original interaction handler
        const originalEmit = client.emit.bind(client);
        // Override emit to intercept interactions
        client.emit = function (event, ...args) {
            if (event === 'interactionCreate') {
                const interaction = args[0];
                if (interaction?.isCommand?.()) {
                    // Wrap command execution with error handling
                    CommandInterceptor.wrapCommandExecution(interaction);
                }
            }
            // Call original emit
            return originalEmit(event, ...args);
        };
    }
    /**
     * Wrap command execution with error handling
     */
    static wrapCommandExecution(interaction) {
        // Get the original interaction handler
        const commandName = interaction.commandName;
        const handlerKey = `${commandName}_${interaction.id}`; // Use interaction ID for uniqueness
        // Find and wrap the command handler if not already wrapped
        if (!this.commandHandlers.has(handlerKey)) {
            this.wrapCommand(commandName, handlerKey, interaction);
        }
    }
    /**
     * Wrap a specific command with error handling
     */
    static wrapCommand(commandName, handlerKey, interaction) {
        try {
            // Create wrapped handler
            const wrappedHandler = async (..._args) => {
                const startTime = Date.now();
                const context = this.createExecutionContext(interaction);
                try {
                    logger_1.logger.info(`Command execution started: ${commandName}`, context);
                    // Execute original command logic would go here
                    // This is a placeholder as the actual command execution happens in discordx
                    const duration = Date.now() - startTime;
                    logger_1.logger.info(`Command execution completed: ${commandName}`, {
                        ...context,
                        duration: `${duration}ms`
                    });
                }
                catch (error) {
                    const duration = Date.now() - startTime;
                    logger_1.logger.error(`Command execution failed: ${commandName}`, {
                        ...context,
                        duration: `${duration}ms`,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    await this.handleCommandError(error, interaction);
                }
            };
            this.commandHandlers.set(handlerKey, wrappedHandler);
        }
        catch (error) {
            logger_1.logger.error(`Failed to wrap command ${commandName}:`, error);
        }
    }
    /**
     * Handle command errors
     */
    static async handleCommandError(error, interaction) {
        try {
            await this.errorHandlingService.handleDiscordError(error, interaction);
        }
        catch (handlingError) {
            logger_1.logger.error('Error handling failed:', handlingError);
            // Fallback error handling
            await this.handleFallbackError(interaction);
        }
    }
    /**
     * Fallback error handling when main error handling fails
     */
    static async handleFallbackError(interaction) {
        try {
            const fallbackError = new errors_1.DiscordError('A critical error occurred while processing your command', errors_1.ErrorCode.SYS_INTERNAL_ERROR, {
                commandName: interaction.commandName,
                guildId: interaction.guildId || undefined,
                userId: interaction.user.id,
                metadata: {
                    isFallback: true,
                    timestamp: new Date().toISOString()
                }
            });
            await error_handler_middleware_1.ErrorHandlerMiddleware.handleError(fallbackError, interaction);
        }
        catch (fallbackError) {
            logger_1.logger.error('Fallback error handling failed:', fallbackError);
        }
    }
    /**
     * Create execution context for logging
     */
    static createExecutionContext(interaction) {
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
    static wrapCommandMethod(commandMethod, commandName, options) {
        return (async (...args) => {
            const interaction = args.find(arg => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
            if (!interaction) {
                logger_1.logger.warn(`No interaction found for command: ${commandName}`);
                return await commandMethod(...args);
            }
            const startTime = Date.now();
            const context = this.createExecutionContext(interaction);
            try {
                logger_1.logger.info(`Manual command execution started: ${commandName}`, context);
                const result = await commandMethod(...args);
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Manual command execution completed: ${commandName}`, {
                    ...context,
                    duration: `${duration}ms`
                });
                return result;
            }
            catch (error) {
                const duration = Date.now() - startTime;
                logger_1.logger.error(`Manual command execution failed: ${commandName}`, {
                    ...context,
                    duration: `${duration}ms`,
                    error: error instanceof Error ? error.message : String(error)
                });
                let processedError = error;
                // Convert common errors if requested
                if (options?.convertCommonErrors !== false && !(error instanceof errors_1.BaseError)) {
                    processedError = this.convertCommonError(error, interaction);
                }
                // Add bypass information for business rule errors
                if (processedError instanceof errors_1.BaseError &&
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
                await this.errorHandlingService.handleDiscordError(processedError, interaction);
            }
        });
    }
    /**
     * Convert common errors to domain errors
     */
    static convertCommonError(error, interaction) {
        if (error instanceof TypeError && error.message.includes('Cannot read')) {
            return new errors_1.DiscordError('Invalid input provided', errors_1.ErrorCode.VAL_INVALID_INPUT, {
                commandName: interaction.commandName,
                guildId: interaction.guildId || undefined,
                userId: interaction.user.id,
                metadata: {
                    originalError: error.message,
                    errorType: 'TypeError'
                }
            });
        }
        if (error.message?.includes('Missing permissions') || error.message?.includes('Forbidden')) {
            return new errors_1.DiscordError('Insufficient permissions to perform this action', errors_1.ErrorCode.PERM_INSUFFICIENT_PERMISSIONS, {
                commandName: interaction.commandName,
                guildId: interaction.guildId || undefined,
                userId: interaction.user.id,
                metadata: {
                    originalError: error.message,
                    errorType: 'PermissionError'
                }
            });
        }
        if (error.message?.includes('Unknown') ||
            error.name === 'DiscordAPIError' ||
            'code' in error) {
            return errors_1.DiscordError.fromDiscordJSError(error, {
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
    static getCommandStats() {
        return {
            wrappedCommands: this.commandHandlers.size,
            isInitialized: this.isInitialized,
            errorMetrics: this.errorHandlingService?.getErrorMetrics() || {}
        };
    }
    /**
     * Reset command interceptor
     */
    static reset() {
        this.commandHandlers.clear();
        this.originalHandlers.clear();
        this.isInitialized = false;
        if (this.errorHandlingService) {
            this.errorHandlingService.resetErrorMetrics();
        }
        logger_1.logger.info('CommandInterceptor reset');
    }
}
exports.CommandInterceptor = CommandInterceptor;
CommandInterceptor.isInitialized = false;
CommandInterceptor.commandHandlers = new Map();
CommandInterceptor.originalHandlers = new Map();
//# sourceMappingURL=command-interceptor.js.map