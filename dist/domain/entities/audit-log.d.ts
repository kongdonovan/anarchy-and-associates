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
    JOB_INFO_VIEWED = "job_info_viewed"
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
    };
    timestamp: Date;
    ipAddress?: string;
    channelId?: string;
}
//# sourceMappingURL=audit-log.d.ts.map