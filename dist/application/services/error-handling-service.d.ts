import { CommandInteraction } from 'discord.js';
import { ErrorContext } from '../../domain/errors';
import { DiscordErrorContext } from '../../infrastructure/middleware/error-handler-middleware';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
/**
 * Centralized error handling service
 */
export declare class ErrorHandlingService {
    private auditLogRepository;
    private errorMetrics;
    constructor(auditLogRepository: AuditLogRepository);
    /**
     * Handles Discord command errors
     */
    handleDiscordError(error: Error, interaction: CommandInteraction, additionalContext?: Partial<DiscordErrorContext>): Promise<void>;
    /**
     * Handles service-level errors (non-Discord)
     */
    handleServiceError(error: Error, context: ErrorContext): Promise<void>;
    /**
     * Processes and converts errors to appropriate types
     */
    private processError;
    /**
     * Checks if error is from Discord.js
     */
    private isDiscordJSError;
    /**
     * Checks if error is from MongoDB
     */
    private isMongoError;
    /**
     * Checks if error is a validation error
     */
    private isValidationError;
    /**
     * Converts MongoDB errors to DatabaseError
     */
    private convertMongoError;
    /**
     * Converts validation errors to ValidationError
     */
    private convertValidationError;
    /**
     * Tracks error metrics for monitoring
     */
    private trackErrorMetrics;
    /**
     * Audits significant errors
     */
    private auditError;
    /**
     * Gets error metrics for monitoring
     */
    getErrorMetrics(): Record<string, number>;
    /**
     * Resets error metrics
     */
    resetErrorMetrics(): void;
    /**
     * Creates error context from interaction
     */
    static createContextFromInteraction(interaction: CommandInteraction, additionalContext?: Partial<ErrorContext>): ErrorContext;
}
/**
 * Global error handler for uncaught errors
 */
export declare class GlobalErrorHandler {
    static initialize(_errorHandlingService: ErrorHandlingService): void;
}
//# sourceMappingURL=error-handling-service.d.ts.map