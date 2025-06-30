"use strict";
/**
 * @module AuditLogSchemas
 * @description Zod schemas for audit logging domain entities
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActionSeverity = exports.AuditLogSearchFiltersSchema = exports.AuditLogCreateRequestSchema = exports.AuditLogSchema = exports.AuditDetailsSchema = exports.AuditStateSchema = exports.BypassInfoSchema = exports.BypassTypeSchema = exports.AuditSeveritySchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Audit log severity enum schema
 */
exports.AuditSeveritySchema = zod_1.z.enum(['low', 'medium', 'high', 'critical']);
/**
 * Bypass type enum schema
 */
exports.BypassTypeSchema = zod_1.z.enum(['guild-owner', 'admin', 'emergency']);
/**
 * Bypass info schema
 * @description Information about business rule bypasses
 */
exports.BypassInfoSchema = zod_1.z.object({
    bypassType: exports.BypassTypeSchema,
    businessRuleViolated: zod_1.z.string(),
    originalValidationErrors: zod_1.z.array(zod_1.z.string()),
    bypassReason: zod_1.z.string().optional(),
    currentCount: zod_1.z.number().int().nonnegative().optional(),
    maxCount: zod_1.z.number().int().positive().optional(),
    ruleMetadata: zod_1.z.record(zod_1.z.any()).optional(),
});
/**
 * Audit details before/after state schema
 */
exports.AuditStateSchema = zod_1.z.object({
    role: shared_1.StaffRoleSchema.optional(),
    status: zod_1.z.string().optional(),
}).passthrough(); // Allow additional properties
/**
 * Audit details schema
 * @description Detailed information about the audit event
 */
exports.AuditDetailsSchema = zod_1.z.object({
    before: exports.AuditStateSchema.optional(),
    after: exports.AuditStateSchema.optional(),
    reason: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
    bypassInfo: exports.BypassInfoSchema.optional(),
});
/**
 * Audit log entity schema
 * @description Complete validation schema for audit logs
 */
exports.AuditLogSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    action: shared_1.AuditActionSchema,
    actorId: shared_1.DiscordSnowflakeSchema,
    targetId: shared_1.DiscordSnowflakeSchema.optional(),
    details: exports.AuditDetailsSchema,
    timestamp: zod_1.z.date(),
    ipAddress: zod_1.z.string().ip().optional(),
    channelId: shared_1.DiscordSnowflakeSchema.optional(),
    isGuildOwnerBypass: zod_1.z.boolean().optional(),
    businessRulesBypassed: zod_1.z.array(zod_1.z.string()).optional(),
    severity: exports.AuditSeveritySchema.optional(),
});
/**
 * Audit log creation request schema
 * @description Validates data for creating new audit logs
 */
exports.AuditLogCreateRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    action: shared_1.AuditActionSchema,
    actorId: shared_1.DiscordSnowflakeSchema,
    targetId: shared_1.DiscordSnowflakeSchema.optional(),
    details: exports.AuditDetailsSchema,
    ipAddress: zod_1.z.string().ip().optional(),
    channelId: shared_1.DiscordSnowflakeSchema.optional(),
    isGuildOwnerBypass: zod_1.z.boolean().optional(),
    businessRulesBypassed: zod_1.z.array(zod_1.z.string()).optional(),
    severity: exports.AuditSeveritySchema.optional(),
});
/**
 * Audit log search filters schema
 */
exports.AuditLogSearchFiltersSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema.optional(),
    action: shared_1.AuditActionSchema.optional(),
    actorId: shared_1.DiscordSnowflakeSchema.optional(),
    targetId: shared_1.DiscordSnowflakeSchema.optional(),
    severity: exports.AuditSeveritySchema.optional(),
    isGuildOwnerBypass: zod_1.z.boolean().optional(),
    startDate: zod_1.z.date().optional(),
    endDate: zod_1.z.date().optional(),
});
/**
 * Helper function to determine severity based on action
 */
const getActionSeverity = (action) => {
    const severityMap = {
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
exports.getActionSeverity = getActionSeverity;
//# sourceMappingURL=audit-log.schema.js.map