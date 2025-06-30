"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderService = void 0;
const logger_1 = require("../../infrastructure/logger");
const validation_1 = require("../../validation");
class ReminderService {
    constructor(reminderRepository, caseRepository, staffRepository) {
        this.reminderRepository = reminderRepository;
        this.caseRepository = caseRepository;
        this.staffRepository = staffRepository;
        this.reminderTimeouts = new Map();
        this.discordClient = null;
    }
    setDiscordClient(client) {
        this.discordClient = client;
        // Start monitoring existing reminders when service is initialized
        this.initializeActiveReminders();
    }
    async createReminder(request) {
        // Validate input using Zod schema
        const validatedRequest = validation_1.ValidationHelpers.validateOrThrow(validation_1.ReminderCreationRequestSchema, request, 'Reminder creation request');
        logger_1.logger.info('Creating reminder', {
            userId: validatedRequest.userId,
            scheduledFor: validatedRequest.scheduledFor,
            message: validatedRequest.message
        });
        // Verify user is staff
        const staff = await this.staffRepository.findByUserId(validatedRequest.guildId, validatedRequest.userId);
        if (!staff || staff.status !== 'active') {
            throw new Error('Only staff members can set reminders');
        }
        // Use provided scheduled time
        const scheduledFor = validatedRequest.scheduledFor;
        if (!scheduledFor) {
            throw new Error('Invalid time format');
        }
        // If channelId is provided, validate it exists and optionally check for case
        let caseId = validatedRequest.caseId;
        if (validatedRequest.channelId && !caseId) {
            // Try to find a case associated with this channel
            const cases = await this.caseRepository.searchCases({
                guildId: validatedRequest.guildId,
                channelId: validatedRequest.channelId
            });
            if (cases.length > 0 && cases[0]?._id) {
                caseId = cases[0]._id.toString();
            }
        }
        // Create reminder data
        const reminderData = {
            guildId: validatedRequest.guildId,
            userId: validatedRequest.userId,
            username: validatedRequest.username,
            message: validatedRequest.message,
            scheduledFor,
            channelId: validatedRequest.channelId,
            type: validatedRequest.type || 'custom',
            caseId: caseId ? String(caseId) : undefined,
            isActive: true
        };
        const createdReminder = await this.reminderRepository.add(reminderData);
        // Schedule the reminder
        this.scheduleReminder(createdReminder);
        logger_1.logger.info('Reminder created successfully', {
            reminderId: createdReminder._id,
            userId: validatedRequest.userId,
            scheduledFor
        });
        return createdReminder;
    }
    async getUserReminders(userId, guildId, activeOnly = true) {
        return this.reminderRepository.getUserReminders(userId, guildId, activeOnly);
    }
    async cancelReminder(reminderId, userId) {
        logger_1.logger.info('Cancelling reminder', { reminderId, userId });
        // Get the reminder to verify ownership
        const reminder = await this.reminderRepository.findById(reminderId);
        if (!reminder) {
            throw new Error('Reminder not found');
        }
        if (reminder.userId !== userId) {
            throw new Error('You can only cancel your own reminders');
        }
        if (!reminder.isActive) {
            throw new Error('Reminder is already inactive');
        }
        // Cancel the timeout
        this.cancelReminderTimeout(reminderId);
        // Update in database
        const updatedReminder = await this.reminderRepository.cancelReminder(reminderId);
        logger_1.logger.info('Reminder cancelled successfully', { reminderId, userId });
        return updatedReminder;
    }
    async getCaseReminders(caseId) {
        return this.reminderRepository.getCaseReminders(caseId);
    }
    async getChannelReminders(channelId) {
        return this.reminderRepository.getChannelReminders(channelId);
    }
    async searchReminders(filters) {
        return this.reminderRepository.searchReminders(filters);
    }
    async initializeActiveReminders() {
        try {
            logger_1.logger.info('Initializing active reminders');
            const activeReminders = await this.reminderRepository.getDueReminders();
            const futureReminders = await this.reminderRepository.getActiveReminders('');
            // Process any overdue reminders immediately
            for (const reminder of activeReminders) {
                await this.deliverReminder(reminder);
            }
            // Schedule future reminders
            for (const reminder of futureReminders) {
                if (reminder.scheduledFor > new Date()) {
                    this.scheduleReminder(reminder);
                }
            }
            logger_1.logger.info(`Initialized ${futureReminders.length} active reminders`);
        }
        catch (error) {
            logger_1.logger.error('Error initializing active reminders', { error });
        }
    }
    scheduleReminder(reminder) {
        const now = new Date();
        const timeUntilReminder = reminder.scheduledFor.getTime() - now.getTime();
        if (timeUntilReminder <= 0) {
            // Reminder is due now or overdue
            this.deliverReminder(reminder);
            return;
        }
        const reminderId = reminder._id.toString();
        // Clear any existing timeout for this reminder
        this.cancelReminderTimeout(reminderId);
        // Schedule the reminder
        const timeout = setTimeout(() => {
            this.deliverReminder(reminder);
        }, timeUntilReminder);
        this.reminderTimeouts.set(reminderId, timeout);
        logger_1.logger.debug('Reminder scheduled', {
            reminderId,
            scheduledFor: reminder.scheduledFor,
            timeUntilReminder
        });
    }
    cancelReminderTimeout(reminderId) {
        const timeout = this.reminderTimeouts.get(reminderId);
        if (timeout) {
            clearTimeout(timeout);
            this.reminderTimeouts.delete(reminderId);
            logger_1.logger.debug('Reminder timeout cancelled', { reminderId });
        }
    }
    async deliverReminder(reminder) {
        try {
            logger_1.logger.info('Delivering reminder', {
                reminderId: reminder._id,
                userId: reminder.userId,
                message: reminder.message
            });
            if (!this.discordClient) {
                logger_1.logger.error('Discord client not available for reminder delivery');
                return;
            }
            const user = await this.discordClient.users.fetch(reminder.userId);
            if (!user) {
                logger_1.logger.error('User not found for reminder delivery', { userId: reminder.userId });
                await this.reminderRepository.markAsDelivered(reminder._id.toString());
                return;
            }
            // Determine where to send the reminder
            let channel = null;
            if (reminder.channelId) {
                try {
                    const fetchedChannel = await this.discordClient.channels.fetch(reminder.channelId);
                    if (fetchedChannel?.isTextBased() && 'guild' in fetchedChannel) {
                        channel = fetchedChannel;
                    }
                }
                catch (error) {
                    logger_1.logger.warn('Could not fetch reminder channel, falling back to DM', {
                        channelId: reminder.channelId,
                        error
                    });
                }
            }
            const reminderEmbed = {
                title: '⏰ Reminder',
                description: reminder.message,
                color: 0x3498db,
                footer: {
                    text: `Set by ${reminder.username}`,
                    icon_url: user.displayAvatarURL()
                },
                timestamp: new Date().toISOString()
            };
            if (channel) {
                // Send to channel with mention
                await channel.send({
                    content: `<@${reminder.userId}>`,
                    embeds: [reminderEmbed]
                });
                logger_1.logger.info('Reminder delivered to channel', {
                    reminderId: reminder._id,
                    channelId: reminder.channelId
                });
            }
            else {
                // Send as DM
                await user.send({
                    embeds: [reminderEmbed]
                });
                logger_1.logger.info('Reminder delivered via DM', {
                    reminderId: reminder._id,
                    userId: reminder.userId
                });
            }
            // Mark as delivered
            await this.reminderRepository.markAsDelivered(reminder._id.toString());
            // Remove from active timeouts
            this.cancelReminderTimeout(reminder._id.toString());
        }
        catch (error) {
            logger_1.logger.error('Error delivering reminder', {
                error,
                reminderId: reminder._id,
                userId: reminder.userId
            });
            // Still mark as delivered to prevent retry loops
            await this.reminderRepository.markAsDelivered(reminder._id.toString());
        }
    }
    async cleanupOldReminders(olderThanDays = 30) {
        logger_1.logger.info('Cleaning up old reminders', { olderThanDays });
        const deletedCount = await this.reminderRepository.cleanupDeliveredReminders(olderThanDays);
        logger_1.logger.info('Old reminders cleaned up', { deletedCount });
        return deletedCount;
    }
    getReminderStats() {
        return {
            activeTimeouts: this.reminderTimeouts.size,
            scheduledReminders: Array.from(this.reminderTimeouts.keys())
        };
    }
}
exports.ReminderService = ReminderService;
//# sourceMappingURL=reminder-service.js.map