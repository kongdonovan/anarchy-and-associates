"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationErrorHandler = exports.ErrorType = void 0;
const logger_1 = require("../logger");
const embed_utils_1 = require("../utils/embed-utils");
var ErrorType;
(function (ErrorType) {
    ErrorType["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    ErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorType["RESOURCE_NOT_FOUND"] = "RESOURCE_NOT_FOUND";
    ErrorType["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorType["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorType["DISCORD_API_ERROR"] = "DISCORD_API_ERROR";
    ErrorType["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
    ErrorType["SYSTEM_ERROR"] = "SYSTEM_ERROR";
    ErrorType["QUEUE_TIMEOUT"] = "QUEUE_TIMEOUT";
    ErrorType["CONCURRENT_MODIFICATION"] = "CONCURRENT_MODIFICATION";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
class ApplicationErrorHandler {
    constructor() { }
    static getInstance() {
        if (!ApplicationErrorHandler.instance) {
            ApplicationErrorHandler.instance = new ApplicationErrorHandler();
        }
        return ApplicationErrorHandler.instance;
    }
    createError(type, message, userMessage, details, originalError) {
        const error = new Error(message);
        error.type = type;
        error.userMessage = userMessage;
        error.details = details;
        error.originalError = originalError;
        return error;
    }
    handleError(error, context) {
        const appError = this.normalizeError(error);
        // Log the error with context
        logger_1.logger.error('Application error occurred', {
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
    normalizeError(error) {
        if (!error) {
            return this.createError(ErrorType.SYSTEM_ERROR, 'Unknown error occurred', 'An unexpected error occurred. Please try again later.', undefined, new Error('Null or undefined error'));
        }
        if (this.isApplicationError(error)) {
            return error;
        }
        // Convert generic errors to application errors
        const message = error.message || 'Unknown error';
        if (message.includes('Permission')) {
            return this.createError(ErrorType.PERMISSION_DENIED, message, 'You do not have permission to perform this action.', undefined, error);
        }
        if (message.includes('not found') || message.includes('Not Found')) {
            return this.createError(ErrorType.RESOURCE_NOT_FOUND, message, 'The requested resource could not be found.', undefined, error);
        }
        if (message.toLowerCase().includes('validation') || message.toLowerCase().includes('invalid')) {
            return this.createError(ErrorType.VALIDATION_ERROR, message, 'The provided information is not valid. Please check your input and try again.', undefined, error);
        }
        if (message.includes('timeout') || message.includes('timed out')) {
            return this.createError(ErrorType.QUEUE_TIMEOUT, message, 'The operation took too long to complete. Please try again.', undefined, error);
        }
        // Default system error
        return this.createError(ErrorType.SYSTEM_ERROR, message, 'A system error occurred. Please try again later.', undefined, error);
    }
    isApplicationError(error) {
        return error && typeof error === 'object' && 'type' in error && 'userMessage' in error;
    }
    createErrorEmbed(error) {
        switch (error.type) {
            case ErrorType.PERMISSION_DENIED:
                return embed_utils_1.EmbedUtils.createErrorEmbed('🚫 Permission Denied', error.userMessage);
            case ErrorType.VALIDATION_ERROR:
                return embed_utils_1.EmbedUtils.createErrorEmbed('⚠️ Validation Error', error.userMessage);
            case ErrorType.RESOURCE_NOT_FOUND:
                return embed_utils_1.EmbedUtils.createErrorEmbed('🔍 Not Found', error.userMessage);
            case ErrorType.RATE_LIMIT_EXCEEDED:
                return embed_utils_1.EmbedUtils.createErrorEmbed('⏱️ Rate Limit Exceeded', error.userMessage);
            case ErrorType.DATABASE_ERROR:
                return embed_utils_1.EmbedUtils.createErrorEmbed('💾 Service Temporarily Unavailable', 'Our services are temporarily unavailable. Please try again in a few moments.');
            case ErrorType.DISCORD_API_ERROR:
                return embed_utils_1.EmbedUtils.createErrorEmbed('🤖 Discord Service Issue', 'There was an issue communicating with Discord. Please try again.');
            case ErrorType.EXTERNAL_SERVICE_ERROR:
                return embed_utils_1.EmbedUtils.createErrorEmbed('🌐 External Service Issue', 'An external service is temporarily unavailable. Please try again later.');
            case ErrorType.QUEUE_TIMEOUT:
                return embed_utils_1.EmbedUtils.createErrorEmbed('⏰ Operation Timeout', error.userMessage);
            case ErrorType.CONCURRENT_MODIFICATION:
                return embed_utils_1.EmbedUtils.createErrorEmbed('🔄 Concurrent Modification', 'Another operation is currently in progress. Please try again in a moment.');
            default:
                return embed_utils_1.EmbedUtils.createErrorEmbed('❌ System Error', 'A system error occurred. Please try again later.');
        }
    }
    shouldBeEphemeral(errorType) {
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
    async executeWithErrorHandling(operation, context) {
        try {
            const result = await operation();
            return { success: true, result };
        }
        catch (error) {
            const appError = this.normalizeError(error);
            // Add context to error
            if (context) {
                appError.userId = context.userId;
                appError.guildId = context.guildId;
            }
            return { success: false, error: appError };
        }
    }
}
exports.ApplicationErrorHandler = ApplicationErrorHandler;
//# sourceMappingURL=error-handler.js.map