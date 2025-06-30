"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseOperation = exports.DatabaseError = void 0;
const base_error_1 = require("./base-error");
/**
 * Error class for database operation failures
 */
class DatabaseError extends base_error_1.BaseError {
    constructor(message, errorCode, operation, context) {
        super(message, errorCode, context, false); // Database errors are not operational
        this.operation = operation;
        this.collection = context?.collection;
        this.query = context?.query;
        this.originalError = context?.originalError;
        this.isRetryable = context?.isRetryable ?? this.determineRetryability(errorCode);
    }
    getClientMessage() {
        // Database errors should provide generic messages to avoid exposing internals
        switch (this.errorCode) {
            case base_error_1.ErrorCode.DB_CONNECTION_FAILED:
                return 'Unable to connect to the database. Please try again later.';
            case base_error_1.ErrorCode.DB_QUERY_FAILED:
                return 'Database operation failed. Please try again.';
            case base_error_1.ErrorCode.DB_TRANSACTION_FAILED:
                return 'Transaction could not be completed. Changes have been rolled back.';
            case base_error_1.ErrorCode.DB_CONSTRAINT_VIOLATION:
                return 'Operation violates data integrity constraints.';
            case base_error_1.ErrorCode.DB_TIMEOUT:
                return 'Database operation timed out. Please try again.';
            default:
                return 'A database error occurred. Please contact support if the issue persists.';
        }
    }
    /**
     * Determines if the error is retryable based on the error code
     */
    determineRetryability(errorCode) {
        const retryableErrors = [
            base_error_1.ErrorCode.DB_CONNECTION_FAILED,
            base_error_1.ErrorCode.DB_TIMEOUT
        ];
        return retryableErrors.includes(errorCode);
    }
    /**
     * Creates a database error from a MongoDB error
     */
    static fromMongoError(error, operation, collection, context) {
        let errorCode = base_error_1.ErrorCode.DB_QUERY_FAILED;
        let message = error.message || 'Unknown database error';
        let isRetryable = false;
        // Map MongoDB error codes to our error codes
        if (error.code === 11000) {
            errorCode = base_error_1.ErrorCode.DB_CONSTRAINT_VIOLATION;
            message = 'Duplicate key error';
        }
        else if (error.name === 'MongoNetworkError') {
            errorCode = base_error_1.ErrorCode.DB_CONNECTION_FAILED;
            message = 'Database connection error';
            isRetryable = true;
        }
        else if (error.name === 'MongoTimeoutError') {
            errorCode = base_error_1.ErrorCode.DB_TIMEOUT;
            message = 'Database operation timeout';
            isRetryable = true;
        }
        return new DatabaseError(message, errorCode, operation, {
            ...context,
            collection,
            originalError: error,
            isRetryable,
            metadata: {
                ...context?.metadata,
                mongoErrorCode: error.code,
                mongoErrorName: error.name
            }
        });
    }
    /**
     * Creates a transaction failure error with rollback information
     */
    static createTransactionError(operation, affectedCollections, originalError, context) {
        const message = `Transaction failed during ${operation}. All changes have been rolled back.`;
        return new DatabaseError(message, base_error_1.ErrorCode.DB_TRANSACTION_FAILED, DatabaseOperation.TRANSACTION, {
            ...context,
            originalError,
            metadata: {
                ...context?.metadata,
                operation,
                affectedCollections,
                rollbackStatus: 'completed'
            }
        });
    }
}
exports.DatabaseError = DatabaseError;
/**
 * Database operations enum
 */
var DatabaseOperation;
(function (DatabaseOperation) {
    DatabaseOperation["INSERT"] = "INSERT";
    DatabaseOperation["UPDATE"] = "UPDATE";
    DatabaseOperation["DELETE"] = "DELETE";
    DatabaseOperation["FIND"] = "FIND";
    DatabaseOperation["AGGREGATE"] = "AGGREGATE";
    DatabaseOperation["TRANSACTION"] = "TRANSACTION";
    DatabaseOperation["INDEX"] = "INDEX";
    DatabaseOperation["CONNECTION"] = "CONNECTION";
})(DatabaseOperation || (exports.DatabaseOperation = DatabaseOperation = {}));
//# sourceMappingURL=database-error.js.map