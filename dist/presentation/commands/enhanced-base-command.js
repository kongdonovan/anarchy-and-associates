"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedBaseCommand = void 0;
const base_command_1 = require("./base-command");
const error_handling_service_1 = require("../../application/services/error-handling-service");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const errors_1 = require("../../domain/errors");
/**
 * Enhanced base command with automatic error handling
 */
class EnhancedBaseCommand extends base_command_1.BaseCommand {
    constructor() {
        super();
        // Initialize error handling service
        const auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        this.errorHandlingService = new error_handling_service_1.ErrorHandlingService(auditLogRepository);
    }
    /**
     * Execute command with automatic error handling
     */
    async executeWithErrorHandling(interaction, commandFunction, operationName) {
        try {
            this.logCommandExecution(interaction, operationName || 'command execution started');
            const result = await commandFunction();
            this.logCommandExecution(interaction, operationName || 'command execution completed');
            return result;
        }
        catch (error) {
            this.logCommandError(interaction, operationName || 'command execution', error);
            await this.errorHandlingService.handleDiscordError(error, interaction);
        }
    }
    /**
     * Execute command with specific error type handling
     */
    async executeWithSpecificErrorHandling(interaction, commandFunction, errorTypes, operationName) {
        try {
            this.logCommandExecution(interaction, operationName || 'command execution started');
            const result = await commandFunction();
            this.logCommandExecution(interaction, operationName || 'command execution completed');
            return result;
        }
        catch (error) {
            this.logCommandError(interaction, operationName || 'command execution', error);
            // Check if error is one of the specified types
            const isSpecificError = errorTypes.some(ErrorType => error instanceof ErrorType);
            if (isSpecificError) {
                await this.errorHandlingService.handleDiscordError(error, interaction);
                return;
            }
            // Re-throw if not a specific error type
            throw error;
        }
    }
    /**
     * Execute command with permission error handling
     */
    async executeWithPermissionHandling(interaction, commandFunction, customPermissionMessage, operationName) {
        try {
            this.logCommandExecution(interaction, operationName || 'command execution started');
            const result = await commandFunction();
            this.logCommandExecution(interaction, operationName || 'command execution completed');
            return result;
        }
        catch (error) {
            this.logCommandError(interaction, operationName || 'command execution', error);
            if (error instanceof errors_1.PermissionError) {
                // Create custom permission error if message provided
                if (customPermissionMessage) {
                    const customError = new errors_1.PermissionError(customPermissionMessage, error.errorCode, {
                        ...error.context,
                        metadata: {
                            ...error.context.metadata,
                            customMessage: customPermissionMessage
                        }
                    });
                    await this.errorHandlingService.handleDiscordError(customError, interaction);
                }
                else {
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
    async executeWithBusinessRuleHandling(interaction, commandFunction, allowBypass = false, operationName) {
        try {
            this.logCommandExecution(interaction, operationName || 'command execution started');
            const result = await commandFunction();
            this.logCommandExecution(interaction, operationName || 'command execution completed');
            return result;
        }
        catch (error) {
            this.logCommandError(interaction, operationName || 'command execution', error);
            if (error instanceof errors_1.BusinessRuleError) {
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
    async executeWithErrorConversion(interaction, commandFunction, operationName) {
        try {
            this.logCommandExecution(interaction, operationName || 'command execution started');
            const result = await commandFunction();
            this.logCommandExecution(interaction, operationName || 'command execution completed');
            return result;
        }
        catch (error) {
            this.logCommandError(interaction, operationName || 'command execution', error);
            let convertedError = error;
            // Convert common errors to domain errors
            if (!(convertedError instanceof errors_1.BaseError)) {
                if (convertedError instanceof TypeError && convertedError.message.includes('Cannot read')) {
                    convertedError = new errors_1.ValidationError('Invalid input provided', errors_1.ErrorCode.VAL_INVALID_INPUT, {
                        commandName: interaction.commandName,
                        guildId: interaction.guildId || undefined,
                        userId: interaction.user.id,
                        metadata: {
                            originalError: convertedError.message,
                            errorType: 'TypeError'
                        }
                    });
                }
                else if (convertedError.message?.includes('Missing permissions') || convertedError.message?.includes('Forbidden')) {
                    convertedError = new errors_1.PermissionError('Insufficient permissions to perform this action', errors_1.ErrorCode.PERM_INSUFFICIENT_PERMISSIONS, {
                        commandName: interaction.commandName,
                        guildId: interaction.guildId || undefined,
                        userId: interaction.user.id,
                        metadata: {
                            originalError: convertedError.message,
                            errorType: 'PermissionError'
                        }
                    });
                }
                else if (convertedError.message?.includes('Unknown') ||
                    convertedError.name === 'DiscordAPIError' ||
                    'code' in convertedError) {
                    convertedError = errors_1.DiscordError.fromDiscordJSError(convertedError, {
                        commandName: interaction.commandName,
                        guildId: interaction.guildId || undefined,
                        userId: interaction.user.id
                    });
                }
            }
            await this.errorHandlingService.handleDiscordError(convertedError, interaction);
        }
    }
    /**
     * Safe execution wrapper that handles all types of errors
     */
    async safeExecute(interaction, commandFunction, options) {
        const operationName = options?.operationName || 'safe command execution';
        try {
            this.logCommandExecution(interaction, `${operationName} started`);
            // Pre-execution validation if available
            if (this.commandValidationService) {
                const validationResult = await this.validateCommand(interaction);
                if (!validationResult.isValid) {
                    const validationError = new errors_1.ValidationError(validationResult.errors.join('; '), errors_1.ErrorCode.VAL_INVALID_INPUT, {
                        commandName: interaction.commandName,
                        guildId: interaction.guildId || undefined,
                        userId: interaction.user.id,
                        metadata: {
                            validationErrors: validationResult.errors,
                            validationWarnings: validationResult.warnings
                        }
                    });
                    throw validationError;
                }
            }
            const result = await commandFunction();
            this.logCommandExecution(interaction, `${operationName} completed successfully`);
            return result;
        }
        catch (error) {
            this.logCommandError(interaction, operationName, error);
            let processedError = error;
            // Convert common errors if requested
            if (options?.convertCommonErrors !== false && !(processedError instanceof errors_1.BaseError)) {
                processedError = this.convertCommonError(processedError, interaction);
            }
            // Add bypass information for business rule errors
            if (processedError instanceof errors_1.BusinessRuleError &&
                options?.allowBusinessRuleBypass &&
                interaction.guild?.ownerId === interaction.user.id) {
                processedError.enrichContext({
                    metadata: {
                        ...processedError.context.metadata,
                        bypassAllowed: true,
                        bypassMessage: 'As guild owner, you can override this business rule.'
                    }
                });
            }
            // Add custom message for permission errors
            if (processedError instanceof errors_1.PermissionError && options?.customPermissionMessage) {
                processedError = new errors_1.PermissionError(options.customPermissionMessage, processedError.errorCode, {
                    ...processedError.context,
                    metadata: {
                        ...processedError.context.metadata,
                        customMessage: options.customPermissionMessage
                    }
                });
            }
            await this.errorHandlingService.handleDiscordError(processedError, interaction);
        }
    }
    /**
     * Convert common errors to domain errors
     */
    convertCommonError(error, interaction) {
        if (error instanceof TypeError && error.message.includes('Cannot read')) {
            return new errors_1.ValidationError('Invalid input provided', errors_1.ErrorCode.VAL_INVALID_INPUT, {
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
            return new errors_1.PermissionError('Insufficient permissions to perform this action', errors_1.ErrorCode.PERM_INSUFFICIENT_PERMISSIONS, {
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
}
exports.EnhancedBaseCommand = EnhancedBaseCommand;
//# sourceMappingURL=enhanced-base-command.js.map