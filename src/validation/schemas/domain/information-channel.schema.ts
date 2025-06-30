/**
 * @module InformationChannelSchemas
 * @description Zod schemas for information channel domain entities
 * @category Domain/Validation
 */

import { z } from 'zod';
import { BaseEntitySchema, DiscordSnowflakeSchema } from '../shared';

/**
 * Information channel entity schema
 * @description Complete validation schema for information channels
 */
export const InformationChannelSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  channelId: DiscordSnowflakeSchema,
  messageId: DiscordSnowflakeSchema.optional(),
  content: z.string().min(1).max(4000),
  lastUpdatedBy: DiscordSnowflakeSchema,
  lastUpdatedAt: z.date(),
  createdBy: DiscordSnowflakeSchema,
  version: z.number().int().positive().default(1),
});

export type InformationChannel = z.infer<typeof InformationChannelSchema>;

/**
 * Information channel creation request schema
 * @description Validates data for creating new information channels
 */
export const InformationChannelCreateRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  channelId: DiscordSnowflakeSchema,
  content: z.string().min(1).max(4000),
  createdBy: DiscordSnowflakeSchema,
});

export type InformationChannelCreateRequest = z.infer<typeof InformationChannelCreateRequestSchema>;

/**
 * Information channel update request schema
 * @description Validates data for updating information channels
 */
export const InformationChannelUpdateRequestSchema = z.object({
  content: z.string().min(1).max(4000),
  updatedBy: DiscordSnowflakeSchema,
});

export type InformationChannelUpdateRequest = z.infer<typeof InformationChannelUpdateRequestSchema>;