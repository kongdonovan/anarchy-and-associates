/**
 * @module StaffSchemas
 * @description Zod schemas for Staff domain entities
 * @category Domain/Validation
 */

import { z } from 'zod';
import { 
  BaseEntitySchema, 
  DiscordSnowflakeSchema, 
  StaffRoleSchema, 
  FlexibleTimestampSchema 
} from '../shared';

/**
 * Promotion action type schema
 */
export const PromotionActionTypeSchema = z.enum(['promotion', 'demotion', 'hire', 'fire']);

export type PromotionActionType = z.infer<typeof PromotionActionTypeSchema>;

/**
 * Promotion record schema
 * @description Tracks staff role transitions and employment history
 */
export const PromotionRecordSchema = z.object({
  fromRole: StaffRoleSchema,
  toRole: StaffRoleSchema,
  promotedBy: DiscordSnowflakeSchema,
  promotedAt: FlexibleTimestampSchema,
  reason: z.string().max(500).optional(),
  actionType: PromotionActionTypeSchema,
});

export type PromotionRecord = z.infer<typeof PromotionRecordSchema>;

/**
 * Staff employment status schema
 */
export const StaffEmploymentStatusSchema = z.enum(['active', 'inactive', 'terminated']);

export type StaffEmploymentStatus = z.infer<typeof StaffEmploymentStatusSchema>;

/**
 * Staff entity schema
 * @description Complete validation schema for staff members
 */
export const StaffSchema = BaseEntitySchema.extend({
  userId: DiscordSnowflakeSchema,
  guildId: DiscordSnowflakeSchema,
  robloxUsername: z.string()
    .min(3, 'Roblox username must be at least 3 characters')
    .max(20, 'Roblox username must not exceed 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Roblox username can only contain letters, numbers, and underscores'),
  role: StaffRoleSchema,
  hiredAt: FlexibleTimestampSchema,
  hiredBy: DiscordSnowflakeSchema,
  promotionHistory: z.array(PromotionRecordSchema).default([]),
  status: StaffEmploymentStatusSchema,
  discordRoleId: DiscordSnowflakeSchema.optional(),
});

export type Staff = z.infer<typeof StaffSchema>;

/**
 * Staff creation request schema
 * @description Validates data for creating new staff members
 */
export const StaffCreateRequestSchema = z.object({
  userId: DiscordSnowflakeSchema,
  guildId: DiscordSnowflakeSchema,
  robloxUsername: z.string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
  role: StaffRoleSchema,
  hiredBy: DiscordSnowflakeSchema,
  reason: z.string().max(500).optional(),
});

export type StaffCreateRequest = z.infer<typeof StaffCreateRequestSchema>;

/**
 * Staff update request schema
 * @description Validates partial updates to staff members
 */
export const StaffUpdateRequestSchema = StaffCreateRequestSchema.partial().extend({
  status: StaffEmploymentStatusSchema.optional(),
  discordRoleId: DiscordSnowflakeSchema.optional(),
});

export type StaffUpdateRequest = z.infer<typeof StaffUpdateRequestSchema>;

/**
 * Staff search filters schema
 */
export const StaffSearchFiltersSchema = z.object({
  guildId: DiscordSnowflakeSchema.optional(),
  userId: DiscordSnowflakeSchema.optional(),
  role: StaffRoleSchema.optional(),
  status: StaffEmploymentStatusSchema.optional(),
  roles: z.array(StaffRoleSchema).optional(),
});

export type StaffSearchFilters = z.infer<typeof StaffSearchFiltersSchema>;

/**
 * Staff role change request schema
 */
export const StaffRoleChangeRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  userId: DiscordSnowflakeSchema,
  newRole: StaffRoleSchema,
  promotedBy: DiscordSnowflakeSchema,
  reason: z.string().max(500).optional(),
});

export type StaffRoleChangeRequest = z.infer<typeof StaffRoleChangeRequestSchema>;

/**
 * Staff termination request schema
 */
export const StaffTerminationRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  userId: DiscordSnowflakeSchema,
  terminatedBy: DiscordSnowflakeSchema,
  reason: z.string().max(500).optional(),
});

export type StaffTerminationRequest = z.infer<typeof StaffTerminationRequestSchema>;
