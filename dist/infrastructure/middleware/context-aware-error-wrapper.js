"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalContextStore = exports.ContextAwareErrorWrapper = void 0;
const base_error_1 = require("../../domain/errors/base-error");
const error_context_service_1 = require("../../application/services/error-context-service");
const logger_1 = require("../logger");
/**
 * Context-aware error wrapper that automatically enriches errors with correlation data
 */
class ContextAwareErrorWrapper {
    /**
     * Wraps a Discord command function with automatic context preservation
     */
    static wrapDiscordCommand(fn, commandName) {
        return async (...args) => {
            // Find the CommandInteraction in the arguments
            const interaction = args.find((arg) => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
            if (!interaction) {
                logger_1.logger.warn(`No interaction found for command ${commandName}`);
                return await fn(...args);
            }
            // Create enhanced context
            const context = await error_context_service_1.ErrorContextService.createFromInteraction(interaction, `command.${commandName}`);
            const operationId = context.operationId;
            try {
                logger_1.logger.debug(`Starting command ${commandName}`, {
                    correlationId: context.correlationId,
                    operationId,
                    guildId: context.guildId,
                    userId: context.userId
                });
                const result = await fn(...args);
                // Complete operation tracking
                const metrics = error_context_service_1.ErrorContextService.completeOperation(operationId);
                logger_1.logger.debug(`Completed command ${commandName}`, {
                    correlationId: context.correlationId,
                    operationId,
                    duration: metrics?.duration
                });
                return result;
            }
            catch (error) {
                // Enrich error with context if it's a custom error
                if (error instanceof base_error_1.BaseError) {
                    error.enrichContext(context);
                }
                // Complete operation tracking
                error_context_service_1.ErrorContextService.completeOperation(operationId);
                // Log the error with full context
                logger_1.logger.error(`Command ${commandName} failed`, {
                    correlationId: context.correlationId,
                    operationId,
                    error: error instanceof base_error_1.BaseError ? error.serialize() : {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    },
                    breadcrumbs: error_context_service_1.ErrorContextService.createBreadcrumbTrail(context)
                });
                throw error;
            }
        };
    }
    /**
     * Wraps a service method with automatic context preservation
     */
    static wrapServiceMethod(fn, serviceName, methodName, parentContext) {
        return async (...args) => {
            const context = error_context_service_1.ErrorContextService.createForService(serviceName, methodName, parentContext);
            const operationId = context.operationId;
            try {
                logger_1.logger.debug(`Starting ${serviceName}.${methodName}`, {
                    correlationId: context.correlationId,
                    operationId,
                    parentOperation: context.parentOperationId
                });
                const result = await fn(...args);
                // Complete operation tracking
                const metrics = error_context_service_1.ErrorContextService.completeOperation(operationId);
                logger_1.logger.debug(`Completed ${serviceName}.${methodName}`, {
                    correlationId: context.correlationId,
                    operationId,
                    duration: metrics?.duration
                });
                return result;
            }
            catch (error) {
                // Enrich error with context
                if (error instanceof base_error_1.BaseError) {
                    error.enrichContext(context);
                }
                // Complete operation tracking
                error_context_service_1.ErrorContextService.completeOperation(operationId);
                // Log the error
                logger_1.logger.error(`Service method ${serviceName}.${methodName} failed`, {
                    correlationId: context.correlationId,
                    operationId,
                    error: error instanceof base_error_1.BaseError ? error.serialize() : {
                        name: error.name,
                        message: error.message
                    }
                });
                throw error;
            }
        };
    }
    /**
     * Wraps a repository method with automatic context preservation
     */
    static wrapRepositoryMethod(fn, repositoryName, methodName, parentContext) {
        return async (...args) => {
            const context = error_context_service_1.ErrorContextService.createForDatabase(methodName, repositoryName.replace('Repository', '').toLowerCase(), undefined, parentContext);
            const operationId = context.operationId;
            try {
                // Track resource access
                error_context_service_1.ErrorContextService.trackResourceAccess(operationId, `${repositoryName}.${methodName}`);
                const result = await fn(...args);
                // Complete operation tracking
                error_context_service_1.ErrorContextService.completeOperation(operationId);
                return result;
            }
            catch (error) {
                // Enrich error with context
                if (error instanceof base_error_1.BaseError) {
                    error.enrichContext(context);
                }
                // Complete operation tracking
                error_context_service_1.ErrorContextService.completeOperation(operationId);
                throw error;
            }
        };
    }
    /**
     * Decorator for Discord command methods
     */
    static DiscordCommandWrapper(commandName) {
        return function (_target, _propertyName, descriptor) {
            const originalMethod = descriptor.value;
            descriptor.value = ContextAwareErrorWrapper.wrapDiscordCommand(originalMethod, commandName);
            return descriptor;
        };
    }
    /**
     * Decorator for service methods
     */
    static ServiceMethodWrapper(serviceName) {
        return function (_target, propertyName, descriptor) {
            const originalMethod = descriptor.value;
            descriptor.value = function (...args) {
                // Try to extract parent context from 'this' or arguments
                const parentContext = this.context || args.find((arg) => arg && typeof arg === 'object' && 'correlationId' in arg);
                return ContextAwareErrorWrapper.wrapServiceMethod(originalMethod.bind(this), serviceName, propertyName, parentContext)(...args);
            };
            return descriptor;
        };
    }
    /**
     * Decorator for repository methods
     */
    static RepositoryMethodWrapper(repositoryName) {
        return function (_target, propertyName, descriptor) {
            const originalMethod = descriptor.value;
            descriptor.value = function (...args) {
                const parentContext = this.context;
                return ContextAwareErrorWrapper.wrapRepositoryMethod(originalMethod.bind(this), repositoryName, propertyName, parentContext)(...args);
            };
            return descriptor;
        };
    }
    /**
     * Creates a context-aware error from a regular error
     */
    static createContextAwareError(error, context, additionalMetadata) {
        // If it's already a BaseError, just enrich the context
        if (error instanceof base_error_1.BaseError) {
            return error.enrichContext({
                ...context,
                metadata: {
                    ...context.metadata,
                    ...additionalMetadata
                }
            });
        }
        // Create a new BaseError wrapper for non-custom errors
        return new (class extends base_error_1.BaseError {
            constructor() {
                super(error.message, 'SYS_001', // System error code
                {
                    ...context,
                    metadata: {
                        ...context.metadata,
                        originalErrorName: error.name,
                        originalStack: error.stack,
                        ...additionalMetadata
                    }
                }, false // System errors are not operational
                );
                this.name = `ContextAware${error.name}`;
                this.stack = error.stack;
            }
            getClientMessage() {
                return 'An unexpected error occurred. Please try again or contact support.';
            }
        })();
    }
    /**
     * Propagates context through promise chains
     */
    static propagateContext(promise, context) {
        return promise.catch((error) => {
            if (error instanceof base_error_1.BaseError) {
                error.enrichContext(context);
            }
            throw error;
        });
    }
    /**
     * Creates a context-preserving timeout wrapper
     */
    static withTimeout(promise, timeoutMs, context, timeoutMessage = 'Operation timed out') {
        const timeoutPromise = new Promise((_resolve, reject) => {
            setTimeout(() => {
                const timeoutError = new (class extends base_error_1.BaseError {
                    constructor() {
                        super(timeoutMessage, 'SYS_002', {
                            ...context,
                            metadata: {
                                ...context.metadata,
                                timeoutMs,
                                timeoutAt: Date.now()
                            }
                        }, true);
                    }
                    getClientMessage() {
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
exports.ContextAwareErrorWrapper = ContextAwareErrorWrapper;
/**
 * Global context store for maintaining request-scoped context
 */
class GlobalContextStore {
    /**
     * Sets context for current operation
     */
    static setContext(operationId, context) {
        this.store.set(operationId, context);
    }
    /**
     * Gets context for current operation
     */
    static getContext(operationId) {
        return this.store.get(operationId);
    }
    /**
     * Removes context for completed operation
     */
    static removeContext(operationId) {
        this.store.delete(operationId);
    }
    /**
     * Cleans up old contexts (older than 10 minutes)
     */
    static cleanup() {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        for (const [operationId, context] of this.store.entries()) {
            if (context.metadata?.timestamp && context.metadata.timestamp < tenMinutesAgo) {
                this.store.delete(operationId);
            }
        }
    }
}
exports.GlobalContextStore = GlobalContextStore;
GlobalContextStore.store = new Map();
//# sourceMappingURL=context-aware-error-wrapper.js.map