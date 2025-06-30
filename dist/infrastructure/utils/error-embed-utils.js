"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorEmbedUtils = exports.ErrorIcons = exports.ErrorColors = void 0;
const discord_js_1 = require("discord.js");
const errors_1 = require("../../domain/errors");
const embed_utils_1 = require("./embed-utils");
/**
 * Error-specific embed colors
 */
exports.ErrorColors = {
    BUSINESS_RULE: 0xFFA500, // Orange
    VALIDATION: 0xFFFF00, // Yellow  
    PERMISSION: 0xFF6B6B, // Light Red
    NOT_FOUND: 0x808080, // Gray
    DATABASE: 0x8B0000, // Dark Red
    DISCORD_API: 0x5865F2, // Discord Blue
    SYSTEM: 0xFF0000, // Red
    UNKNOWN: 0xFF0000 // Red
};
/**
 * Error icon mappings
 */
exports.ErrorIcons = {
    BUSINESS_RULE: '⚖️',
    VALIDATION: '📝',
    PERMISSION: '🔒',
    NOT_FOUND: '🔍',
    DATABASE: '💾',
    DISCORD_API: '🤖',
    SYSTEM: '⚠️',
    UNKNOWN: '❌'
};
/**
 * Utility class for creating consistent error embeds
 */
class ErrorEmbedUtils {
    /**
     * Creates an embed for any error type with automatic formatting
     */
    static createErrorEmbed(error, context) {
        if (error instanceof errors_1.BaseError) {
            return this.createCustomErrorEmbed(error, context);
        }
        return this.createGenericErrorEmbed(error, context);
    }
    /**
     * Creates embed for custom domain errors
     */
    static createCustomErrorEmbed(error, context) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTimestamp()
            .setFooter({
            text: this.createFooterText(error, context)
        });
        if (error instanceof errors_1.BusinessRuleError) {
            return this.formatBusinessRuleError(embed, error, context);
        }
        else if (error instanceof errors_1.ValidationError) {
            return this.formatValidationError(embed, error, context);
        }
        else if (error instanceof errors_1.PermissionError) {
            return this.formatPermissionError(embed, error, context);
        }
        else if (error instanceof errors_1.NotFoundError) {
            return this.formatNotFoundError(embed, error, context);
        }
        else if (error instanceof errors_1.DatabaseError) {
            return this.formatDatabaseError(embed, error, context);
        }
        else if (error instanceof errors_1.DiscordError) {
            return this.formatDiscordError(embed, error, context);
        }
        else {
            return this.formatGenericDomainError(embed, error, context);
        }
    }
    /**
     * Format business rule error embed
     */
    static formatBusinessRuleError(embed, error, context) {
        embed
            .setTitle(`${exports.ErrorIcons.BUSINESS_RULE} Business Rule Violation`)
            .setDescription(error.toClientError().message)
            .setColor(exports.ErrorColors.BUSINESS_RULE);
        // Add rule details
        if (error.rule) {
            embed.addFields({
                name: '📋 Rule',
                value: `\`${error.rule}\``,
                inline: true
            });
        }
        // Add current vs allowed values if available
        if (error.currentValue !== undefined && error.allowedValue !== undefined) {
            embed.addFields({
                name: '📊 Current Value',
                value: `\`${error.currentValue}\``,
                inline: true
            }, {
                name: '✅ Allowed Value',
                value: `\`${error.allowedValue}\``,
                inline: true
            });
        }
        // Add bypass information for guild owners
        const bypassAllowed = error.context.metadata?.bypassAllowed;
        if (bypassAllowed) {
            embed.addFields({
                name: '🔓 Guild Owner Override',
                value: error.context.metadata?.bypassMessage || 'As guild owner, you may be able to override this restriction.',
                inline: false
            });
        }
        // Add technical details if requested
        if (context?.showTechnicalDetails) {
            this.addTechnicalDetails(embed, error);
        }
        return embed;
    }
    /**
     * Format validation error embed
     */
    static formatValidationError(embed, error, context) {
        embed
            .setTitle(`${exports.ErrorIcons.VALIDATION} Validation Error`)
            .setDescription(error.toClientError().message)
            .setColor(exports.ErrorColors.VALIDATION);
        // Add field-specific errors if available
        const fieldFailures = error.context.metadata?.fieldFailures;
        if (fieldFailures && fieldFailures.length > 0) {
            const errorList = fieldFailures
                .slice(0, 5) // Limit to 5 errors
                .map(failure => `• **${failure.field}**: ${failure.message}`)
                .join('\n');
            embed.addFields({
                name: '📝 Field Errors',
                value: errorList,
                inline: false
            });
            if (fieldFailures.length > 5) {
                embed.addFields({
                    name: '➕ Additional Errors',
                    value: `... and ${fieldFailures.length - 5} more validation errors`,
                    inline: false
                });
            }
        }
        // Add single field error details
        if (error.field && !fieldFailures) {
            embed.addFields({
                name: '🏷️ Field',
                value: `\`${error.field}\``,
                inline: true
            });
            if (error.value !== undefined) {
                embed.addFields({
                    name: '💭 Provided Value',
                    value: `\`${String(error.value).substring(0, 100)}\``,
                    inline: true
                });
            }
        }
        // Add constraints information
        if (error.constraints && Object.keys(error.constraints).length > 0) {
            const constraintList = Object.entries(error.constraints)
                .map(([key, value]) => `• **${key}**: ${value}`)
                .join('\n');
            embed.addFields({
                name: '📏 Constraints',
                value: constraintList,
                inline: false
            });
        }
        if (context?.showTechnicalDetails) {
            this.addTechnicalDetails(embed, error);
        }
        return embed;
    }
    /**
     * Format permission error embed
     */
    static formatPermissionError(embed, error, context) {
        embed
            .setTitle(`${exports.ErrorIcons.PERMISSION} Permission Denied`)
            .setDescription(error.toClientError().message)
            .setColor(exports.ErrorColors.PERMISSION);
        // Add required permission details
        if (error.requiredPermission) {
            embed.addFields({
                name: '🔐 Required Permission',
                value: `\`${error.requiredPermission}\``,
                inline: true
            });
        }
        // Add action and resource context
        if (error.action) {
            embed.addFields({
                name: '⚡ Action',
                value: `\`${error.action}\``,
                inline: true
            });
        }
        if (error.resource) {
            embed.addFields({
                name: '🎯 Resource',
                value: `\`${error.resource}\``,
                inline: true
            });
        }
        // Add help text
        embed.addFields({
            name: '💡 Need Help?',
            value: 'Contact a server administrator to request the necessary permissions.',
            inline: false
        });
        if (context?.showTechnicalDetails) {
            this.addTechnicalDetails(embed, error);
        }
        return embed;
    }
    /**
     * Format not found error embed
     */
    static formatNotFoundError(embed, error, context) {
        embed
            .setTitle(`${exports.ErrorIcons.NOT_FOUND} Not Found`)
            .setDescription(error.toClientError().message)
            .setColor(exports.ErrorColors.NOT_FOUND);
        // Add resource type
        embed.addFields({
            name: '🏷️ Resource Type',
            value: `\`${error.resourceType}\``,
            inline: true
        });
        // Add resource ID if available
        if (error.resourceId) {
            embed.addFields({
                name: '🆔 Resource ID',
                value: `\`${error.resourceId}\``,
                inline: true
            });
        }
        // Add search criteria if available
        if (error.searchCriteria && Object.keys(error.searchCriteria).length > 0) {
            const criteriaList = Object.entries(error.searchCriteria)
                .map(([key, value]) => `• **${key}**: \`${value}\``)
                .join('\n');
            embed.addFields({
                name: '🔍 Search Criteria',
                value: criteriaList,
                inline: false
            });
        }
        // Add helpful suggestions
        embed.addFields({
            name: '💡 Suggestions',
            value: '• Check spelling and try again\n• Verify the resource exists\n• Ensure you have access to view it',
            inline: false
        });
        if (context?.showTechnicalDetails) {
            this.addTechnicalDetails(embed, error);
        }
        return embed;
    }
    /**
     * Format database error embed
     */
    static formatDatabaseError(embed, error, context) {
        embed
            .setTitle(`${exports.ErrorIcons.DATABASE} Database Error`)
            .setDescription(error.toClientError().message)
            .setColor(exports.ErrorColors.DATABASE);
        // Add operation type
        embed.addFields({
            name: '⚙️ Operation',
            value: `\`${error.operation}\``,
            inline: true
        });
        // Add retry information
        if (error.isRetryable) {
            embed.addFields({
                name: '🔄 Retry Available',
                value: 'This operation can be retried. Please try again in a moment.',
                inline: false
            });
        }
        // Add collection info if available (but not in technical details)
        if (error.collection && context?.showTechnicalDetails) {
            embed.addFields({
                name: '📂 Collection',
                value: `\`${error.collection}\``,
                inline: true
            });
        }
        if (context?.showTechnicalDetails) {
            this.addTechnicalDetails(embed, error);
        }
        return embed;
    }
    /**
     * Format Discord API error embed
     */
    static formatDiscordError(embed, error, context) {
        embed
            .setTitle(`${exports.ErrorIcons.DISCORD_API} Discord API Error`)
            .setDescription(error.toClientError().message)
            .setColor(exports.ErrorColors.DISCORD_API);
        // Add Discord error code if available
        if (error.discordCode) {
            embed.addFields({
                name: '🏷️ Discord Error Code',
                value: `\`${error.discordCode}\``,
                inline: true
            });
        }
        // Add HTTP status if available
        if (error.httpStatus) {
            embed.addFields({
                name: '🌐 HTTP Status',
                value: `\`${error.httpStatus}\``,
                inline: true
            });
        }
        // Add rate limit information
        if (error.isRateLimit()) {
            embed.addFields({
                name: '⏱️ Rate Limited',
                value: 'You are being rate limited. Please wait before trying again.',
                inline: false
            });
        }
        // Add retry information for certain errors
        if (error.httpStatus && error.httpStatus >= 500) {
            embed.addFields({
                name: '🔄 Service Issue',
                value: 'Discord services are experiencing issues. Please try again later.',
                inline: false
            });
        }
        if (context?.showTechnicalDetails) {
            this.addTechnicalDetails(embed, error);
        }
        return embed;
    }
    /**
     * Format generic domain error embed
     */
    static formatGenericDomainError(embed, error, context) {
        embed
            .setTitle(`${exports.ErrorIcons.SYSTEM} Error`)
            .setDescription(error.toClientError().message)
            .setColor(exports.ErrorColors.SYSTEM);
        if (context?.showTechnicalDetails) {
            this.addTechnicalDetails(embed, error);
        }
        return embed;
    }
    /**
     * Creates embed for non-domain errors
     */
    static createGenericErrorEmbed(error, context) {
        const errorId = this.generateErrorId();
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`${exports.ErrorIcons.UNKNOWN} Unexpected Error`)
            .setDescription('An unexpected error occurred while processing your request.')
            .setColor(exports.ErrorColors.UNKNOWN)
            .setTimestamp()
            .setFooter({
            text: this.createFooterText(error, context, errorId)
        });
        // Add error reference
        embed.addFields({
            name: '🆔 Error Reference',
            value: `\`${errorId}\`\nPlease provide this ID when reporting the issue.`,
            inline: false
        });
        // Add technical details if requested
        if (context?.showTechnicalDetails) {
            embed.addFields({
                name: '🔧 Technical Details',
                value: `\`\`\`\n${error.name}: ${error.message}\n\`\`\``,
                inline: false
            });
        }
        return embed;
    }
    /**
     * Add technical details section to embed
     */
    static addTechnicalDetails(embed, error) {
        const details = [];
        if (error.errorCode) {
            details.push(`**Error Code**: \`${error.errorCode}\``);
        }
        if (error.context.guildId) {
            details.push(`**Guild**: \`${error.context.guildId}\``);
        }
        if (error.context.commandName) {
            details.push(`**Command**: \`${error.context.commandName}\``);
        }
        if (details.length > 0) {
            embed.addFields({
                name: '🔧 Technical Details',
                value: details.join('\n'),
                inline: false
            });
        }
    }
    /**
     * Create footer text with error information
     */
    static createFooterText(error, context, errorId) {
        const parts = [];
        if (error instanceof errors_1.BaseError) {
            parts.push(`Error: ${error.errorCode}`);
        }
        else if (errorId) {
            parts.push(`ID: ${errorId}`);
        }
        if (context?.commandName) {
            parts.push(`Command: ${context.commandName}`);
        }
        parts.push(new Date().toLocaleTimeString());
        return parts.join(' • ');
    }
    /**
     * Generate unique error ID for tracking
     */
    static generateErrorId() {
        return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Create success embed with consistent branding
     */
    static createSuccessEmbed(title, description, details) {
        const embed = embed_utils_1.EmbedUtils.createSuccessEmbed(title, description);
        if (details) {
            embed.addFields(details);
        }
        return embed;
    }
    /**
     * Create warning embed with consistent branding
     */
    static createWarningEmbed(title, description, warnings) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`⚠️ ${title}`)
            .setDescription(description)
            .setColor(0xFFCC00)
            .setTimestamp();
        if (warnings && warnings.length > 0) {
            embed.addFields({
                name: '⚠️ Warnings',
                value: warnings.map(w => `• ${w}`).join('\n'),
                inline: false
            });
        }
        return embed;
    }
    /**
     * Create info embed with consistent branding
     */
    static createInfoEmbed(title, description, fields) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`ℹ️ ${title}`)
            .setDescription(description)
            .setColor(discord_js_1.Colors.Blue)
            .setTimestamp();
        if (fields) {
            embed.addFields(fields);
        }
        return embed;
    }
    /**
     * Create loading embed for long operations
     */
    static createLoadingEmbed(title = 'Processing', description = 'Please wait while we process your request...') {
        return new discord_js_1.EmbedBuilder()
            .setTitle(`⏳ ${title}`)
            .setDescription(description)
            .setColor(discord_js_1.Colors.Yellow)
            .setTimestamp();
    }
}
exports.ErrorEmbedUtils = ErrorEmbedUtils;
//# sourceMappingURL=error-embed-utils.js.map