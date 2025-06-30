import { Reminder, ReminderSearchFilters } from '../../validation';
import { ReminderRepository } from '../../infrastructure/repositories/reminder-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { Client } from 'discord.js';
export declare class ReminderService {
    private reminderRepository;
    private caseRepository;
    private staffRepository;
    private reminderTimeouts;
    private discordClient;
    constructor(reminderRepository: ReminderRepository, caseRepository: CaseRepository, staffRepository: StaffRepository);
    setDiscordClient(client: Client): void;
    createReminder(request: unknown): Promise<Reminder>;
    getUserReminders(userId: string, guildId: string, activeOnly?: boolean): Promise<Reminder[]>;
    cancelReminder(reminderId: string, userId: string): Promise<Reminder | null>;
    getCaseReminders(caseId: string): Promise<Reminder[]>;
    getChannelReminders(channelId: string): Promise<Reminder[]>;
    searchReminders(filters: ReminderSearchFilters): Promise<Reminder[]>;
    private initializeActiveReminders;
    private scheduleReminder;
    private cancelReminderTimeout;
    private deliverReminder;
    cleanupOldReminders(olderThanDays?: number): Promise<number>;
    getReminderStats(): {
        activeTimeouts: number;
        scheduledReminders: string[];
    };
}
//# sourceMappingURL=reminder-service.d.ts.map