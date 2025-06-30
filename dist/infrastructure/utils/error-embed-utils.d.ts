import { EmbedBuilder } from 'discord.js';
/**
 * Error-specific embed colors
 */
export declare const ErrorColors: {
    readonly BUSINESS_RULE: 16753920;
    readonly VALIDATION: 16776960;
    readonly PERMISSION: 16739179;
    readonly NOT_FOUND: 8421504;
    readonly DATABASE: 9109504;
    readonly DISCORD_API: 5793266;
    readonly SYSTEM: 16711680;
    readonly UNKNOWN: 16711680;
};
/**
 * Error icon mappings
 */
export declare const ErrorIcons: {
    readonly BUSINESS_RULE: "⚖️";
    readonly VALIDATION: "📝";
    readonly PERMISSION: "🔒";
    readonly NOT_FOUND: "🔍";
    readonly DATABASE: "💾";
    readonly DISCORD_API: "🤖";
    readonly SYSTEM: "⚠️";
    readonly UNKNOWN: "❌";
};
/**
 * Utility class for creating consistent error embeds
 */
export declare class ErrorEmbedUtils {
    /**
     * Creates an embed for any error type with automatic formatting
     */
    static createErrorEmbed(error: Error, context?: {
        guildId?: string;
        userId?: string;
        commandName?: string;
        showTechnicalDetails?: boolean;
        includeErrorId?: boolean;
    }): EmbedBuilder;
    /**
     * Creates embed for custom domain errors
     */
    private static createCustomErrorEmbed;
    /**
     * Format business rule error embed
     */
    private static formatBusinessRuleError;
    /**
     * Format validation error embed
     */
    private static formatValidationError;
    /**
     * Format permission error embed
     */
    private static formatPermissionError;
    /**
     * Format not found error embed
     */
    private static formatNotFoundError;
    /**
     * Format database error embed
     */
    private static formatDatabaseError;
    /**
     * Format Discord API error embed
     */
    private static formatDiscordError;
    /**
     * Format generic domain error embed
     */
    private static formatGenericDomainError;
    /**
     * Creates embed for non-domain errors
     */
    private static createGenericErrorEmbed;
    /**
     * Add technical details section to embed
     */
    private static addTechnicalDetails;
    /**
     * Create footer text with error information
     */
    private static createFooterText;
    /**
     * Generate unique error ID for tracking
     */
    private static generateErrorId;
    /**
     * Create success embed with consistent branding
     */
    static createSuccessEmbed(title: string, description: string, details?: {
        name: string;
        value: string;
        inline?: boolean;
    }[]): EmbedBuilder;
    /**
     * Create warning embed with consistent branding
     */
    static createWarningEmbed(title: string, description: string, warnings?: string[]): EmbedBuilder;
    /**
     * Create info embed with consistent branding
     */
    static createInfoEmbed(title: string, description: string, fields?: {
        name: string;
        value: string;
        inline?: boolean;
    }[]): EmbedBuilder;
    /**
     * Create loading embed for long operations
     */
    static createLoadingEmbed(title?: string, description?: string): EmbedBuilder;
}
//# sourceMappingURL=error-embed-utils.d.ts.map