import { BaseMongoRepository } from './base-mongo-repository';
import { Reminder, ReminderSearchFilters } from '../../domain/entities/reminder';
export declare class ReminderRepository extends BaseMongoRepository<Reminder> {
    constructor();
    getActiveReminders(guildId: string): Promise<Reminder[]>;
    getUserReminders(userId: string, guildId: string, activeOnly?: boolean): Promise<Reminder[]>;
    getDueReminders(): Promise<Reminder[]>;
    markAsDelivered(reminderId: string): Promise<Reminder | null>;
    cancelReminder(reminderId: string): Promise<Reminder | null>;
    searchReminders(filters: ReminderSearchFilters): Promise<Reminder[]>;
    getCaseReminders(caseId: string): Promise<Reminder[]>;
    getChannelReminders(channelId: string): Promise<Reminder[]>;
    cleanupDeliveredReminders(olderThanDays?: number): Promise<number>;
    private buildSearchQuery;
}
//# sourceMappingURL=reminder-repository.d.ts.map