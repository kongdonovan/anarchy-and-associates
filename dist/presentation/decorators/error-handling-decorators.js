"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeErrorHandling = initializeErrorHandling;
exports.HandleDiscordErrors = HandleDiscordErrors;
exports.HandleSpecificErrors = HandleSpecificErrors;
exports.HandlePermissionErrors = HandlePermissionErrors;
exports.HandleValidationErrors = HandleValidationErrors;
exports.HandleBusinessRuleErrors = HandleBusinessRuleErrors;
exports.ConvertErrors = ConvertErrors;
exports.HandleAllErrors = HandleAllErrors;
exports.getErrorHandlingService = getErrorHandlingService;
const error_handler_middleware_1 = require("../../infrastructure/middleware/error-handler-middleware");
const error_handling_service_1 = require("../../application/services/error-handling-service");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const errors_1 = require("../../domain/errors");
const logger_1 = require("../../infrastructure/logger");
/**
 * Global error handling service instance
 */
let globalErrorHandlingService = null;
/**
 * Initialize the global error handling service
 */
function initializeErrorHandling(_target) {
    const auditLogRepository = new audit_log_repository_1.AuditLogRepository();
    globalErrorHandlingService = new error_handling_service_1.ErrorHandlingService(auditLogRepository);
}
/**
 * Decorator for automatic error handling in Discord commands
 */
function HandleDiscordErrors(_target, _propertyName, descriptor) {
    const method = descriptor.value;
    descriptor.value = async function (...args) {
        try {
            return await method.apply(this, args);
        }
        catch (error) {
            // Find the interaction parameter
            const interaction = args.find(arg => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
            if (interaction) {
                // Use global error handling service if available
                if (globalErrorHandlingService) {
                    await globalErrorHandlingService.handleDiscordError(error, interaction);
                }
                else {
                    // Fallback to middleware directly
                    await error_handler_middleware_1.ErrorHandlerMiddleware.handleError(error, interaction);
                }
            }
            else {
                // Log error if no interaction found
                logger_1.logger.error(`Error in ${_propertyName} (no interaction found):`, error);
                throw error;
            }
        }
    };
    return descriptor;
}
/**
 * Decorator for handling specific error types with custom behavior
 */
function HandleSpecificErrors(errorTypes) {
    return function (_target, _propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            try {
                return await method.apply(this, args);
            }
            catch (error) {
                // Check if error is one of the specified types
                const isSpecificError = errorTypes.some(ErrorType => error instanceof ErrorType);
                if (isSpecificError) {
                    const interaction = args.find(arg => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
                    if (interaction) {
                        if (globalErrorHandlingService) {
                            await globalErrorHandlingService.handleDiscordError(error, interaction);
                        }
                        else {
                            await error_handler_middleware_1.ErrorHandlerMiddleware.handleError(error, interaction);
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
function HandlePermissionErrors(customMessage) {
    return function (_target, _propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            try {
                return await method.apply(this, args);
            }
            catch (error) {
                if (error instanceof errors_1.PermissionError) {
                    const interaction = args.find(arg => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
                    if (interaction) {
                        // Create custom permission error if message provided
                        if (customMessage) {
                            const customError = new errors_1.PermissionError(customMessage, error.errorCode, {
                                ...error.context,
                                metadata: {
                                    ...error.context.metadata,
                                    customMessage
                                }
                            });
                            if (globalErrorHandlingService) {
                                await globalErrorHandlingService.handleDiscordError(customError, interaction);
                            }
                            else {
                                await error_handler_middleware_1.ErrorHandlerMiddleware.handleError(customError, interaction);
                            }
                        }
                        else {
                            if (globalErrorHandlingService) {
                                await globalErrorHandlingService.handleDiscordError(error, interaction);
                            }
                            else {
                                await error_handler_middleware_1.ErrorHandlerMiddleware.handleError(error, interaction);
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
function HandleValidationErrors(_target, _propertyName, descriptor) {
    const method = descriptor.value;
    descriptor.value = async function (...args) {
        try {
            return await method.apply(this, args);
        }
        catch (error) {
            if (error instanceof errors_1.ValidationError) {
                const interaction = args.find(arg => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
                if (interaction) {
                    if (globalErrorHandlingService) {
                        await globalErrorHandlingService.handleDiscordError(error, interaction);
                    }
                    else {
                        await error_handler_middleware_1.ErrorHandlerMiddleware.handleError(error, interaction);
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
function HandleBusinessRuleErrors(allowBypass = false) {
    return function (_target, _propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            try {
                return await method.apply(this, args);
            }
            catch (error) {
                if (error instanceof errors_1.BusinessRuleError) {
                    const interaction = args.find(arg => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
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
                        }
                        else {
                            await error_handler_middleware_1.ErrorHandlerMiddleware.handleError(error, interaction);
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
function ConvertErrors(_target, _propertyName, descriptor) {
    const method = descriptor.value;
    descriptor.value = async function (...args) {
        try {
            return await method.apply(this, args);
        }
        catch (error) {
            const interaction = args.find(arg => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
            let convertedError = error;
            // Convert common errors to domain errors
            if (!(error instanceof errors_1.BaseError)) {
                if (error instanceof TypeError && error.message.includes('Cannot read')) {
                    convertedError = new errors_1.ValidationError('Invalid input provided', errors_1.ErrorCode.VAL_INVALID_INPUT, {
                        commandName: interaction?.commandName,
                        metadata: {
                            originalError: error.message
                        }
                    });
                }
                else if (error.message?.includes('Missing permissions') || error.message?.includes('Forbidden')) {
                    convertedError = new errors_1.PermissionError('Insufficient permissions', errors_1.ErrorCode.PERM_INSUFFICIENT_PERMISSIONS, {
                        commandName: interaction?.commandName,
                        metadata: {
                            originalError: error.message
                        }
                    });
                }
                else if (error.message?.includes('Unknown') && interaction) {
                    convertedError = errors_1.DiscordError.fromDiscordJSError(error, {
                        commandName: interaction.commandName,
                        guildId: interaction.guildId || undefined,
                        userId: interaction.user.id
                    });
                }
            }
            if (interaction && convertedError !== error) {
                if (globalErrorHandlingService) {
                    await globalErrorHandlingService.handleDiscordError(convertedError, interaction);
                }
                else {
                    await error_handler_middleware_1.ErrorHandlerMiddleware.handleError(convertedError, interaction);
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
function HandleAllErrors(options) {
    return function (_target, _propertyName, descriptor) {
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
function getErrorHandlingService() {
    return globalErrorHandlingService;
}
//# sourceMappingURL=error-handling-decorators.js.map