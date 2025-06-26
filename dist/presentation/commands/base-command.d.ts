import { CommandInteraction, EmbedBuilder, ButtonInteraction, ModalSubmitInteraction, GuildMember } from 'discord.js';
import { PermissionContext, PermissionService } from '../../application/services/permission-service';
import { CommandValidationService, CommandValidationOptions, CommandValidationResult } from '../../application/services/command-validation-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { CrossEntityValidationService } from '../../application/services/cross-entity-validation-service';
export declare abstract class BaseCommand {
    protected commandValidationService?: CommandValidationService;
    protected businessRuleValidationService?: BusinessRuleValidationService;
    protected crossEntityValidationService?: CrossEntityValidationService;
    protected permissionService?: PermissionService;
    /**
     * Initialize validation services
     * Should be called in the constructor of derived classes
     */
    protected initializeValidationServices(commandValidationService: CommandValidationService, businessRuleValidationService: BusinessRuleValidationService, crossEntityValidationService: CrossEntityValidationService, permissionService: PermissionService): void;
    /**
     * Get permission context from interaction
     */
    protected getPermissionContext(interaction: CommandInteraction): Promise<PermissionContext>;
    /**
     * Validate command with options
     */
    protected validateCommand(interaction: CommandInteraction, options?: CommandValidationOptions): Promise<CommandValidationResult>;
    /**
     * Handle validation result and show appropriate UI
     */
    protected handleValidationResult(interaction: CommandInteraction, validationResult: CommandValidationResult): Promise<boolean>;
    /**
     * Handle validation bypass confirmation
     */
    protected handleValidationBypass(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<boolean>;
    /**
     * Check if user has required permission
     */
    protected hasPermission(interaction: CommandInteraction, requiredPermission: string): Promise<boolean>;
    /**
     * Create error embed with consistent styling
     */
    protected createErrorEmbed(title: string, description: string): EmbedBuilder;
    /**
     * Create success embed with consistent styling
     */
    protected createSuccessEmbed(title: string, description: string): EmbedBuilder;
    /**
     * Create warning embed with consistent styling
     */
    protected createWarningEmbed(title: string, description: string): EmbedBuilder;
    /**
     * Create info embed with consistent styling
     */
    protected createInfoEmbed(title: string, description: string, fields?: {
        name: string;
        value: string;
        inline?: boolean;
    }[]): EmbedBuilder;
    /**
     * Log command execution with context
     */
    protected logCommandExecution(interaction: CommandInteraction, action: string, details?: Record<string, any>): void;
    /**
     * Log command error with context
     */
    protected logCommandError(interaction: CommandInteraction, action: string, error: any, details?: Record<string, any>): void;
    /**
     * Extract member from user option
     */
    protected getMemberFromOption(interaction: CommandInteraction, optionName: string): Promise<GuildMember | null>;
    /**
     * Defer reply with thinking state
     */
    protected deferReply(interaction: CommandInteraction, ephemeral?: boolean): Promise<void>;
    /**
     * Safe reply that handles deferred state
     */
    protected safeReply(interaction: CommandInteraction, options: {
        embeds?: EmbedBuilder[];
        content?: string;
        ephemeral?: boolean;
    }): Promise<void>;
}
//# sourceMappingURL=base-command.d.ts.map