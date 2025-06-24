"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_REMINDER_MILLISECONDS = exports.MAX_REMINDER_DAYS = exports.TimeUnit = void 0;
exports.parseTimeString = parseTimeString;
exports.validateReminderTime = validateReminderTime;
exports.validateReminderCreation = validateReminderCreation;
exports.formatReminderTime = formatReminderTime;
exports.calculateScheduledTime = calculateScheduledTime;
exports.formatTimeUntilReminder = formatTimeUntilReminder;
var TimeUnit;
(function (TimeUnit) {
    TimeUnit["MINUTES"] = "minutes";
    TimeUnit["HOURS"] = "hours";
    TimeUnit["DAYS"] = "days";
})(TimeUnit || (exports.TimeUnit = TimeUnit = {}));
// Maximum reminder time is 7 days
exports.MAX_REMINDER_DAYS = 7;
exports.MAX_REMINDER_MILLISECONDS = exports.MAX_REMINDER_DAYS * 24 * 60 * 60 * 1000;
// Time parsing functions
function parseTimeString(timeString) {
    // Support formats: 10m, 2h, 1d, 30min, 5hour, 3day
    const timeRegex = /^(\d+)(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i;
    const match = timeString.trim().match(timeRegex);
    if (!match) {
        return null;
    }
    const value = parseInt(match[1] || '0');
    const unitString = (match[2] || '').toLowerCase();
    let unit;
    let multiplier;
    // Determine unit and multiplier
    if (['m', 'min', 'mins', 'minute', 'minutes'].includes(unitString)) {
        unit = TimeUnit.MINUTES;
        multiplier = 60 * 1000; // Convert to milliseconds
    }
    else if (['h', 'hr', 'hrs', 'hour', 'hours'].includes(unitString)) {
        unit = TimeUnit.HOURS;
        multiplier = 60 * 60 * 1000; // Convert to milliseconds
    }
    else if (['d', 'day', 'days'].includes(unitString)) {
        unit = TimeUnit.DAYS;
        multiplier = 24 * 60 * 60 * 1000; // Convert to milliseconds
    }
    else {
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
function validateReminderTime(timeString) {
    const parsed = parseTimeString(timeString);
    if (!parsed) {
        return {
            isValid: false,
            error: 'Invalid time format. Use formats like: 10m, 2h, 1d (max 7 days)'
        };
    }
    if (parsed.milliseconds > exports.MAX_REMINDER_MILLISECONDS) {
        return {
            isValid: false,
            error: `Maximum reminder time is ${exports.MAX_REMINDER_DAYS} days`
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
function validateReminderCreation(request) {
    const errors = [];
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
    }
    else {
        const timeValidation = validateReminderTime(request.timeString);
        if (!timeValidation.isValid) {
            errors.push(timeValidation.error);
        }
    }
    return errors;
}
function formatReminderTime(parsedTime) {
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
function calculateScheduledTime(timeString) {
    const validation = validateReminderTime(timeString);
    if (!validation.isValid || !validation.parsedTime) {
        return null;
    }
    const now = new Date();
    return new Date(now.getTime() + validation.parsedTime.milliseconds);
}
function formatTimeUntilReminder(scheduledFor) {
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
    }
    else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    else {
        return `${minutes}m`;
    }
}
//# sourceMappingURL=reminder.js.map