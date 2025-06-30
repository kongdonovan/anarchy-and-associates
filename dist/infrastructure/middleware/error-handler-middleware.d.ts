import { CommandInteraction } from 'discord.js';
import { ErrorContext } from '../../domain/errors';
import { EnhancedErrorContext } from '../../application/services/error-context-service';
/**
 * Discord-specific error context (extends EnhancedErrorContext)
 */
export interface DiscordErrorContext extends EnhancedErrorContext {
    interaction?: CommandInteraction;
}
/**
 * Error handler middleware for Discord commands
 */
export declare class ErrorHandlerMiddleware {
    /**
     * Main error handling method for Discord interactions
     */
    static handleError(error: Error, interaction: CommandInteraction, context?: Partial<DiscordErrorContext>): Promise<void>;
    /**
     * Enriches error context with Discord interaction data using enhanced context service
     */
    private static enrichErrorContext;
    /**
     * Logs error using enhanced logger with full context and correlation tracking
     */
    private static logError;
    /**
     * Creates appropriate error embed based on error type
     */
    private static createErrorEmbed;
    /**
     * Sends error response to user
     */
    private static sendErrorResponse;
    /**
     * Sends fallback response when error handling fails
     */
    private static sendFallbackResponse;
}
/**
 * Decorator for automatic error handling in Discord commands
 */
export declare function HandleErrors(_target: any, propertyName: string, descriptor: PropertyDescriptor): PropertyDescriptor;
/**
 * Error boundary for non-Discord errors
 */
export declare class ErrorBoundary {
    /**
     * Wraps async functions with error handling
     */
    static wrap<T extends (...args: any[]) => Promise<any>>(fn: T, context?: Partial<ErrorContext>): T;
    /**
     * Handles uncaught errors in the application
     */
    static handleUncaughtError(error: Error): void;
}
//# sourceMappingURL=error-handler-middleware.d.ts.map