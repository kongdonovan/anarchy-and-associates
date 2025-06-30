"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorFactory = void 0;
exports.isCustomError = isCustomError;
exports.isRetryableError = isRetryableError;
const base_error_1 = require("./base-error");
const business_rule_error_1 = require("./business-rule-error");
const validation_error_1 = require("./validation-error");
const permission_error_1 = require("./permission-error");
const not_found_error_1 = require("./not-found-error");
const database_error_1 = require("./database-error");
/**
 * Factory class for creating consistent error instances
 */
class ErrorFactory {
    /**
     * Creates a staff limit exceeded error
     */
    static staffLimitExceeded(role, currentCount, maxCount, context) {
        return new business_rule_error_1.BusinessRuleError(`Cannot hire more ${role}. Current: ${currentCount}, Maximum: ${maxCount}`, base_error_1.ErrorCode.BR_STAFF_LIMIT_EXCEEDED, 'staff-limit', {
            ...context,
            currentValue: currentCount,
            allowedValue: maxCount,
            metadata: { role }
        });
    }
    /**
     * Creates a role hierarchy violation error
     */
    static roleHierarchyViolation(action, targetRole, userRole, context) {
        return new business_rule_error_1.BusinessRuleError(`Cannot ${action} ${targetRole} as ${userRole}. Role hierarchy violation.`, base_error_1.ErrorCode.BR_ROLE_HIERARCHY_VIOLATION, 'role-hierarchy', {
            ...context,
            metadata: { action, targetRole, userRole }
        });
    }
    /**
     * Creates a multiple roles exceeded error
     */
    static multipleRolesExceeded(userId, currentRoles, context) {
        return new business_rule_error_1.BusinessRuleError(`User cannot have more than 2 staff roles. Currently has: ${currentRoles.join(', ')}`, base_error_1.ErrorCode.BR_MULTIPLE_ROLES_EXCEEDED, 'multiple-roles-limit', {
            ...context,
            userId,
            currentValue: currentRoles.length,
            allowedValue: 2,
            metadata: { currentRoles }
        });
    }
    /**
     * Creates a validation error for missing required fields
     */
    static missingRequiredFields(fields, context) {
        if (fields.length === 1) {
            return new validation_error_1.ValidationError(`Required field '${fields[0]}' is missing`, base_error_1.ErrorCode.VAL_MISSING_REQUIRED_FIELD, { ...context, field: fields[0] });
        }
        const failures = fields.map(field => ({
            field,
            value: undefined,
            message: 'Field is required',
            constraint: 'required'
        }));
        return validation_error_1.ValidationError.createMultiFieldError(failures, context);
    }
    /**
     * Creates a validation error for invalid format
     */
    static invalidFormat(field, expectedFormat, actualValue, context) {
        return new validation_error_1.ValidationError(`Field '${field}' has invalid format. Expected: ${expectedFormat}`, base_error_1.ErrorCode.VAL_INVALID_FORMAT, {
            ...context,
            field,
            value: actualValue,
            constraints: { format: expectedFormat }
        });
    }
    /**
     * Creates a permission error for insufficient permissions
     */
    static insufficientPermissions(action, resource, requiredPermission, context) {
        return permission_error_1.PermissionError.createWithAuditContext(action, resource, requiredPermission, context || {});
    }
    /**
     * Creates a not found error for entities
     */
    static entityNotFound(entityType, entityId, context) {
        return new not_found_error_1.NotFoundError(`${entityType} with ID '${entityId}' not found`, base_error_1.ErrorCode.NF_ENTITY_NOT_FOUND, entityType, {
            ...context,
            resourceId: entityId,
            entityType
        });
    }
    /**
     * Creates a not found error with search criteria
     */
    static notFoundWithCriteria(resourceType, criteria, context) {
        return not_found_error_1.NotFoundError.createWithSearchContext(resourceType, criteria, context);
    }
    /**
     * Creates a database connection error
     */
    static databaseConnectionFailed(details, context) {
        return new database_error_1.DatabaseError(`Database connection failed: ${details}`, base_error_1.ErrorCode.DB_CONNECTION_FAILED, database_error_1.DatabaseOperation.CONNECTION, {
            ...context,
            isRetryable: true
        });
    }
    /**
     * Creates a database transaction error
     */
    static transactionFailed(operation, collections, originalError, context) {
        return database_error_1.DatabaseError.createTransactionError(operation, collections, originalError, context);
    }
    /**
     * Transforms unknown errors into our error types
     */
    static fromUnknown(error, defaultMessage = 'An unexpected error occurred', context) {
        if (error instanceof Error) {
            // Check if it's already one of our errors
            if (error instanceof business_rule_error_1.BusinessRuleError ||
                error instanceof validation_error_1.ValidationError ||
                error instanceof permission_error_1.PermissionError ||
                error instanceof not_found_error_1.NotFoundError ||
                error instanceof database_error_1.DatabaseError) {
                return error;
            }
            // Check for MongoDB errors
            if (error.name && error.name.includes('Mongo')) {
                return database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.FIND, undefined, context);
            }
            // Default to business rule error for known errors
            return new business_rule_error_1.BusinessRuleError(error.message || defaultMessage, base_error_1.ErrorCode.SYS_INTERNAL_ERROR, 'unknown-error', {
                ...context,
                metadata: {
                    originalError: error.message,
                    errorName: error.name,
                    stack: error.stack
                }
            });
        }
        // For non-Error objects, create a generic business rule error
        return new business_rule_error_1.BusinessRuleError(defaultMessage, base_error_1.ErrorCode.SYS_INTERNAL_ERROR, 'unknown-error', {
            ...context,
            metadata: {
                originalError: String(error)
            }
        });
    }
}
exports.ErrorFactory = ErrorFactory;
/**
 * Type guard to check if an error is one of our custom errors
 */
function isCustomError(error) {
    return error instanceof business_rule_error_1.BusinessRuleError ||
        error instanceof validation_error_1.ValidationError ||
        error instanceof permission_error_1.PermissionError ||
        error instanceof not_found_error_1.NotFoundError ||
        error instanceof database_error_1.DatabaseError;
}
/**
 * Type guard to check if an error is retryable
 */
function isRetryableError(error) {
    if (error instanceof database_error_1.DatabaseError) {
        return error.isRetryable;
    }
    return false;
}
//# sourceMappingURL=error-factory.js.map