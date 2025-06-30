import { ClientSession, MongoClient } from 'mongodb';
import { IUnitOfWork, TransactionOptions, ITransactionAwareRepository, IUnitOfWorkFactory } from './unit-of-work';
/**
 * MongoDB implementation of the Unit of Work pattern.
 *
 * This class provides transaction management for MongoDB operations, ensuring
 * data consistency across multiple repository operations and providing automatic
 * rollback capabilities on failures.
 *
 * ## Features:
 * - Automatic transaction retry for transient errors
 * - Session-aware repository coordination
 * - Configurable transaction options (read/write concerns)
 * - Comprehensive error handling and logging
 * - Resource cleanup and disposal
 */
export declare class MongoUnitOfWork implements IUnitOfWork {
    private session;
    private client;
    private registeredRepositories;
    private transactionOptions;
    private transactionId;
    private isTransactionActive;
    constructor(client: MongoClient, options?: TransactionOptions);
    /**
     * Begins a new MongoDB transaction with retry logic for transient errors.
     */
    begin(): Promise<void>;
    /**
     * Commits the current transaction with retry logic for transient errors.
     */
    commit(): Promise<void>;
    /**
     * Rolls back the current transaction.
     * This method does not throw errors to allow for safe use in error handlers.
     */
    rollback(): Promise<void>;
    /**
     * Gets a repository instance configured with the current transaction session.
     */
    getRepository<T extends ITransactionAwareRepository<any>>(repositoryClass: new (...args: any[]) => T): T;
    /**
     * Registers an existing repository with the unit of work.
     */
    registerRepository<T extends ITransactionAwareRepository<any>>(repository: T): void;
    /**
     * Gets the current MongoDB ClientSession.
     */
    getSession(): ClientSession | null;
    /**
     * Checks if a transaction is currently active.
     */
    isActive(): boolean;
    /**
     * Disposes of the unit of work and cleans up resources.
     */
    dispose(): Promise<void>;
    /**
     * Applies the current session to all registered repositories that support it.
     */
    private applySessionToRepositories;
    /**
     * Checks if a repository is transaction-aware (supports sessions).
     */
    private isTransactionAware;
    /**
     * Checks if an error is a transient transaction error that can be retried.
     */
    private isTransientTransactionError;
    /**
     * Cleans up resources (session, repositories) without throwing errors.
     */
    private cleanup;
    /**
     * Generates a unique transaction ID for logging and tracking.
     */
    private generateTransactionId;
    /**
     * Utility method for sleeping (used in retry logic).
     */
    private sleep;
}
/**
 * Factory for creating MongoUnitOfWork instances.
 * Handles dependency injection and configuration.
 */
export declare class MongoUnitOfWorkFactory implements IUnitOfWorkFactory {
    private mongoClient;
    constructor(mongoClient?: MongoClient);
    /**
     * Creates a new MongoUnitOfWork instance with the specified options.
     */
    create(options?: TransactionOptions): IUnitOfWork;
}
/**
 * Decorator function for automatic transaction management.
 * Wraps a method to automatically begin, commit, or rollback transactions.
 *
 * @param options - Transaction options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class StaffService {
 *   @Transactional({ readConcern: 'majority' })
 *   async hireStaff(request: StaffHireRequest): Promise<StaffHireResult> {
 *     // Method implementation with automatic transaction management
 *   }
 * }
 * ```
 */
export declare function Transactional(options?: TransactionOptions): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=mongo-unit-of-work.d.ts.map