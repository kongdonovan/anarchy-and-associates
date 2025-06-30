import { BaseMongoRepository } from './base-mongo-repository';
import { Filter } from 'mongodb';
import { logger } from '../logger';
import {
  Reminder,
  ReminderSearchFilters,
  ValidationHelpers,
  DiscordSnowflakeSchema,
  z
} from '../../validation';

export class ReminderRepository extends BaseMongoRepository<Reminder> {
  constructor() {
    super('reminders');
  }

  public async getActiveReminders(guildId: unknown): Promise<Reminder[]> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      return this.findWithComplexFilter({
        guildId: validatedGuildId,
        isActive: true,
        deliveredAt: { $exists: false }
      } as Filter<Reminder>);
    } catch (error) {
      logger.error('Error getting active reminders', { error, guildId: String(guildId) });
      throw error;
    }
  }

  public async getUserReminders(userId: unknown, guildId: unknown, activeOnly: unknown = true): Promise<Reminder[]> {
    try {
      const validatedUserId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        userId,
        'User ID'
      );
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedActiveOnly = ValidationHelpers.validateOrThrow(
        z.boolean(),
        activeOnly,
        'Active only flag'
      );

      const query: Filter<Reminder> = {
        guildId: validatedGuildId,
        userId: validatedUserId
      };

      if (validatedActiveOnly) {
        query.isActive = true;
        query.deliveredAt = { $exists: false } as any;
      }

      return this.findWithComplexFilter(query, { scheduledFor: 1 }); // Sort by scheduled time
    } catch (error) {
      logger.error('Error getting user reminders', { error, userId: String(userId), guildId: String(guildId) });
      throw error;
    }
  }

  public async getDueReminders(): Promise<Reminder[]> {
    try {
      const now = new Date();
      return this.findWithComplexFilter({
        isActive: true,
        scheduledFor: { $lte: now },
        deliveredAt: { $exists: false }
      } as Filter<Reminder>);
    } catch (error) {
      logger.error('Error getting due reminders', { error });
      throw error;
    }
  }

  public async markAsDelivered(reminderId: unknown): Promise<Reminder | null> {
    try {
      const validatedReminderId = ValidationHelpers.validateOrThrow(
        z.string(),
        reminderId,
        'Reminder ID'
      );
      const updated = await this.update(validatedReminderId, {
        deliveredAt: new Date(),
        isActive: false
      });

      if (updated) {
        logger.info('Reminder marked as delivered', { reminderId: validatedReminderId });
      }

      return updated;
    } catch (error) {
      logger.error('Error marking reminder as delivered', { error, reminderId: String(reminderId) });
      throw error;
    }
  }

  public async cancelReminder(reminderId: unknown): Promise<Reminder | null> {
    try {
      const validatedReminderId = ValidationHelpers.validateOrThrow(
        z.string(),
        reminderId,
        'Reminder ID'
      );
      const updated = await this.update(validatedReminderId, {
        isActive: false
      });

      if (updated) {
        logger.info('Reminder cancelled', { reminderId: validatedReminderId });
      }

      return updated;
    } catch (error) {
      logger.error('Error cancelling reminder', { error, reminderId: String(reminderId) });
      throw error;
    }
  }

  public async searchReminders(filters: unknown): Promise<Reminder[]> {
    try {
      // Create a schema for ReminderSearchFilters
      const ReminderSearchFiltersSchema = z.object({
        guildId: DiscordSnowflakeSchema.optional(),
        userId: DiscordSnowflakeSchema.optional(),
        isActive: z.boolean().optional(),
        deliveredAt: z.date().optional(),
        scheduledBefore: z.date().optional(),
        scheduledAfter: z.date().optional(),
        caseId: z.string().optional(),
      }).passthrough();
      
      const validatedFilters = ValidationHelpers.validateOrThrow(
        ReminderSearchFiltersSchema,
        filters,
        'Reminder search filters'
      );
      
      const query = this.buildSearchQuery(validatedFilters as ReminderSearchFilters);
      return this.findWithComplexFilter(query, { scheduledFor: 1 });
    } catch (error) {
      logger.error('Error searching reminders', { error, filters });
      throw error;
    }
  }

  public async getCaseReminders(caseId: string): Promise<Reminder[]> {
    try {
      return this.findWithComplexFilter({
        caseId,
        isActive: true
      }, { scheduledFor: 1 });
    } catch (error) {
      logger.error('Error getting case reminders', { error, caseId });
      throw error;
    }
  }

  public async getChannelReminders(channelId: string): Promise<Reminder[]> {
    try {
      return this.findWithComplexFilter({
        channelId,
        isActive: true
      }, { scheduledFor: 1 });
    } catch (error) {
      logger.error('Error getting channel reminders', { error, channelId });
      throw error;
    }
  }

  public async cleanupDeliveredReminders(olderThanDays = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const deletedCount = await this.deleteMany({
        isActive: false,
        deliveredAt: { $lt: cutoffDate }
      } as any);

      logger.info('Cleaned up delivered reminders', { deletedCount, olderThanDays });
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up delivered reminders', { error });
      throw error;
    }
  }

  private buildSearchQuery(filters: ReminderSearchFilters): Filter<Reminder> {
    const query: Filter<Reminder> = {
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