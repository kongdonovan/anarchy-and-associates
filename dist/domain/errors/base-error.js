"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = exports.BaseError = void 0;
/**
 * Base error class for all custom errors in the application.
 * Provides context preservation, error codes, and metadata support.
 */
class BaseError extends Error {
    constructor(message, errorCode, context, isOperational = true) {
        super(message);
        // Maintain proper prototype chain
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = this.constructor.name;
        this.errorCode = errorCode;
        this.timestamp = new Date();
        this.isOperational = isOperational;
        // Merge provided context with defaults
        this.context = {
            guildId: context?.guildId,
            userId: context?.userId,
            commandName: context?.commandName,
            metadata: context?.metadata || {},
            ...context
        };
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    /**
     * Serializes the error for logging purposes
     */
    serialize() {
        return {
            name: this.name,
            message: this.message,
            errorCode: this.errorCode,
            timestamp: this.timestamp.toISOString(),
            context: this.context,
            stack: this.stack,
            isOperational: this.isOperational
        };
    }
    /**
     * Enriches the error context with additional information
     */
    enrichContext(additionalContext) {
        Object.assign(this.context, additionalContext);
        return this;
    }
    /**
     * Creates a sanitized version of the error for client display
     */
    toClientError() {
        return {
            message: this.getClientMessage(),
            errorCode: this.errorCode,
            timestamp: this.timestamp.toISOString()
        };
    }
}
exports.BaseError = BaseError;
/**
 * Standard error codes used across the application
 */
var ErrorCode;
(function (ErrorCode) {
    // Business rule errors (BR_)
    ErrorCode["BR_STAFF_LIMIT_EXCEEDED"] = "BR_001";
    ErrorCode["BR_ROLE_HIERARCHY_VIOLATION"] = "BR_002";
    ErrorCode["BR_CASE_ASSIGNMENT_INVALID"] = "BR_003";
    ErrorCode["BR_JOB_CAPACITY_EXCEEDED"] = "BR_004";
    ErrorCode["BR_PROMOTION_NOT_ALLOWED"] = "BR_005";
    ErrorCode["BR_MULTIPLE_ROLES_EXCEEDED"] = "BR_006";
    // Validation errors (VAL_)
    ErrorCode["VAL_INVALID_INPUT"] = "VAL_001";
    ErrorCode["VAL_MISSING_REQUIRED_FIELD"] = "VAL_002";
    ErrorCode["VAL_INVALID_FORMAT"] = "VAL_003";
    ErrorCode["VAL_OUT_OF_RANGE"] = "VAL_004";
    ErrorCode["VAL_DUPLICATE_ENTRY"] = "VAL_005";
    // Permission errors (PERM_)
    ErrorCode["PERM_INSUFFICIENT_PERMISSIONS"] = "PERM_001";
    ErrorCode["PERM_ACTION_NOT_ALLOWED"] = "PERM_002";
    ErrorCode["PERM_ROLE_REQUIRED"] = "PERM_003";
    ErrorCode["PERM_OWNER_ONLY"] = "PERM_004";
    // Not found errors (NF_)
    ErrorCode["NF_ENTITY_NOT_FOUND"] = "NF_001";
    ErrorCode["NF_USER_NOT_FOUND"] = "NF_002";
    ErrorCode["NF_CHANNEL_NOT_FOUND"] = "NF_003";
    ErrorCode["NF_ROLE_NOT_FOUND"] = "NF_004";
    ErrorCode["NF_GUILD_NOT_FOUND"] = "NF_005";
    // Database errors (DB_)
    ErrorCode["DB_CONNECTION_FAILED"] = "DB_001";
    ErrorCode["DB_QUERY_FAILED"] = "DB_002";
    ErrorCode["DB_TRANSACTION_FAILED"] = "DB_003";
    ErrorCode["DB_CONSTRAINT_VIOLATION"] = "DB_004";
    ErrorCode["DB_TIMEOUT"] = "DB_005";
    // System errors (SYS_)
    ErrorCode["SYS_INTERNAL_ERROR"] = "SYS_001";
    ErrorCode["SYS_SERVICE_UNAVAILABLE"] = "SYS_002";
    ErrorCode["SYS_CONFIGURATION_ERROR"] = "SYS_003";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
//# sourceMappingURL=base-error.js.map