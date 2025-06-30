"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
const base_error_1 = require("./base-error");
/**
 * Error class for input validation failures
 */
class ValidationError extends base_error_1.BaseError {
    constructor(message, errorCode, context) {
        super(message, errorCode, context);
        this.field = context?.field;
        this.value = context?.value;
        this.constraints = context?.constraints;
    }
    getClientMessage() {
        switch (this.errorCode) {
            case base_error_1.ErrorCode.VAL_INVALID_INPUT:
                return this.field
                    ? `Invalid input for field '${this.field}'.`
                    : 'Invalid input provided.';
            case base_error_1.ErrorCode.VAL_MISSING_REQUIRED_FIELD:
                return this.field
                    ? `Required field '${this.field}' is missing.`
                    : 'Required field is missing.';
            case base_error_1.ErrorCode.VAL_INVALID_FORMAT:
                return this.field
                    ? `Field '${this.field}' has an invalid format.`
                    : 'Invalid format provided.';
            case base_error_1.ErrorCode.VAL_OUT_OF_RANGE:
                return this.field
                    ? `Field '${this.field}' value is out of acceptable range.`
                    : 'Value is out of acceptable range.';
            case base_error_1.ErrorCode.VAL_DUPLICATE_ENTRY:
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
    static createMultiFieldError(failures, context) {
        const message = `Validation failed for fields: ${failures.map(f => f.field).join(', ')}`;
        const error = new ValidationError(message, base_error_1.ErrorCode.VAL_INVALID_INPUT, {
            ...context,
            fieldFailures: failures
        });
        return error;
    }
}
exports.ValidationError = ValidationError;
//# sourceMappingURL=validation-error.js.map