import { CommandInteraction } from 'discord.js';
import { BaseCommand } from './base-command';
import { ErrorHandlingService } from '../../application/services/error-handling-service';
/**
 * Enhanced base command with automatic error handling
 */
export declare abstract class EnhancedBaseCommand extends BaseCommand {
    protected errorHandlingService: ErrorHandlingService;
    constructor();
    /**
     * Execute command with automatic error handling
     */
    protected executeWithErrorHandling<T>(interaction: CommandInteraction, commandFunction: () => Promise<T>, operationName?: string): Promise<T | void>;
    /**
     * Execute command with specific error type handling
     */
    protected executeWithSpecificErrorHandling<T>(interaction: CommandInteraction, commandFunction: () => Promise<T>, errorTypes: (new (...args: any[]) => Error)[], operationName?: string): Promise<T | void>;
    /**
     * Execute command with permission error handling
     */
    protected executeWithPermissionHandling<T>(interaction: CommandInteraction, commandFunction: () => Promise<T>, customPermissionMessage?: string, operationName?: string): Promise<T | void>;
    /**
     * Execute command with business rule error handling
     */
    protected executeWithBusinessRuleHandling<T>(interaction: CommandInteraction, commandFunction: () => Promise<T>, allowBypass?: boolean, operationName?: string): Promise<T | void>;
    /**
     * Execute command with automatic error conversion
     */
    protected executeWithErrorConversion<T>(interaction: CommandInteraction, commandFunction: () => Promise<T>, operationName?: string): Promise<T | void>;
    /**
     * Safe execution wrapper that handles all types of errors
     */
    protected safeExecute<T>(interaction: CommandInteraction, commandFunction: () => Promise<T>, options?: {
        allowBusinessRuleBypass?: boolean;
        customPermissionMessage?: string;
        convertCommonErrors?: boolean;
        operationName?: string;
    }): Promise<T | void>;
    /**
     * Convert common errors to domain errors
     */
    private convertCommonError;
}
//# sourceMappingURL=enhanced-base-command.d.ts.map