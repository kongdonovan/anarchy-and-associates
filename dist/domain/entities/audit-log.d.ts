import { BaseEntity } from './base';
import { StaffRole } from './staff-role';
export declare enum AuditAction {
    STAFF_HIRED = "staff_hired",
    STAFF_FIRED = "staff_fired",
    STAFF_PROMOTED = "staff_promoted",
    STAFF_DEMOTED = "staff_demoted",
    STAFF_INFO_VIEWED = "staff_info_viewed",
    STAFF_LIST_VIEWED = "staff_list_viewed",
    ROLE_SYNC_PERFORMED = "role_sync_performed",
    JOB_CREATED = "job_created",
    JOB_UPDATED = "job_updated",
    JOB_CLOSED = "job_closed",
    JOB_REMOVED = "job_removed",
    JOB_LIST_VIEWED = "job_list_viewed",
    JOB_INFO_VIEWED = "job_info_viewed",
    GUILD_OWNER_BYPASS = "guild_owner_bypass",
    BUSINESS_RULE_VIOLATION = "business_rule_violation",
    ROLE_LIMIT_BYPASSED = "role_limit_bypassed",
    PERMISSION_OVERRIDE = "permission_override",
    CASE_CREATED = "case_created",
    CASE_ASSIGNED = "case_assigned",
    CASE_CLOSED = "case_closed",
    CASE_ARCHIVED = "case_archived",
    CHANNEL_ARCHIVED = "channel_archived",
    LEAD_ATTORNEY_CHANGED = "lead_attorney_changed",
    LEAD_ATTORNEY_REMOVED = "lead_attorney_removed",
    CHANNEL_CLEANUP_SCAN = "channel_cleanup_scan",
    CHANNEL_CLEANUP_PERFORMED = "channel_cleanup_performed",
    ORPHANED_CHANNEL_DELETED = "orphaned_channel_deleted",
    SYSTEM_REPAIR = "system_repair"
}
export interface AuditLog extends BaseEntity {
    guildId: string;
    action: AuditAction;
    actorId: string;
    targetId?: string;
    details: {
        before?: {
            role?: StaffRole;
            status?: string;
            [key: string]: any;
        };
        after?: {
            role?: StaffRole;
            status?: string;
            [key: string]: any;
        };
        reason?: string;
        metadata?: Record<string, any>;
        bypassInfo?: {
            bypassType: 'guild-owner' | 'admin' | 'emergency';
            businessRuleViolated: string;
            originalValidationErrors: string[];
            bypassReason?: string;
            currentCount?: number;
            maxCount?: number;
            ruleMetadata?: Record<string, any>;
        };
    };
    timestamp: Date;
    ipAddress?: string;
    channelId?: string;
    isGuildOwnerBypass?: boolean;
    businessRulesBypassed?: string[];
    severity?: 'low' | 'medium' | 'high' | 'critical';
}
//# sourceMappingURL=audit-log.d.ts.map