import { CommandInteraction, ModalBuilder, ActionRowBuilder, ButtonBuilder, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { BusinessRuleValidationService, ValidationResult } from './business-rule-validation-service';
import { CrossEntityValidationService } from './cross-entity-validation-service';
import { PermissionContext } from './permission-service';
export interface CommandValidationRule {
    name: string;
    validate: (context: CommandValidationContext) => Promise<ValidationResult>;
    bypassable?: boolean;
    priority?: number;
}
export interface CommandValidationContext {
    interaction: CommandInteraction;
    permissionContext: PermissionContext;
    commandName: string;
    subcommandName?: string;
    options: Record<string, any>;
    metadata?: Record<string, any>;
}
export interface CommandValidationOptions {
    skipPermissionCheck?: boolean;
    skipBusinessRules?: boolean;
    skipEntityValidation?: boolean;
    customRules?: CommandValidationRule[];
    bypassConfirmationRequired?: boolean;
}
export interface ValidationBypassRequest {
    validationResult: ValidationResult;
    context: CommandValidationContext;
    bypassReason?: string;
}
export interface CommandValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    bypassRequests?: ValidationBypassRequest[];
    requiresConfirmation?: boolean;
}
export declare class CommandValidationService {
    private businessRuleValidationService;
    private crossEntityValidationService;
    private static readonly VALIDATION_CACHE_TTL;
    private validationCache;
    private pendingBypasses;
    constructor(businessRuleValidationService: BusinessRuleValidationService, crossEntityValidationService: CrossEntityValidationService);
    /**
     * Main validation entry point for commands
     */
    validateCommand(context: CommandValidationContext, options?: CommandValidationOptions): Promise<CommandValidationResult>;
    /**
     * Handle bypass confirmation workflow
     */
    handleBypassConfirmation(interaction: ButtonInteraction | ModalSubmitInteraction, userId: string): Promise<boolean>;
    /**
     * Create validation bypass modal
     */
    createBypassModal(bypassRequests: ValidationBypassRequest[]): ModalBuilder;
    /**
     * Create validation bypass buttons
     */
    createBypassButtons(): ActionRowBuilder<ButtonBuilder>;
    /**
     * Extract validation context from interaction
     */
    extractValidationContext(interaction: CommandInteraction, permissionContext: PermissionContext): Promise<CommandValidationContext>;
    /**
     * Clear validation cache for a specific context
     */
    clearValidationCache(context?: CommandValidationContext): void;
    /**
     * Get pending bypass requests for a user
     */
    getPendingBypasses(userId: string): ValidationBypassRequest[] | undefined;
    /**
     * Create permission validation rule for command
     */
    private createPermissionValidationRule;
    /**
     * Get business rules for specific command
     */
    private getBusinessRulesForCommand;
    /**
     * Get entity validation rules for command
     */
    private getEntityValidationRules;
    /**
     * Generate cache key for validation context
     */
    private getCacheKey;
    /**
     * Get cached validation result
     */
    private getFromCache;
    /**
     * Cache validation result
     */
    private cacheResult;
    /**
     * Store pending bypasses for user
     */
    private storePendingBypasses;
}
//# sourceMappingURL=command-validation-service.d.ts.map