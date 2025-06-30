import { IUnitOfWork } from './unit-of-work';
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
export declare class RollbackService {
    private compensationActions;
    private rollbackHistory;
    /**
     * Registers a compensation action for a specific transaction.
     * These actions will be executed if the transaction needs to be rolled back.
     *
     * @param transactionId - Unique identifier for the transaction
     * @param action - Compensation action to register
     */
    registerCompensationAction(transactionId: string, action: CompensationAction): void;
    /**
     * Performs a complete rollback including MongoDB transaction rollback and compensation actions.
     *
     * @param unitOfWork - Unit of work to rollback
     * @param context - Rollback context with error information
     * @returns Rollback result with execution details
     */
    performRollback(unitOfWork: IUnitOfWork, context: RollbackContext): Promise<RollbackResult>;
    /**
     * Creates a rollback context from a Unit of Work and error.
     *
     * @param unitOfWork - The unit of work that failed
     * @param operation - Name of the operation that failed
     * @param error - The error that occurred
     * @param additionalContext - Additional context information
     * @returns Rollback context
     */
    createRollbackContext(unitOfWork: IUnitOfWork, operation: string, error: Error, additionalContext?: Partial<RollbackContext>): RollbackContext;
    /**
     * Gets the rollback history for a specific transaction.
     *
     * @param transactionId - Transaction ID to get history for
     * @returns Rollback result or null if not found
     */
    getRollbackHistory(transactionId: string): RollbackResult | null;
    /**
     * Clears rollback history and compensation actions for a transaction.
     * Should be called after successful completion.
     *
     * @param transactionId - Transaction ID to clear
     */
    clearTransaction(transactionId: string): void;
    /**
     * Rolls back the MongoDB transaction.
     */
    private rollbackTransaction;
    /**
     * Executes compensation actions for a transaction.
     */
    private executeCompensationActions;
    /**
     * Executes a single compensation action with retry logic.
     */
    private executeCompensationAction;
    /**
     * Cleans up resources and compensation actions for a transaction.
     */
    private cleanup;
    /**
     * Utility method for sleeping during retry logic.
     */
    private sleep;
}
/**
 * Factory for creating common compensation actions.
 */
export declare class CompensationActionFactory {
    /**
     * Creates a compensation action for Discord role removal.
     */
    static createDiscordRoleRemovalAction(guildId: string, userId: string, roleId: string): CompensationAction;
    /**
     * Creates a compensation action for audit log creation.
     */
    static createAuditLogCompensationAction(guildId: string, userId: string, action: string, reason: string): CompensationAction;
    /**
     * Creates a compensation action for notification sending.
     */
    static createNotificationCompensationAction(recipients: string[], message: string, type?: 'error' | 'warning' | 'info'): CompensationAction;
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
export declare function AutoRollback(rollbackService: RollbackService): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=rollback-service.d.ts.map