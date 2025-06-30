import { IUnitOfWork, UnitOfWorkError } from './unit-of-work';
import { RollbackService, RollbackContext } from './rollback-service';
import { logger } from '../logger';

/**
 * MongoDB transaction error codes and their meanings.
 * Reference: https://docs.mongodb.com/manual/reference/error-codes/
 */
export enum TransactionErrorCode {
  // Transient transaction errors (retryable)
  TRANSIENT_TRANSACTION_ERROR = 112,
  WRITE_CONFLICT = 112,
  NO_SUCH_TRANSACTION = 251,
  UNKNOWN_TRANSACTION_COMMIT_RESULT = 50,
  
  // Connection and network errors
  NETWORK_TIMEOUT = 89,
  HOST_UNREACHABLE = 6,
  HOST_NOT_FOUND = 7,
  CONNECTION_POOL_CLEARED = 91,
  SOCKET_EXCEPTION = 9001,
  
  // Lock and concurrency errors
  LOCK_TIMEOUT = 50,
  MAXTIME_EXPIRED = 50,
  CONFLICTING_OPERATION_IN_PROGRESS = 117,
  
  // Session and transaction state errors
  NO_SUCH_SESSION = 206,
  SESSION_EXPIRED = 228,
  TRANSACTION_TOO_OLD = 244,
  TRANSACTION_SIZE_LIMIT_EXCEEDED = 334,
  
  // Replica set and sharding errors
  NOT_MASTER = 10107,
  NOT_MASTER_NO_SLAVE_OK = 13435,
  NOT_MASTER_OR_SECONDARY = 13436,
  PRIMARY_STEPPED_DOWN = 189,
  SHUTDOWN_IN_PROGRESS = 91,
  
  // Configuration and authentication errors
  UNAUTHORIZED = 13,
  AUTHENTICATION_FAILED = 18,
  OPERATION_NOT_SUPPORTED_IN_TRANSACTION = 263
}

/**
 * Classification of transaction errors for handling strategies.
 */
export enum ErrorSeverity {
  /** Error is transient and operation should be retried */
  TRANSIENT = 'transient',
  /** Error indicates a permanent failure, operation should not be retried */
  PERMANENT = 'permanent',
  /** Error indicates a configuration issue that needs admin intervention */
  CONFIGURATION = 'configuration',
  /** Error severity is unknown, use default handling */
  UNKNOWN = 'unknown'
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
export class TransactionErrorHandler {
  private static readonly DEFAULT_RETRY_CONFIG: TransactionRetryConfig = {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 5000,
    exponentialBackoff: true,
    jitterFactor: 0.1,
    attemptTimeout: 30000
  };

  private static readonly ERROR_CLASSIFICATIONS = new Map<number, TransactionErrorInfo>([
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

  private rollbackService: RollbackService;
  private retryConfig: TransactionRetryConfig;
  private circuitBreakerThreshold: number = 5;
  private circuitBreakerWindow: number = 60000; // 1 minute
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    rollbackService: RollbackService,
    retryConfig?: Partial<TransactionRetryConfig>
  ) {
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
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, any>
  ): Promise<TransactionAttemptResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | null = null;
    let wasRetried = false;

    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      return {
        success: false,
        error: new UnitOfWorkError(
          'Circuit breaker is open - too many recent failures',
          operationName
        ),
        attempts: 0,
        duration: Date.now() - startTime,
        wasRetried: false
      };
    }

    while (attempts < this.retryConfig.maxRetries + 1) {
      attempts++;

      try {
        logger.debug('Attempting transaction operation', {
          operationName,
          attempt: attempts,
          maxAttempts: this.retryConfig.maxRetries + 1,
          context
        });

        const result = await this.executeWithTimeout(operation, this.retryConfig.attemptTimeout);
        
        // Reset circuit breaker on success
        this.resetCircuitBreaker();

        logger.info('Transaction operation succeeded', {
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

      } catch (error) {
        lastError = error as Error;
        const errorInfo = this.classifyError(lastError);

        logger.warn('Transaction operation failed', {
          operationName,
          attempt: attempts,
          error: lastError.message,
          errorCode: (lastError as any).code,
          severity: errorInfo.severity,
          retryable: errorInfo.retryable
        });

        // Check if we should retry
        const shouldRetry = this.shouldRetryError(errorInfo, attempts);
        
        if (!shouldRetry) {
          logger.error('Transaction operation failed permanently', {
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
          
          logger.info('Retrying transaction operation', {
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
  public async handleTransactionError(
    error: Error,
    unitOfWork: IUnitOfWork,
    operationName: string,
    context?: Record<string, any>
  ): Promise<{
    errorInfo: TransactionErrorInfo;
    rollbackResult: any;
    recoveryActions: string[];
  }> {
    const errorInfo = this.classifyError(error);

    logger.error('Handling transaction error', {
      operationName,
      error: error.message,
      classification: errorInfo,
      context
    });

    // Create rollback context
    const rollbackContext: RollbackContext = {
      failedOperation: operationName,
      originalError: error,
      transactionId: unitOfWork.getSession()?.id?.toString(),
      metadata: {
        errorCode: (error as any).code,
        errorSeverity: errorInfo.severity,
        ...context
      }
    };

    // Perform rollback with compensation
    const rollbackResult = await this.rollbackService.performRollback(unitOfWork, rollbackContext);

    // Log recovery suggestions
    logger.info('Transaction error recovery actions', {
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
  public classifyError(error: Error): TransactionErrorInfo {
    const mongoError = error as any;
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
  private shouldRetryError(errorInfo: TransactionErrorInfo, currentAttempt: number): boolean {
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
  private calculateRetryDelay(attempt: number, errorInfo: TransactionErrorInfo): number {
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
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new UnitOfWorkError(
          `Operation timed out after ${timeoutMs}ms`,
          'executeWithTimeout'
        ));
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
  private isCircuitBreakerOpen(): boolean {
    const now = Date.now();
    
    // Reset failure count if window has passed
    if (now - this.lastFailureTime > this.circuitBreakerWindow) {
      this.failureCount = 0;
    }

    return this.failureCount >= this.circuitBreakerThreshold;
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  private resetCircuitBreaker(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Utility method for sleeping during retry logic.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for automatic transaction error handling.
 * Wraps a method to automatically handle transaction errors with retry logic.
 * 
 * @param errorHandler - Transaction error handler instance
 * @param operationName - Name of the operation for logging
 * @returns Method decorator
 */
export function HandleTransactionErrors(
  errorHandler: TransactionErrorHandler,
  operationName?: string
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const opName = operationName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const result = await errorHandler.executeWithRetry(
        () => originalMethod.apply(this, args),
        opName,
        {
          className: target.constructor.name,
          methodName: propertyName,
          argumentCount: args.length
        }
      );

      if (!result.success) {
        throw new UnitOfWorkError(
          `Operation '${opName}' failed after ${result.attempts} attempts`,
          opName,
          result.error
        );
      }

      return result.result;
    };

    return descriptor;
  };
}

/**
 * Factory for creating transaction error handlers with different configurations.
 */
export class TransactionErrorHandlerFactory {
  /**
   * Creates an error handler optimized for high-throughput operations.
   */
  public static createHighThroughputHandler(rollbackService: RollbackService): TransactionErrorHandler {
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
  public static createCriticalOperationHandler(rollbackService: RollbackService): TransactionErrorHandler {
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
  public static createBackgroundOperationHandler(rollbackService: RollbackService): TransactionErrorHandler {
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