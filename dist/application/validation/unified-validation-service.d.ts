import { ValidationStrategy, ValidationContext, ValidationResult, ValidationOptions, AggregatedValidationResult } from './types';
/**
 * Unified validation service that orchestrates multiple validation strategies
 */
export declare class UnifiedValidationService {
    private strategies;
    /**
     * Registers a validation strategy
     * @param strategy The validation strategy to register
     */
    registerStrategy(strategy: ValidationStrategy): void;
    /**
     * Unregisters a validation strategy
     * @param strategyName The name of the strategy to unregister
     */
    unregisterStrategy(strategyName: string): boolean;
    /**
     * Gets all registered strategy names
     */
    getStrategyNames(): string[];
    /**
     * Validates using all applicable strategies
     * @param context The validation context
     * @param options Optional validation options
     * @returns Aggregated validation result
     */
    validate(context: ValidationContext, options?: ValidationOptions): Promise<AggregatedValidationResult>;
    /**
     * Validates using a specific strategy
     * @param strategyName The name of the strategy to use
     * @param context The validation context
     * @returns Validation result from the specific strategy
     */
    validateWithStrategy(strategyName: string, context: ValidationContext): Promise<ValidationResult>;
    /**
     * Validates and throws ValidationError if validation fails
     * @param context The validation context
     * @param options Optional validation options
     * @throws ValidationError if validation fails
     */
    validateOrThrow(context: ValidationContext, options?: ValidationOptions): Promise<void>;
    /**
     * Gets applicable strategies based on context and options
     */
    private getApplicableStrategies;
    /**
     * Executes a single strategy with error handling
     */
    private executeStrategy;
    /**
     * Creates an aggregated result from individual strategy results
     */
    private createAggregatedResult;
    /**
     * Creates a pre-configured validation context
     */
    static createContext(params: Partial<ValidationContext> & Pick<ValidationContext, 'permissionContext' | 'entityType' | 'operation'>): ValidationContext;
    /**
     * Formats validation result for user display
     */
    static formatResult(result: ValidationResult): string;
}
//# sourceMappingURL=unified-validation-service.d.ts.map