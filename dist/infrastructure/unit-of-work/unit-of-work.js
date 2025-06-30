"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitOfWorkError = void 0;
/**
 * Error thrown when Unit of Work operations fail.
 * Provides additional context about transaction state and failure reasons.
 */
class UnitOfWorkError extends Error {
    constructor(message, operation, originalError, transactionId) {
        super(message);
        this.name = 'UnitOfWorkError';
        this.operation = operation;
        this.originalError = originalError;
        this.transactionId = transactionId;
    }
}
exports.UnitOfWorkError = UnitOfWorkError;
//# sourceMappingURL=unit-of-work.js.map