import { ErrorCode, ErrorContext, BaseError } from './base-error';
import { BusinessRuleError } from './business-rule-error';
import { ValidationError, FieldValidationFailure } from './validation-error';
import { PermissionError } from './permission-error';
import { NotFoundError } from './not-found-error';
import { DatabaseError, DatabaseOperation } from './database-error';

/**
 * Factory class for creating consistent error instances
 */
export class ErrorFactory {
  /**
   * Creates a staff limit exceeded error
   */
  public static staffLimitExceeded(
    role: string,
    currentCount: number,
    maxCount: number,
    context?: Partial<ErrorContext>
  ): BusinessRuleError {
    return new BusinessRuleError(
      `Cannot hire more ${role}. Current: ${currentCount}, Maximum: ${maxCount}`,
      ErrorCode.BR_STAFF_LIMIT_EXCEEDED,
      'staff-limit',
      {
        ...context,
        currentValue: currentCount,
        allowedValue: maxCount,
        metadata: { role }
      }
    );
  }

  /**
   * Creates a role hierarchy violation error
   */
  public static roleHierarchyViolation(
    action: string,
    targetRole: string,
    userRole: string,
    context?: Partial<ErrorContext>
  ): BusinessRuleError {
    return new BusinessRuleError(
      `Cannot ${action} ${targetRole} as ${userRole}. Role hierarchy violation.`,
      ErrorCode.BR_ROLE_HIERARCHY_VIOLATION,
      'role-hierarchy',
      {
        ...context,
        metadata: { action, targetRole, userRole }
      }
    );
  }

  /**
   * Creates a multiple roles exceeded error
   */
  public static multipleRolesExceeded(
    userId: string,
    currentRoles: string[],
    context?: Partial<ErrorContext>
  ): BusinessRuleError {
    return new BusinessRuleError(
      `User cannot have more than 2 staff roles. Currently has: ${currentRoles.join(', ')}`,
      ErrorCode.BR_MULTIPLE_ROLES_EXCEEDED,
      'multiple-roles-limit',
      {
        ...context,
        userId,
        currentValue: currentRoles.length,
        allowedValue: 2,
        metadata: { currentRoles }
      }
    );
  }

  /**
   * Creates a validation error for missing required fields
   */
  public static missingRequiredFields(
    fields: string[],
    context?: Partial<ErrorContext>
  ): ValidationError {
    if (fields.length === 1) {
      return new ValidationError(
        `Required field '${fields[0]}' is missing`,
        ErrorCode.VAL_MISSING_REQUIRED_FIELD,
        { ...context, field: fields[0] }
      );
    }

    const failures: FieldValidationFailure[] = fields.map(field => ({
      field,
      value: undefined,
      message: 'Field is required',
      constraint: 'required'
    }));

    return ValidationError.createMultiFieldError(failures, context);
  }

  /**
   * Creates a validation error for invalid format
   */
  public static invalidFormat(
    field: string,
    expectedFormat: string,
    actualValue: any,
    context?: Partial<ErrorContext>
  ): ValidationError {
    return new ValidationError(
      `Field '${field}' has invalid format. Expected: ${expectedFormat}`,
      ErrorCode.VAL_INVALID_FORMAT,
      {
        ...context,
        field,
        value: actualValue,
        constraints: { format: expectedFormat }
      }
    );
  }

  /**
   * Creates a permission error for insufficient permissions
   */
  public static insufficientPermissions(
    action: string,
    resource: string,
    requiredPermission: string,
    context?: Partial<ErrorContext>
  ): PermissionError {
    return PermissionError.createWithAuditContext(
      action,
      resource,
      requiredPermission,
      context || {}
    );
  }

  /**
   * Creates a not found error for entities
   */
  public static entityNotFound(
    entityType: string,
    entityId: string,
    context?: Partial<ErrorContext>
  ): NotFoundError {
    return new NotFoundError(
      `${entityType} with ID '${entityId}' not found`,
      ErrorCode.NF_ENTITY_NOT_FOUND,
      entityType,
      {
        ...context,
        resourceId: entityId,
        entityType
      }
    );
  }

  /**
   * Creates a not found error with search criteria
   */
  public static notFoundWithCriteria(
    resourceType: string,
    criteria: Record<string, any>,
    context?: Partial<ErrorContext>
  ): NotFoundError {
    return NotFoundError.createWithSearchContext(resourceType, criteria, context);
  }

  /**
   * Creates a database connection error
   */
  public static databaseConnectionFailed(
    details: string,
    context?: Partial<ErrorContext>
  ): DatabaseError {
    return new DatabaseError(
      `Database connection failed: ${details}`,
      ErrorCode.DB_CONNECTION_FAILED,
      DatabaseOperation.CONNECTION,
      {
        ...context,
        isRetryable: true
      }
    );
  }

  /**
   * Creates a database transaction error
   */
  public static transactionFailed(
    operation: string,
    collections: string[],
    originalError: Error,
    context?: Partial<ErrorContext>
  ): DatabaseError {
    return DatabaseError.createTransactionError(
      operation,
      collections,
      originalError,
      context
    );
  }

  /**
   * Transforms unknown errors into our error types
   */
  public static fromUnknown(
    error: unknown,
    defaultMessage: string = 'An unexpected error occurred',
    context?: Partial<ErrorContext>
  ): BaseError {
    if (error instanceof Error) {
      // Check if it's already one of our errors
      if (error instanceof BusinessRuleError ||
          error instanceof ValidationError ||
          error instanceof PermissionError ||
          error instanceof NotFoundError ||
          error instanceof DatabaseError) {
        return error;
      }

      // Check for MongoDB errors
      if (error.name && error.name.includes('Mongo')) {
        return DatabaseError.fromMongoError(
          error,
          DatabaseOperation.FIND,
          undefined,
          context
        );
      }

      // Default to business rule error for known errors
      return new BusinessRuleError(
        error.message || defaultMessage,
        ErrorCode.SYS_INTERNAL_ERROR,
        'unknown-error',
        {
          ...context,
          metadata: {
            originalError: error.message,
            errorName: error.name,
            stack: error.stack
          }
        }
      );
    }

    // For non-Error objects, create a generic business rule error
    return new BusinessRuleError(
      defaultMessage,
      ErrorCode.SYS_INTERNAL_ERROR,
      'unknown-error',
      {
        ...context,
        metadata: {
          originalError: String(error)
        }
      }
    );
  }
}

/**
 * Type guard to check if an error is one of our custom errors
 */
export function isCustomError(error: unknown): error is BusinessRuleError | ValidationError | PermissionError | NotFoundError | DatabaseError {
  return error instanceof BusinessRuleError ||
         error instanceof ValidationError ||
         error instanceof PermissionError ||
         error instanceof NotFoundError ||
         error instanceof DatabaseError;
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof DatabaseError) {
    return error.isRetryable;
  }
  return false;
}