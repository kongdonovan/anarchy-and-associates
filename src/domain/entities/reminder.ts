import { BaseEntity } from './base';

export interface Reminder extends BaseEntity {
  guildId: string;
  userId: string; // Discord user ID who set the reminder
  username: string; // Discord username for display
  message: string; // Reminder message
  scheduledFor: Date; // When the reminder should fire
  channelId?: string; // Channel to send reminder (null for DM)
  caseId?: string; // Associated case ID if set in a case channel
  isActive: boolean; // Whether the reminder is still active
  deliveredAt?: Date; // When the reminder was delivered (null if not yet delivered)
}

export interface ReminderCreationRequest {
  guildId: string;
  userId: string;
  username: string;
  message: string;
  timeString: string; // e.g., "2h", "30m", "1d"
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

export enum TimeUnit {
  MINUTES = 'minutes',
  HOURS = 'hours',
  DAYS = 'days'
}

// Maximum reminder time is 7 days
export const MAX_REMINDER_DAYS = 7;
export const MAX_REMINDER_MILLISECONDS = MAX_REMINDER_DAYS * 24 * 60 * 60 * 1000;

// Time parsing functions
export function parseTimeString(timeString: string): ParsedTime | null {
  // Support formats: 10m, 2h, 1d, 30min, 5hour, 3day
  const timeRegex = /^(\d+)(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i;
  const match = timeString.trim().match(timeRegex);
  
  if (!match) {
    return null;
  }
  
  const value = parseInt(match[1] || '0');
  const unitString = (match[2] || '').toLowerCase();
  
  let unit: TimeUnit;
  let multiplier: number;
  
  // Determine unit and multiplier
  if (['m', 'min', 'mins', 'minute', 'minutes'].includes(unitString)) {
    unit = TimeUnit.MINUTES;
    multiplier = 60 * 1000; // Convert to milliseconds
  } else if (['h', 'hr', 'hrs', 'hour', 'hours'].includes(unitString)) {
    unit = TimeUnit.HOURS;
    multiplier = 60 * 60 * 1000; // Convert to milliseconds
  } else if (['d', 'day', 'days'].includes(unitString)) {
    unit = TimeUnit.DAYS;
    multiplier = 24 * 60 * 60 * 1000; // Convert to milliseconds
  } else {
    return null;
  }
  
  const milliseconds = value * multiplier;
  
  return {
    milliseconds,
    originalString: timeString,
    unit,
    value
  };
}

export function validateReminderTime(timeString: string): { isValid: boolean; error?: string; parsedTime?: ParsedTime } {
  const parsed = parseTimeString(timeString);
  
  if (!parsed) {
    return {
      isValid: false,
      error: 'Invalid time format. Use formats like: 10m, 2h, 1d (max 7 days)'
    };
  }
  
  if (parsed.milliseconds > MAX_REMINDER_MILLISECONDS) {
    return {
      isValid: false,
      error: `Maximum reminder time is ${MAX_REMINDER_DAYS} days`
    };
  }
  
  if (parsed.milliseconds < 60000) { // Less than 1 minute
    return {
      isValid: false,
      error: 'Minimum reminder time is 1 minute'
    };
  }
  
  return {
    isValid: true,
    parsedTime: parsed
  };
}

export function validateReminderCreation(request: ReminderCreationRequest): string[] {
  const errors: string[] = [];
  
  if (!request.guildId || request.guildId.trim() === '') {
    errors.push('Guild ID is required');
  }
  
  if (!request.userId || request.userId.trim() === '') {
    errors.push('User ID is required');
  }
  
  if (!request.username || request.username.trim() === '') {
    errors.push('Username is required');
  }
  
  if (!request.message || request.message.trim() === '') {
    errors.push('Reminder message is required');
  }
  
  if (request.message && request.message.length > 500) {
    errors.push('Reminder message cannot exceed 500 characters');
  }
  
  if (!request.timeString || request.timeString.trim() === '') {
    errors.push('Time specification is required');
  } else {
    const timeValidation = validateReminderTime(request.timeString);
    if (!timeValidation.isValid) {
      errors.push(timeValidation.error!);
    }
  }
  
  return errors;
}

export function formatReminderTime(parsedTime: ParsedTime): string {
  const { value, unit } = parsedTime;
  
  switch (unit) {
    case TimeUnit.MINUTES:
      return `${value} minute${value !== 1 ? 's' : ''}`;
    case TimeUnit.HOURS:
      return `${value} hour${value !== 1 ? 's' : ''}`;
    case TimeUnit.DAYS:
      return `${value} day${value !== 1 ? 's' : ''}`;
    default:
      return parsedTime.originalString;
  }
}

export function calculateScheduledTime(timeString: string): Date | null {
  const validation = validateReminderTime(timeString);
  if (!validation.isValid || !validation.parsedTime) {
    return null;
  }
  
  const now = new Date();
  return new Date(now.getTime() + validation.parsedTime.milliseconds);
}

export function formatTimeUntilReminder(scheduledFor: Date): string {
  const now = new Date();
  const msUntil = scheduledFor.getTime() - now.getTime();
  
  if (msUntil <= 0) {
    return 'Overdue';
  }
  
  const days = Math.floor(msUntil / (24 * 60 * 60 * 1000));
  const hours = Math.floor((msUntil % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((msUntil % (60 * 60 * 1000)) / (60 * 1000));
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}