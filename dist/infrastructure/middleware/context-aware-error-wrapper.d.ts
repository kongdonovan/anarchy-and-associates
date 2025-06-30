import { BaseError, ErrorContext } from '../../domain/errors/base-error';
import { EnhancedErrorContext } from '../../application/services/error-context-service';
/**
 * Context-aware error wrapper that automatically enriches errors with correlation data
 */
export declare class ContextAwareErrorWrapper {
    /**
     * Wraps a Discord command function with automatic context preservation
     */
    static wrapDiscordCommand<T extends any[], R>(fn: (...args: T) => Promise<R>, commandName: string): (...args: T) => Promise<R>;
    /**
     * Wraps a service method with automatic context preservation
     */
    static wrapServiceMethod<T extends any[], R>(fn: (...args: T) => Promise<R>, serviceName: string, methodName: string, parentContext?: Partial<ErrorContext>): (...args: T) => Promise<R>;
    /**
     * Wraps a repository method with automatic context preservation
     */
    static wrapRepositoryMethod<T extends any[], R>(fn: (...args: T) => Promise<R>, repositoryName: string, methodName: string, parentContext?: Partial<ErrorContext>): (...args: T) => Promise<R>;
    /**
     * Decorator for Discord command methods
     */
    static DiscordCommandWrapper(commandName: string): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Decorator for service methods
     */
    static ServiceMethodWrapper(serviceName: string): (_target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Decorator for repository methods
     */
    static RepositoryMethodWrapper(repositoryName: string): (_target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Creates a context-aware error from a regular error
     */
    static createContextAwareError(error: Error, context: EnhancedErrorContext, additionalMetadata?: Record<string, any>): BaseError;
    /**
     * Propagates context through promise chains
     */
    static propagateContext<T>(promise: Promise<T>, context: EnhancedErrorContext): Promise<T>;
    /**
     * Creates a context-preserving timeout wrapper
     */
    static withTimeout<T>(promise: Promise<T>, timeoutMs: number, context: EnhancedErrorContext, timeoutMessage?: string): Promise<T>;
}
/**
 * Global context store for maintaining request-scoped context
 */
export declare class GlobalContextStore {
    private static readonly store;
    /**
     * Sets context for current operation
     */
    static setContext(operationId: string, context: EnhancedErrorContext): void;
    /**
     * Gets context for current operation
     */
    static getContext(operationId: string): EnhancedErrorContext | undefined;
    /**
     * Removes context for completed operation
     */
    static removeContext(operationId: string): void;
    /**
     * Cleans up old contexts (older than 10 minutes)
     */
    static cleanup(): void;
}
//# sourceMappingURL=context-aware-error-wrapper.d.ts.map