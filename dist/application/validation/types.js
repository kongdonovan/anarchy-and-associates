"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationResultHelper = exports.ValidationError = exports.ValidationSeverity = void 0;
/**
 * Validation severity levels
 */
var ValidationSeverity;
(function (ValidationSeverity) {
    ValidationSeverity["ERROR"] = "error";
    ValidationSeverity["WARNING"] = "warning";
    ValidationSeverity["INFO"] = "info";
})(ValidationSeverity || (exports.ValidationSeverity = ValidationSeverity = {}));
/**
 * Validation error thrown when validation fails
 */
class ValidationError extends Error {
    constructor(result, message) {
        super(message || 'Validation failed');
        this.result = result;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/**
 * Helper functions for working with validation results
 */
class ValidationResultHelper {
    /**
     * Creates a successful validation result
     */
    static success(metadata) {
        return {
            valid: true,
            issues: [],
            metadata
        };
    }
    /**
     * Creates a failed validation result with a single error
     */
    static error(code, message, field) {
        return {
            valid: false,
            issues: [{
                    severity: ValidationSeverity.ERROR,
                    code,
                    message,
                    field
                }]
        };
    }
    /**
     * Creates a validation result with warnings only
     */
    static warning(code, message, field) {
        return {
            valid: true,
            issues: [{
                    severity: ValidationSeverity.WARNING,
                    code,
                    message,
                    field
                }]
        };
    }
    /**
     * Merges multiple validation results
     */
    static merge(...results) {
        const merged = {
            valid: true,
            issues: [],
            metadata: {}
        };
        for (const result of results) {
            merged.valid = merged.valid && result.valid;
            merged.issues.push(...result.issues);
            if (result.metadata) {
                Object.assign(merged.metadata, result.metadata);
            }
            if (result.bypassAvailable) {
                merged.bypassAvailable = true;
                merged.bypassType = result.bypassType;
            }
        }
        return merged;
    }
    /**
     * Checks if result has errors
     */
    static hasErrors(result) {
        return result.issues.some(issue => issue.severity === ValidationSeverity.ERROR);
    }
    /**
     * Checks if result has warnings
     */
    static hasWarnings(result) {
        return result.issues.some(issue => issue.severity === ValidationSeverity.WARNING);
    }
    /**
     * Gets all error messages
     */
    static getErrorMessages(result) {
        return result.issues
            .filter(issue => issue.severity === ValidationSeverity.ERROR)
            .map(issue => issue.message);
    }
    /**
     * Gets all warning messages
     */
    static getWarningMessages(result) {
        return result.issues
            .filter(issue => issue.severity === ValidationSeverity.WARNING)
            .map(issue => issue.message);
    }
}
exports.ValidationResultHelper = ValidationResultHelper;
//# sourceMappingURL=types.js.map