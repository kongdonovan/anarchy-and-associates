/**
 * @module GuildConfigSchemas
 * @description Zod schemas for Guild Configuration domain entities
 * @category Domain/Validation
 */

import { z } from 'zod';
import { 
  BaseEntitySchema, 
  DiscordSnowflakeSchema,
  PermissionActionSchema
} from '../shared';

/**
 * Channel cleanup configuration schema
 * @description Settings for automated channel cleanup
 */
export const ChannelCleanupConfigSchema = z.object({
  scanInterval: z.number().int().positive().min(300000), // Min 5 minutes
  inactivityThreshold: z.number().int().positive().min(86400000), // Min 1 day
  archiveThreshold: z.number().int().positive().min(604800000), // Min 7 days
  deleteThreshold: z.number().int().positive().min(2592000000), // Min 30 days
  batchSize: z.number().int().positive().max(50),
  enableAutoCleanup: z.boolean(),
  notificationChannelId: DiscordSnowflakeSchema.optional(),
  excludedCategories: z.array(DiscordSnowflakeSchema).default([]),
  excludedChannels: z.array(DiscordSnowflakeSchema).default([]),
});

export type ChannelCleanupConfig = z.infer<typeof ChannelCleanupConfigSchema>;

/**
 * Guild permissions schema
 * @description Permission mappings for different actions
 */
export const GuildPermissionsSchema = z.object({
  admin: z.array(DiscordSnowflakeSchema).default([]),
  'senior-staff': z.array(DiscordSnowflakeSchema).default([]),
  case: z.array(DiscordSnowflakeSchema).default([]),
  config: z.array(DiscordSnowflakeSchema).default([]),
  lawyer: z.array(DiscordSnowflakeSchema).default([]),
  'lead-attorney': z.array(DiscordSnowflakeSchema).default([]),
  repair: z.array(DiscordSnowflakeSchema).default([]),
});

export type GuildPermissions = z.infer<typeof GuildPermissionsSchema>;

/**
 * Guild configuration entity schema
 * @description Complete validation schema for guild settings
 */
export const GuildConfigSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  feedbackChannelId: DiscordSnowflakeSchema.optional(),
  retainerChannelId: DiscordSnowflakeSchema.optional(),
  caseReviewCategoryId: DiscordSnowflakeSchema.optional(),
  caseArchiveCategoryId: DiscordSnowflakeSchema.optional(),
  modlogChannelId: DiscordSnowflakeSchema.optional(),
  applicationChannelId: DiscordSnowflakeSchema.optional(),
  defaultInformationChannelId: DiscordSnowflakeSchema.optional(),
  defaultRulesChannelId: DiscordSnowflakeSchema.optional(),
  clientRoleId: DiscordSnowflakeSchema.optional(),
  permissions: GuildPermissionsSchema,
  adminRoles: z.array(DiscordSnowflakeSchema).default([]),
  adminUsers: z.array(DiscordSnowflakeSchema).default([]),
  channelCleanupConfig: ChannelCleanupConfigSchema.optional(),
});

export type GuildConfig = z.infer<typeof GuildConfigSchema>;

/**
 * Guild config update request schema
 * @description Validates partial guild config updates
 */
export const GuildConfigUpdateRequestSchema = GuildConfigSchema
  .omit({ _id: true, createdAt: true, updatedAt: true, guildId: true })
  .partial();

export type GuildConfigUpdateRequest = z.infer<typeof GuildConfigUpdateRequestSchema>;

/**
 * Set permission request schema
 * @description Validates permission assignment requests
 */
export const SetPermissionRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  action: PermissionActionSchema,
  roleId: DiscordSnowflakeSchema,
});

export type SetPermissionRequest = z.infer<typeof SetPermissionRequestSchema>;

/**
 * Add admin request schema
 * @description Validates admin role/user addition
 */
export const AddAdminRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  type: z.enum(['role', 'user']),
  id: DiscordSnowflakeSchema,
});

export type AddAdminRequest = z.infer<typeof AddAdminRequestSchema>;

/**
 * Channel configuration request schema
 * @description Validates channel configuration updates
 */
export const ChannelConfigRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  channelType: z.enum([
    'feedback',
    'retainer',
    'caseReview',
    'caseArchive',
    'modlog',
    'application',
    'information',
    'rules'
  ]),
  channelId: DiscordSnowflakeSchema.nullable(),
});

export type ChannelConfigRequest = z.infer<typeof ChannelConfigRequestSchema>;
