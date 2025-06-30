/**
 * @module ReminderSchemas
 * @description Zod schemas for reminder domain entities
 * @category Domain/Validation
 */

import { z } from 'zod';
import { BaseEntitySchema, DiscordSnowflakeSchema, MongoIdSchema } from '../shared';

/**
 * Reminder type enum schema
 */
export const ReminderTypeSchema = z.enum([
  'custom',
  'case_update',
  'court_date',
  'filing_deadline',
  'meeting',
  'follow_up'
]);

export type ReminderType = z.infer<typeof ReminderTypeSchema>;

/**
 * Reminder entity schema
 */
export const ReminderSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  userId: DiscordSnowflakeSchema,
  username: z.string(),
  channelId: DiscordSnowflakeSchema,
  message: z.string().min(1).max(2000),
  scheduledFor: z.date(),
  type: ReminderTypeSchema.default('custom'),
  caseId: MongoIdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  deliveredAt: z.date().optional(),
});

export type Reminder = z.infer<typeof ReminderSchema>;

/**
 * Reminder creation request schema
 */
export const ReminderCreationRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  userId: DiscordSnowflakeSchema,
  username: z.string(),
  channelId: DiscordSnowflakeSchema,
  message: z.string().min(1).max(2000),
  scheduledFor: z.date(),
  type: ReminderTypeSchema.optional(),
  caseId: MongoIdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ReminderCreationRequest = z.infer<typeof ReminderCreationRequestSchema>;

/**
 * Reminder search filters schema
 */
export const ReminderSearchFiltersSchema = z.object({
  guildId: DiscordSnowflakeSchema.optional(),
  userId: DiscordSnowflakeSchema.optional(),
  type: ReminderTypeSchema.optional(),
  caseId: MongoIdSchema.optional(),
  channelId: DiscordSnowflakeSchema.optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  isActive: z.boolean().optional(),
});

export type ReminderSearchFilters = z.infer<typeof ReminderSearchFiltersSchema>;

/**
 * Reminder sort options schema
 */
export const ReminderSortOptionsSchema = z.object({
  field: z.enum(['scheduledFor', 'createdAt', 'type']).default('scheduledFor'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type ReminderSortOptions = z.infer<typeof ReminderSortOptionsSchema>;