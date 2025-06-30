"use strict";
/**
 * @module ReminderSchemas
 * @description Zod schemas for reminder domain entities
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderSortOptionsSchema = exports.ReminderSearchFiltersSchema = exports.ReminderCreationRequestSchema = exports.ReminderSchema = exports.ReminderTypeSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Reminder type enum schema
 */
exports.ReminderTypeSchema = zod_1.z.enum([
    'custom',
    'case_update',
    'court_date',
    'filing_deadline',
    'meeting',
    'follow_up'
]);
/**
 * Reminder entity schema
 */
exports.ReminderSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    userId: shared_1.DiscordSnowflakeSchema,
    username: zod_1.z.string(),
    channelId: shared_1.DiscordSnowflakeSchema,
    message: zod_1.z.string().min(1).max(2000),
    scheduledFor: zod_1.z.date(),
    type: exports.ReminderTypeSchema.default('custom'),
    caseId: shared_1.MongoIdSchema.optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    isActive: zod_1.z.boolean().default(true),
    deliveredAt: zod_1.z.date().optional(),
});
/**
 * Reminder creation request schema
 */
exports.ReminderCreationRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    userId: shared_1.DiscordSnowflakeSchema,
    username: zod_1.z.string(),
    channelId: shared_1.DiscordSnowflakeSchema,
    message: zod_1.z.string().min(1).max(2000),
    scheduledFor: zod_1.z.date(),
    type: exports.ReminderTypeSchema.optional(),
    caseId: shared_1.MongoIdSchema.optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
/**
 * Reminder search filters schema
 */
exports.ReminderSearchFiltersSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema.optional(),
    userId: shared_1.DiscordSnowflakeSchema.optional(),
    type: exports.ReminderTypeSchema.optional(),
    caseId: shared_1.MongoIdSchema.optional(),
    channelId: shared_1.DiscordSnowflakeSchema.optional(),
    startDate: zod_1.z.date().optional(),
    endDate: zod_1.z.date().optional(),
    isActive: zod_1.z.boolean().optional(),
});
/**
 * Reminder sort options schema
 */
exports.ReminderSortOptionsSchema = zod_1.z.object({
    field: zod_1.z.enum(['scheduledFor', 'createdAt', 'type']).default('scheduledFor'),
    order: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
//# sourceMappingURL=reminder.schema.js.map