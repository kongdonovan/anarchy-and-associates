import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  CommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { RoleLimitValidationResult } from '../../application/services/business-rule-validation-service';
import { logger } from '../logger';

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

export class GuildOwnerUtils {
  /**
   * Create a bypass confirmation modal for role limits
   */
  public static createRoleLimitBypassModal(
    userId: string,
    validationResult: RoleLimitValidationResult
  ): ModalBuilder {
    const customId = `role_limit_bypass_${userId}_${Date.now()}`;
    
    const modal = new ModalBuilder()
      .setCustomId(customId)
      .setTitle('🚨 Role Limit Bypass Required');

    const confirmationInput = new TextInputBuilder()
      .setCustomId('confirmation')
      .setLabel('Type "Confirm" to bypass role limits')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Confirm')
      .setMaxLength(10);

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Reason for bypassing role limits (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setPlaceholder('Explain why this bypass is necessary...')
      .setMaxLength(500);

    const confirmationRow = new ActionRowBuilder<TextInputBuilder>()
      .addComponents(confirmationInput);
    
    const reasonRow = new ActionRowBuilder<TextInputBuilder>()
      .addComponents(reasonInput);

    modal.addComponents(confirmationRow, reasonRow);

    logger.info('Created role limit bypass modal', {
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
  public static createBypassConfirmationEmbed(
    validationResult: RoleLimitValidationResult
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor('#FFA500') // Orange warning color
      .setTitle('⚠️ Guild Owner Role Limit Bypass')
      .setDescription(
        `You are attempting to exceed the normal role limits for **${validationResult.roleName}**.\n\n` +
        `**Current Count:** ${validationResult.currentCount}\n` +
        `**Maximum Limit:** ${validationResult.maxCount}\n` +
        `**New Count (after hiring):** ${validationResult.currentCount + 1}\n\n` +
        `As the guild owner, you can bypass this limit. Please confirm this action in the modal.`
      )
      .addFields(
        {
          name: '📊 Impact',
          value: `This will exceed the recommended organizational structure for **${validationResult.roleName}**.`,
          inline: false
        },
        {
          name: '🔒 Authorization',
          value: 'Only guild owners can perform this bypass action.',
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ 
        text: 'This action will be logged in the audit trail' 
      });
  }

  /**
   * Validate bypass confirmation from modal submission
   */
  public static validateBypassConfirmation(
    interaction: ModalSubmitInteraction
  ): BypassConfirmationResult {
    try {
      const confirmation = interaction.fields.getTextInputValue('confirmation').trim();
      const reason = interaction.fields.getTextInputValue('reason')?.trim() || undefined;

      if (confirmation.toLowerCase() !== 'confirm') {
        return {
          confirmed: false,
          error: 'Confirmation text must be exactly "Confirm" (case-insensitive). Bypass cancelled.'
        };
      }

      logger.info('Guild owner bypass confirmed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        reason: reason || 'No reason provided'
      });

      return {
        confirmed: true,
        reason
      };
    } catch (error) {
      logger.error('Error validating bypass confirmation:', error);
      return {
        confirmed: false,
        error: 'Failed to validate bypass confirmation. Please try again.'
      };
    }
  }

  /**
   * Create success embed for completed bypass
   */
  public static createBypassSuccessEmbed(
    roleName: string,
    newCount: number,
    reason?: string
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor('#00FF00') // Green success color
      .setTitle('✅ Role Limit Bypass Completed')
      .setDescription(
        `Role limit bypass has been successfully applied for **${roleName}**.\n\n` +
        `**New Count:** ${newCount}\n` +
        `**Bypass Reason:** ${reason || 'No reason provided'}`
      )
      .addFields(
        {
          name: '📝 Audit Trail',
          value: 'This bypass has been logged in the audit system with special designation.',
          inline: false
        }
      )
      .setTimestamp();

    return embed;
  }

  /**
   * Create error embed for failed bypass
   */
  public static createBypassErrorEmbed(error: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor('#FF0000') // Red error color
      .setTitle('❌ Bypass Failed')
      .setDescription(error)
      .setTimestamp();
  }

  /**
   * Check if user is eligible for bypass (guild owner check)
   */
  public static isEligibleForBypass(
    interaction: CommandInteraction | ModalSubmitInteraction
  ): boolean {
    return interaction.guild?.ownerId === interaction.user.id;
  }

  /**
   * Generate bypass custom ID for modal tracking
   */
  public static generateBypassId(
    userId: string,
    bypassType: string,
    additionalData?: string
  ): string {
    const timestamp = Date.now();
    const suffix = additionalData ? `_${additionalData}` : '';
    return `${bypassType}_bypass_${userId}_${timestamp}${suffix}`;
  }

  /**
   * Parse bypass custom ID to extract information
   */
  public static parseBypassId(customId: string): {
    bypassType: string;
    userId: string;
    timestamp: number;
    additionalData?: string;
  } | null {
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
    } catch (error) {
      logger.error('Error parsing bypass ID:', error);
      return null;
    }
  }

  /**
   * Check if bypass modal is expired (30 seconds timeout)
   */
  public static isBypassExpired(customId: string): boolean {
    const parsed = this.parseBypassId(customId);
    if (!parsed) return true;

    const now = Date.now();
    const expiry = parsed.timestamp + (30 * 1000); // 30 seconds
    return now > expiry;
  }
}