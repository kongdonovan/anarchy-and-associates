import { ValidationStrategy, ValidationContext, ValidationResult } from '../types';
/**
 * Command parameter validation rules
 */
interface ParameterRule {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'enum' | 'snowflake' | 'date';
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enumValues?: string[];
    custom?: (value: any, context: ValidationContext) => ValidationResult | null;
}
/**
 * Command validation configuration
 */
interface CommandConfig {
    requiredPermission?: string;
    parameters: Record<string, ParameterRule>;
    customValidation?: (context: ValidationContext) => Promise<ValidationResult | null>;
}
/**
 * Strategy for validating Discord command parameters and constraints
 */
export declare class CommandValidationStrategy implements ValidationStrategy {
    readonly name = "CommandValidation";
    private commandConfigs;
    constructor();
    canHandle(context: ValidationContext): boolean;
    validate(context: ValidationContext): Promise<ValidationResult>;
    /**
     * Validates command parameters against rules
     */
    private validateParameters;
    /**
     * Validates value type
     */
    private validateType;
    /**
     * Initializes command validation configurations
     */
    private initializeCommandConfigs;
    /**
     * Adds or updates a command configuration
     */
    addCommandConfig(commandKey: string, config: CommandConfig): void;
    /**
     * Removes a command configuration
     */
    removeCommandConfig(commandKey: string): boolean;
}
export {};
//# sourceMappingURL=command-validation-strategy.d.ts.map