"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuildOwnerUtils = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../logger");
class GuildOwnerUtils {
    /**
     * Create a bypass confirmation modal for role limits
     */
    static createRoleLimitBypassModal(userId, validationResult) {
        const customId = `role_limit_bypass_${userId}_${Date.now()}`;
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(customId)
            .setTitle('🚨 Role Limit Bypass Required');
        const confirmationInput = new discord_js_1.TextInputBuilder()
            .setCustomId('confirmation')
            .setLabel('Type "Confirm" to bypass role limits')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Confirm')
            .setMaxLength(10);
        const reasonInput = new discord_js_1.TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for bypassing role limits (optional)')
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('Explain why this bypass is necessary...')
            .setMaxLength(500);
        const confirmationRow = new discord_js_1.ActionRowBuilder()
            .addComponents(confirmationInput);
        const reasonRow = new discord_js_1.ActionRowBuilder()
            .addComponents(reasonInput);
        modal.addComponents(confirmationRow, reasonRow);
        logger_1.logger.info('Created role limit bypass modal', {
            customId,
            userId,
            roleName: validationResult.roleName,
            currentCount: validationResult.currentCount,
            maxCount: validationResult.maxCount
        });
        return modal;
    }
    /**
     * Create an informational embed for bypass confirmation
     */
    static createBypassConfirmationEmbed(validationResult) {
        return new discord_js_1.EmbedBuilder()
            .setColor('#FFA500') // Orange warning color
            .setTitle('⚠️ Guild Owner Role Limit Bypass')
            .setDescription(`You are attempting to exceed the normal role limits for **${validationResult.roleName}**.\n\n` +
            `**Current Count:** ${validationResult.currentCount}\n` +
            `**Maximum Limit:** ${validationResult.maxCount}\n` +
            `**New Count (after hiring):** ${validationResult.currentCount + 1}\n\n` +
            `As the guild owner, you can bypass this limit. Please confirm this action in the modal.`)
            .addFields({
            name: '📊 Impact',
            value: `This will exceed the recommended organizational structure for **${validationResult.roleName}**.`,
            inline: false
        }, {
            name: '🔒 Authorization',
            value: 'Only guild owners can perform this bypass action.',
            inline: false
        })
            .setTimestamp()
            .setFooter({
            text: 'This action will be logged in the audit trail'
        });
    }
    /**
     * Validate bypass confirmation from modal submission
     */
    static validateBypassConfirmation(interaction) {
        try {
            const confirmation = interaction.fields.getTextInputValue('confirmation').trim();
            const reason = interaction.fields.getTextInputValue('reason')?.trim() || undefined;
            if (confirmation.toLowerCase() !== 'confirm') {
                return {
                    confirmed: false,
                    error: 'Confirmation text must be exactly "Confirm" (case-insensitive). Bypass cancelled.'
                };
            }
            logger_1.logger.info('Guild owner bypass confirmed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                reason: reason || 'No reason provided'
            });
            return {
                confirmed: true,
                reason
            };
        }
        catch (error) {
            logger_1.logger.error('Error validating bypass confirmation:', error);
            return {
                confirmed: false,
                error: 'Failed to validate bypass confirmation. Please try again.'
            };
        }
    }
    /**
     * Create success embed for completed bypass
     */
    static createBypassSuccessEmbed(roleName, newCount, reason) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#00FF00') // Green success color
            .setTitle('✅ Role Limit Bypass Completed')
            .setDescription(`Role limit bypass has been successfully applied for **${roleName}**.\n\n` +
            `**New Count:** ${newCount}\n` +
            `**Bypass Reason:** ${reason || 'No reason provided'}`)
            .addFields({
            name: '📝 Audit Trail',
            value: 'This bypass has been logged in the audit system with special designation.',
            inline: false
        })
            .setTimestamp();
        return embed;
    }
    /**
     * Create error embed for failed bypass
     */
    static createBypassErrorEmbed(error) {
        return new discord_js_1.EmbedBuilder()
            .setColor('#FF0000') // Red error color
            .setTitle('❌ Bypass Failed')
            .setDescription(error)
            .setTimestamp();
    }
    /**
     * Check if user is eligible for bypass (guild owner check)
     */
    static isEligibleForBypass(interaction) {
        return interaction.guild?.ownerId === interaction.user.id;
    }
    /**
     * Generate bypass custom ID for modal tracking
     */
    static generateBypassId(userId, bypassType, additionalData) {
        const timestamp = Date.now();
        const suffix = additionalData ? `_${additionalData}` : '';
        return `${bypassType}_bypass_${userId}_${timestamp}${suffix}`;
    }
    /**
     * Parse bypass custom ID to extract information
     */
    static parseBypassId(customId) {
        try {
            const parts = customId.split('_');
            if (parts.length < 4 || parts[1] !== 'bypass') {
                return null;
            }
            return {
                bypassType: parts[0] || '',
                userId: parts[2] || '',
                timestamp: parseInt(parts[3] || '0'),
                additionalData: parts.length > 4 ? parts.slice(4).join('_') : undefined
            };
        }
        catch (error) {
            logger_1.logger.error('Error parsing bypass ID:', error);
            return null;
        }
    }
    /**
     * Check if bypass modal is expired (30 seconds timeout)
     */
    static isBypassExpired(customId) {
        const parsed = this.parseBypassId(customId);
        if (!parsed)
            return true;
        const now = Date.now();
        const expiry = parsed.timestamp + (30 * 1000); // 30 seconds
        return now > expiry;
    }
}
exports.GuildOwnerUtils = GuildOwnerUtils;
//# sourceMappingURL=guild-owner-utils.js.map