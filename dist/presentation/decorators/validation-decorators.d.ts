import { CommandValidationRule, CommandValidationOptions } from '../../application/services/command-validation-service';
/**
 * Decorator to enable general command validation
 * @param options Validation options
 */
export declare function ValidateCommand(options?: CommandValidationOptions): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Decorator to validate permissions with business rules
 * @param requiredPermission The permission required
 * @param bypassable Whether guild owners can bypass
 */
export declare function ValidatePermissions(requiredPermission: string, bypassable?: boolean): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Decorator to validate entity before operations
 * @param entityType Type of entity to validate
 * @param operation Operation being performed
 */
export declare function ValidateEntity(entityType: string, operation: 'create' | 'update' | 'delete'): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Decorator to validate business rules
 * @param rules Array of business rule names to validate
 */
export declare function ValidateBusinessRules(...rules: string[]): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Helper function to add custom validation rule to a method
 * @param target Class instance
 * @param methodName Method name
 * @param rule Custom validation rule
 */
export declare function addCustomValidationRule(target: any, methodName: string, rule: CommandValidationRule): void;
/**
 * Helper to clear validation rules for testing
 */
export declare function clearValidationRules(): void;
//# sourceMappingURL=validation-decorators.d.ts.map