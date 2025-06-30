"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionErrorHandlerFactory = exports.TransactionErrorHandler = exports.ErrorSeverity = exports.TransactionErrorCode = void 0;
exports.HandleTransactionErrors = HandleTransactionErrors;
const unit_of_work_1 = require("./unit-of-work");
const logger_1 = require("../logger");
/**
 * MongoDB transaction error codes and their meanings.
 * Reference: https://docs.mongodb.com/manual/reference/error-codes/
 */
var TransactionErrorCode;
(function (TransactionErrorCode) {
    // Transient transaction errors (retryable)
    TransactionErrorCode[TransactionErrorCode["TRANSIENT_TRANSACTION_ERROR"] = 112] = "TRANSIENT_TRANSACTION_ERROR";
    TransactionErrorCode[TransactionErrorCode["WRITE_CONFLICT"] = 112] = "WRITE_CONFLICT";
    TransactionErrorCode[TransactionErrorCode["NO_SUCH_TRANSACTION"] = 251] = "NO_SUCH_TRANSACTION";
    TransactionErrorCode[TransactionErrorCode["UNKNOWN_TRANSACTION_COMMIT_RESULT"] = 50] = "UNKNOWN_TRANSACTION_COMMIT_RESULT";
    // Connection and network errors
    TransactionErrorCode[TransactionErrorCode["NETWORK_TIMEOUT"] = 89] = "NETWORK_TIMEOUT";
    TransactionErrorCode[TransactionErrorCode["HOST_UNREACHABLE"] = 6] = "HOST_UNREACHABLE";
    TransactionErrorCode[TransactionErrorCode["HOST_NOT_FOUND"] = 7] = "HOST_NOT_FOUND";
    TransactionErrorCode[TransactionErrorCode["CONNECTION_POOL_CLEARED"] = 91] = "CONNECTION_POOL_CLEARED";
    TransactionErrorCode[TransactionErrorCode["SOCKET_EXCEPTION"] = 9001] = "SOCKET_EXCEPTION";
    // Lock and concurrency errors
    TransactionErrorCode[TransactionErrorCode["LOCK_TIMEOUT"] = 50] = "LOCK_TIMEOUT";
    TransactionErrorCode[TransactionErrorCode["MAXTIME_EXPIRED"] = 50] = "MAXTIME_EXPIRED";
    TransactionErrorCode[TransactionErrorCode["CONFLICTING_OPERATION_IN_PROGRESS"] = 117] = "CONFLICTING_OPERATION_IN_PROGRESS";
    // Session and transaction state errors
    TransactionErrorCode[TransactionErrorCode["NO_SUCH_SESSION"] = 206] = "NO_SUCH_SESSION";
    TransactionErrorCode[TransactionErrorCode["SESSION_EXPIRED"] = 228] = "SESSION_EXPIRED";
    TransactionErrorCode[TransactionErrorCode["TRANSACTION_TOO_OLD"] = 244] = "TRANSACTION_TOO_OLD";
    TransactionErrorCode[TransactionErrorCode["TRANSACTION_SIZE_LIMIT_EXCEEDED"] = 334] = "TRANSACTION_SIZE_LIMIT_EXCEEDED";
    // Replica set and sharding errors
    TransactionErrorCode[TransactionErrorCode["NOT_MASTER"] = 10107] = "NOT_MASTER";
    TransactionErrorCode[TransactionErrorCode["NOT_MASTER_NO_SLAVE_OK"] = 13435] = "NOT_MASTER_NO_SLAVE_OK";
    TransactionErrorCode[TransactionErrorCode["NOT_MASTER_OR_SECONDARY"] = 13436] = "NOT_MASTER_OR_SECONDARY";
    TransactionErrorCode[TransactionErrorCode["PRIMARY_STEPPED_DOWN"] = 189] = "PRIMARY_STEPPED_DOWN";
    TransactionErrorCode[TransactionErrorCode["SHUTDOWN_IN_PROGRESS"] = 91] = "SHUTDOWN_IN_PROGRESS";
    // Configuration and authentication errors
    TransactionErrorCode[TransactionErrorCode["UNAUTHORIZED"] = 13] = "UNAUTHORIZED";
    TransactionErrorCode[TransactionErrorCode["AUTHENTICATION_FAILED"] = 18] = "AUTHENTICATION_FAILED";
    TransactionErrorCode[TransactionErrorCode["OPERATION_NOT_SUPPORTED_IN_TRANSACTION"] = 263] = "OPERATION_NOT_SUPPORTED_IN_TRANSACTION";
})(TransactionErrorCode || (exports.TransactionErrorCode = TransactionErrorCode = {}));
/**
 * Classification of transaction errors for handling strategies.
 */
var ErrorSeverity;
(function (ErrorSeverity) {
    /** Error is transient and operation should be retried */
    ErrorSeverity["TRANSIENT"] = "transient";
    /** Error indicates a permanent failure, operation should not be retried */
    ErrorSeverity["PERMANENT"] = "permanent";
    /** Error indicates a configuration issue that needs admin intervention */
    ErrorSeverity["CONFIGURATION"] = "configuration";
    /** Error severity is unknown, use default handling */
    ErrorSeverity["UNKNOWN"] = "unknown";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
/**
 * Service for handling MongoDB transaction errors with comprehensive retry logic,
 * error classification, and recovery strategies.
 *
 * This service provides:
 * - Automatic retry for transient errors
 * - Error classification and severity assessment
 * - Intelligent backoff strategies
 * - Circuit breaker patterns for persistent failures
 * - Detailed error logging and metrics
 * - Recovery action suggestions
 */
class TransactionErrorHandler {
    constructor(rollbackService, retryConfig) {
        this.circuitBreakerThreshold = 5;
        this.circuitBreakerWindow = 60000; // 1 minute
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.rollbackService = rollbackService;
        this.retryConfig = { ...TransactionErrorHandler.DEFAULT_RETRY_CONFIG, ...retryConfig };
    }
    /**
     * Executes a transaction operation with comprehensive error handling and retry logic.
     *
     * @param operation - Function that performs the transaction operation
     * @param operationName - Human-readable name for the operation
     * @param context - Additional context for error handling
     * @returns Result of the operation attempt
     */
    async executeWithRetry(operation, operationName, context) {
        const startTime = Date.now();
        let attempts = 0;
        let lastError = null;
        let wasRetried = false;
        // Check circuit breaker
        if (this.isCircuitBreakerOpen()) {
            return {
                success: false,
                error: new unit_of_work_1.UnitOfWorkError('Circuit breaker is open - too many recent failures', operationName),
                attempts: 0,
                duration: Date.now() - startTime,
                wasRetried: false
            };
        }
        while (attempts < this.retryConfig.maxRetries + 1) {
            attempts++;
            try {
                logger_1.logger.debug('Attempting transaction operation', {
                    operationName,
                    attempt: attempts,
                    maxAttempts: this.retryConfig.maxRetries + 1,
                    context
                });
                const result = await this.executeWithTimeout(operation, this.retryConfig.attemptTimeout);
                // Reset circuit breaker on success
                this.resetCircuitBreaker();
                logger_1.logger.info('Transaction operation succeeded', {
                    operationName,
                    attempts,
                    duration: Date.now() - startTime,
                    wasRetried
                });
                return {
                    success: true,
                    result,
                    attempts,
                    duration: Date.now() - startTime,
                    wasRetried
                };
            }
            catch (error) {
                lastError = error;
                const errorInfo = this.classifyError(lastError);
                logger_1.logger.warn('Transaction operation failed', {
                    operationName,
                    attempt: attempts,
                    error: lastError.message,
                    errorCode: lastError.code,
                    severity: errorInfo.severity,
                    retryable: errorInfo.retryable
                });
                // Check if we should retry
                const shouldRetry = this.shouldRetryError(errorInfo, attempts);
                if (!shouldRetry) {
                    logger_1.logger.error('Transaction operation failed permanently', {
                        operationName,
                        attempts,
                        finalError: lastError.message,
                        errorClassification: errorInfo
                    });
                    this.recordFailure();
                    break;
                }
                // Calculate retry delay
                if (attempts <= this.retryConfig.maxRetries) {
                    wasRetried = true;
                    const delay = this.calculateRetryDelay(attempts, errorInfo);
                    logger_1.logger.info('Retrying transaction operation', {
                        operationName,
                        attempt: attempts,
                        nextAttemptIn: delay,
                        errorInfo: {
                            code: errorInfo.code,
                            severity: errorInfo.severity,
                            description: errorInfo.description
                        }
                    });
                    await this.sleep(delay);
                }
            }
        }
        this.recordFailure();
        return {
            success: false,
            error: lastError || new Error('Unknown transaction error'),
            attempts,
            duration: Date.now() - startTime,
            wasRetried
        };
    }
    /**
     * Handles a transaction error with comprehensive rollback and compensation.
     *
     * @param error - The error that occurred
     * @param unitOfWork - Unit of work to rollback
     * @param operationName - Name of the failed operation
     * @param context - Additional context for rollback
     * @returns Detailed error handling result
     */
    async handleTransactionError(error, unitOfWork, operationName, context) {
        const errorInfo = this.classifyError(error);
        logger_1.logger.error('Handling transaction error', {
            operationName,
            error: error.message,
            classification: errorInfo,
            context
        });
        // Create rollback context
        const rollbackContext = {
            failedOperation: operationName,
            originalError: error,
            transactionId: unitOfWork.getSession()?.id?.toString(),
            metadata: {
                errorCode: error.code,
                errorSeverity: errorInfo.severity,
                ...context
            }
        };
        // Perform rollback with compensation
        const rollbackResult = await this.rollbackService.performRollback(unitOfWork, rollbackContext);
        // Log recovery suggestions
        logger_1.logger.info('Transaction error recovery actions', {
            operationName,
            errorCode: errorInfo.code,
            severity: errorInfo.severity,
            recoveryActions: errorInfo.recoveryActions,
            rollbackSuccess: rollbackResult.success
        });
        return {
            errorInfo,
            rollbackResult,
            recoveryActions: errorInfo.recoveryActions
        };
    }
    /**
     * Classifies an error and provides handling metadata.
     */
    classifyError(error) {
        const mongoError = error;
        const errorCode = mongoError.code || 0;
        // Check for known error codes
        const knownError = TransactionErrorHandler.ERROR_CLASSIFICATIONS.get(errorCode);
        if (knownError) {
            return knownError;
        }
        // Check for error labels (MongoDB 4.0+)
        if (mongoError.errorLabels) {
            if (mongoError.errorLabels.includes('TransientTransactionError')) {
                return {
                    code: errorCode,
                    severity: ErrorSeverity.TRANSIENT,
                    retryable: true,
                    retryDelay: 100,
                    maxRetries: 3,
                    description: 'Transient transaction error (labeled)',
                    recoveryActions: ['Retry the transaction']
                };
            }
            if (mongoError.errorLabels.includes('UnknownTransactionCommitResult')) {
                return {
                    code: errorCode,
                    severity: ErrorSeverity.TRANSIENT,
                    retryable: true,
                    retryDelay: 200,
                    maxRetries: 2,
                    description: 'Unknown transaction commit result',
                    recoveryActions: ['Retry commit operation', 'Check transaction state']
                };
            }
        }
        // Default classification for unknown errors
        return {
            code: errorCode,
            severity: ErrorSeverity.UNKNOWN,
            retryable: false,
            retryDelay: 0,
            maxRetries: 0,
            description: `Unknown MongoDB error: ${error.message}`,
            recoveryActions: ['Check MongoDB logs', 'Contact support if issue persists']
        };
    }
    /**
     * Determines if an error should be retried based on classification and attempt count.
     */
    shouldRetryError(errorInfo, currentAttempt) {
        if (!errorInfo.retryable) {
            return false;
        }
        if (currentAttempt > this.retryConfig.maxRetries) {
            return false;
        }
        // Don't retry if circuit breaker is open
        if (this.isCircuitBreakerOpen()) {
            return false;
        }
        return true;
    }
    /**
     * Calculates retry delay with exponential backoff and jitter.
     */
    calculateRetryDelay(attempt, errorInfo) {
        let delay = Math.max(this.retryConfig.baseDelay, errorInfo.retryDelay);
        if (this.retryConfig.exponentialBackoff) {
            delay = Math.min(delay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
        }
        // Add jitter to prevent thundering herd
        const jitter = delay * this.retryConfig.jitterFactor * Math.random();
        delay += jitter;
        return Math.floor(delay);
    }
    /**
     * Executes an operation with timeout.
     */
    async executeWithTimeout(operation, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new unit_of_work_1.UnitOfWorkError(`Operation timed out after ${timeoutMs}ms`, 'executeWithTimeout'));
            }, timeoutMs);
            operation()
                .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    /**
     * Circuit breaker logic to prevent cascading failures.
     */
    isCircuitBreakerOpen() {
        const now = Date.now();
        // Reset failure count if window has passed
        if (now - this.lastFailureTime > this.circuitBreakerWindow) {
            this.failureCount = 0;
        }
        return this.failureCount >= this.circuitBreakerThreshold;
    }
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
    }
    resetCircuitBreaker() {
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }
    /**
     * Utility method for sleeping during retry logic.
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.TransactionErrorHandler = TransactionErrorHandler;
TransactionErrorHandler.DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 5000,
    exponentialBackoff: true,
    jitterFactor: 0.1,
    attemptTimeout: 30000
};
TransactionErrorHandler.ERROR_CLASSIFICATIONS = new Map([
    // Transient transaction errors
    [TransactionErrorCode.TRANSIENT_TRANSACTION_ERROR, {
            code: TransactionErrorCode.TRANSIENT_TRANSACTION_ERROR,
            severity: ErrorSeverity.TRANSIENT,
            retryable: true,
            retryDelay: 100,
            maxRetries: 3,
            description: 'Transient transaction error - operation can be retried',
            recoveryActions: ['Retry the transaction', 'Check for write conflicts']
        }],
    [TransactionErrorCode.WRITE_CONFLICT, {
            code: TransactionErrorCode.WRITE_CONFLICT,
            severity: ErrorSeverity.TRANSIENT,
            retryable: true,
            retryDelay: 50,
            maxRetries: 5,
            description: 'Write conflict detected - multiple transactions modifying same data',
            recoveryActions: ['Retry with backoff', 'Review transaction isolation', 'Optimize query patterns']
        }],
    [TransactionErrorCode.NO_SUCH_TRANSACTION, {
            code: TransactionErrorCode.NO_SUCH_TRANSACTION,
            severity: ErrorSeverity.TRANSIENT,
            retryable: true,
            retryDelay: 200,
            maxRetries: 2,
            description: 'Transaction not found - may have been aborted or expired',
            recoveryActions: ['Start a new transaction', 'Check session validity']
        }],
    // Network and connection errors
    [TransactionErrorCode.NETWORK_TIMEOUT, {
            code: TransactionErrorCode.NETWORK_TIMEOUT,
            severity: ErrorSeverity.TRANSIENT,
            retryable: true,
            retryDelay: 1000,
            maxRetries: 3,
            description: 'Network timeout connecting to MongoDB',
            recoveryActions: ['Retry with longer timeout', 'Check network connectivity', 'Verify MongoDB server status']
        }],
    [TransactionErrorCode.HOST_UNREACHABLE, {
            code: TransactionErrorCode.HOST_UNREACHABLE,
            severity: ErrorSeverity.CONFIGURATION,
            retryable: false,
            retryDelay: 0,
            maxRetries: 0,
            description: 'MongoDB host is unreachable',
            recoveryActions: ['Check MongoDB server status', 'Verify connection string', 'Check firewall settings']
        }],
    // Lock and concurrency errors
    [TransactionErrorCode.LOCK_TIMEOUT, {
            code: TransactionErrorCode.LOCK_TIMEOUT,
            severity: ErrorSeverity.TRANSIENT,
            retryable: true,
            retryDelay: 500,
            maxRetries: 2,
            description: 'Lock acquisition timeout',
            recoveryActions: ['Retry with backoff', 'Review transaction patterns', 'Consider shorter transactions']
        }],
    [TransactionErrorCode.MAXTIME_EXPIRED, {
            code: TransactionErrorCode.MAXTIME_EXPIRED,
            severity: ErrorSeverity.PERMANENT,
            retryable: false,
            retryDelay: 0,
            maxRetries: 0,
            description: 'Transaction exceeded maximum execution time',
            recoveryActions: ['Increase transaction timeout', 'Optimize transaction operations', 'Break into smaller transactions']
        }],
    // Session errors
    [TransactionErrorCode.SESSION_EXPIRED, {
            code: TransactionErrorCode.SESSION_EXPIRED,
            severity: ErrorSeverity.PERMANENT,
            retryable: false,
            retryDelay: 0,
            maxRetries: 0,
            description: 'Session has expired',
            recoveryActions: ['Start new session', 'Review session timeout settings']
        }],
    [TransactionErrorCode.TRANSACTION_SIZE_LIMIT_EXCEEDED, {
            code: TransactionErrorCode.TRANSACTION_SIZE_LIMIT_EXCEEDED,
            severity: ErrorSeverity.PERMANENT,
            retryable: false,
            retryDelay: 0,
            maxRetries: 0,
            description: 'Transaction size exceeds MongoDB limits',
            recoveryActions: ['Break transaction into smaller pieces', 'Review transaction scope', 'Optimize data operations']
        }],
    // Replica set errors
    [TransactionErrorCode.NOT_MASTER, {
            code: TransactionErrorCode.NOT_MASTER,
            severity: ErrorSeverity.TRANSIENT,
            retryable: true,
            retryDelay: 1000,
            maxRetries: 3,
            description: 'Current node is not the primary replica',
            recoveryActions: ['Wait for primary election', 'Retry operation', 'Check replica set status']
        }],
    [TransactionErrorCode.PRIMARY_STEPPED_DOWN, {
            code: TransactionErrorCode.PRIMARY_STEPPED_DOWN,
            severity: ErrorSeverity.TRANSIENT,
            retryable: true,
            retryDelay: 2000,
            maxRetries: 2,
            description: 'Primary replica stepped down',
            recoveryActions: ['Wait for new primary', 'Retry operation', 'Monitor replica set health']
        }]
]);
/**
 * Decorator for automatic transaction error handling.
 * Wraps a method to automatically handle transaction errors with retry logic.
 *
 * @param errorHandler - Transaction error handler instance
 * @param operationName - Name of the operation for logging
 * @returns Method decorator
 */
function HandleTransactionErrors(errorHandler, operationName) {
    return function (target, propertyName, descriptor) {
        const originalMethod = descriptor.value;
        const opName = operationName || `${target.constructor.name}.${propertyName}`;
        descriptor.value = async function (...args) {
            const result = await errorHandler.executeWithRetry(() => originalMethod.apply(this, args), opName, {
                className: target.constructor.name,
                methodName: propertyName,
                argumentCount: args.length
            });
            if (!result.success) {
                throw new unit_of_work_1.UnitOfWorkError(`Operation '${opName}' failed after ${result.attempts} attempts`, opName, result.error);
            }
            return result.result;
        };
        return descriptor;
    };
}
/**
 * Factory for creating transaction error handlers with different configurations.
 */
class TransactionErrorHandlerFactory {
    /**
     * Creates an error handler optimized for high-throughput operations.
     */
    static createHighThroughputHandler(rollbackService) {
        return new TransactionErrorHandler(rollbackService, {
            maxRetries: 2,
            baseDelay: 50,
            maxDelay: 1000,
            exponentialBackoff: true,
            jitterFactor: 0.2,
            attemptTimeout: 10000
        });
    }
    /**
     * Creates an error handler optimized for critical operations.
     */
    static createCriticalOperationHandler(rollbackService) {
        return new TransactionErrorHandler(rollbackService, {
            maxRetries: 5,
            baseDelay: 200,
            maxDelay: 10000,
            exponentialBackoff: true,
            jitterFactor: 0.1,
            attemptTimeout: 60000
        });
    }
    /**
     * Creates an error handler optimized for background operations.
     */
    static createBackgroundOperationHandler(rollbackService) {
        return new TransactionErrorHandler(rollbackService, {
            maxRetries: 10,
            baseDelay: 1000,
            maxDelay: 30000,
            exponentialBackoff: true,
            jitterFactor: 0.3,
            attemptTimeout: 120000
        });
    }
}
exports.TransactionErrorHandlerFactory = TransactionErrorHandlerFactory;
//# sourceMappingURL=transaction-error-handler.js.map