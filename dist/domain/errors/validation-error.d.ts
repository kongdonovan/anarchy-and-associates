import { BaseError, ErrorContext, ErrorCode } from './base-error';
/**
 * Error class for input validation failures
 */
export declare class ValidationError extends BaseError {
    readonly field?: string;
    readonly value?: any;
    readonly constraints?: Record<string, any>;
    constructor(message: string, errorCode: ErrorCode, context?: Partial<ValidationErrorContext>);
    protected getClientMessage(): string;
    /**
     * Creates a validation error for multiple field failures
     */
    static createMultiFieldError(failures: FieldValidationFailure[], context?: Partial<ErrorContext>): ValidationError;
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
//# sourceMappingURL=validation-error.d.ts.map