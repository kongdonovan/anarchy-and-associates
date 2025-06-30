import {
  CommandInteraction,
  ApplicationCommandOptionType
} from 'discord.js';
import { Discord, Slash, SlashOption, SlashGroup } from 'discordx';
import { ReminderService } from '../../application/services/reminder-service';
import { ReminderRepository } from '../../infrastructure/repositories/reminder-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { 
  validateReminderTime,
  formatReminderTime,
  formatTimeUntilReminder
} from '../../domain/entities/reminder'; // Keep utility functions
import { logger } from '../../infrastructure/logger';
import { AuditDecorators } from '../decorators/audit-decorators';
import { ValidationHelpers, DiscordSnowflakeSchema, z } from '../../validation';
import { AuditAction } from '../../domain/entities/audit-log';

@Discord()
@SlashGroup({ description: 'Reminder management commands', name: 'remind' })
@SlashGroup('remind')
export class ReminderCommands {
  private reminderService: ReminderService;

  constructor() {
    const reminderRepository = new ReminderRepository();
    const caseRepository = new CaseRepository();
    const staffRepository = new StaffRepository();

    this.reminderService = new ReminderService(
      reminderRepository,
      caseRepository,
      staffRepository
    );
  }

  @Slash({
    description: 'Set a reminder',
    name: 'set'
  })
  @AuditDecorators.AdminAction(AuditAction.JOB_CREATED, 'medium')
  async setReminder(
    @SlashOption({
      description: 'Time until reminder (e.g., 30m, 2h, 1d - max 7 days)',
      name: 'time',
      type: ApplicationCommandOptionType.String,
      required: true
    })
    timeString: string,
    @SlashOption({
      description: 'Reminder message',
      name: 'message',
      type: ApplicationCommandOptionType.String,
      required: true
    })
    message: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guildId) {
        const embed = EmbedUtils.createErrorEmbed(
          'Server Required',
          'This command can only be used in a server.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Validate inputs
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        interaction.guildId,
        'Guild ID'
      );
      const validatedTimeString = ValidationHelpers.validateOrThrow(
        z.string().regex(/^\d+[mhd]$/),
        timeString,
        'Time string'
      );
      const validatedMessage = ValidationHelpers.validateOrThrow(
        z.string().min(1).max(500),
        message,
        'Reminder message'
      );

      const guildId = validatedGuildId;
      const userId = interaction.user.id;
      const username = interaction.user.username;
      const channelId = interaction.channelId;

      // Validate time format
      const timeValidation = validateReminderTime(validatedTimeString);
      if (!timeValidation.isValid) {
        const embed = EmbedUtils.createErrorEmbed(
          'Invalid Time Format',
          timeValidation.error!
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }


      // Create the reminder
      const reminder = await this.reminderService.createReminder({
        guildId,
        userId,
        username,
        message: validatedMessage,
        timeString: validatedTimeString,
        channelId: channelId || undefined
      });

      const formattedTime = formatReminderTime(timeValidation.parsedTime!);
      const deliveryLocation = channelId ? 'this channel' : 'your DMs';

      const embed = EmbedUtils.createSuccessEmbed(
        'Reminder Set',
        `⏰ I'll remind you in **${formattedTime}** via ${deliveryLocation}.\n\n**Message:** ${message}`
      );
      
      embed.setFooter({
        text: `Reminder ID: ${reminder._id}`,
        iconURL: interaction.user.displayAvatarURL()
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      logger.error('Error setting reminder', { error });
      
      const embed = EmbedUtils.createErrorEmbed(
        'Reminder Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred while setting the reminder.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @Slash({
    description: 'List your active reminders',
    name: 'list'
  })
  @AuditDecorators.AdminAction(AuditAction.JOB_LIST_VIEWED, 'low')
  async listReminders(
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      const reminders = await this.reminderService.getUserReminders(userId, guildId, true);

      if (reminders.length === 0) {
        const embed = EmbedUtils.createInfoEmbed(
          'No Reminders',
          'You don\'t have any active reminders.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const embed = EmbedUtils.createAALegalEmbed({
        title: '§ Scheduled Notifications',
        description: 'Your personal reminder schedule is displayed below.',
        color: 'info',
        footer: `${reminders.length} Active Notification${reminders.length !== 1 ? 's' : ''} | Anarchy & Associates Case Management System`
      }).setThumbnail(interaction.user.displayAvatarURL());

      // Sort by scheduled time
      const sortedReminders = reminders
        .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
        .slice(0, 10); // Limit to 10 reminders

      for (const reminder of sortedReminders) {
        const timeUntil = formatTimeUntilReminder(reminder.scheduledFor);
        const location = reminder.channelId ? `<#${reminder.channelId}>` : 'DM';
        
        embed.addFields([{
          name: `⏰ Due in ${timeUntil}`,
          value: `**Message:** ${reminder.message.length > 100 ? reminder.message.substring(0, 100) + '...' : reminder.message}\n**Location:** ${location}\n**ID:** \`${reminder._id}\``,
          inline: false
        }]);
      }

      if (reminders.length > 10) {
        embed.setDescription(`Showing 10 of ${reminders.length} reminders. Use \`/remind cancel\` to remove specific reminders.`);
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      logger.error('Error listing reminders', { error });
      
      const embed = EmbedUtils.createErrorEmbed(
        'List Failed',
        'An unexpected error occurred while retrieving your reminders.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @Slash({
    description: 'Cancel a reminder',
    name: 'cancel'
  })
  @AuditDecorators.AdminAction(AuditAction.JOB_UPDATED, 'medium')
  async cancelReminder(
    @SlashOption({
      description: 'Reminder ID to cancel',
      name: 'id',
      type: ApplicationCommandOptionType.String,
      required: true
    })
    reminderId: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const userId = interaction.user.id;

      const cancelledReminder = await this.reminderService.cancelReminder(reminderId, userId);

      if (!cancelledReminder) {
        const embed = EmbedUtils.createErrorEmbed(
          'Cancellation Failed',
          'Reminder not found or already cancelled.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const embed = EmbedUtils.createSuccessEmbed(
        'Reminder Cancelled',
        `✅ Reminder cancelled successfully.\n\n**Message:** ${cancelledReminder.message}`
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      logger.error('Error cancelling reminder', { error });
      
      const embed = EmbedUtils.createErrorEmbed(
        'Cancellation Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred while cancelling the reminder.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @Slash({
    description: 'View reminders for current case channel',
    name: 'case'
  })
  @AuditDecorators.AdminAction(AuditAction.JOB_LIST_VIEWED, 'low')
  async viewCaseReminders(
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const channelId = interaction.channelId;
      
      if (!channelId) {
        const embed = EmbedUtils.createErrorEmbed(
          'Invalid Channel',
          'This command can only be used in a channel.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const reminders = await this.reminderService.getChannelReminders(channelId);

      if (reminders.length === 0) {
        const embed = EmbedUtils.createInfoEmbed(
          'No Case Reminders',
          'There are no active reminders for this case.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const embed = EmbedUtils.createCaseEmbed({
        title: 'Case Notification Schedule',
        description: 'Active notifications and reminders for this matter are listed below.',
        status: 'open'
      }).setFooter({
        text: `${reminders.length} Active Notification${reminders.length !== 1 ? 's' : ''} | Case Management System`
      });

      // Sort by scheduled time
      const sortedReminders = reminders
        .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
        .slice(0, 10); // Limit to 10 reminders

      for (const reminder of sortedReminders) {
        const timeUntil = formatTimeUntilReminder(reminder.scheduledFor);
        
        embed.addFields([{
          name: `⏰ Due in ${timeUntil}`,
          value: `**Message:** ${reminder.message}\n**Set by:** ${reminder.username}\n**ID:** \`${reminder._id}\``,
          inline: false
        }]);
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error viewing case reminders', { error });
      
      const embed = EmbedUtils.createErrorEmbed(
        'View Failed',
        'An unexpected error occurred while retrieving case reminders.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}