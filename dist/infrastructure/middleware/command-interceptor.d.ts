import { Client } from 'discord.js';
/**
 * Command interceptor that automatically wraps all Discord commands with error handling
 */
export declare class CommandInterceptor {
    private static errorHandlingService;
    private static isInitialized;
    private static commandHandlers;
    private static originalHandlers;
    /**
     * Initialize the command interceptor
     */
    static initialize(client: Client): void;
    /**
     * Setup interaction hook to intercept commands
     */
    private static setupInteractionHook;
    /**
     * Wrap command execution with error handling
     */
    private static wrapCommandExecution;
    /**
     * Wrap a specific command with error handling
     */
    private static wrapCommand;
    /**
     * Handle command errors
     */
    private static handleCommandError;
    /**
     * Fallback error handling when main error handling fails
     */
    private static handleFallbackError;
    /**
     * Create execution context for logging
     */
    private static createExecutionContext;
    /**
     * Register a manual command wrapper for specific commands
     */
    static wrapCommandMethod<T extends (...args: any[]) => Promise<any>>(commandMethod: T, commandName: string, options?: {
        allowBusinessRuleBypass?: boolean;
        customPermissionMessage?: string;
        convertCommonErrors?: boolean;
    }): T;
    /**
     * Convert common errors to domain errors
     */
    private static convertCommonError;
    /**
     * Get command execution statistics
     */
    static getCommandStats(): Record<string, any>;
    /**
     * Reset command interceptor
     */
    static reset(): void;
}
//# sourceMappingURL=command-interceptor.d.ts.map