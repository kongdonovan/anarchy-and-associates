import { IUnitOfWork, UnitOfWorkError } from './unit-of-work';
import { logger } from '../logger';

/**
 * Compensation action interface for operations that cannot be rolled back automatically.
 * Used for implementing the Saga pattern for distributed transactions.
 */
export interface CompensationAction {
  /**
   * Unique identifier for the compensation action
   */
  id: string;

  /**
   * Human-readable description of what this compensation action does
   */
  description: string;

  /**
   * The compensation logic to execute
   */
  execute(): Promise<void>;

  /**
   * Priority for execution order (higher priority executes first)
   */
  priority?: number;

  /**
   * Whether this compensation action can be retried on failure
   */
  retryable?: boolean;

  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;
}

/**
 * Rollback context containing information about the failed operation
 */
export interface RollbackContext {
  /**
   * The operation that failed and triggered the rollback
   */
  failedOperation: string;

  /**
   * The original error that caused the rollback
   */
  originalError: Error;

  /**
   * Transaction ID for tracking and logging
   */
  transactionId?: string;

  /**
   * Guild ID for audit logging
   */
  guildId?: string;

  /**
   * User ID who initiated the operation
   */
  userId?: string;

  /**
   * Additional context data
   */
  metadata?: Record<string, any>;
}

/**
 * Result of a rollback operation
 */
export interface RollbackResult {
  /**
   * Whether the rollback was successful
   */
  success: boolean;

  /**
   * Compensation actions that were executed
   */
  compensationsExecuted: string[];

  /**
   * Compensation actions that failed
   */
  compensationsFailed: string[];

  /**
   * Errors that occurred during rollback
   */
  errors: Error[];

  /**
   * Time taken for rollback in milliseconds
   */
  duration: number;
}

/**
 * Service for managing complex rollback scenarios and compensation patterns.
 * 
 * This service provides:
 * - Automatic MongoDB transaction rollback
 * - Compensation action execution for non-transactional operations
 * - Rollback logging and auditing
 * - Error recovery mechanisms
 * - Saga pattern implementation
 */
export class RollbackService {
  private compensationActions: Map<string, CompensationAction[]> = new Map();
  private rollbackHistory: Map<string, RollbackResult> = new Map();

  /**
   * Registers a compensation action for a specific transaction.
   * These actions will be executed if the transaction needs to be rolled back.
   * 
   * @param transactionId - Unique identifier for the transaction
   * @param action - Compensation action to register
   */
  public registerCompensationAction(transactionId: string, action: CompensationAction): void {
    if (!this.compensationActions.has(transactionId)) {
      this.compensationActions.set(transactionId, []);
    }

    const actions = this.compensationActions.get(transactionId)!;
    actions.push(action);

    // Sort by priority (highest first)
    actions.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    logger.debug('Compensation action registered', {
      transactionId,
      actionId: action.id,
      description: action.description,
      priority: action.priority || 0
    });
  }

  /**
   * Performs a complete rollback including MongoDB transaction rollback and compensation actions.
   * 
   * @param unitOfWork - Unit of work to rollback
   * @param context - Rollback context with error information
   * @returns Rollback result with execution details
   */
  public async performRollback(
    unitOfWork: IUnitOfWork,
    context: RollbackContext
  ): Promise<RollbackResult> {
    const startTime = Date.now();
    const result: RollbackResult = {
      success: false,
      compensationsExecuted: [],
      compensationsFailed: [],
      errors: [],
      duration: 0
    };

    logger.info('Starting rollback operation', {
      transactionId: context.transactionId,
      failedOperation: context.failedOperation,
      guildId: context.guildId,
      userId: context.userId,
      originalError: context.originalError.message
    });

    try {
      // Step 1: Rollback MongoDB transaction
      await this.rollbackTransaction(unitOfWork, context, result);

      // Step 2: Execute compensation actions
      if (context.transactionId) {
        await this.executeCompensationActions(context.transactionId, context, result);
      }

      // Step 3: Clean up resources
      await this.cleanup(unitOfWork, context.transactionId);

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      // Store rollback result for audit purposes
      if (context.transactionId) {
        this.rollbackHistory.set(context.transactionId, result);
      }

      logger.info('Rollback operation completed', {
        transactionId: context.transactionId,
        success: result.success,
        compensationsExecuted: result.compensationsExecuted.length,
        compensationsFailed: result.compensationsFailed.length,
        errors: result.errors.length,
        duration: result.duration
      });

      return result;

    } catch (error) {
      result.errors.push(error as Error);
      result.success = false;
      result.duration = Date.now() - startTime;

      logger.error('Critical error during rollback operation', {
        transactionId: context.transactionId,
        error: (error as Error).message,
        duration: result.duration
      });

      return result;
    }
  }

  /**
   * Creates a rollback context from a Unit of Work and error.
   * 
   * @param unitOfWork - The unit of work that failed
   * @param operation - Name of the operation that failed
   * @param error - The error that occurred
   * @param additionalContext - Additional context information
   * @returns Rollback context
   */
  public createRollbackContext(
    unitOfWork: IUnitOfWork,
    operation: string,
    error: Error,
    additionalContext?: Partial<RollbackContext>
  ): RollbackContext {
    const session = unitOfWork.getSession();
    const transactionId = session ? `txn_${session.id?.toString()}` : undefined;

    return {
      failedOperation: operation,
      originalError: error,
      transactionId,
      ...additionalContext
    };
  }

  /**
   * Gets the rollback history for a specific transaction.
   * 
   * @param transactionId - Transaction ID to get history for
   * @returns Rollback result or null if not found
   */
  public getRollbackHistory(transactionId: string): RollbackResult | null {
    return this.rollbackHistory.get(transactionId) || null;
  }

  /**
   * Clears rollback history and compensation actions for a transaction.
   * Should be called after successful completion.
   * 
   * @param transactionId - Transaction ID to clear
   */
  public clearTransaction(transactionId: string): void {
    this.compensationActions.delete(transactionId);
    this.rollbackHistory.delete(transactionId);
    
    logger.debug('Transaction cleared from rollback service', {
      transactionId
    });
  }

  /**
   * Rolls back the MongoDB transaction.
   */
  private async rollbackTransaction(
    unitOfWork: IUnitOfWork,
    context: RollbackContext,
    result: RollbackResult
  ): Promise<void> {
    try {
      if (unitOfWork.isActive()) {
        await unitOfWork.rollback();
        logger.debug('MongoDB transaction rolled back successfully', {
          transactionId: context.transactionId
        });
      } else {
        logger.debug('No active transaction to rollback', {
          transactionId: context.transactionId
        });
      }
    } catch (error) {
      const rollbackError = new UnitOfWorkError(
        'Failed to rollback MongoDB transaction',
        'rollback',
        error as Error,
        context.transactionId
      );
      
      result.errors.push(rollbackError);
      logger.error('Failed to rollback MongoDB transaction', {
        transactionId: context.transactionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Executes compensation actions for a transaction.
   */
  private async executeCompensationActions(
    transactionId: string,
    context: RollbackContext,
    result: RollbackResult
  ): Promise<void> {
    const actions = this.compensationActions.get(transactionId) || [];
    
    if (actions.length === 0) {
      logger.debug('No compensation actions to execute', {
        transactionId
      });
      return;
    }

    logger.info('Executing compensation actions', {
      transactionId,
      actionCount: actions.length
    });

    for (const action of actions) {
      await this.executeCompensationAction(action, context, result);
    }
  }

  /**
   * Executes a single compensation action with retry logic.
   */
  private async executeCompensationAction(
    action: CompensationAction,
    context: RollbackContext,
    result: RollbackResult
  ): Promise<void> {
    const maxRetries = action.retryable ? (action.maxRetries || 3) : 1;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        logger.debug('Executing compensation action', {
          transactionId: context.transactionId,
          actionId: action.id,
          description: action.description,
          attempt: retryCount + 1,
          maxRetries
        });

        await action.execute();
        
        result.compensationsExecuted.push(action.id);
        
        logger.info('Compensation action executed successfully', {
          transactionId: context.transactionId,
          actionId: action.id,
          attempts: retryCount + 1
        });

        return; // Success, exit retry loop

      } catch (error) {
        retryCount++;
        const actionError = error as Error;

        logger.warn('Compensation action failed', {
          transactionId: context.transactionId,
          actionId: action.id,
          attempt: retryCount,
          maxRetries,
          error: actionError.message
        });

        if (retryCount >= maxRetries) {
          result.compensationsFailed.push(action.id);
          result.errors.push(new Error(
            `Compensation action '${action.id}' failed after ${maxRetries} attempts: ${actionError.message}`
          ));
          
          logger.error('Compensation action failed permanently', {
            transactionId: context.transactionId,
            actionId: action.id,
            totalAttempts: retryCount,
            finalError: actionError.message
          });
        } else if (action.retryable) {
          // Wait before retrying with exponential backoff
          const delay = Math.pow(2, retryCount - 1) * 1000;
          await this.sleep(delay);
        }
      }
    }
  }

  /**
   * Cleans up resources and compensation actions for a transaction.
   */
  private async cleanup(unitOfWork: IUnitOfWork, transactionId?: string): Promise<void> {
    try {
      // Dispose unit of work
      await unitOfWork.dispose();

      // Clear compensation actions for this transaction
      if (transactionId) {
        this.compensationActions.delete(transactionId);
      }

      logger.debug('Rollback cleanup completed', {
        transactionId
      });

    } catch (error) {
      logger.error('Error during rollback cleanup', {
        transactionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Utility method for sleeping during retry logic.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory for creating common compensation actions.
 */
export class CompensationActionFactory {
  /**
   * Creates a compensation action for Discord role removal.
   */
  public static createDiscordRoleRemovalAction(
    guildId: string,
    userId: string,
    roleId: string
  ): CompensationAction {
    return {
      id: `discord-role-removal-${userId}-${roleId}`,
      description: `Remove Discord role ${roleId} from user ${userId}`,
      priority: 10,
      retryable: true,
      maxRetries: 3,
      execute: async () => {
        // Implementation would use Discord.js to remove the role
        logger.info('Executing Discord role removal compensation', {
          guildId,
          userId,
          roleId
        });
        // Note: Actual Discord API call would be implemented here
      }
    };
  }

  /**
   * Creates a compensation action for audit log creation.
   */
  public static createAuditLogCompensationAction(
    guildId: string,
    userId: string,
    action: string,
    reason: string
  ): CompensationAction {
    return {
      id: `audit-log-compensation-${Date.now()}`,
      description: `Log compensation action for ${action}`,
      priority: 5,
      retryable: true,
      maxRetries: 2,
      execute: async () => {
        logger.info('Executing audit log compensation', {
          guildId,
          userId,
          action,
          reason
        });
        // Note: Actual audit log creation would be implemented here
      }
    };
  }

  /**
   * Creates a compensation action for notification sending.
   */
  public static createNotificationCompensationAction(
    recipients: string[],
    message: string,
    type: 'error' | 'warning' | 'info' = 'error'
  ): CompensationAction {
    return {
      id: `notification-compensation-${Date.now()}`,
      description: `Send ${type} notification to ${recipients.length} recipients`,
      priority: 1,
      retryable: true,
      maxRetries: 2,
      execute: async () => {
        logger.info('Executing notification compensation', {
          recipients: recipients.length,
          type,
          message: message.substring(0, 100) + '...'
        });
        // Note: Actual notification sending would be implemented here
      }
    };
  }
}

/**
 * Decorator for automatic rollback management.
 * Wraps a method to automatically handle rollbacks on failure.
 * 
 * @param rollbackService - Rollback service instance
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class StaffService {
 *   @AutoRollback(rollbackService)
 *   async hireStaff(unitOfWork: IUnitOfWork, request: StaffHireRequest): Promise<StaffHireResult> {
 *     // Method implementation with automatic rollback on failure
 *   }
 * }
 * ```
 */
export function AutoRollback(rollbackService: RollbackService) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Extract unit of work from arguments (should be first parameter)
      const unitOfWork = args.find(arg => arg && typeof arg.begin === 'function') as IUnitOfWork;
      
      if (!unitOfWork) {
        throw new Error('AutoRollback decorator requires IUnitOfWork as a parameter');
      }

      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const context = rollbackService.createRollbackContext(
          unitOfWork,
          propertyName,
          error as Error,
          {
            metadata: {
              className: target.constructor.name,
              methodName: propertyName,
              arguments: args.length
            }
          }
        );

        const rollbackResult = await rollbackService.performRollback(unitOfWork, context);
        
        // Enhance the original error with rollback information
        const enhancedError = new UnitOfWorkError(
          `Operation '${propertyName}' failed and rollback ${rollbackResult.success ? 'succeeded' : 'failed'}`,
          propertyName,
          error as Error
        );

        throw enhancedError;
      }
    };

    return descriptor;
  };
}