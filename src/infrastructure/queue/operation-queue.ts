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
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class OperationQueue {
  private static instance: OperationQueue;
  private queue: QueuedOperation[] = [];
  private processing = false;
  private readonly TIMEOUT_MS = 30000; // 30 seconds
  private readonly HIGH_PRIORITY = 1;
  private readonly NORMAL_PRIORITY = 2;

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
      setTimeout(() => {
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
      
      try {
        logger.info('Processing operation', {
          operationId: operation.id,
          userId: operation.userId,
          guildId: operation.guildId,
          remainingQueue: this.queue.length
        });

        const result = await operation.operation();
        operation.resolve(result);
        
        logger.info('Operation completed successfully', {
          operationId: operation.id,
          userId: operation.userId
        });
        
      } catch (error) {
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
    const operationIndex = this.queue.findIndex(op => op.id === operationId);
    
    if (operationIndex >= 0) {
      const operation = this.queue[operationIndex];
      if (operation) {
        this.queue.splice(operationIndex, 1);
        
        logger.warn('Operation timed out', {
          operationId,
          userId: operation.userId,
          guildId: operation.guildId
        });
        
        operation.reject(new Error('Operation timed out after 30 seconds'));
      }
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
    const operations = [...this.queue];
    this.queue = [];
    
    // Reject all pending operations
    operations.forEach(op => {
      op.reject(new Error('Queue cleared'));
    });
    
    logger.info('Queue cleared', { clearedOperations: operations.length });
  }

  // Test helper methods
  public isProcessing(): boolean {
    return this.processing;
  }

  public hasOperationsForUser(userId: string): boolean {
    return this.queue.some(op => op.userId === userId);
  }
}