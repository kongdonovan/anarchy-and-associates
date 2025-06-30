import { CommandInteraction } from 'discord.js';
import { BaseError, ErrorContext } from '../../domain/errors/base-error';
import { ErrorContextService, EnhancedErrorContext } from '../../application/services/error-context-service';
import { logger } from '../logger';

/**
 * Context-aware error wrapper that automatically enriches errors with correlation data
 */
export class ContextAwareErrorWrapper {
  /**
   * Wraps a Discord command function with automatic context preservation
   */
  public static wrapDiscordCommand<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    commandName: string
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      // Find the CommandInteraction in the arguments
      const interaction = args.find((arg): arg is CommandInteraction => 
        arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
      );

      if (!interaction) {
        logger.warn(`No interaction found for command ${commandName}`);
        return await fn(...args);
      }

      // Create enhanced context
      const context = await ErrorContextService.createFromInteraction(interaction, `command.${commandName}`);
      const operationId = context.operationId!;

      try {
        logger.debug(`Starting command ${commandName}`, {
          correlationId: context.correlationId,
          operationId,
          guildId: context.guildId,
          userId: context.userId
        });

        const result = await fn(...args);

        // Complete operation tracking
        const metrics = ErrorContextService.completeOperation(operationId);
        logger.debug(`Completed command ${commandName}`, {
          correlationId: context.correlationId,
          operationId,
          duration: metrics?.duration
        });

        return result;

      } catch (error) {
        // Enrich error with context if it's a custom error
        if (error instanceof BaseError) {
          error.enrichContext(context);
        }

        // Complete operation tracking
        ErrorContextService.completeOperation(operationId);

        // Log the error with full context
        logger.error(`Command ${commandName} failed`, {
          correlationId: context.correlationId,
          operationId,
          error: error instanceof BaseError ? error.serialize() : {
            name: (error as Error).name,
            message: (error as Error).message,
            stack: (error as Error).stack
          },
          breadcrumbs: ErrorContextService.createBreadcrumbTrail(context)
        });

        throw error;
      }
    };
  }

  /**
   * Wraps a service method with automatic context preservation
   */
  public static wrapServiceMethod<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    serviceName: string,
    methodName: string,
    parentContext?: Partial<ErrorContext>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const context = ErrorContextService.createForService(serviceName, methodName, parentContext);
      const operationId = context.operationId!;

      try {
        logger.debug(`Starting ${serviceName}.${methodName}`, {
          correlationId: context.correlationId,
          operationId,
          parentOperation: context.parentOperationId
        });

        const result = await fn(...args);

        // Complete operation tracking
        const metrics = ErrorContextService.completeOperation(operationId);
        logger.debug(`Completed ${serviceName}.${methodName}`, {
          correlationId: context.correlationId,
          operationId,
          duration: metrics?.duration
        });

        return result;

      } catch (error) {
        // Enrich error with context
        if (error instanceof BaseError) {
          error.enrichContext(context);
        }

        // Complete operation tracking
        ErrorContextService.completeOperation(operationId);

        // Log the error
        logger.error(`Service method ${serviceName}.${methodName} failed`, {
          correlationId: context.correlationId,
          operationId,
          error: error instanceof BaseError ? error.serialize() : {
            name: (error as Error).name,
            message: (error as Error).message
          }
        });

        throw error;
      }
    };
  }

  /**
   * Wraps a repository method with automatic context preservation
   */
  public static wrapRepositoryMethod<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    repositoryName: string,
    methodName: string,
    parentContext?: Partial<ErrorContext>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const context = ErrorContextService.createForDatabase(
        methodName,
        repositoryName.replace('Repository', '').toLowerCase(),
        undefined,
        parentContext
      );
      const operationId = context.operationId!;

      try {
        // Track resource access
        ErrorContextService.trackResourceAccess(operationId, `${repositoryName}.${methodName}`);

        const result = await fn(...args);

        // Complete operation tracking
        ErrorContextService.completeOperation(operationId);

        return result;

      } catch (error) {
        // Enrich error with context
        if (error instanceof BaseError) {
          error.enrichContext(context);
        }

        // Complete operation tracking
        ErrorContextService.completeOperation(operationId);

        throw error;
      }
    };
  }

  /**
   * Decorator for Discord command methods
   */
  public static DiscordCommandWrapper(commandName: string) {
    return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      descriptor.value = ContextAwareErrorWrapper.wrapDiscordCommand(originalMethod, commandName);
      return descriptor;
    };
  }

  /**
   * Decorator for service methods
   */
  public static ServiceMethodWrapper(serviceName: string) {
    return function (_target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      descriptor.value = function (...args: any[]) {
        // Try to extract parent context from 'this' or arguments
        const parentContext = (this as any).context || args.find((arg: any) => 
          arg && typeof arg === 'object' && 'correlationId' in arg
        );
        
        return ContextAwareErrorWrapper.wrapServiceMethod(
          originalMethod.bind(this),
          serviceName,
          propertyName,
          parentContext
        )(...args);
      };
      return descriptor;
    };
  }

  /**
   * Decorator for repository methods
   */
  public static RepositoryMethodWrapper(repositoryName: string) {
    return function (_target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      descriptor.value = function (...args: any[]) {
        const parentContext = (this as any).context;
        
        return ContextAwareErrorWrapper.wrapRepositoryMethod(
          originalMethod.bind(this),
          repositoryName,
          propertyName,
          parentContext
        )(...args);
      };
      return descriptor;
    };
  }

  /**
   * Creates a context-aware error from a regular error
   */
  public static createContextAwareError(
    error: Error,
    context: EnhancedErrorContext,
    additionalMetadata?: Record<string, any>
  ): BaseError {
    // If it's already a BaseError, just enrich the context
    if (error instanceof BaseError) {
      return error.enrichContext({
        ...context,
        metadata: {
          ...context.metadata,
          ...additionalMetadata
        }
      });
    }

    // Create a new BaseError wrapper for non-custom errors
    return new (class extends BaseError {
      constructor() {
        super(
          error.message,
          'SYS_001', // System error code
          {
            ...context,
            metadata: {
              ...context.metadata,
              originalErrorName: error.name,
              originalStack: error.stack,
              ...additionalMetadata
            }
          },
          false // System errors are not operational
        );
        this.name = `ContextAware${error.name}`;
        this.stack = error.stack;
      }

      protected getClientMessage(): string {
        return 'An unexpected error occurred. Please try again or contact support.';
      }
    })();
  }

  /**
   * Propagates context through promise chains
   */
  public static propagateContext<T>(
    promise: Promise<T>,
    context: EnhancedErrorContext
  ): Promise<T> {
    return promise.catch((error: Error) => {
      if (error instanceof BaseError) {
        error.enrichContext(context);
      }
      throw error;
    });
  }

  /**
   * Creates a context-preserving timeout wrapper
   */
  public static withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    context: EnhancedErrorContext,
    timeoutMessage: string = 'Operation timed out'
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        const timeoutError = new (class extends BaseError {
          constructor() {
            super(
              timeoutMessage,
              'SYS_002',
              {
                ...context,
                metadata: {
                  ...context.metadata,
                  timeoutMs,
                  timeoutAt: Date.now()
                }
              },
              true
            );
          }

          protected getClientMessage(): string {
            return 'The operation took too long to complete. Please try again.';
          }
        })();

        reject(timeoutError);
      }, timeoutMs);
    });

    return Promise.race([
      this.propagateContext(promise, context),
      timeoutPromise
    ]);
  }
}

/**
 * Global context store for maintaining request-scoped context
 */
export class GlobalContextStore {
  private static readonly store = new Map<string, EnhancedErrorContext>();

  /**
   * Sets context for current operation
   */
  public static setContext(operationId: string, context: EnhancedErrorContext): void {
    this.store.set(operationId, context);
  }

  /**
   * Gets context for current operation
   */
  public static getContext(operationId: string): EnhancedErrorContext | undefined {
    return this.store.get(operationId);
  }

  /**
   * Removes context for completed operation
   */
  public static removeContext(operationId: string): void {
    this.store.delete(operationId);
  }

  /**
   * Cleans up old contexts (older than 10 minutes)
   */
  public static cleanup(): void {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    
    for (const [operationId, context] of this.store.entries()) {
      if (context.metadata?.timestamp && context.metadata.timestamp < tenMinutesAgo) {
        this.store.delete(operationId);
      }
    }
  }
}