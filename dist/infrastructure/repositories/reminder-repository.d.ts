import { BaseMongoRepository } from './base-mongo-repository';
import { Reminder } from '../../validation';
export declare class ReminderRepository extends BaseMongoRepository<Reminder> {
    constructor();
    getActiveReminders(guildId: unknown): Promise<Reminder[]>;
    getUserReminders(userId: unknown, guildId: unknown, activeOnly?: unknown): Promise<Reminder[]>;
    getDueReminders(): Promise<Reminder[]>;
    markAsDelivered(reminderId: unknown): Promise<Reminder | null>;
    cancelReminder(reminderId: unknown): Promise<Reminder | null>;
    searchReminders(filters: unknown): Promise<Reminder[]>;
    getCaseReminders(caseId: string): Promise<Reminder[]>;
    getChannelReminders(channelId: string): Promise<Reminder[]>;
    cleanupDeliveredReminders(olderThanDays?: number): Promise<number>;
    private buildSearchQuery;
}
//# sourceMappingURL=reminder-repository.d.ts.map