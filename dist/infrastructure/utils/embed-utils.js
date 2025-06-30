"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbedUtils = void 0;
const discord_js_1 = require("discord.js");
class EmbedUtils {
    static createAALegalEmbed(options = {}) {
        const embed = new discord_js_1.EmbedBuilder();
        // Set color based on type
        const colorMap = {
            brand: this.BRAND_COLOR,
            accent: this.ACCENT_COLOR,
            secondary: this.SECONDARY_COLOR,
            success: this.SUCCESS_COLOR,
            error: this.ERROR_COLOR,
            warning: this.WARNING_COLOR,
            info: this.INFO_COLOR
        };
        embed.setColor(colorMap[options.color || 'brand']);
        // Set author if provided
        if (options.author) {
            embed.setAuthor(options.author);
        }
        // Set title with professional formatting
        if (options.title) {
            embed.setTitle(options.title);
        }
        // Set description with professional language
        if (options.description) {
            embed.setDescription(options.description);
        }
        // Set thumbnail for branding
        if (options.thumbnail) {
            embed.setThumbnail(options.thumbnail);
        }
        // Add fields if provided
        if (options.fields && options.fields.length > 0) {
            embed.addFields(options.fields);
        }
        // Set footer with firm branding and legal disclaimer if needed
        const footerText = options.footer || '© Anarchy & Associates | Excellence in Legal Services';
        embed.setFooter({
            text: footerText,
            iconURL: 'https://cdn.discordapp.com/attachments/placeholder/scales-of-justice.png'
        });
        // Set timestamp for audit trail
        if (options.timestamp !== false) {
            embed.setTimestamp();
        }
        return embed;
    }
    static createSuccessEmbed(title, description, fields) {
        return this.createAALegalEmbed({
            title: `${this.ICONS.success} ${title}`,
            description,
            color: 'success',
            fields
        });
    }
    static createErrorEmbed(title, description, fields) {
        return this.createAALegalEmbed({
            title: `${this.ICONS.error} ${title}`,
            description,
            color: 'error',
            fields
        });
    }
    static createWarningEmbed(title, description, fields) {
        return this.createAALegalEmbed({
            title: `${this.ICONS.warning} ${title}`,
            description,
            color: 'warning',
            fields
        });
    }
    static createInfoEmbed(title, description, fields) {
        return this.createAALegalEmbed({
            title: `${this.ICONS.info} ${title}`,
            description,
            color: 'info',
            fields
        });
    }
    // Professional embed for case-related operations
    static createCaseEmbed(options) {
        const statusColors = {
            open: 'accent',
            closed: 'secondary',
            review: 'warning'
        };
        return this.createAALegalEmbed({
            title: `${this.ICONS.case} ${options.title}`,
            description: options.description,
            color: statusColors[options.status || 'open'],
            fields: [
                ...(options.caseNumber ? [{ name: 'Case Reference', value: `\`${options.caseNumber}\``, inline: true }] : []),
                ...(options.fields || [])
            ]
        });
    }
    // Professional embed for staff operations
    static createStaffEmbed(options) {
        const actionColors = {
            hire: 'success',
            promote: 'accent',
            terminate: 'error',
            update: 'info'
        };
        return this.createAALegalEmbed({
            title: `${this.ICONS.staff} ${options.title}`,
            description: options.description,
            color: actionColors[options.action || 'update'],
            fields: [
                ...(options.staffMember ? [{ name: 'Staff Member', value: options.staffMember, inline: true }] : []),
                ...(options.role ? [{ name: 'Position', value: options.role, inline: true }] : []),
                ...(options.fields || [])
            ]
        });
    }
    // Professional embed for legal documents and forms
    static createDocumentEmbed(options) {
        const typeIcons = {
            contract: this.ICONS.legal,
            retainer: this.ICONS.document,
            application: this.ICONS.document,
            feedback: this.ICONS.client,
            report: this.ICONS.info
        };
        return this.createAALegalEmbed({
            title: `${typeIcons[options.documentType]} ${options.title}`,
            description: options.description,
            color: 'secondary',
            fields: options.fields
        });
    }
    static addFieldSafe(embed, name, value, inline = false) {
        // Discord field value limit is 1024 characters
        const truncatedValue = value.length > 1024 ? value.substring(0, 1021) + '...' : value;
        return embed.addFields({ name, value: truncatedValue, inline });
    }
    static setDescriptionSafe(embed, description) {
        // Discord description limit is 4096 characters
        const truncatedDescription = description.length > 4096 ? description.substring(0, 4093) + '...' : description;
        return embed.setDescription(truncatedDescription);
    }
    // Format professional signatures for embeds
    static formatSignature(name, title) {
        return `*${name}*\n${title}\nAnarchy & Associates`;
    }
    // Format legal notice footer
    static getLegalFooter() {
        return 'This communication is confidential and may be legally privileged';
    }
    // Create a professional list format
    static formatList(items, numbered = false) {
        return items.map((item, index) => numbered ? `${index + 1}. ${item}` : `• ${item}`).join('\n');
    }
}
exports.EmbedUtils = EmbedUtils;
// Professional Law Firm Color Palette
EmbedUtils.BRAND_COLOR = 0x000000; // Pure Black - Primary brand color
EmbedUtils.ACCENT_COLOR = 0xD4AF37; // Deep Gold - Prestige and success
EmbedUtils.SECONDARY_COLOR = 0x36393F; // Charcoal - Professional dark theme
EmbedUtils.SUCCESS_COLOR = 0x2D7D46; // Deep Forest Green - Accomplished
EmbedUtils.ERROR_COLOR = 0xA62019; // Deep Crimson - Serious matters
EmbedUtils.WARNING_COLOR = 0xF0B232; // Amber - Attention required
EmbedUtils.INFO_COLOR = 0x1E3A5F; // Navy Blue - Trust and stability
// Professional Icons
EmbedUtils.ICONS = {
    firm: '⚖️',
    success: '✓',
    error: '⚠',
    warning: '⚡',
    info: '📋',
    case: '📑',
    staff: '👔',
    client: '🤝',
    document: '📄',
    legal: '§'
};
//# sourceMappingURL=embed-utils.js.map