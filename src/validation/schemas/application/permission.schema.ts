/**
 * @module PermissionSchemas
 * @description Zod schemas for permission and authorization structures
 * @category Application/Validation
 */

import { z } from 'zod';
import { DiscordSnowflakeSchema, PermissionActionSchema } from '../shared';

/**
 * Permission context schema
 * @description Runtime context for permission checks
 */
export const PermissionContextSchema = z.object({
  userId: DiscordSnowflakeSchema,
  guildId: DiscordSnowflakeSchema,
  isGuildOwner: z.boolean(),
  hasAdminRole: z.boolean(),
  hasSeniorStaffRole: z.boolean().optional(),
  hasHRRole: z.boolean().optional(),
  hasCaseRole: z.boolean().optional(),
  hasConfigRole: z.boolean().optional(),
  hasLawyerRole: z.boolean().optional(),
  hasLeadAttorneyRole: z.boolean().optional(),
  hasRepairRole: z.boolean().optional(),
});

export type PermissionContext = z.infer<typeof PermissionContextSchema>;

/**
 * Permission check request schema
 * @description Request to check if user has specific permission
 */
export const PermissionCheckRequestSchema = z.object({
  context: PermissionContextSchema,
  action: PermissionActionSchema,
  targetUserId: DiscordSnowflakeSchema.optional(),
  targetRoleLevel: z.number().int().optional(),
});

export type PermissionCheckRequest = z.infer<typeof PermissionCheckRequestSchema>;

/**
 * Permission grant request schema
 * @description Request to grant permissions to a role
 */
export const PermissionGrantRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  roleId: DiscordSnowflakeSchema,
  action: PermissionActionSchema,
  grantedBy: DiscordSnowflakeSchema,
});

export type PermissionGrantRequest = z.infer<typeof PermissionGrantRequestSchema>;

/**
 * Permission revoke request schema
 * @description Request to revoke permissions from a role
 */
export const PermissionRevokeRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  roleId: DiscordSnowflakeSchema,
  action: PermissionActionSchema,
  revokedBy: DiscordSnowflakeSchema,
});

export type PermissionRevokeRequest = z.infer<typeof PermissionRevokeRequestSchema>;

/**
 * Action permission result schema
 * @description Result of permission check for an action
 */
export const ActionPermissionResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  requiredRole: z.string().optional(),
  userRoles: z.array(z.string()).optional(),
});

export type ActionPermissionResult = z.infer<typeof ActionPermissionResultSchema>;

/**
 * Bulk permission check request schema
 * @description Check multiple permissions at once
 */
export const BulkPermissionCheckRequestSchema = z.object({
  context: PermissionContextSchema,
  actions: z.array(PermissionActionSchema),
});

export type BulkPermissionCheckRequest = z.infer<typeof BulkPermissionCheckRequestSchema>;

/**
 * Bulk permission check result schema
 */
export const BulkPermissionCheckResultSchema = z.object({
  results: z.record(PermissionActionSchema, ActionPermissionResultSchema),
  allAllowed: z.boolean(),
  anyAllowed: z.boolean(),
});

export type BulkPermissionCheckResult = z.infer<typeof BulkPermissionCheckResultSchema>;
