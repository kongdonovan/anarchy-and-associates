import { BaseEntity } from './base';
export interface Reminder extends BaseEntity {
    guildId: string;
    userId: string;
    username: string;
    message: string;
    scheduledFor: Date;
    channelId?: string;
    caseId?: string;
    isActive: boolean;
    deliveredAt?: Date;
}
export interface ReminderCreationRequest {
    guildId: string;
    userId: string;
    username: string;
    message: string;
    timeString: string;
    channelId?: string;
    caseId?: string;
}
export interface ReminderSearchFilters {
    guildId: string;
    userId?: string;
    isActive?: boolean;
    channelId?: string;
    caseId?: string;
    startDate?: Date;
    endDate?: Date;
}
export interface ParsedTime {
    milliseconds: number;
    originalString: string;
    unit: TimeUnit;
    value: number;
}
export declare enum TimeUnit {
    MINUTES = "minutes",
    HOURS = "hours",
    DAYS = "days"
}
export declare const MAX_REMINDER_DAYS = 7;
export declare const MAX_REMINDER_MILLISECONDS: number;
export declare function parseTimeString(timeString: string): ParsedTime | null;
export declare function validateReminderTime(timeString: string): {
    isValid: boolean;
    error?: string;
    parsedTime?: ParsedTime;
};
export declare function validateReminderCreation(request: ReminderCreationRequest): string[];
export declare function formatReminderTime(parsedTime: ParsedTime): string;
export declare function calculateScheduledTime(timeString: string): Date | null;
export declare function formatTimeUntilReminder(scheduledFor: Date): string;
//# sourceMappingURL=reminder.d.ts.map