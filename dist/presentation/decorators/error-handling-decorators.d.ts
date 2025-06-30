import { ErrorHandlingService } from '../../application/services/error-handling-service';
/**
 * Initialize the global error handling service
 */
export declare function initializeErrorHandling(_target?: any): void;
/**
 * Decorator for automatic error handling in Discord commands
 */
export declare function HandleDiscordErrors(_target: any, _propertyName: string, descriptor: PropertyDescriptor): PropertyDescriptor;
/**
 * Decorator for handling specific error types with custom behavior
 */
export declare function HandleSpecificErrors(errorTypes: (new (...args: any[]) => Error)[]): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Decorator for permission error handling with custom messages
 */
export declare function HandlePermissionErrors(customMessage?: string): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Decorator for validation error handling with field details
 */
export declare function HandleValidationErrors(_target: any, _propertyName: string, descriptor: PropertyDescriptor): PropertyDescriptor;
/**
 * Decorator for business rule error handling with bypass options
 */
export declare function HandleBusinessRuleErrors(allowBypass?: boolean): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Decorator that converts common errors to domain errors
 */
export declare function ConvertErrors(_target: any, _propertyName: string, descriptor: PropertyDescriptor): PropertyDescriptor;
/**
 * Composite decorator that combines all error handling decorators
 */
export declare function HandleAllErrors(options?: {
    allowBusinessRuleBypass?: boolean;
    customPermissionMessage?: string;
    convertCommonErrors?: boolean;
}): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Method to get error handling service
 */
export declare function getErrorHandlingService(): ErrorHandlingService | null;
//# sourceMappingURL=error-handling-decorators.d.ts.map