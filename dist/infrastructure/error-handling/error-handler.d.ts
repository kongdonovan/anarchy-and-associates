export declare enum ErrorType {
    PERMISSION_DENIED = "PERMISSION_DENIED",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    DATABASE_ERROR = "DATABASE_ERROR",
    DISCORD_API_ERROR = "DISCORD_API_ERROR",
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
    SYSTEM_ERROR = "SYSTEM_ERROR",
    QUEUE_TIMEOUT = "QUEUE_TIMEOUT",
    CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION"
}
export interface ApplicationError extends Error {
    type: ErrorType;
    userMessage: string;
    details?: any;
    userId?: string;
    guildId?: string;
    originalError?: Error;
}
export declare class ApplicationErrorHandler {
    private static instance;
    private constructor();
    static getInstance(): ApplicationErrorHandler;
    createError(type: ErrorType, message: string, userMessage: string, details?: any, originalError?: Error): ApplicationError;
    handleError(error: Error | ApplicationError, context?: {
        userId?: string;
        guildId?: string;
        command?: string;
    }): {
        embed: any;
        ephemeral: boolean;
    };
    private normalizeError;
    private isApplicationError;
    private createErrorEmbed;
    private shouldBeEphemeral;
    executeWithErrorHandling<T>(operation: () => Promise<T>, context?: {
        userId?: string;
        guildId?: string;
        command?: string;
    }): Promise<{
        success: true;
        result: T;
    } | {
        success: false;
        error: ApplicationError;
    }>;
}
//# sourceMappingURL=error-handler.d.ts.map