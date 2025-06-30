import { IUnitOfWork } from './unit-of-work';
import { RollbackService } from './rollback-service';
/**
 * MongoDB transaction error codes and their meanings.
 * Reference: https://docs.mongodb.com/manual/reference/error-codes/
 */
export declare enum TransactionErrorCode {
    TRANSIENT_TRANSACTION_ERROR = 112,
    WRITE_CONFLICT = 112,
    NO_SUCH_TRANSACTION = 251,
    UNKNOWN_TRANSACTION_COMMIT_RESULT = 50,
    NETWORK_TIMEOUT = 89,
    HOST_UNREACHABLE = 6,
    HOST_NOT_FOUND = 7,
    CONNECTION_POOL_CLEARED = 91,
    SOCKET_EXCEPTION = 9001,
    LOCK_TIMEOUT = 50,
    MAXTIME_EXPIRED = 50,
    CONFLICTING_OPERATION_IN_PROGRESS = 117,
    NO_SUCH_SESSION = 206,
    SESSION_EXPIRED = 228,
    TRANSACTION_TOO_OLD = 244,
    TRANSACTION_SIZE_LIMIT_EXCEEDED = 334,
    NOT_MASTER = 10107,
    NOT_MASTER_NO_SLAVE_OK = 13435,
    NOT_MASTER_OR_SECONDARY = 13436,
    PRIMARY_STEPPED_DOWN = 189,
    SHUTDOWN_IN_PROGRESS = 91,
    UNAUTHORIZED = 13,
    AUTHENTICATION_FAILED = 18,
    OPERATION_NOT_SUPPORTED_IN_TRANSACTION = 263
}
/**
 * Classification of transaction errors for handling strategies.
 */
export declare enum ErrorSeverity {
    /** Error is transient and operation should be retried */
    TRANSIENT = "transient",
    /** Error indicates a permanent failure, operation should not be retried */
    PERMANENT = "permanent",
    /** Error indicates a configuration issue that needs admin intervention */
    CONFIGURATION = "configuration",
    /** Error severity is unknown, use default handling */
    UNKNOWN = "unknown"
}
/**
 * Transaction error classification and metadata.
 */
export interface TransactionErrorInfo {
    /** MongoDB error code */
    code: number;
    /** Error classification for handling strategy */
    severity: ErrorSeverity;
    /** Whether this error can be retried */
    retryable: boolean;
    /** Suggested retry delay in milliseconds */
    retryDelay: number;
    /** Maximum number of retry attempts */
    maxRetries: number;
    /** Human-readable description of the error */
    description: string;
    /** Suggested recovery actions */
    recoveryActions: string[];
}
/**
 * Result of a transaction operation attempt.
 */
export interface TransactionAttemptResult<T> {
    /** Whether the operation succeeded */
    success: boolean;
    /** Result data if successful */
    result?: T;
    /** Error if operation failed */
    error?: Error;
    /** Number of attempts made */
    attempts: number;
    /** Total duration in milliseconds */
    duration: number;
    /** Whether operation was retried */
    wasRetried: boolean;
}
/**
 * Configuration for transaction retry behavior.
 */
export interface TransactionRetryConfig {
    /** Maximum number of retry attempts */
    maxRetries: number;
    /** Base delay between retries in milliseconds */
    baseDelay: number;
    /** Maximum delay between retries in milliseconds */
    maxDelay: number;
    /** Whether to use exponential backoff */
    exponentialBackoff: boolean;
    /** Jitter factor to add randomness to retry delays (0-1) */
    jitterFactor: number;
    /** Timeout for individual transaction attempts in milliseconds */
    attemptTimeout: number;
}
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
export declare class TransactionErrorHandler {
    private static readonly DEFAULT_RETRY_CONFIG;
    private static readonly ERROR_CLASSIFICATIONS;
    private rollbackService;
    private retryConfig;
    private circuitBreakerThreshold;
    private circuitBreakerWindow;
    private failureCount;
    private lastFailureTime;
    constructor(rollbackService: RollbackService, retryConfig?: Partial<TransactionRetryConfig>);
    /**
     * Executes a transaction operation with comprehensive error handling and retry logic.
     *
     * @param operation - Function that performs the transaction operation
     * @param operationName - Human-readable name for the operation
     * @param context - Additional context for error handling
     * @returns Result of the operation attempt
     */
    executeWithRetry<T>(operation: () => Promise<T>, operationName: string, context?: Record<string, any>): Promise<TransactionAttemptResult<T>>;
    /**
     * Handles a transaction error with comprehensive rollback and compensation.
     *
     * @param error - The error that occurred
     * @param unitOfWork - Unit of work to rollback
     * @param operationName - Name of the failed operation
     * @param context - Additional context for rollback
     * @returns Detailed error handling result
     */
    handleTransactionError(error: Error, unitOfWork: IUnitOfWork, operationName: string, context?: Record<string, any>): Promise<{
        errorInfo: TransactionErrorInfo;
        rollbackResult: any;
        recoveryActions: string[];
    }>;
    /**
     * Classifies an error and provides handling metadata.
     */
    classifyError(error: Error): TransactionErrorInfo;
    /**
     * Determines if an error should be retried based on classification and attempt count.
     */
    private shouldRetryError;
    /**
     * Calculates retry delay with exponential backoff and jitter.
     */
    private calculateRetryDelay;
    /**
     * Executes an operation with timeout.
     */
    private executeWithTimeout;
    /**
     * Circuit breaker logic to prevent cascading failures.
     */
    private isCircuitBreakerOpen;
    private recordFailure;
    private resetCircuitBreaker;
    /**
     * Utility method for sleeping during retry logic.
     */
    private sleep;
}
/**
 * Decorator for automatic transaction error handling.
 * Wraps a method to automatically handle transaction errors with retry logic.
 *
 * @param errorHandler - Transaction error handler instance
 * @param operationName - Name of the operation for logging
 * @returns Method decorator
 */
export declare function HandleTransactionErrors(errorHandler: TransactionErrorHandler, operationName?: string): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Factory for creating transaction error handlers with different configurations.
 */
export declare class TransactionErrorHandlerFactory {
    /**
     * Creates an error handler optimized for high-throughput operations.
     */
    static createHighThroughputHandler(rollbackService: RollbackService): TransactionErrorHandler;
    /**
     * Creates an error handler optimized for critical operations.
     */
    static createCriticalOperationHandler(rollbackService: RollbackService): TransactionErrorHandler;
    /**
     * Creates an error handler optimized for background operations.
     */
    static createBackgroundOperationHandler(rollbackService: RollbackService): TransactionErrorHandler;
}
//# sourceMappingURL=transaction-error-handler.d.ts.map