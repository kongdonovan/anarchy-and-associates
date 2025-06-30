import { ErrorContext, BaseError } from './base-error';
import { BusinessRuleError } from './business-rule-error';
import { ValidationError } from './validation-error';
import { PermissionError } from './permission-error';
import { NotFoundError } from './not-found-error';
import { DatabaseError } from './database-error';
/**
 * Factory class for creating consistent error instances
 */
export declare class ErrorFactory {
    /**
     * Creates a staff limit exceeded error
     */
    static staffLimitExceeded(role: string, currentCount: number, maxCount: number, context?: Partial<ErrorContext>): BusinessRuleError;
    /**
     * Creates a role hierarchy violation error
     */
    static roleHierarchyViolation(action: string, targetRole: string, userRole: string, context?: Partial<ErrorContext>): BusinessRuleError;
    /**
     * Creates a multiple roles exceeded error
     */
    static multipleRolesExceeded(userId: string, currentRoles: string[], context?: Partial<ErrorContext>): BusinessRuleError;
    /**
     * Creates a validation error for missing required fields
     */
    static missingRequiredFields(fields: string[], context?: Partial<ErrorContext>): ValidationError;
    /**
     * Creates a validation error for invalid format
     */
    static invalidFormat(field: string, expectedFormat: string, actualValue: any, context?: Partial<ErrorContext>): ValidationError;
    /**
     * Creates a permission error for insufficient permissions
     */
    static insufficientPermissions(action: string, resource: string, requiredPermission: string, context?: Partial<ErrorContext>): PermissionError;
    /**
     * Creates a not found error for entities
     */
    static entityNotFound(entityType: string, entityId: string, context?: Partial<ErrorContext>): NotFoundError;
    /**
     * Creates a not found error with search criteria
     */
    static notFoundWithCriteria(resourceType: string, criteria: Record<string, any>, context?: Partial<ErrorContext>): NotFoundError;
    /**
     * Creates a database connection error
     */
    static databaseConnectionFailed(details: string, context?: Partial<ErrorContext>): DatabaseError;
    /**
     * Creates a database transaction error
     */
    static transactionFailed(operation: string, collections: string[], originalError: Error, context?: Partial<ErrorContext>): DatabaseError;
    /**
     * Transforms unknown errors into our error types
     */
    static fromUnknown(error: unknown, defaultMessage?: string, context?: Partial<ErrorContext>): BaseError;
}
/**
 * Type guard to check if an error is one of our custom errors
 */
export declare function isCustomError(error: unknown): error is BusinessRuleError | ValidationError | PermissionError | NotFoundError | DatabaseError;
/**
 * Type guard to check if an error is retryable
 */
export declare function isRetryableError(error: unknown): boolean;
//# sourceMappingURL=error-factory.d.ts.map