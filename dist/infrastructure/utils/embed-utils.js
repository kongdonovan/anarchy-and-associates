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
            success: this.SUCCESS_COLOR,
            error: this.ERROR_COLOR,
            warning: this.WARNING_COLOR,
            info: this.INFO_COLOR
        };
        embed.setColor(colorMap[options.color || 'brand']);
        // Set title with firm branding
        if (options.title) {
            embed.setTitle(options.title);
        }
        // Set description
        if (options.description) {
            embed.setDescription(options.description);
        }
        // Set footer with firm branding
        const footerText = options.footer || 'Anarchy & Associates Legal Services';
        embed.setFooter({
            text: footerText,
            iconURL: 'https://cdn.discordapp.com/attachments/placeholder/logo.png' // Placeholder for firm logo
        });
        // Set timestamp if requested
        if (options.timestamp !== false) {
            embed.setTimestamp();
        }
        return embed;
    }
    static createSuccessEmbed(title, description) {
        return this.createAALegalEmbed({
            title: `✅ ${title}`,
            description,
            color: 'success'
        });
    }
    static createErrorEmbed(title, description) {
        return this.createAALegalEmbed({
            title: `❌ ${title}`,
            description,
            color: 'error'
        });
    }
    static createWarningEmbed(title, description) {
        return this.createAALegalEmbed({
            title: `⚠️ ${title}`,
            description,
            color: 'warning'
        });
    }
    static createInfoEmbed(title, description) {
        return this.createAALegalEmbed({
            title: `ℹ️ ${title}`,
            description,
            color: 'info'
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
}
exports.EmbedUtils = EmbedUtils;
EmbedUtils.BRAND_COLOR = 0x2B2D31; // Professional dark gray
EmbedUtils.SUCCESS_COLOR = 0x00FF41; // Bright green
EmbedUtils.ERROR_COLOR = 0xFF4136; // Red
EmbedUtils.WARNING_COLOR = 0xFF851B; // Orange
EmbedUtils.INFO_COLOR = 0x0074D9; // Blue
//# sourceMappingURL=embed-utils.js.map