import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { ValidationResult } from '../../application/services/business-rule-validation-service';
import { CommandValidationResult, ValidationBypassRequest } from '../../application/services/command-validation-service';
export declare class ValidationErrorHandler {
    /**
     * Convert validation errors to user-friendly embed
     */
    static createValidationErrorEmbed(validationResult: CommandValidationResult, commandName: string, subcommandName?: string): EmbedBuilder;
    /**
     * Create interactive embed for specific validation failures
     */
    static createDetailedValidationEmbed(validationResult: ValidationResult, context: {
        commandName: string;
        subcommandName?: string;
    }): EmbedBuilder;
    /**
     * Create bypass confirmation embed
     */
    static createBypassConfirmationEmbed(bypassRequests: ValidationBypassRequest[]): EmbedBuilder;
    /**
     * Create success embed after validation bypass
     */
    static createBypassSuccessEmbed(commandName: string, bypassReason: string, subcommandName?: string): EmbedBuilder;
    /**
     * Create action buttons for validation errors
     */
    static createValidationActionButtons(validationResult: CommandValidationResult, isGuildOwner: boolean): ActionRowBuilder<ButtonBuilder> | null;
    private static createRoleLimitEmbed;
    private static createCaseLimitEmbed;
    private static createStaffValidationEmbed;
    private static createPermissionValidationEmbed;
    private static createGenericValidationEmbed;
    private static formatCommandName;
    private static groupErrors;
    private static getCategoryEmoji;
    private static getSuggestionsForErrors;
    private static isRoleLimitValidation;
    private static isCaseLimitValidation;
    private static isStaffValidation;
    private static isPermissionValidation;
}
//# sourceMappingURL=validation-error-handler.d.ts.map