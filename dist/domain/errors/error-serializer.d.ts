import { BaseError, SerializedError } from './base-error';
/**
 * Error serialization system for structured logging
 */
export declare class ErrorSerializer {
    private static readonly SENSITIVE_FIELDS;
    /**
     * Serializes an error for Winston logging with appropriate log level
     */
    static serializeForLogging(error: unknown): {
        level: string;
        error: SerializedError | Record<string, any>;
        tags: string[];
    };
    /**
     * Determines the appropriate log level based on error type
     */
    private static determineLogLevel;
    /**
     * Sanitizes error data to remove sensitive information
     */
    private static sanitizeError;
    /**
     * Recursively sanitizes an object to remove sensitive fields
     */
    private static sanitizeObject;
    /**
     * Sanitizes a string to remove potential sensitive data
     */
    private static sanitizeString;
    /**
     * Generates tags for error categorization and searching
     */
    private static generateTags;
    /**
     * Logs an error with appropriate formatting and context
     */
    static logError(error: unknown, additionalContext?: Record<string, any>): void;
    /**
     * Creates a structured error response for audit logging
     */
    static serializeForAudit(error: BaseError): Record<string, any>;
}
//# sourceMappingURL=error-serializer.d.ts.map