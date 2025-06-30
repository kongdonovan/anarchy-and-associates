/**
 * @module AuditLogSchemas
 * @description Zod schemas for audit logging domain entities
 * @category Domain/Validation
 */
import { z } from 'zod';
import { AuditAction } from '../shared';
/**
 * Audit log severity enum schema
 */
export declare const AuditSeveritySchema: z.ZodEnum<["low", "medium", "high", "critical"]>;
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;
/**
 * Bypass type enum schema
 */
export declare const BypassTypeSchema: z.ZodEnum<["guild-owner", "admin", "emergency"]>;
export type BypassType = z.infer<typeof BypassTypeSchema>;
/**
 * Bypass info schema
 * @description Information about business rule bypasses
 */
export declare const BypassInfoSchema: z.ZodObject<{
    bypassType: z.ZodEnum<["guild-owner", "admin", "emergency"]>;
    businessRuleViolated: z.ZodString;
    originalValidationErrors: z.ZodArray<z.ZodString, "many">;
    bypassReason: z.ZodOptional<z.ZodString>;
    currentCount: z.ZodOptional<z.ZodNumber>;
    maxCount: z.ZodOptional<z.ZodNumber>;
    ruleMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    bypassType: "admin" | "guild-owner" | "emergency";
    businessRuleViolated: string;
    originalValidationErrors: string[];
    bypassReason?: string | undefined;
    currentCount?: number | undefined;
    maxCount?: number | undefined;
    ruleMetadata?: Record<string, any> | undefined;
}, {
    bypassType: "admin" | "guild-owner" | "emergency";
    businessRuleViolated: string;
    originalValidationErrors: string[];
    bypassReason?: string | undefined;
    currentCount?: number | undefined;
    maxCount?: number | undefined;
    ruleMetadata?: Record<string, any> | undefined;
}>;
export type BypassInfo = z.infer<typeof BypassInfoSchema>;
/**
 * Audit details before/after state schema
 */
export declare const AuditStateSchema: z.ZodObject<{
    role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
    status: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
    status: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
    status: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export type AuditState = z.infer<typeof AuditStateSchema>;
/**
 * Audit details schema
 * @description Detailed information about the audit event
 */
export declare const AuditDetailsSchema: z.ZodObject<{
    before: z.ZodOptional<z.ZodObject<{
        role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
        status: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
        status: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
        status: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
    after: z.ZodOptional<z.ZodObject<{
        role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
        status: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
        status: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
        status: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
    reason: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    bypassInfo: z.ZodOptional<z.ZodObject<{
        bypassType: z.ZodEnum<["guild-owner", "admin", "emergency"]>;
        businessRuleViolated: z.ZodString;
        originalValidationErrors: z.ZodArray<z.ZodString, "many">;
        bypassReason: z.ZodOptional<z.ZodString>;
        currentCount: z.ZodOptional<z.ZodNumber>;
        maxCount: z.ZodOptional<z.ZodNumber>;
        ruleMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        bypassType: "admin" | "guild-owner" | "emergency";
        businessRuleViolated: string;
        originalValidationErrors: string[];
        bypassReason?: string | undefined;
        currentCount?: number | undefined;
        maxCount?: number | undefined;
        ruleMetadata?: Record<string, any> | undefined;
    }, {
        bypassType: "admin" | "guild-owner" | "emergency";
        businessRuleViolated: string;
        originalValidationErrors: string[];
        bypassReason?: string | undefined;
        currentCount?: number | undefined;
        maxCount?: number | undefined;
        ruleMetadata?: Record<string, any> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    metadata?: Record<string, any> | undefined;
    reason?: string | undefined;
    before?: z.objectOutputType<{
        role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
        status: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    after?: z.objectOutputType<{
        role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
        status: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    bypassInfo?: {
        bypassType: "admin" | "guild-owner" | "emergency";
        businessRuleViolated: string;
        originalValidationErrors: string[];
        bypassReason?: string | undefined;
        currentCount?: number | undefined;
        maxCount?: number | undefined;
        ruleMetadata?: Record<string, any> | undefined;
    } | undefined;
}, {
    metadata?: Record<string, any> | undefined;
    reason?: string | undefined;
    before?: z.objectInputType<{
        role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
        status: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    after?: z.objectInputType<{
        role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
        status: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    bypassInfo?: {
        bypassType: "admin" | "guild-owner" | "emergency";
        businessRuleViolated: string;
        originalValidationErrors: string[];
        bypassReason?: string | undefined;
        currentCount?: number | undefined;
        maxCount?: number | undefined;
        ruleMetadata?: Record<string, any> | undefined;
    } | undefined;
}>;
export type AuditDetails = z.infer<typeof AuditDetailsSchema>;
/**
 * Audit log entity schema
 * @description Complete validation schema for audit logs
 */
export declare const AuditLogSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
} & {
    guildId: z.ZodString;
    action: z.ZodEnum<["staff_hired", "staff_fired", "staff_promoted", "staff_demoted", "staff_info_viewed", "staff_list_viewed", "role_sync_performed", "job_created", "job_updated", "job_closed", "job_removed", "job_list_viewed", "job_info_viewed", "guild_owner_bypass", "business_rule_violation", "role_limit_bypassed", "permission_override", "case_created", "case_assigned", "case_closed", "case_archived", "channel_archived", "lead_attorney_changed", "lead_attorney_removed", "channel_cleanup_scan", "channel_cleanup_performed", "orphaned_channel_deleted", "system_repair"]>;
    actorId: z.ZodString;
    targetId: z.ZodOptional<z.ZodString>;
    details: z.ZodObject<{
        before: z.ZodOptional<z.ZodObject<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
        after: z.ZodOptional<z.ZodObject<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
        reason: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        bypassInfo: z.ZodOptional<z.ZodObject<{
            bypassType: z.ZodEnum<["guild-owner", "admin", "emergency"]>;
            businessRuleViolated: z.ZodString;
            originalValidationErrors: z.ZodArray<z.ZodString, "many">;
            bypassReason: z.ZodOptional<z.ZodString>;
            currentCount: z.ZodOptional<z.ZodNumber>;
            maxCount: z.ZodOptional<z.ZodNumber>;
            ruleMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        }, {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        metadata?: Record<string, any> | undefined;
        reason?: string | undefined;
        before?: z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        after?: z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        bypassInfo?: {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        } | undefined;
    }, {
        metadata?: Record<string, any> | undefined;
        reason?: string | undefined;
        before?: z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        after?: z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        bypassInfo?: {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        } | undefined;
    }>;
    timestamp: z.ZodDate;
    ipAddress: z.ZodOptional<z.ZodString>;
    channelId: z.ZodOptional<z.ZodString>;
    isGuildOwnerBypass: z.ZodOptional<z.ZodBoolean>;
    businessRulesBypassed: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    action: "staff_hired" | "staff_fired" | "staff_promoted" | "staff_demoted" | "staff_info_viewed" | "staff_list_viewed" | "role_sync_performed" | "job_created" | "job_updated" | "job_closed" | "job_removed" | "job_list_viewed" | "job_info_viewed" | "guild_owner_bypass" | "business_rule_violation" | "role_limit_bypassed" | "permission_override" | "case_created" | "case_assigned" | "case_closed" | "case_archived" | "channel_archived" | "lead_attorney_changed" | "lead_attorney_removed" | "channel_cleanup_scan" | "channel_cleanup_performed" | "orphaned_channel_deleted" | "system_repair";
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
    actorId: string;
    details: {
        metadata?: Record<string, any> | undefined;
        reason?: string | undefined;
        before?: z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        after?: z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        bypassInfo?: {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        } | undefined;
    };
    _id?: string | undefined;
    channelId?: string | undefined;
    targetId?: string | undefined;
    ipAddress?: string | undefined;
    isGuildOwnerBypass?: boolean | undefined;
    businessRulesBypassed?: string[] | undefined;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}, {
    guildId: string;
    action: "staff_hired" | "staff_fired" | "staff_promoted" | "staff_demoted" | "staff_info_viewed" | "staff_list_viewed" | "role_sync_performed" | "job_created" | "job_updated" | "job_closed" | "job_removed" | "job_list_viewed" | "job_info_viewed" | "guild_owner_bypass" | "business_rule_violation" | "role_limit_bypassed" | "permission_override" | "case_created" | "case_assigned" | "case_closed" | "case_archived" | "channel_archived" | "lead_attorney_changed" | "lead_attorney_removed" | "channel_cleanup_scan" | "channel_cleanup_performed" | "orphaned_channel_deleted" | "system_repair";
    timestamp: Date;
    createdAt: string | number | Date;
    updatedAt: string | number | Date;
    actorId: string;
    details: {
        metadata?: Record<string, any> | undefined;
        reason?: string | undefined;
        before?: z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        after?: z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        bypassInfo?: {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        } | undefined;
    };
    _id?: string | import("bson").ObjectId | undefined;
    channelId?: string | undefined;
    targetId?: string | undefined;
    ipAddress?: string | undefined;
    isGuildOwnerBypass?: boolean | undefined;
    businessRulesBypassed?: string[] | undefined;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}>;
export type AuditLog = z.infer<typeof AuditLogSchema>;
/**
 * Audit log creation request schema
 * @description Validates data for creating new audit logs
 */
export declare const AuditLogCreateRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    action: z.ZodEnum<["staff_hired", "staff_fired", "staff_promoted", "staff_demoted", "staff_info_viewed", "staff_list_viewed", "role_sync_performed", "job_created", "job_updated", "job_closed", "job_removed", "job_list_viewed", "job_info_viewed", "guild_owner_bypass", "business_rule_violation", "role_limit_bypassed", "permission_override", "case_created", "case_assigned", "case_closed", "case_archived", "channel_archived", "lead_attorney_changed", "lead_attorney_removed", "channel_cleanup_scan", "channel_cleanup_performed", "orphaned_channel_deleted", "system_repair"]>;
    actorId: z.ZodString;
    targetId: z.ZodOptional<z.ZodString>;
    details: z.ZodObject<{
        before: z.ZodOptional<z.ZodObject<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
        after: z.ZodOptional<z.ZodObject<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough">>>;
        reason: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        bypassInfo: z.ZodOptional<z.ZodObject<{
            bypassType: z.ZodEnum<["guild-owner", "admin", "emergency"]>;
            businessRuleViolated: z.ZodString;
            originalValidationErrors: z.ZodArray<z.ZodString, "many">;
            bypassReason: z.ZodOptional<z.ZodString>;
            currentCount: z.ZodOptional<z.ZodNumber>;
            maxCount: z.ZodOptional<z.ZodNumber>;
            ruleMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        }, {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        metadata?: Record<string, any> | undefined;
        reason?: string | undefined;
        before?: z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        after?: z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        bypassInfo?: {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        } | undefined;
    }, {
        metadata?: Record<string, any> | undefined;
        reason?: string | undefined;
        before?: z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        after?: z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        bypassInfo?: {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        } | undefined;
    }>;
    ipAddress: z.ZodOptional<z.ZodString>;
    channelId: z.ZodOptional<z.ZodString>;
    isGuildOwnerBypass: z.ZodOptional<z.ZodBoolean>;
    businessRulesBypassed: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    action: "staff_hired" | "staff_fired" | "staff_promoted" | "staff_demoted" | "staff_info_viewed" | "staff_list_viewed" | "role_sync_performed" | "job_created" | "job_updated" | "job_closed" | "job_removed" | "job_list_viewed" | "job_info_viewed" | "guild_owner_bypass" | "business_rule_violation" | "role_limit_bypassed" | "permission_override" | "case_created" | "case_assigned" | "case_closed" | "case_archived" | "channel_archived" | "lead_attorney_changed" | "lead_attorney_removed" | "channel_cleanup_scan" | "channel_cleanup_performed" | "orphaned_channel_deleted" | "system_repair";
    actorId: string;
    details: {
        metadata?: Record<string, any> | undefined;
        reason?: string | undefined;
        before?: z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        after?: z.objectOutputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        bypassInfo?: {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        } | undefined;
    };
    channelId?: string | undefined;
    targetId?: string | undefined;
    ipAddress?: string | undefined;
    isGuildOwnerBypass?: boolean | undefined;
    businessRulesBypassed?: string[] | undefined;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}, {
    guildId: string;
    action: "staff_hired" | "staff_fired" | "staff_promoted" | "staff_demoted" | "staff_info_viewed" | "staff_list_viewed" | "role_sync_performed" | "job_created" | "job_updated" | "job_closed" | "job_removed" | "job_list_viewed" | "job_info_viewed" | "guild_owner_bypass" | "business_rule_violation" | "role_limit_bypassed" | "permission_override" | "case_created" | "case_assigned" | "case_closed" | "case_archived" | "channel_archived" | "lead_attorney_changed" | "lead_attorney_removed" | "channel_cleanup_scan" | "channel_cleanup_performed" | "orphaned_channel_deleted" | "system_repair";
    actorId: string;
    details: {
        metadata?: Record<string, any> | undefined;
        reason?: string | undefined;
        before?: z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        after?: z.objectInputType<{
            role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
            status: z.ZodOptional<z.ZodString>;
        }, z.ZodTypeAny, "passthrough"> | undefined;
        bypassInfo?: {
            bypassType: "admin" | "guild-owner" | "emergency";
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string | undefined;
            currentCount?: number | undefined;
            maxCount?: number | undefined;
            ruleMetadata?: Record<string, any> | undefined;
        } | undefined;
    };
    channelId?: string | undefined;
    targetId?: string | undefined;
    ipAddress?: string | undefined;
    isGuildOwnerBypass?: boolean | undefined;
    businessRulesBypassed?: string[] | undefined;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}>;
export type AuditLogCreateRequest = z.infer<typeof AuditLogCreateRequestSchema>;
/**
 * Audit log search filters schema
 */
export declare const AuditLogSearchFiltersSchema: z.ZodObject<{
    guildId: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodEnum<["staff_hired", "staff_fired", "staff_promoted", "staff_demoted", "staff_info_viewed", "staff_list_viewed", "role_sync_performed", "job_created", "job_updated", "job_closed", "job_removed", "job_list_viewed", "job_info_viewed", "guild_owner_bypass", "business_rule_violation", "role_limit_bypassed", "permission_override", "case_created", "case_assigned", "case_closed", "case_archived", "channel_archived", "lead_attorney_changed", "lead_attorney_removed", "channel_cleanup_scan", "channel_cleanup_performed", "orphaned_channel_deleted", "system_repair"]>>;
    actorId: z.ZodOptional<z.ZodString>;
    targetId: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    isGuildOwnerBypass: z.ZodOptional<z.ZodBoolean>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    guildId?: string | undefined;
    action?: "staff_hired" | "staff_fired" | "staff_promoted" | "staff_demoted" | "staff_info_viewed" | "staff_list_viewed" | "role_sync_performed" | "job_created" | "job_updated" | "job_closed" | "job_removed" | "job_list_viewed" | "job_info_viewed" | "guild_owner_bypass" | "business_rule_violation" | "role_limit_bypassed" | "permission_override" | "case_created" | "case_assigned" | "case_closed" | "case_archived" | "channel_archived" | "lead_attorney_changed" | "lead_attorney_removed" | "channel_cleanup_scan" | "channel_cleanup_performed" | "orphaned_channel_deleted" | "system_repair" | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    actorId?: string | undefined;
    targetId?: string | undefined;
    isGuildOwnerBypass?: boolean | undefined;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}, {
    guildId?: string | undefined;
    action?: "staff_hired" | "staff_fired" | "staff_promoted" | "staff_demoted" | "staff_info_viewed" | "staff_list_viewed" | "role_sync_performed" | "job_created" | "job_updated" | "job_closed" | "job_removed" | "job_list_viewed" | "job_info_viewed" | "guild_owner_bypass" | "business_rule_violation" | "role_limit_bypassed" | "permission_override" | "case_created" | "case_assigned" | "case_closed" | "case_archived" | "channel_archived" | "lead_attorney_changed" | "lead_attorney_removed" | "channel_cleanup_scan" | "channel_cleanup_performed" | "orphaned_channel_deleted" | "system_repair" | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    actorId?: string | undefined;
    targetId?: string | undefined;
    isGuildOwnerBypass?: boolean | undefined;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}>;
export type AuditLogSearchFilters = z.infer<typeof AuditLogSearchFiltersSchema>;
/**
 * Helper function to determine severity based on action
 */
export declare const getActionSeverity: (action: AuditAction) => AuditSeverity;
//# sourceMappingURL=audit-log.schema.d.ts.map