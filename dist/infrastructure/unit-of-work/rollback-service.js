"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompensationActionFactory = exports.RollbackService = void 0;
exports.AutoRollback = AutoRollback;
const unit_of_work_1 = require("./unit-of-work");
const logger_1 = require("../logger");
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
class RollbackService {
    constructor() {
        this.compensationActions = new Map();
        this.rollbackHistory = new Map();
    }
    /**
     * Registers a compensation action for a specific transaction.
     * These actions will be executed if the transaction needs to be rolled back.
     *
     * @param transactionId - Unique identifier for the transaction
     * @param action - Compensation action to register
     */
    registerCompensationAction(transactionId, action) {
        if (!this.compensationActions.has(transactionId)) {
            this.compensationActions.set(transactionId, []);
        }
        const actions = this.compensationActions.get(transactionId);
        actions.push(action);
        // Sort by priority (highest first)
        actions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        logger_1.logger.debug('Compensation action registered', {
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
    async performRollback(unitOfWork, context) {
        const startTime = Date.now();
        const result = {
            success: false,
            compensationsExecuted: [],
            compensationsFailed: [],
            errors: [],
            duration: 0
        };
        logger_1.logger.info('Starting rollback operation', {
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
            logger_1.logger.info('Rollback operation completed', {
                transactionId: context.transactionId,
                success: result.success,
                compensationsExecuted: result.compensationsExecuted.length,
                compensationsFailed: result.compensationsFailed.length,
                errors: result.errors.length,
                duration: result.duration
            });
            return result;
        }
        catch (error) {
            result.errors.push(error);
            result.success = false;
            result.duration = Date.now() - startTime;
            logger_1.logger.error('Critical error during rollback operation', {
                transactionId: context.transactionId,
                error: error.message,
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
    createRollbackContext(unitOfWork, operation, error, additionalContext) {
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
    getRollbackHistory(transactionId) {
        return this.rollbackHistory.get(transactionId) || null;
    }
    /**
     * Clears rollback history and compensation actions for a transaction.
     * Should be called after successful completion.
     *
     * @param transactionId - Transaction ID to clear
     */
    clearTransaction(transactionId) {
        this.compensationActions.delete(transactionId);
        this.rollbackHistory.delete(transactionId);
        logger_1.logger.debug('Transaction cleared from rollback service', {
            transactionId
        });
    }
    /**
     * Rolls back the MongoDB transaction.
     */
    async rollbackTransaction(unitOfWork, context, result) {
        try {
            if (unitOfWork.isActive()) {
                await unitOfWork.rollback();
                logger_1.logger.debug('MongoDB transaction rolled back successfully', {
                    transactionId: context.transactionId
                });
            }
            else {
                logger_1.logger.debug('No active transaction to rollback', {
                    transactionId: context.transactionId
                });
            }
        }
        catch (error) {
            const rollbackError = new unit_of_work_1.UnitOfWorkError('Failed to rollback MongoDB transaction', 'rollback', error, context.transactionId);
            result.errors.push(rollbackError);
            logger_1.logger.error('Failed to rollback MongoDB transaction', {
                transactionId: context.transactionId,
                error: error.message
            });
        }
    }
    /**
     * Executes compensation actions for a transaction.
     */
    async executeCompensationActions(transactionId, context, result) {
        const actions = this.compensationActions.get(transactionId) || [];
        if (actions.length === 0) {
            logger_1.logger.debug('No compensation actions to execute', {
                transactionId
            });
            return;
        }
        logger_1.logger.info('Executing compensation actions', {
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
    async executeCompensationAction(action, context, result) {
        const maxRetries = action.retryable ? (action.maxRetries || 3) : 1;
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                logger_1.logger.debug('Executing compensation action', {
                    transactionId: context.transactionId,
                    actionId: action.id,
                    description: action.description,
                    attempt: retryCount + 1,
                    maxRetries
                });
                await action.execute();
                result.compensationsExecuted.push(action.id);
                logger_1.logger.info('Compensation action executed successfully', {
                    transactionId: context.transactionId,
                    actionId: action.id,
                    attempts: retryCount + 1
                });
                return; // Success, exit retry loop
            }
            catch (error) {
                retryCount++;
                const actionError = error;
                logger_1.logger.warn('Compensation action failed', {
                    transactionId: context.transactionId,
                    actionId: action.id,
                    attempt: retryCount,
                    maxRetries,
                    error: actionError.message
                });
                if (retryCount >= maxRetries) {
                    result.compensationsFailed.push(action.id);
                    result.errors.push(new Error(`Compensation action '${action.id}' failed after ${maxRetries} attempts: ${actionError.message}`));
                    logger_1.logger.error('Compensation action failed permanently', {
                        transactionId: context.transactionId,
                        actionId: action.id,
                        totalAttempts: retryCount,
                        finalError: actionError.message
                    });
                }
                else if (action.retryable) {
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
    async cleanup(unitOfWork, transactionId) {
        try {
            // Dispose unit of work
            await unitOfWork.dispose();
            // Clear compensation actions for this transaction
            if (transactionId) {
                this.compensationActions.delete(transactionId);
            }
            logger_1.logger.debug('Rollback cleanup completed', {
                transactionId
            });
        }
        catch (error) {
            logger_1.logger.error('Error during rollback cleanup', {
                transactionId,
                error: error.message
            });
        }
    }
    /**
     * Utility method for sleeping during retry logic.
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RollbackService = RollbackService;
/**
 * Factory for creating common compensation actions.
 */
class CompensationActionFactory {
    /**
     * Creates a compensation action for Discord role removal.
     */
    static createDiscordRoleRemovalAction(guildId, userId, roleId) {
        return {
            id: `discord-role-removal-${userId}-${roleId}`,
            description: `Remove Discord role ${roleId} from user ${userId}`,
            priority: 10,
            retryable: true,
            maxRetries: 3,
            execute: async () => {
                // Implementation would use Discord.js to remove the role
                logger_1.logger.info('Executing Discord role removal compensation', {
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
    static createAuditLogCompensationAction(guildId, userId, action, reason) {
        return {
            id: `audit-log-compensation-${Date.now()}`,
            description: `Log compensation action for ${action}`,
            priority: 5,
            retryable: true,
            maxRetries: 2,
            execute: async () => {
                logger_1.logger.info('Executing audit log compensation', {
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
    static createNotificationCompensationAction(recipients, message, type = 'error') {
        return {
            id: `notification-compensation-${Date.now()}`,
            description: `Send ${type} notification to ${recipients.length} recipients`,
            priority: 1,
            retryable: true,
            maxRetries: 2,
            execute: async () => {
                logger_1.logger.info('Executing notification compensation', {
                    recipients: recipients.length,
                    type,
                    message: message.substring(0, 100) + '...'
                });
                // Note: Actual notification sending would be implemented here
            }
        };
    }
}
exports.CompensationActionFactory = CompensationActionFactory;
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
function AutoRollback(rollbackService) {
    return function (target, propertyName, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            // Extract unit of work from arguments (should be first parameter)
            const unitOfWork = args.find(arg => arg && typeof arg.begin === 'function');
            if (!unitOfWork) {
                throw new Error('AutoRollback decorator requires IUnitOfWork as a parameter');
            }
            try {
                return await originalMethod.apply(this, args);
            }
            catch (error) {
                const context = rollbackService.createRollbackContext(unitOfWork, propertyName, error, {
                    metadata: {
                        className: target.constructor.name,
                        methodName: propertyName,
                        arguments: args.length
                    }
                });
                const rollbackResult = await rollbackService.performRollback(unitOfWork, context);
                // Enhance the original error with rollback information
                const enhancedError = new unit_of_work_1.UnitOfWorkError(`Operation '${propertyName}' failed and rollback ${rollbackResult.success ? 'succeeded' : 'failed'}`, propertyName, error);
                throw enhancedError;
            }
        };
        return descriptor;
    };
}
//# sourceMappingURL=rollback-service.js.map