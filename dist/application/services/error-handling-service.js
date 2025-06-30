"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalErrorHandler = exports.ErrorHandlingService = void 0;
const errors_1 = require("../../domain/errors");
const error_handler_middleware_1 = require("../../infrastructure/middleware/error-handler-middleware");
const logger_1 = require("../../infrastructure/logger");
const audit_log_1 = require("../../domain/entities/audit-log");
/**
 * Centralized error handling service
 */
class ErrorHandlingService {
    constructor(auditLogRepository) {
        this.errorMetrics = new Map();
        this.auditLogRepository = auditLogRepository;
    }
    /**
     * Handles Discord command errors
     */
    async handleDiscordError(error, interaction, additionalContext) {
        // Convert Discord.js errors to our custom types
        const processedError = this.processError(error, interaction);
        // Track error metrics
        this.trackErrorMetrics(processedError);
        // Log to audit trail if it's a significant error
        await this.auditError(processedError, interaction);
        // Use middleware to handle the error
        await error_handler_middleware_1.ErrorHandlerMiddleware.handleError(processedError, interaction, additionalContext);
    }
    /**
     * Handles service-level errors (non-Discord)
     */
    async handleServiceError(error, context) {
        const processedError = this.processError(error, null, context);
        // Track error metrics
        this.trackErrorMetrics(processedError);
        // Log error
        logger_1.logger.error('Service error occurred:', {
            error: processedError instanceof errors_1.BaseError ? processedError.serialize() : {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            context
        });
        // Re-throw for calling code to handle
        throw processedError;
    }
    /**
     * Processes and converts errors to appropriate types
     */
    processError(error, interaction, context) {
        // If it's already a BaseError, return as-is
        if (error instanceof errors_1.BaseError) {
            return error;
        }
        // Try to convert Discord.js errors
        if (this.isDiscordJSError(error)) {
            return errors_1.DiscordError.fromDiscordJSError(error, context);
        }
        // Try to convert MongoDB errors
        if (this.isMongoError(error)) {
            return this.convertMongoError(error, context);
        }
        // Try to convert validation errors
        if (this.isValidationError(error)) {
            return this.convertValidationError(error, context);
        }
        // For unknown errors, wrap in appropriate type
        if (interaction) {
            return new errors_1.DiscordError(error.message, errors_1.ErrorCode.SYS_INTERNAL_ERROR, context);
        }
        // Return as-is if we can't convert it
        return error;
    }
    /**
     * Checks if error is from Discord.js
     */
    isDiscordJSError(error) {
        return error.name === 'DiscordAPIError' ||
            error.name === 'HTTPError' ||
            'code' in error ||
            'status' in error;
    }
    /**
     * Checks if error is from MongoDB
     */
    isMongoError(error) {
        return error.name === 'MongoError' ||
            error.name === 'MongoServerError' ||
            error.name === 'MongoNetworkError' ||
            error.name === 'MongoTimeoutError' ||
            'code' in error && typeof error.code === 'number';
    }
    /**
     * Checks if error is a validation error
     */
    isValidationError(error) {
        return error.name === 'ValidationError' ||
            error.message.includes('validation') ||
            error.message.includes('required') ||
            error.message.includes('invalid');
    }
    /**
     * Converts MongoDB errors to DatabaseError
     */
    convertMongoError(error, context) {
        const mongoError = error;
        let errorCode = errors_1.ErrorCode.DB_QUERY_FAILED;
        let message = 'Database operation failed';
        if (mongoError.code === 11000) {
            errorCode = errors_1.ErrorCode.DB_CONSTRAINT_VIOLATION;
            message = 'Duplicate entry detected';
        }
        else if (mongoError.name === 'MongoNetworkError') {
            errorCode = errors_1.ErrorCode.DB_CONNECTION_FAILED;
            message = 'Database connection failed';
        }
        else if (mongoError.name === 'MongoTimeoutError') {
            errorCode = errors_1.ErrorCode.DB_TIMEOUT;
            message = 'Database operation timed out';
        }
        return new errors_1.DatabaseError(message, errorCode, errors_1.DatabaseOperation.FIND, context);
    }
    /**
     * Converts validation errors to ValidationError
     */
    convertValidationError(error, context) {
        return new errors_1.ValidationError(error.message, errors_1.ErrorCode.VAL_INVALID_INPUT, context);
    }
    /**
     * Tracks error metrics for monitoring
     */
    trackErrorMetrics(error) {
        const errorType = error.constructor.name;
        const errorCode = error instanceof errors_1.BaseError ? error.errorCode : 'UNKNOWN';
        const key = `${errorType}:${errorCode}`;
        const current = this.errorMetrics.get(key) || 0;
        this.errorMetrics.set(key, current + 1);
        // Log metrics periodically (every 100 errors)
        const total = Array.from(this.errorMetrics.values()).reduce((a, b) => a + b, 0);
        if (total % 100 === 0) {
            logger_1.logger.info('Error metrics summary:', Object.fromEntries(this.errorMetrics));
        }
    }
    /**
     * Audits significant errors
     */
    async auditError(error, interaction) {
        try {
            // Only audit certain types of errors
            if (error instanceof errors_1.PermissionError ||
                error instanceof errors_1.BusinessRuleError ||
                (error instanceof errors_1.BaseError && !error.isOperational)) {
                await this.auditLogRepository.add({
                    guildId: interaction.guildId || 'unknown',
                    actorId: interaction.user.id,
                    action: audit_log_1.AuditAction.SYSTEM_REPAIR, // We could add a new audit action for errors
                    targetId: interaction.user.id,
                    details: {
                        reason: 'Error occurred during command execution',
                        metadata: {
                            errorType: error.constructor.name,
                            errorCode: error instanceof errors_1.BaseError ? error.errorCode : 'UNKNOWN',
                            commandName: interaction.commandName,
                            errorMessage: error.message
                        }
                    },
                    timestamp: new Date()
                });
            }
        }
        catch (auditError) {
            logger_1.logger.error('Failed to audit error:', auditError);
        }
    }
    /**
     * Gets error metrics for monitoring
     */
    getErrorMetrics() {
        return Object.fromEntries(this.errorMetrics);
    }
    /**
     * Resets error metrics
     */
    resetErrorMetrics() {
        this.errorMetrics.clear();
    }
    /**
     * Creates error context from interaction
     */
    static createContextFromInteraction(interaction, additionalContext) {
        return {
            guildId: interaction.guildId || undefined,
            userId: interaction.user.id,
            commandName: interaction.commandName,
            metadata: {
                interactionId: interaction.id,
                channelId: interaction.channelId,
                createdTimestamp: interaction.createdTimestamp,
                ...additionalContext?.metadata
            },
            ...additionalContext
        };
    }
}
exports.ErrorHandlingService = ErrorHandlingService;
/**
 * Global error handler for uncaught errors
 */
class GlobalErrorHandler {
    // Error handling service could be used for advanced error handling in the future
    static initialize(_errorHandlingService) {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught Exception:', error);
            // Don't exit for operational errors
            if (error instanceof errors_1.BaseError && error.isOperational) {
                return;
            }
            // Exit for non-operational errors after a delay
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            if (reason instanceof errors_1.BaseError && reason.isOperational) {
                return;
            }
            // Exit for non-operational errors after a delay
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });
    }
}
exports.GlobalErrorHandler = GlobalErrorHandler;
//# sourceMappingURL=error-handling-service.js.map