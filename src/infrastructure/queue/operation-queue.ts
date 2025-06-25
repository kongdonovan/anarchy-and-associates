import { logger } from '../logger';

export interface QueuedOperation {
  id: string;
  operation: () => Promise<any>;
  userId: string;
  guildId: string;
  isGuildOwner: boolean;
  priority: number;
  createdAt: Date;
  timeout: number;
  timeoutId?: NodeJS.Timeout;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class OperationQueue {
  private static instance: OperationQueue;
  private queue: QueuedOperation[] = [];
  private processing = false;
  private TIMEOUT_MS = 30000; // 30 seconds
  private readonly HIGH_PRIORITY = 1;
  private readonly NORMAL_PRIORITY = 2;
  private runningOperations = new Map<string, QueuedOperation>();

  private constructor() {}

  public static getInstance(): OperationQueue {
    if (!OperationQueue.instance) {
      OperationQueue.instance = new OperationQueue();
    }
    return OperationQueue.instance;
  }

  public async enqueue<T>(
    operation: () => Promise<T>,
    userId: string,
    guildId: string,
    isGuildOwner: boolean = false
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedOperation: QueuedOperation = {
        id: `${userId}-${Date.now()}-${Math.random()}`,
        operation,
        userId,
        guildId,
        isGuildOwner,
        priority: isGuildOwner ? this.HIGH_PRIORITY : this.NORMAL_PRIORITY,
        createdAt: new Date(),
        timeout: this.TIMEOUT_MS,
        resolve,
        reject
      };

      this.queue.push(queuedOperation);
      this.sortQueue();
      
      logger.info('Operation enqueued', {
        operationId: queuedOperation.id,
        userId,
        guildId,
        isGuildOwner,
        queueLength: this.queue.length
      });

      // Set timeout for the operation
      queuedOperation.timeoutId = setTimeout(() => {
        this.timeoutOperation(queuedOperation.id);
      }, this.TIMEOUT_MS);

      // Start processing if not already processing
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Sort by priority first (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // Then by creation time (FIFO within same priority)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    
    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (!operation) continue;
      
      // Move to running operations map
      this.runningOperations.set(operation.id, operation);
      
      try {
        logger.info('Processing operation', {
          operationId: operation.id,
          userId: operation.userId,
          guildId: operation.guildId,
          remainingQueue: this.queue.length
        });

        const result = await operation.operation();
        
        // Remove from running operations and clear timeout
        this.runningOperations.delete(operation.id);
        if (operation.timeoutId) {
          clearTimeout(operation.timeoutId);
        }
        
        operation.resolve(result);
        
        logger.info('Operation completed successfully', {
          operationId: operation.id,
          userId: operation.userId
        });
        
      } catch (error) {
        // Remove from running operations and clear timeout
        this.runningOperations.delete(operation.id);
        if (operation.timeoutId) {
          clearTimeout(operation.timeoutId);
        }
        
        logger.error('Operation failed', {
          operationId: operation.id,
          userId: operation.userId,
          error: error instanceof Error ? error.message : String(error)
        });
        
        operation.reject(error);
      }
    }
    
    this.processing = false;
  }

  private timeoutOperation(operationId: string): void {
    // Check if operation is still in queue
    const operationIndex = this.queue.findIndex(op => op.id === operationId);
    
    if (operationIndex >= 0) {
      const operation = this.queue[operationIndex];
      if (operation) {
        this.queue.splice(operationIndex, 1);
        
        logger.warn('Operation timed out in queue', {
          operationId,
          userId: operation.userId,
          guildId: operation.guildId
        });
        
        operation.reject(new Error('Operation timed out after 30 seconds'));
      }
      return;
    }
    
    // Check if operation is currently running
    const runningOperation = this.runningOperations.get(operationId);
    if (runningOperation) {
      this.runningOperations.delete(operationId);
      
      logger.warn('Running operation timed out', {
        operationId,
        userId: runningOperation.userId,
        guildId: runningOperation.guildId
      });
      
      runningOperation.reject(new Error('Operation timed out after 30 seconds'));
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getQueueStatus(): {
    queueLength: number;
    processing: boolean;
    operations: Array<{
      id: string;
      userId: string;
      guildId: string;
      priority: number;
      createdAt: Date;
    }>;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      operations: this.queue.map(op => ({
        id: op.id,
        userId: op.userId,
        guildId: op.guildId,
        priority: op.priority,
        createdAt: op.createdAt
      }))
    };
  }

  public clearQueue(): void {
    const queuedOperations = [...this.queue];
    const runningOperationsArray = Array.from(this.runningOperations.values());
    
    this.queue = [];
    this.runningOperations.clear();
    
    // Clear timeouts and reject all pending operations
    [...queuedOperations, ...runningOperationsArray].forEach(op => {
      if (op.timeoutId) {
        clearTimeout(op.timeoutId);
      }
      op.reject(new Error('Queue cleared'));
    });
    
    logger.info('Queue cleared', { 
      clearedOperations: queuedOperations.length + runningOperationsArray.length 
    });
  }

  // Test helper methods
  public isProcessing(): boolean {
    return this.processing;
  }

  public setTimeoutMs(timeoutMs: number): void {
    this.TIMEOUT_MS = timeoutMs;
  }

  public hasOperationsForUser(userId: string): boolean {
    return this.queue.some(op => op.userId === userId);
  }
}