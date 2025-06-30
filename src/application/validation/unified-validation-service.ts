import { logger } from '../../infrastructure/logger';
import {
  ValidationStrategy,
  ValidationContext,
  ValidationResult,
  ValidationOptions,
  AggregatedValidationResult,
  ValidationResultHelper,
  ValidationError,
  ValidationSeverity
} from './types';

/**
 * Unified validation service that orchestrates multiple validation strategies
 */
export class UnifiedValidationService {
  private strategies: Map<string, ValidationStrategy> = new Map();

  /**
   * Registers a validation strategy
   * @param strategy The validation strategy to register
   */
  registerStrategy(strategy: ValidationStrategy): void {
    if (this.strategies.has(strategy.name)) {
      logger.warn(`Overwriting existing validation strategy: ${strategy.name}`);
    }
    this.strategies.set(strategy.name, strategy);
    logger.info(`Registered validation strategy: ${strategy.name}`);
  }

  /**
   * Unregisters a validation strategy
   * @param strategyName The name of the strategy to unregister
   */
  unregisterStrategy(strategyName: string): boolean {
    const result = this.strategies.delete(strategyName);
    if (result) {
      logger.info(`Unregistered validation strategy: ${strategyName}`);
    }
    return result;
  }

  /**
   * Gets all registered strategy names
   */
  getStrategyNames(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Validates using all applicable strategies
   * @param context The validation context
   * @param options Optional validation options
   * @returns Aggregated validation result
   */
  async validate(
    context: ValidationContext,
    options: ValidationOptions = {}
  ): Promise<AggregatedValidationResult> {
    const startTime = Date.now();
    const applicableStrategies = this.getApplicableStrategies(context, options);
    
    if (applicableStrategies.length === 0) {
      logger.warn(`No applicable validation strategies for ${context.entityType}:${context.operation}`);
      return this.createAggregatedResult(new Map());
    }

    logger.info(`Validating ${context.entityType}:${context.operation} with ${applicableStrategies.length} strategies`);

    const strategyResults = new Map<string, ValidationResult>();
    
    // Execute validations
    if (options.failFast) {
      // Sequential execution with fail-fast
      for (const strategy of applicableStrategies) {
        const result = await this.executeStrategy(strategy, context);
        strategyResults.set(strategy.name, result);
        
        if (!result.valid && ValidationResultHelper.hasErrors(result)) {
          logger.info(`Validation failed fast on strategy: ${strategy.name}`);
          break;
        }
      }
    } else {
      // Parallel execution
      const promises = applicableStrategies.map(async strategy => {
        const result = await this.executeStrategy(strategy, context);
        return { name: strategy.name, result };
      });
      
      const results = await Promise.all(promises);
      results.forEach(({ name, result }) => {
        strategyResults.set(name, result);
      });
    }

    const aggregatedResult = this.createAggregatedResult(strategyResults);
    const duration = Date.now() - startTime;
    
    logger.info(`Validation completed in ${duration}ms. Valid: ${aggregatedResult.valid}`);
    
    return aggregatedResult;
  }

  /**
   * Validates using a specific strategy
   * @param strategyName The name of the strategy to use
   * @param context The validation context
   * @returns Validation result from the specific strategy
   */
  async validateWithStrategy(
    strategyName: string,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Validation strategy not found: ${strategyName}`);
    }

    if (!strategy.canHandle(context)) {
      throw new Error(`Strategy ${strategyName} cannot handle context for ${context.entityType}:${context.operation}`);
    }

    return this.executeStrategy(strategy, context);
  }

  /**
   * Validates and throws ValidationError if validation fails
   * @param context The validation context
   * @param options Optional validation options
   * @throws ValidationError if validation fails
   */
  async validateOrThrow(
    context: ValidationContext,
    options: ValidationOptions = {}
  ): Promise<void> {
    const result = await this.validate(context, options);
    
    if (!result.valid) {
      const errorMessages = ValidationResultHelper.getErrorMessages(result);
      throw new ValidationError(
        result,
        `Validation failed: ${errorMessages.join(', ')}`
      );
    }
  }

  /**
   * Gets applicable strategies based on context and options
   */
  private getApplicableStrategies(
    context: ValidationContext,
    options: ValidationOptions
  ): ValidationStrategy[] {
    let strategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.canHandle(context));

    // Apply include filter
    if (options.includeStrategies && options.includeStrategies.length > 0) {
      strategies = strategies.filter(s => options.includeStrategies!.includes(s.name));
    }

    // Apply exclude filter
    if (options.excludeStrategies && options.excludeStrategies.length > 0) {
      strategies = strategies.filter(s => !options.excludeStrategies!.includes(s.name));
    }

    return strategies;
  }

  /**
   * Executes a single strategy with error handling
   */
  private async executeStrategy(
    strategy: ValidationStrategy,
    context: ValidationContext
  ): Promise<ValidationResult> {
    try {
      const startTime = Date.now();
      const result = await strategy.validate(context);
      const duration = Date.now() - startTime;
      
      logger.debug(`Strategy ${strategy.name} completed in ${duration}ms`);
      
      return result;
    } catch (error) {
      logger.error(`Error in validation strategy ${strategy.name}:`, error);
      
      // Return error result instead of throwing
      return {
        valid: false,
        issues: [{
          severity: ValidationSeverity.ERROR,
          code: 'STRATEGY_ERROR',
          message: `Validation strategy ${strategy.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          context: { strategy: strategy.name, error: String(error) }
        }]
      };
    }
  }

  /**
   * Creates an aggregated result from individual strategy results
   */
  private createAggregatedResult(
    strategyResults: Map<string, ValidationResult>
  ): AggregatedValidationResult {
    const results = Array.from(strategyResults.values());
    
    if (results.length === 0) {
      return {
        valid: true,
        issues: [],
        strategyResults
      };
    }

    const merged = ValidationResultHelper.merge(...results);
    
    return {
      ...merged,
      strategyResults
    };
  }

  /**
   * Creates a pre-configured validation context
   */
  static createContext(
    params: Partial<ValidationContext> & 
    Pick<ValidationContext, 'permissionContext' | 'entityType' | 'operation'>
  ): ValidationContext {
    return {
      data: {},
      metadata: {},
      ...params
    };
  }

  /**
   * Formats validation result for user display
   */
  static formatResult(result: ValidationResult): string {
    if (result.valid && result.issues.length === 0) {
      return 'Validation passed';
    }

    const errors = result.issues
      .filter(i => i.severity === ValidationSeverity.ERROR)
      .map(i => `• ${i.field ? `[${i.field}] ` : ''}${i.message}`)
      .join('\n');

    const warnings = result.issues
      .filter(i => i.severity === ValidationSeverity.WARNING)
      .map(i => `• ${i.field ? `[${i.field}] ` : ''}${i.message}`)
      .join('\n');

    let message = '';
    if (errors) {
      message += `**Errors:**\n${errors}\n`;
    }
    if (warnings) {
      message += `**Warnings:**\n${warnings}\n`;
    }

    if (result.bypassAvailable) {
      message += `\n*Bypass available for ${result.bypassType}*`;
    }

    return message.trim();
  }
}