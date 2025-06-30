"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditAction = void 0;
var AuditAction;
(function (AuditAction) {
    AuditAction["STAFF_HIRED"] = "staff_hired";
    AuditAction["STAFF_FIRED"] = "staff_fired";
    AuditAction["STAFF_PROMOTED"] = "staff_promoted";
    AuditAction["STAFF_DEMOTED"] = "staff_demoted";
    AuditAction["STAFF_INFO_VIEWED"] = "staff_info_viewed";
    AuditAction["STAFF_LIST_VIEWED"] = "staff_list_viewed";
    AuditAction["ROLE_SYNC_PERFORMED"] = "role_sync_performed";
    AuditAction["JOB_CREATED"] = "job_created";
    AuditAction["JOB_UPDATED"] = "job_updated";
    AuditAction["JOB_CLOSED"] = "job_closed";
    AuditAction["JOB_REMOVED"] = "job_removed";
    AuditAction["JOB_LIST_VIEWED"] = "job_list_viewed";
    AuditAction["JOB_INFO_VIEWED"] = "job_info_viewed";
    // Guild Owner Bypass Actions
    AuditAction["GUILD_OWNER_BYPASS"] = "guild_owner_bypass";
    AuditAction["BUSINESS_RULE_VIOLATION"] = "business_rule_violation";
    AuditAction["ROLE_LIMIT_BYPASSED"] = "role_limit_bypassed";
    AuditAction["PERMISSION_OVERRIDE"] = "permission_override";
    // Case Actions
    AuditAction["CASE_CREATED"] = "case_created";
    AuditAction["CASE_ASSIGNED"] = "case_assigned";
    AuditAction["CASE_CLOSED"] = "case_closed";
    AuditAction["CASE_ARCHIVED"] = "case_archived";
    AuditAction["CHANNEL_ARCHIVED"] = "channel_archived";
    // Lead Attorney Actions  
    AuditAction["LEAD_ATTORNEY_CHANGED"] = "lead_attorney_changed";
    AuditAction["LEAD_ATTORNEY_REMOVED"] = "lead_attorney_removed";
    // Channel Cleanup Actions
    AuditAction["CHANNEL_CLEANUP_SCAN"] = "channel_cleanup_scan";
    AuditAction["CHANNEL_CLEANUP_PERFORMED"] = "channel_cleanup_performed";
    AuditAction["ORPHANED_CHANNEL_DELETED"] = "orphaned_channel_deleted";
    // System Maintenance Actions
    AuditAction["SYSTEM_REPAIR"] = "system_repair";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
//# sourceMappingURL=audit-log.js.map