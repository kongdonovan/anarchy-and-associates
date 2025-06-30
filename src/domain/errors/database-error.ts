import { BaseError, ErrorContext, ErrorCode } from './base-error';

/**
 * Error class for database operation failures
 */
export class DatabaseError extends BaseError {
  public readonly operation: DatabaseOperation;
  public readonly collection?: string;
  public readonly query?: Record<string, any>;
  public readonly originalError?: Error;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    errorCode: ErrorCode,
    operation: DatabaseOperation,
    context?: Partial<DatabaseErrorContext>
  ) {
    super(message, errorCode, context, false); // Database errors are not operational
    this.operation = operation;
    this.collection = context?.collection;
    this.query = context?.query;
    this.originalError = context?.originalError;
    this.isRetryable = context?.isRetryable ?? this.determineRetryability(errorCode);
  }

  protected getClientMessage(): string {
    // Database errors should provide generic messages to avoid exposing internals
    switch (this.errorCode) {
      case ErrorCode.DB_CONNECTION_FAILED:
        return 'Unable to connect to the database. Please try again later.';
      case ErrorCode.DB_QUERY_FAILED:
        return 'Database operation failed. Please try again.';
      case ErrorCode.DB_TRANSACTION_FAILED:
        return 'Transaction could not be completed. Changes have been rolled back.';
      case ErrorCode.DB_CONSTRAINT_VIOLATION:
        return 'Operation violates data integrity constraints.';
      case ErrorCode.DB_TIMEOUT:
        return 'Database operation timed out. Please try again.';
      default:
        return 'A database error occurred. Please contact support if the issue persists.';
    }
  }

  /**
   * Determines if the error is retryable based on the error code
   */
  private determineRetryability(errorCode: ErrorCode): boolean {
    const retryableErrors = [
      ErrorCode.DB_CONNECTION_FAILED,
      ErrorCode.DB_TIMEOUT
    ];
    return retryableErrors.includes(errorCode);
  }

  /**
   * Creates a database error from a MongoDB error
   */
  public static fromMongoError(
    error: any,
    operation: DatabaseOperation,
    collection?: string,
    context?: Partial<ErrorContext>
  ): DatabaseError {
    let errorCode = ErrorCode.DB_QUERY_FAILED;
    let message = error.message || 'Unknown database error';
    let isRetryable = false;

    // Map MongoDB error codes to our error codes
    if (error.code === 11000) {
      errorCode = ErrorCode.DB_CONSTRAINT_VIOLATION;
      message = 'Duplicate key error';
    } else if (error.name === 'MongoNetworkError') {
      errorCode = ErrorCode.DB_CONNECTION_FAILED;
      message = 'Database connection error';
      isRetryable = true;
    } else if (error.name === 'MongoTimeoutError') {
      errorCode = ErrorCode.DB_TIMEOUT;
      message = 'Database operation timeout';
      isRetryable = true;
    }

    return new DatabaseError(
      message,
      errorCode,
      operation,
      {
        ...context,
        collection,
        originalError: error,
        isRetryable,
        metadata: {
          ...context?.metadata,
          mongoErrorCode: error.code,
          mongoErrorName: error.name
        }
      }
    );
  }

  /**
   * Creates a transaction failure error with rollback information
   */
  public static createTransactionError(
    operation: string,
    affectedCollections: string[],
    originalError: Error,
    context?: Partial<ErrorContext>
  ): DatabaseError {
    const message = `Transaction failed during ${operation}. All changes have been rolled back.`;
    
    return new DatabaseError(
      message,
      ErrorCode.DB_TRANSACTION_FAILED,
      DatabaseOperation.TRANSACTION,
      {
        ...context,
        originalError,
        metadata: {
          ...context?.metadata,
          operation,
          affectedCollections,
          rollbackStatus: 'completed'
        }
      }
    );
  }
}

/**
 * Database operations enum
 */
export enum DatabaseOperation {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  FIND = 'FIND',
  AGGREGATE = 'AGGREGATE',
  TRANSACTION = 'TRANSACTION',
  INDEX = 'INDEX',
  CONNECTION = 'CONNECTION'
}

/**
 * Extended context for database errors
 */
export interface DatabaseErrorContext extends ErrorContext {
  operation?: DatabaseOperation;
  collection?: string;
  query?: Record<string, any>;
  originalError?: Error;
  isRetryable?: boolean;
  connectionState?: string;
  transactionId?: string;
}