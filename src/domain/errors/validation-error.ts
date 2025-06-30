import { BaseError, ErrorContext, ErrorCode } from './base-error';

/**
 * Error class for input validation failures
 */
export class ValidationError extends BaseError {
  public readonly field?: string;
  public readonly value?: any;
  public readonly constraints?: Record<string, any>;

  constructor(
    message: string,
    errorCode: ErrorCode,
    context?: Partial<ValidationErrorContext>
  ) {
    super(message, errorCode as string, context);
    this.field = context?.field;
    this.value = context?.value;
    this.constraints = context?.constraints;
  }

  protected getClientMessage(): string {
    switch (this.errorCode) {
      case ErrorCode.VAL_INVALID_INPUT:
        return this.field 
          ? `Invalid input for field '${this.field}'.`
          : 'Invalid input provided.';
      case ErrorCode.VAL_MISSING_REQUIRED_FIELD:
        return this.field
          ? `Required field '${this.field}' is missing.`
          : 'Required field is missing.';
      case ErrorCode.VAL_INVALID_FORMAT:
        return this.field
          ? `Field '${this.field}' has an invalid format.`
          : 'Invalid format provided.';
      case ErrorCode.VAL_OUT_OF_RANGE:
        return this.field
          ? `Field '${this.field}' value is out of acceptable range.`
          : 'Value is out of acceptable range.';
      case ErrorCode.VAL_DUPLICATE_ENTRY:
        return this.field
          ? `Duplicate value for field '${this.field}'.`
          : 'Duplicate entry detected.';
      default:
        return 'Validation error occurred.';
    }
  }

  /**
   * Creates a validation error for multiple field failures
   */
  public static createMultiFieldError(
    failures: FieldValidationFailure[],
    context?: Partial<ErrorContext>
  ): ValidationError {
    const message = `Validation failed for fields: ${failures.map(f => f.field).join(', ')}`;
    const error = new ValidationError(
      message,
      ErrorCode.VAL_INVALID_INPUT,
      {
        ...context,
        fieldFailures: failures
      }
    );
    return error;
  }
}

/**
 * Extended context for validation errors
 */
export interface ValidationErrorContext extends ErrorContext {
  field?: string;
  value?: any;
  constraints?: Record<string, any>;
  fieldFailures?: FieldValidationFailure[];
}

/**
 * Individual field validation failure
 */
export interface FieldValidationFailure {
  field: string;
  value: any;
  message: string;
  constraint?: string;
}