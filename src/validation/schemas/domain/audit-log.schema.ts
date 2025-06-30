/**
 * @module AuditLogSchemas
 * @description Zod schemas for audit logging domain entities
 * @category Domain/Validation
 */

import { z } from 'zod';
import { 
  BaseEntitySchema, 
  DiscordSnowflakeSchema,
  StaffRoleSchema,
  AuditActionSchema,
  AuditAction
} from '../shared';

/**
 * Audit log severity enum schema
 */
export const AuditSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

/**
 * Bypass type enum schema
 */
export const BypassTypeSchema = z.enum(['guild-owner', 'admin', 'emergency']);

export type BypassType = z.infer<typeof BypassTypeSchema>;

/**
 * Bypass info schema
 * @description Information about business rule bypasses
 */
export const BypassInfoSchema = z.object({
  bypassType: BypassTypeSchema,
  businessRuleViolated: z.string(),
  originalValidationErrors: z.array(z.string()),
  bypassReason: z.string().optional(),
  currentCount: z.number().int().nonnegative().optional(),
  maxCount: z.number().int().positive().optional(),
  ruleMetadata: z.record(z.any()).optional(),
});

export type BypassInfo = z.infer<typeof BypassInfoSchema>;

/**
 * Audit details before/after state schema
 */
export const AuditStateSchema = z.object({
  role: StaffRoleSchema.optional(),
  status: z.string().optional(),
}).passthrough(); // Allow additional properties

export type AuditState = z.infer<typeof AuditStateSchema>;

/**
 * Audit details schema
 * @description Detailed information about the audit event
 */
export const AuditDetailsSchema = z.object({
  before: AuditStateSchema.optional(),
  after: AuditStateSchema.optional(),
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  bypassInfo: BypassInfoSchema.optional(),
});

export type AuditDetails = z.infer<typeof AuditDetailsSchema>;

/**
 * Audit log entity schema
 * @description Complete validation schema for audit logs
 */
export const AuditLogSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  action: AuditActionSchema,
  actorId: DiscordSnowflakeSchema,
  targetId: DiscordSnowflakeSchema.optional(),
  details: AuditDetailsSchema,
  timestamp: z.date(),
  ipAddress: z.string().ip().optional(),
  channelId: DiscordSnowflakeSchema.optional(),
  isGuildOwnerBypass: z.boolean().optional(),
  businessRulesBypassed: z.array(z.string()).optional(),
  severity: AuditSeveritySchema.optional(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

/**
 * Audit log creation request schema
 * @description Validates data for creating new audit logs
 */
export const AuditLogCreateRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  action: AuditActionSchema,
  actorId: DiscordSnowflakeSchema,
  targetId: DiscordSnowflakeSchema.optional(),
  details: AuditDetailsSchema,
  ipAddress: z.string().ip().optional(),
  channelId: DiscordSnowflakeSchema.optional(),
  isGuildOwnerBypass: z.boolean().optional(),
  businessRulesBypassed: z.array(z.string()).optional(),
  severity: AuditSeveritySchema.optional(),
});

export type AuditLogCreateRequest = z.infer<typeof AuditLogCreateRequestSchema>;

/**
 * Audit log search filters schema
 */
export const AuditLogSearchFiltersSchema = z.object({
  guildId: DiscordSnowflakeSchema.optional(),
  action: AuditActionSchema.optional(),
  actorId: DiscordSnowflakeSchema.optional(),
  targetId: DiscordSnowflakeSchema.optional(),
  severity: AuditSeveritySchema.optional(),
  isGuildOwnerBypass: z.boolean().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

export type AuditLogSearchFilters = z.infer<typeof AuditLogSearchFiltersSchema>;

/**
 * Helper function to determine severity based on action
 */
export const getActionSeverity = (action: AuditAction): AuditSeverity => {
  const severityMap: Record<AuditAction, AuditSeverity> = {
    // Low severity
    'staff_info_viewed': 'low',
    'staff_list_viewed': 'low',
    'job_list_viewed': 'low',
    'job_info_viewed': 'low',
    'channel_cleanup_scan': 'low',
    
    // Medium severity
    'staff_promoted': 'medium',
    'staff_demoted': 'medium',
    'job_created': 'medium',
    'job_updated': 'medium',
    'job_closed': 'medium',
    'case_assigned': 'medium',
    'role_sync_performed': 'medium',
    'lead_attorney_changed': 'medium',
    
    // High severity
    'staff_hired': 'high',
    'staff_fired': 'high',
    'job_removed': 'high',
    'case_created': 'high',
    'case_closed': 'high',
    'case_archived': 'high',
    'channel_archived': 'high',
    'lead_attorney_removed': 'high',
    'channel_cleanup_performed': 'high',
    'orphaned_channel_deleted': 'high',
    'system_repair': 'high',
    
    // Critical severity
    'guild_owner_bypass': 'critical',
    'business_rule_violation': 'critical',
    'role_limit_bypassed': 'critical',
    'permission_override': 'critical',
  };
  
  return severityMap[action] || 'medium';
};