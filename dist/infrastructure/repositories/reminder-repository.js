"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const logger_1 = require("../logger");
const validation_1 = require("../../validation");
class ReminderRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('reminders');
    }
    async getActiveReminders(guildId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            return this.findWithComplexFilter({
                guildId: validatedGuildId,
                isActive: true,
                deliveredAt: { $exists: false }
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting active reminders', { error, guildId: String(guildId) });
            throw error;
        }
    }
    async getUserReminders(userId, guildId, activeOnly = true) {
        try {
            const validatedUserId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, userId, 'User ID');
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedActiveOnly = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.boolean(), activeOnly, 'Active only flag');
            const query = {
                guildId: validatedGuildId,
                userId: validatedUserId
            };
            if (validatedActiveOnly) {
                query.isActive = true;
                query.deliveredAt = { $exists: false };
            }
            return this.findWithComplexFilter(query, { scheduledFor: 1 }); // Sort by scheduled time
        }
        catch (error) {
            logger_1.logger.error('Error getting user reminders', { error, userId: String(userId), guildId: String(guildId) });
            throw error;
        }
    }
    async getDueReminders() {
        try {
            const now = new Date();
            return this.findWithComplexFilter({
                isActive: true,
                scheduledFor: { $lte: now },
                deliveredAt: { $exists: false }
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting due reminders', { error });
            throw error;
        }
    }
    async markAsDelivered(reminderId) {
        try {
            const validatedReminderId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), reminderId, 'Reminder ID');
            const updated = await this.update(validatedReminderId, {
                deliveredAt: new Date(),
                isActive: false
            });
            if (updated) {
                logger_1.logger.info('Reminder marked as delivered', { reminderId: validatedReminderId });
            }
            return updated;
        }
        catch (error) {
            logger_1.logger.error('Error marking reminder as delivered', { error, reminderId: String(reminderId) });
            throw error;
        }
    }
    async cancelReminder(reminderId) {
        try {
            const validatedReminderId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), reminderId, 'Reminder ID');
            const updated = await this.update(validatedReminderId, {
                isActive: false
            });
            if (updated) {
                logger_1.logger.info('Reminder cancelled', { reminderId: validatedReminderId });
            }
            return updated;
        }
        catch (error) {
            logger_1.logger.error('Error cancelling reminder', { error, reminderId: String(reminderId) });
            throw error;
        }
    }
    async searchReminders(filters) {
        try {
            // Create a schema for ReminderSearchFilters
            const ReminderSearchFiltersSchema = validation_1.z.object({
                guildId: validation_1.DiscordSnowflakeSchema.optional(),
                userId: validation_1.DiscordSnowflakeSchema.optional(),
                isActive: validation_1.z.boolean().optional(),
                deliveredAt: validation_1.z.date().optional(),
                scheduledBefore: validation_1.z.date().optional(),
                scheduledAfter: validation_1.z.date().optional(),
                caseId: validation_1.z.string().optional(),
            }).passthrough();
            const validatedFilters = validation_1.ValidationHelpers.validateOrThrow(ReminderSearchFiltersSchema, filters, 'Reminder search filters');
            const query = this.buildSearchQuery(validatedFilters);
            return this.findWithComplexFilter(query, { scheduledFor: 1 });
        }
        catch (error) {
            logger_1.logger.error('Error searching reminders', { error, filters });
            throw error;
        }
    }
    async getCaseReminders(caseId) {
        try {
            return this.findWithComplexFilter({
                caseId,
                isActive: true
            }, { scheduledFor: 1 });
        }
        catch (error) {
            logger_1.logger.error('Error getting case reminders', { error, caseId });
            throw error;
        }
    }
    async getChannelReminders(channelId) {
        try {
            return this.findWithComplexFilter({
                channelId,
                isActive: true
            }, { scheduledFor: 1 });
        }
        catch (error) {
            logger_1.logger.error('Error getting channel reminders', { error, channelId });
            throw error;
        }
    }
    async cleanupDeliveredReminders(olderThanDays = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
            const deletedCount = await this.deleteMany({
                isActive: false,
                deliveredAt: { $lt: cutoffDate }
            });
            logger_1.logger.info('Cleaned up delivered reminders', { deletedCount, olderThanDays });
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up delivered reminders', { error });
            throw error;
        }
    }
    buildSearchQuery(filters) {
        const query = {
            guildId: filters.guildId
        };
        if (filters.userId !== undefined) {
            query.userId = filters.userId;
        }
        if (filters.isActive !== undefined) {
            query.isActive = filters.isActive;
        }
        if (filters.channelId !== undefined) {
            query.channelId = filters.channelId;
        }
        if (filters.caseId !== undefined) {
            query.caseId = filters.caseId;
        }
        if (filters.startDate !== undefined || filters.endDate !== undefined) {
            query.scheduledFor = {};
            if (filters.startDate !== undefined) {
                query.scheduledFor.$gte = filters.startDate;
            }
            if (filters.endDate !== undefined) {
                query.scheduledFor.$lte = filters.endDate;
            }
        }
        return query;
    }
}
exports.ReminderRepository = ReminderRepository;
//# sourceMappingURL=reminder-repository.js.map