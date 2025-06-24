import { BaseMongoRepository } from './base-mongo-repository';
import { 
  Reminder, 
  ReminderSearchFilters 
} from '../../domain/entities/reminder';
import { Filter } from 'mongodb';
import { logger } from '../logger';

export class ReminderRepository extends BaseMongoRepository<Reminder> {
  constructor() {
    super('reminders');
  }

  public async getActiveReminders(guildId: string): Promise<Reminder[]> {
    try {
      return this.findWithComplexFilter({
        guildId,
        isActive: true,
        deliveredAt: { $exists: false }
      } as Filter<Reminder>);
    } catch (error) {
      logger.error('Error getting active reminders', { error, guildId });
      throw error;
    }
  }

  public async getUserReminders(userId: string, guildId: string, activeOnly = true): Promise<Reminder[]> {
    try {
      const query: Filter<Reminder> = {
        guildId,
        userId
      };

      if (activeOnly) {
        query.isActive = true;
        query.deliveredAt = { $exists: false } as any;
      }

      return this.findWithComplexFilter(query, { scheduledFor: 1 }); // Sort by scheduled time
    } catch (error) {
      logger.error('Error getting user reminders', { error, userId, guildId });
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

  public async markAsDelivered(reminderId: string): Promise<Reminder | null> {
    try {
      const updated = await this.update(reminderId, {
        deliveredAt: new Date(),
        isActive: false
      });

      if (updated) {
        logger.info('Reminder marked as delivered', { reminderId });
      }

      return updated;
    } catch (error) {
      logger.error('Error marking reminder as delivered', { error, reminderId });
      throw error;
    }
  }

  public async cancelReminder(reminderId: string): Promise<Reminder | null> {
    try {
      const updated = await this.update(reminderId, {
        isActive: false
      });

      if (updated) {
        logger.info('Reminder cancelled', { reminderId });
      }

      return updated;
    } catch (error) {
      logger.error('Error cancelling reminder', { error, reminderId });
      throw error;
    }
  }

  public async searchReminders(filters: ReminderSearchFilters): Promise<Reminder[]> {
    try {
      const query = this.buildSearchQuery(filters);
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