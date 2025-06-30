import { BaseError, ErrorContext, ErrorCode } from './base-error';
/**
 * Error class for database operation failures
 */
export declare class DatabaseError extends BaseError {
    readonly operation: DatabaseOperation;
    readonly collection?: string;
    readonly query?: Record<string, any>;
    readonly originalError?: Error;
    readonly isRetryable: boolean;
    constructor(message: string, errorCode: ErrorCode, operation: DatabaseOperation, context?: Partial<DatabaseErrorContext>);
    protected getClientMessage(): string;
    /**
     * Determines if the error is retryable based on the error code
     */
    private determineRetryability;
    /**
     * Creates a database error from a MongoDB error
     */
    static fromMongoError(error: any, operation: DatabaseOperation, collection?: string, context?: Partial<ErrorContext>): DatabaseError;
    /**
     * Creates a transaction failure error with rollback information
     */
    static createTransactionError(operation: string, affectedCollections: string[], originalError: Error, context?: Partial<ErrorContext>): DatabaseError;
}
/**
 * Database operations enum
 */
export declare enum DatabaseOperation {
    INSERT = "INSERT",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    FIND = "FIND",
    AGGREGATE = "AGGREGATE",
    TRANSACTION = "TRANSACTION",
    INDEX = "INDEX",
    CONNECTION = "CONNECTION"
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
//# sourceMappingURL=database-error.d.ts.map