import { ClientSession } from 'mongodb';
type BaseEntity = {
    _id?: string;
    createdAt: Date;
    updatedAt: Date;
};
interface IRepositoryBase<T> {
    add(entity: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T>;
    findById(id: string): Promise<T | null>;
    findByFilters(filters: Partial<T>): Promise<T[]>;
    update(id: string, updates: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
    findOne(filters: Partial<T>): Promise<T | null>;
    findMany(filters: Partial<T>, limit?: number, skip?: number): Promise<T[]>;
    count(filters?: Partial<T>): Promise<number>;
    deleteMany(filters: Partial<T>): Promise<number>;
    conditionalUpdate(id: string, conditions: Partial<T>, updates: Partial<T>): Promise<T | null>;
}
/**
 * Unit of Work pattern interface for MongoDB transaction management.
 *
 * This interface provides a contract for managing MongoDB transactions across multiple
 * repository operations, ensuring data consistency and providing rollback capabilities
 * for complex business operations.
 *
 * ## Key Responsibilities:
 * - Transaction lifecycle management (begin, commit, rollback)
 * - Repository registration and session coordination
 * - Error handling and automatic rollback on failures
 * - Session-aware repository operations
 *
 * ## Usage Pattern:
 * ```typescript
 * const unitOfWork = new MongoUnitOfWork();
 * try {
 *   await unitOfWork.begin();
 *
 *   const staffRepo = unitOfWork.getRepository(StaffRepository);
 *   const auditRepo = unitOfWork.getRepository(AuditLogRepository);
 *
 *   // All operations use the same transaction session
 *   await staffRepo.add(staffData);
 *   await auditRepo.logAction(auditData);
 *
 *   await unitOfWork.commit();
 * } catch (error) {
 *   await unitOfWork.rollback();
 *   throw error;
 * }
 * ```
 */
export interface IUnitOfWork {
    /**
     * Begins a new MongoDB transaction.
     * Creates a new ClientSession and starts a transaction.
     *
     * @throws Error if transaction cannot be started or if one is already active
     */
    begin(): Promise<void>;
    /**
     * Commits the current transaction.
     * All changes made within the transaction are persisted to the database.
     *
     * @throws Error if no active transaction or commit fails
     */
    commit(): Promise<void>;
    /**
     * Rolls back the current transaction.
     * All changes made within the transaction are discarded.
     * This method should not throw errors to allow for cleanup in error handlers.
     */
    rollback(): Promise<void>;
    /**
     * Gets a repository instance configured to use the current transaction session.
     * The repository will automatically use the active ClientSession for all operations.
     *
     * @param repositoryClass - Constructor function for the repository
     * @returns Repository instance configured with the current transaction session
     * @throws Error if no active transaction
     */
    getRepository<T extends ITransactionAwareRepository<any>>(repositoryClass: new (...args: any[]) => T): T;
    /**
     * Registers a repository with the unit of work for session coordination.
     * This ensures the repository uses the current transaction session.
     *
     * @param repository - Repository instance to register
     */
    registerRepository<T extends ITransactionAwareRepository<any>>(repository: T): void;
    /**
     * Gets the current MongoDB ClientSession.
     * Useful for operations that need direct session access.
     *
     * @returns The active ClientSession or null if no transaction is active
     */
    getSession(): ClientSession | null;
    /**
     * Checks if a transaction is currently active.
     *
     * @returns true if a transaction is active, false otherwise
     */
    isActive(): boolean;
    /**
     * Disposes of the unit of work and cleans up resources.
     * Should be called in finally blocks to ensure proper cleanup.
     * This will rollback any active transaction and close the session.
     */
    dispose(): Promise<void>;
}
/**
 * Transaction options for configuring MongoDB transaction behavior.
 */
export interface TransactionOptions {
    /**
     * Read concern level for the transaction.
     * - 'local': Default read concern
     * - 'majority': Read data that has been acknowledged by a majority of replica set members
     * - 'snapshot': Provides a consistent view of data across multiple operations
     */
    readConcern?: 'local' | 'majority' | 'snapshot';
    /**
     * Write concern for the transaction.
     * Determines the acknowledgment of write operations.
     */
    writeConcern?: {
        w?: number | 'majority';
        j?: boolean;
        wtimeout?: number;
    };
    /**
     * Maximum time in milliseconds for the transaction to complete.
     * Defaults to MongoDB server's transactionLifetimeLimitSeconds.
     */
    maxTimeMS?: number;
    /**
     * Maximum number of retry attempts for transient transaction errors.
     * Defaults to 3 attempts.
     */
    maxRetries?: number;
}
/**
 * Factory interface for creating Unit of Work instances.
 * Allows for dependency injection and testing with mock implementations.
 */
export interface IUnitOfWorkFactory {
    /**
     * Creates a new Unit of Work instance.
     *
     * @param options - Optional transaction configuration
     * @returns New IUnitOfWork instance
     */
    create(options?: TransactionOptions): IUnitOfWork;
}
/**
 * Repository interface extended to support transaction sessions.
 * All repositories used with Unit of Work must implement this interface.
 */
export interface ITransactionAwareRepository<T extends BaseEntity> extends IRepositoryBase<T> {
    /**
     * Sets the MongoDB ClientSession for transaction-aware operations.
     * When a session is set, all repository operations should use this session.
     *
     * @param session - MongoDB ClientSession or null to clear session
     */
    setSession(session: ClientSession | null): void;
    /**
     * Gets the current MongoDB ClientSession.
     *
     * @returns The current session or null if no session is set
     */
    getSession(): ClientSession | null;
}
/**
 * Error thrown when Unit of Work operations fail.
 * Provides additional context about transaction state and failure reasons.
 */
export declare class UnitOfWorkError extends Error {
    readonly transactionId?: string;
    readonly operation: string;
    readonly originalError?: Error;
    constructor(message: string, operation: string, originalError?: Error, transactionId?: string);
}
export {};
//# sourceMappingURL=unit-of-work.d.ts.map