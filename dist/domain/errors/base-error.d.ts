/**
 * Base error class for all custom errors in the application.
 * Provides context preservation, error codes, and metadata support.
 */
export declare abstract class BaseError extends Error {
    readonly errorCode: string;
    readonly timestamp: Date;
    readonly context: ErrorContext;
    readonly isOperational: boolean;
    constructor(message: string, errorCode: string, context?: Partial<ErrorContext>, isOperational?: boolean);
    /**
     * Serializes the error for logging purposes
     */
    serialize(): SerializedError;
    /**
     * Enriches the error context with additional information
     */
    enrichContext(additionalContext: Partial<ErrorContext>): this;
    /**
     * Creates a sanitized version of the error for client display
     */
    toClientError(): ClientError;
    /**
     * Override in subclasses to provide user-friendly error messages
     */
    protected abstract getClientMessage(): string;
}
/**
 * Context information for errors
 */
export interface ErrorContext {
    guildId?: string;
    userId?: string;
    commandName?: string;
    entityId?: string;
    entityType?: string;
    action?: string;
    permissions?: string[];
    metadata: Record<string, any>;
}
/**
 * Serialized error format for logging
 */
export interface SerializedError {
    name: string;
    message: string;
    errorCode: string;
    timestamp: string;
    context: ErrorContext;
    stack?: string;
    isOperational: boolean;
}
/**
 * Client-safe error format
 */
export interface ClientError {
    message: string;
    errorCode: string;
    timestamp: string;
}
/**
 * Standard error codes used across the application
 */
export declare enum ErrorCode {
    BR_STAFF_LIMIT_EXCEEDED = "BR_001",
    BR_ROLE_HIERARCHY_VIOLATION = "BR_002",
    BR_CASE_ASSIGNMENT_INVALID = "BR_003",
    BR_JOB_CAPACITY_EXCEEDED = "BR_004",
    BR_PROMOTION_NOT_ALLOWED = "BR_005",
    BR_MULTIPLE_ROLES_EXCEEDED = "BR_006",
    VAL_INVALID_INPUT = "VAL_001",
    VAL_MISSING_REQUIRED_FIELD = "VAL_002",
    VAL_INVALID_FORMAT = "VAL_003",
    VAL_OUT_OF_RANGE = "VAL_004",
    VAL_DUPLICATE_ENTRY = "VAL_005",
    PERM_INSUFFICIENT_PERMISSIONS = "PERM_001",
    PERM_ACTION_NOT_ALLOWED = "PERM_002",
    PERM_ROLE_REQUIRED = "PERM_003",
    PERM_OWNER_ONLY = "PERM_004",
    NF_ENTITY_NOT_FOUND = "NF_001",
    NF_USER_NOT_FOUND = "NF_002",
    NF_CHANNEL_NOT_FOUND = "NF_003",
    NF_ROLE_NOT_FOUND = "NF_004",
    NF_GUILD_NOT_FOUND = "NF_005",
    DB_CONNECTION_FAILED = "DB_001",
    DB_QUERY_FAILED = "DB_002",
    DB_TRANSACTION_FAILED = "DB_003",
    DB_CONSTRAINT_VIOLATION = "DB_004",
    DB_TIMEOUT = "DB_005",
    SYS_INTERNAL_ERROR = "SYS_001",
    SYS_SERVICE_UNAVAILABLE = "SYS_002",
    SYS_CONFIGURATION_ERROR = "SYS_003"
}
//# sourceMappingURL=base-error.d.ts.map