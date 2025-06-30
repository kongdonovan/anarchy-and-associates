import { ClientSession, MongoClient } from 'mongodb';
import { 
  IUnitOfWork, 
  TransactionOptions, 
  ITransactionAwareRepository, 
  UnitOfWorkError,
  IUnitOfWorkFactory 
} from './unit-of-work';
import { MongoDbClient } from '../database/mongo-client';
import { logger } from '../logger';

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
export class MongoUnitOfWork implements IUnitOfWork {
  private session: ClientSession | null = null;
  private client: MongoClient;
  private registeredRepositories: Map<string, ITransactionAwareRepository<any>> = new Map();
  private transactionOptions: TransactionOptions;
  private transactionId: string | null = null;
  private isTransactionActive = false;

  constructor(
    client: MongoClient,
    options: TransactionOptions = {}
  ) {
    this.client = client;
    this.transactionOptions = {
      readConcern: 'majority',
      writeConcern: { w: 'majority', j: true },
      maxTimeMS: 30000, // 30 seconds
      maxRetries: 3,
      ...options
    };
  }

  /**
   * Begins a new MongoDB transaction with retry logic for transient errors.
   */
  async begin(): Promise<void> {
    if (this.isTransactionActive) {
      throw new UnitOfWorkError(
        'Transaction is already active. Call rollback() or commit() before starting a new transaction.',
        'begin'
      );
    }

    try {
      // Create a new session
      this.session = this.client.startSession();
      this.transactionId = this.generateTransactionId();
      
      logger.debug('Starting MongoDB transaction', {
        transactionId: this.transactionId || 'unknown',
        readConcern: this.transactionOptions.readConcern,
        writeConcern: this.transactionOptions.writeConcern
      });

      // Start transaction with configured options
      await this.session.startTransaction({
        readConcern: { level: this.transactionOptions.readConcern || 'majority' },
        writeConcern: this.transactionOptions.writeConcern,
        maxTimeMS: this.transactionOptions.maxTimeMS
      });

      this.isTransactionActive = true;

      // Apply session to all registered repositories
      this.applySessionToRepositories();

      logger.info('MongoDB transaction started successfully', {
        transactionId: this.transactionId
      });

    } catch (error) {
      await this.cleanup();
      throw new UnitOfWorkError(
        'Failed to start MongoDB transaction',
        'begin',
        error as Error,
        this.transactionId || undefined
      );
    }
  }

  /**
   * Commits the current transaction with retry logic for transient errors.
   */
  async commit(): Promise<void> {
    if (!this.isTransactionActive || !this.session) {
      throw new UnitOfWorkError(
        'No active transaction to commit. Call begin() first.',
        'commit',
        undefined,
        this.transactionId || undefined
      );
    }

    const maxRetries = this.transactionOptions.maxRetries || 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        logger.debug('Attempting to commit transaction', {
          transactionId: this.transactionId,
          attempt: retryCount + 1,
          maxRetries
        });

        await this.session.commitTransaction();
        
        logger.info('MongoDB transaction committed successfully', {
          transactionId: this.transactionId,
          attempts: retryCount + 1
        });

        await this.cleanup();
        return;

      } catch (error) {
        retryCount++;
        const mongoError = error as any;

        // Check if this is a transient transaction error that can be retried
        if (this.isTransientTransactionError(mongoError) && retryCount < maxRetries) {
          logger.warn('Transient transaction error during commit, retrying', {
            transactionId: this.transactionId,
            attempt: retryCount,
            maxRetries,
            error: mongoError.message,
            errorCode: mongoError.code
          });

          // Wait with exponential backoff before retrying
          await this.sleep(Math.pow(2, retryCount - 1) * 100);
          continue;
        }

        // If we've exhausted retries or it's not a transient error, cleanup and throw
        await this.cleanup();
        throw new UnitOfWorkError(
          `Failed to commit transaction after ${retryCount} attempts`,
          'commit',
          mongoError,
          this.transactionId || undefined
        );
      }
    }
  }

  /**
   * Rolls back the current transaction.
   * This method does not throw errors to allow for safe use in error handlers.
   */
  async rollback(): Promise<void> {
    if (!this.session || !this.isTransactionActive) {
      logger.debug('No active transaction to rollback', {
        transactionId: this.transactionId
      });
      await this.cleanup();
      return;
    }

    try {
      logger.debug('Rolling back transaction', {
        transactionId: this.transactionId
      });

      await this.session.abortTransaction();
      
      logger.info('MongoDB transaction rolled back successfully', {
        transactionId: this.transactionId
      });

    } catch (error) {
      // Log error but don't throw - rollback should not fail error handling
      logger.error('Error during transaction rollback', {
        transactionId: this.transactionId,
        error: (error as Error).message
      });
    }

    await this.cleanup();
  }

  /**
   * Gets a repository instance configured with the current transaction session.
   */
  getRepository<T extends ITransactionAwareRepository<any>>(
    repositoryClass: new (...args: any[]) => T
  ): T {
    if (!this.isTransactionActive || !this.session) {
      throw new UnitOfWorkError(
        'No active transaction. Call begin() first.',
        'getRepository',
        undefined,
        this.transactionId || undefined
      );
    }

    const repositoryKey = repositoryClass.name;
    
    // Check if we already have an instance
    if (this.registeredRepositories.has(repositoryKey)) {
      return this.registeredRepositories.get(repositoryKey) as T;
    }

    // Create new repository instance
    const repository = new repositoryClass();
    
    // Set the transaction session if repository supports it
    if (this.isTransactionAware(repository)) {
      repository.setSession(this.session);
    }

    this.registeredRepositories.set(repositoryKey, repository);
    
    logger.debug('Repository registered with transaction', {
      transactionId: this.transactionId,
      repositoryType: repositoryKey,
      sessionAware: this.isTransactionAware(repository)
    });

    return repository;
  }

  /**
   * Registers an existing repository with the unit of work.
   */
  registerRepository<T extends ITransactionAwareRepository<any>>(repository: T): void {
    const repositoryKey = repository.constructor.name;
    this.registeredRepositories.set(repositoryKey, repository);

    // Apply current session if transaction is active
    if (this.isTransactionActive && this.session && this.isTransactionAware(repository)) {
      repository.setSession(this.session);
    }

    logger.debug('Repository registered', {
      transactionId: this.transactionId,
      repositoryType: repositoryKey,
      sessionAware: this.isTransactionAware(repository)
    });
  }

  /**
   * Gets the current MongoDB ClientSession.
   */
  getSession(): ClientSession | null {
    return this.session;
  }

  /**
   * Checks if a transaction is currently active.
   */
  isActive(): boolean {
    return this.isTransactionActive && this.session !== null;
  }

  /**
   * Disposes of the unit of work and cleans up resources.
   */
  async dispose(): Promise<void> {
    if (this.isTransactionActive) {
      await this.rollback();
    } else {
      await this.cleanup();
    }
  }

  /**
   * Applies the current session to all registered repositories that support it.
   */
  private applySessionToRepositories(): void {
    for (const [key, repository] of this.registeredRepositories) {
      if (this.isTransactionAware(repository) && this.session) {
        repository.setSession(this.session);
        logger.debug('Applied session to repository', {
          transactionId: this.transactionId,
          repositoryType: key
        });
      }
    }
  }

  /**
   * Checks if a repository is transaction-aware (supports sessions).
   */
  private isTransactionAware(repository: any): repository is ITransactionAwareRepository<any> {
    return typeof repository.setSession === 'function' && 
           typeof repository.getSession === 'function';
  }

  /**
   * Checks if an error is a transient transaction error that can be retried.
   */
  private isTransientTransactionError(error: any): boolean {
    if (!error || typeof error.code !== 'number') {
      return false;
    }

    // MongoDB transient transaction error codes
    const transientErrorCodes = [
      112, // WriteConflict
      117, // ConflictingOperationInProgress
      11601, // InterruptedAtShutdown
      11602, // Interrupted
      10107, // NotMaster
      13435, // NotMasterNoSlaveOk
      13436, // NotMasterOrSecondary
      189, // PrimarySteppedDown
      91, // ShutdownInProgress
      7, // HostNotFound
      6, // HostUnreachable
      89, // NetworkTimeout
      9001 // SocketException
    ];

    return transientErrorCodes.includes(error.code) ||
           (error.errorLabels && error.errorLabels.includes('TransientTransactionError'));
  }

  /**
   * Cleans up resources (session, repositories) without throwing errors.
   */
  private async cleanup(): Promise<void> {
    try {
      // Clear session from all repositories
      for (const [, repository] of this.registeredRepositories) {
        if (this.isTransactionAware(repository)) {
          repository.setSession(null);
        }
      }

      // End the session
      if (this.session) {
        await this.session.endSession();
      }

    } catch (error) {
      logger.error('Error during cleanup', {
        transactionId: this.transactionId,
        error: (error as Error).message
      });
    } finally {
      this.session = null;
      this.isTransactionActive = false;
      this.registeredRepositories.clear();
      
      logger.debug('Unit of work cleaned up', {
        transactionId: this.transactionId
      });
      
      this.transactionId = null;
    }
  }

  /**
   * Generates a unique transaction ID for logging and tracking.
   */
  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility method for sleeping (used in retry logic).
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory for creating MongoUnitOfWork instances.
 * Handles dependency injection and configuration.
 */
export class MongoUnitOfWorkFactory implements IUnitOfWorkFactory {
  private mongoClient: MongoClient;

  constructor(mongoClient?: MongoClient) {
    this.mongoClient = mongoClient || MongoDbClient.getInstance().getClient();
  }

  /**
   * Creates a new MongoUnitOfWork instance with the specified options.
   */
  create(options?: TransactionOptions): IUnitOfWork {
    return new MongoUnitOfWork(this.mongoClient, options);
  }
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
export function Transactional(options?: TransactionOptions) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const factory = new MongoUnitOfWorkFactory();
      const unitOfWork = factory.create(options);

      try {
        await unitOfWork.begin();
        
        // Add unitOfWork as first parameter for method to use
        const result = await originalMethod.apply(this, [unitOfWork, ...args]);
        
        await unitOfWork.commit();
        return result;

      } catch (error) {
        await unitOfWork.rollback();
        throw error;
      } finally {
        await unitOfWork.dispose();
      }
    };

    return descriptor;
  };
}