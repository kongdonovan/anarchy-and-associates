import { PermissionContext } from '../services/permission-service';
/**
 * Validation severity levels
 */
export declare enum ValidationSeverity {
    ERROR = "error",
    WARNING = "warning",
    INFO = "info"
}
/**
 * Individual validation issue
 */
export interface ValidationIssue {
    severity: ValidationSeverity;
    code: string;
    message: string;
    field?: string;
    context?: Record<string, any>;
}
/**
 * Validation result containing all issues and metadata
 */
export interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
    metadata?: Record<string, any>;
    bypassAvailable?: boolean;
    bypassType?: 'guild-owner' | 'admin';
}
/**
 * Context object for validation containing all necessary data
 */
export interface ValidationContext {
    permissionContext: PermissionContext;
    entityType: string;
    entityId?: string;
    operation: string;
    data: Record<string, any>;
    metadata?: Record<string, any>;
}
/**
 * Base interface for all validation strategies
 */
export interface ValidationStrategy {
    /**
     * Strategy name for identification
     */
    readonly name: string;
    /**
     * Validates the provided context
     * @param context The validation context containing all necessary data
     * @returns Promise resolving to validation result
     */
    validate(context: ValidationContext): Promise<ValidationResult>;
    /**
     * Checks if this strategy can handle the given validation context
     * @param context The validation context
     * @returns True if this strategy can handle the validation
     */
    canHandle(context: ValidationContext): boolean;
}
/**
 * Factory function type for creating validation strategies
 */
export type ValidationStrategyFactory = (dependencies: any) => ValidationStrategy;
/**
 * Aggregated validation result from multiple strategies
 */
export interface AggregatedValidationResult extends ValidationResult {
    strategyResults: Map<string, ValidationResult>;
}
/**
 * Options for validation execution
 */
export interface ValidationOptions {
    /**
     * Stop validation on first error
     */
    failFast?: boolean;
    /**
     * Strategies to include (if not specified, all applicable strategies are used)
     */
    includeStrategies?: string[];
    /**
     * Strategies to exclude
     */
    excludeStrategies?: string[];
    /**
     * Custom metadata to pass to strategies
     */
    metadata?: Record<string, any>;
}
/**
 * Validation error thrown when validation fails
 */
export declare class ValidationError extends Error {
    readonly result: ValidationResult;
    constructor(result: ValidationResult, message?: string);
}
/**
 * Helper functions for working with validation results
 */
export declare class ValidationResultHelper {
    /**
     * Creates a successful validation result
     */
    static success(metadata?: Record<string, any>): ValidationResult;
    /**
     * Creates a failed validation result with a single error
     */
    static error(code: string, message: string, field?: string): ValidationResult;
    /**
     * Creates a validation result with warnings only
     */
    static warning(code: string, message: string, field?: string): ValidationResult;
    /**
     * Merges multiple validation results
     */
    static merge(...results: ValidationResult[]): ValidationResult;
    /**
     * Checks if result has errors
     */
    static hasErrors(result: ValidationResult): boolean;
    /**
     * Checks if result has warnings
     */
    static hasWarnings(result: ValidationResult): boolean;
    /**
     * Gets all error messages
     */
    static getErrorMessages(result: ValidationResult): string[];
    /**
     * Gets all warning messages
     */
    static getWarningMessages(result: ValidationResult): string[];
}
//# sourceMappingURL=types.d.ts.map