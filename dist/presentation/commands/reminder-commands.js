"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderCommands = void 0;
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const reminder_service_1 = require("../../application/services/reminder-service");
const reminder_repository_1 = require("../../infrastructure/repositories/reminder-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const reminder_1 = require("../../domain/entities/reminder"); // Keep utility functions
const logger_1 = require("../../infrastructure/logger");
const audit_decorators_1 = require("../decorators/audit-decorators");
const validation_1 = require("../../validation");
const audit_log_1 = require("../../domain/entities/audit-log");
let ReminderCommands = class ReminderCommands {
    constructor() {
        const reminderRepository = new reminder_repository_1.ReminderRepository();
        const caseRepository = new case_repository_1.CaseRepository();
        const staffRepository = new staff_repository_1.StaffRepository();
        this.reminderService = new reminder_service_1.ReminderService(reminderRepository, caseRepository, staffRepository);
    }
    async setReminder(timeString, message, interaction) {
        try {
            if (!interaction.guildId) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Server Required', 'This command can only be used in a server.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Validate inputs
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, interaction.guildId, 'Guild ID');
            const validatedTimeString = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string().regex(/^\d+[mhd]$/), timeString, 'Time string');
            const validatedMessage = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string().min(1).max(500), message, 'Reminder message');
            const guildId = validatedGuildId;
            const userId = interaction.user.id;
            const username = interaction.user.username;
            const channelId = interaction.channelId;
            // Validate time format
            const timeValidation = (0, reminder_1.validateReminderTime)(validatedTimeString);
            if (!timeValidation.isValid) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Invalid Time Format', timeValidation.error);
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
            const formattedTime = (0, reminder_1.formatReminderTime)(timeValidation.parsedTime);
            const deliveryLocation = channelId ? 'this channel' : 'your DMs';
            const embed = embed_utils_1.EmbedUtils.createSuccessEmbed('Reminder Set', `⏰ I'll remind you in **${formattedTime}** via ${deliveryLocation}.\n\n**Message:** ${message}`);
            embed.setFooter({
                text: `Reminder ID: ${reminder._id}`,
                iconURL: interaction.user.displayAvatarURL()
            });
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        catch (error) {
            logger_1.logger.error('Error setting reminder', { error });
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Reminder Failed', error instanceof Error ? error.message : 'An unexpected error occurred while setting the reminder.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async listReminders(interaction) {
        try {
            const guildId = interaction.guildId;
            const userId = interaction.user.id;
            const reminders = await this.reminderService.getUserReminders(userId, guildId, true);
            if (reminders.length === 0) {
                const embed = embed_utils_1.EmbedUtils.createInfoEmbed('No Reminders', 'You don\'t have any active reminders.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
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
                const timeUntil = (0, reminder_1.formatTimeUntilReminder)(reminder.scheduledFor);
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
        }
        catch (error) {
            logger_1.logger.error('Error listing reminders', { error });
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('List Failed', 'An unexpected error occurred while retrieving your reminders.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async cancelReminder(reminderId, interaction) {
        try {
            const userId = interaction.user.id;
            const cancelledReminder = await this.reminderService.cancelReminder(reminderId, userId);
            if (!cancelledReminder) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Cancellation Failed', 'Reminder not found or already cancelled.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const embed = embed_utils_1.EmbedUtils.createSuccessEmbed('Reminder Cancelled', `✅ Reminder cancelled successfully.\n\n**Message:** ${cancelledReminder.message}`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        catch (error) {
            logger_1.logger.error('Error cancelling reminder', { error });
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Cancellation Failed', error instanceof Error ? error.message : 'An unexpected error occurred while cancelling the reminder.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async viewCaseReminders(interaction) {
        try {
            const channelId = interaction.channelId;
            if (!channelId) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Invalid Channel', 'This command can only be used in a channel.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const reminders = await this.reminderService.getChannelReminders(channelId);
            if (reminders.length === 0) {
                const embed = embed_utils_1.EmbedUtils.createInfoEmbed('No Case Reminders', 'There are no active reminders for this case.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const embed = embed_utils_1.EmbedUtils.createCaseEmbed({
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
                const timeUntil = (0, reminder_1.formatTimeUntilReminder)(reminder.scheduledFor);
                embed.addFields([{
                        name: `⏰ Due in ${timeUntil}`,
                        value: `**Message:** ${reminder.message}\n**Set by:** ${reminder.username}\n**ID:** \`${reminder._id}\``,
                        inline: false
                    }]);
            }
            await interaction.reply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error viewing case reminders', { error });
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('View Failed', 'An unexpected error occurred while retrieving case reminders.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
exports.ReminderCommands = ReminderCommands;
__decorate([
    (0, discordx_1.Slash)({
        description: 'Set a reminder',
        name: 'set'
    }),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.JOB_CREATED, 'medium'),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Time until reminder (e.g., 30m, 2h, 1d - max 7 days)',
        name: 'time',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __param(1, (0, discordx_1.SlashOption)({
        description: 'Reminder message',
        name: 'message',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], ReminderCommands.prototype, "setReminder", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'List your active reminders',
        name: 'list'
    }),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.JOB_LIST_VIEWED, 'low'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], ReminderCommands.prototype, "listReminders", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'Cancel a reminder',
        name: 'cancel'
    }),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.JOB_UPDATED, 'medium'),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Reminder ID to cancel',
        name: 'id',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], ReminderCommands.prototype, "cancelReminder", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'View reminders for current case channel',
        name: 'case'
    }),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.JOB_LIST_VIEWED, 'low'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], ReminderCommands.prototype, "viewCaseReminders", null);
exports.ReminderCommands = ReminderCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ description: 'Reminder management commands', name: 'remind' }),
    (0, discordx_1.SlashGroup)('remind'),
    __metadata("design:paramtypes", [])
], ReminderCommands);
//# sourceMappingURL=reminder-commands.js.map