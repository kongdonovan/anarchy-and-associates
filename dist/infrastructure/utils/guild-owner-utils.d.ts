import { ModalBuilder, ModalSubmitInteraction, CommandInteraction, EmbedBuilder } from 'discord.js';
import { RoleLimitValidationResult } from '../../application/services/business-rule-validation-service';
export interface BypassModalConfig {
    customId: string;
    title: string;
    currentCount: number;
    maxCount: number;
    roleName: string;
    bypassReason: string;
}
export interface BypassConfirmationResult {
    confirmed: boolean;
    reason?: string;
    error?: string;
}
export declare class GuildOwnerUtils {
    /**
     * Create a bypass confirmation modal for role limits
     */
    static createRoleLimitBypassModal(userId: string, validationResult: RoleLimitValidationResult): ModalBuilder;
    /**
     * Create an informational embed for bypass confirmation
     */
    static createBypassConfirmationEmbed(validationResult: RoleLimitValidationResult): EmbedBuilder;
    /**
     * Validate bypass confirmation from modal submission
     */
    static validateBypassConfirmation(interaction: ModalSubmitInteraction): BypassConfirmationResult;
    /**
     * Create success embed for completed bypass
     */
    static createBypassSuccessEmbed(roleName: string, newCount: number, reason?: string): EmbedBuilder;
    /**
     * Create error embed for failed bypass
     */
    static createBypassErrorEmbed(error: string): EmbedBuilder;
    /**
     * Check if user is eligible for bypass (guild owner check)
     */
    static isEligibleForBypass(interaction: CommandInteraction | ModalSubmitInteraction): boolean;
    /**
     * Generate bypass custom ID for modal tracking
     */
    static generateBypassId(userId: string, bypassType: string, additionalData?: string): string;
    /**
     * Parse bypass custom ID to extract information
     */
    static parseBypassId(customId: string): {
        bypassType: string;
        userId: string;
        timestamp: number;
        additionalData?: string;
    } | null;
    /**
     * Check if bypass modal is expired (30 seconds timeout)
     */
    static isBypassExpired(customId: string): boolean;
}
//# sourceMappingURL=guild-owner-utils.d.ts.map