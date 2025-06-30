/**
 * @module PermissionSchemas
 * @description Zod schemas for permission and authorization structures
 * @category Application/Validation
 */
import { z } from 'zod';
/**
 * Permission context schema
 * @description Runtime context for permission checks
 */
export declare const PermissionContextSchema: z.ZodObject<{
    userId: z.ZodString;
    guildId: z.ZodString;
    isGuildOwner: z.ZodBoolean;
    hasAdminRole: z.ZodBoolean;
    hasSeniorStaffRole: z.ZodOptional<z.ZodBoolean>;
    hasHRRole: z.ZodOptional<z.ZodBoolean>;
    hasCaseRole: z.ZodOptional<z.ZodBoolean>;
    hasConfigRole: z.ZodOptional<z.ZodBoolean>;
    hasLawyerRole: z.ZodOptional<z.ZodBoolean>;
    hasLeadAttorneyRole: z.ZodOptional<z.ZodBoolean>;
    hasRepairRole: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    userId: string;
    isGuildOwner: boolean;
    hasAdminRole: boolean;
    hasSeniorStaffRole?: boolean | undefined;
    hasHRRole?: boolean | undefined;
    hasCaseRole?: boolean | undefined;
    hasConfigRole?: boolean | undefined;
    hasLawyerRole?: boolean | undefined;
    hasLeadAttorneyRole?: boolean | undefined;
    hasRepairRole?: boolean | undefined;
}, {
    guildId: string;
    userId: string;
    isGuildOwner: boolean;
    hasAdminRole: boolean;
    hasSeniorStaffRole?: boolean | undefined;
    hasHRRole?: boolean | undefined;
    hasCaseRole?: boolean | undefined;
    hasConfigRole?: boolean | undefined;
    hasLawyerRole?: boolean | undefined;
    hasLeadAttorneyRole?: boolean | undefined;
    hasRepairRole?: boolean | undefined;
}>;
export type PermissionContext = z.infer<typeof PermissionContextSchema>;
/**
 * Permission check request schema
 * @description Request to check if user has specific permission
 */
export declare const PermissionCheckRequestSchema: z.ZodObject<{
    context: z.ZodObject<{
        userId: z.ZodString;
        guildId: z.ZodString;
        isGuildOwner: z.ZodBoolean;
        hasAdminRole: z.ZodBoolean;
        hasSeniorStaffRole: z.ZodOptional<z.ZodBoolean>;
        hasHRRole: z.ZodOptional<z.ZodBoolean>;
        hasCaseRole: z.ZodOptional<z.ZodBoolean>;
        hasConfigRole: z.ZodOptional<z.ZodBoolean>;
        hasLawyerRole: z.ZodOptional<z.ZodBoolean>;
        hasLeadAttorneyRole: z.ZodOptional<z.ZodBoolean>;
        hasRepairRole: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        userId: string;
        isGuildOwner: boolean;
        hasAdminRole: boolean;
        hasSeniorStaffRole?: boolean | undefined;
        hasHRRole?: boolean | undefined;
        hasCaseRole?: boolean | undefined;
        hasConfigRole?: boolean | undefined;
        hasLawyerRole?: boolean | undefined;
        hasLeadAttorneyRole?: boolean | undefined;
        hasRepairRole?: boolean | undefined;
    }, {
        guildId: string;
        userId: string;
        isGuildOwner: boolean;
        hasAdminRole: boolean;
        hasSeniorStaffRole?: boolean | undefined;
        hasHRRole?: boolean | undefined;
        hasCaseRole?: boolean | undefined;
        hasConfigRole?: boolean | undefined;
        hasLawyerRole?: boolean | undefined;
        hasLeadAttorneyRole?: boolean | undefined;
        hasRepairRole?: boolean | undefined;
    }>;
    action: z.ZodEnum<["admin", "senior-staff", "case", "config", "lawyer", "lead-attorney", "repair"]>;
    targetUserId: z.ZodOptional<z.ZodString>;
    targetRoleLevel: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair";
    context: {
        guildId: string;
        userId: string;
        isGuildOwner: boolean;
        hasAdminRole: boolean;
        hasSeniorStaffRole?: boolean | undefined;
        hasHRRole?: boolean | undefined;
        hasCaseRole?: boolean | undefined;
        hasConfigRole?: boolean | undefined;
        hasLawyerRole?: boolean | undefined;
        hasLeadAttorneyRole?: boolean | undefined;
        hasRepairRole?: boolean | undefined;
    };
    targetUserId?: string | undefined;
    targetRoleLevel?: number | undefined;
}, {
    action: "admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair";
    context: {
        guildId: string;
        userId: string;
        isGuildOwner: boolean;
        hasAdminRole: boolean;
        hasSeniorStaffRole?: boolean | undefined;
        hasHRRole?: boolean | undefined;
        hasCaseRole?: boolean | undefined;
        hasConfigRole?: boolean | undefined;
        hasLawyerRole?: boolean | undefined;
        hasLeadAttorneyRole?: boolean | undefined;
        hasRepairRole?: boolean | undefined;
    };
    targetUserId?: string | undefined;
    targetRoleLevel?: number | undefined;
}>;
export type PermissionCheckRequest = z.infer<typeof PermissionCheckRequestSchema>;
/**
 * Permission grant request schema
 * @description Request to grant permissions to a role
 */
export declare const PermissionGrantRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    roleId: z.ZodString;
    action: z.ZodEnum<["admin", "senior-staff", "case", "config", "lawyer", "lead-attorney", "repair"]>;
    grantedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    action: "admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair";
    roleId: string;
    grantedBy: string;
}, {
    guildId: string;
    action: "admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair";
    roleId: string;
    grantedBy: string;
}>;
export type PermissionGrantRequest = z.infer<typeof PermissionGrantRequestSchema>;
/**
 * Permission revoke request schema
 * @description Request to revoke permissions from a role
 */
export declare const PermissionRevokeRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    roleId: z.ZodString;
    action: z.ZodEnum<["admin", "senior-staff", "case", "config", "lawyer", "lead-attorney", "repair"]>;
    revokedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    action: "admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair";
    roleId: string;
    revokedBy: string;
}, {
    guildId: string;
    action: "admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair";
    roleId: string;
    revokedBy: string;
}>;
export type PermissionRevokeRequest = z.infer<typeof PermissionRevokeRequestSchema>;
/**
 * Action permission result schema
 * @description Result of permission check for an action
 */
export declare const ActionPermissionResultSchema: z.ZodObject<{
    allowed: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodString>;
    requiredRole: z.ZodOptional<z.ZodString>;
    userRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    allowed: boolean;
    reason?: string | undefined;
    requiredRole?: string | undefined;
    userRoles?: string[] | undefined;
}, {
    allowed: boolean;
    reason?: string | undefined;
    requiredRole?: string | undefined;
    userRoles?: string[] | undefined;
}>;
export type ActionPermissionResult = z.infer<typeof ActionPermissionResultSchema>;
/**
 * Bulk permission check request schema
 * @description Check multiple permissions at once
 */
export declare const BulkPermissionCheckRequestSchema: z.ZodObject<{
    context: z.ZodObject<{
        userId: z.ZodString;
        guildId: z.ZodString;
        isGuildOwner: z.ZodBoolean;
        hasAdminRole: z.ZodBoolean;
        hasSeniorStaffRole: z.ZodOptional<z.ZodBoolean>;
        hasHRRole: z.ZodOptional<z.ZodBoolean>;
        hasCaseRole: z.ZodOptional<z.ZodBoolean>;
        hasConfigRole: z.ZodOptional<z.ZodBoolean>;
        hasLawyerRole: z.ZodOptional<z.ZodBoolean>;
        hasLeadAttorneyRole: z.ZodOptional<z.ZodBoolean>;
        hasRepairRole: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        userId: string;
        isGuildOwner: boolean;
        hasAdminRole: boolean;
        hasSeniorStaffRole?: boolean | undefined;
        hasHRRole?: boolean | undefined;
        hasCaseRole?: boolean | undefined;
        hasConfigRole?: boolean | undefined;
        hasLawyerRole?: boolean | undefined;
        hasLeadAttorneyRole?: boolean | undefined;
        hasRepairRole?: boolean | undefined;
    }, {
        guildId: string;
        userId: string;
        isGuildOwner: boolean;
        hasAdminRole: boolean;
        hasSeniorStaffRole?: boolean | undefined;
        hasHRRole?: boolean | undefined;
        hasCaseRole?: boolean | undefined;
        hasConfigRole?: boolean | undefined;
        hasLawyerRole?: boolean | undefined;
        hasLeadAttorneyRole?: boolean | undefined;
        hasRepairRole?: boolean | undefined;
    }>;
    actions: z.ZodArray<z.ZodEnum<["admin", "senior-staff", "case", "config", "lawyer", "lead-attorney", "repair"]>, "many">;
}, "strip", z.ZodTypeAny, {
    context: {
        guildId: string;
        userId: string;
        isGuildOwner: boolean;
        hasAdminRole: boolean;
        hasSeniorStaffRole?: boolean | undefined;
        hasHRRole?: boolean | undefined;
        hasCaseRole?: boolean | undefined;
        hasConfigRole?: boolean | undefined;
        hasLawyerRole?: boolean | undefined;
        hasLeadAttorneyRole?: boolean | undefined;
        hasRepairRole?: boolean | undefined;
    };
    actions: ("admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair")[];
}, {
    context: {
        guildId: string;
        userId: string;
        isGuildOwner: boolean;
        hasAdminRole: boolean;
        hasSeniorStaffRole?: boolean | undefined;
        hasHRRole?: boolean | undefined;
        hasCaseRole?: boolean | undefined;
        hasConfigRole?: boolean | undefined;
        hasLawyerRole?: boolean | undefined;
        hasLeadAttorneyRole?: boolean | undefined;
        hasRepairRole?: boolean | undefined;
    };
    actions: ("admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair")[];
}>;
export type BulkPermissionCheckRequest = z.infer<typeof BulkPermissionCheckRequestSchema>;
/**
 * Bulk permission check result schema
 */
export declare const BulkPermissionCheckResultSchema: z.ZodObject<{
    results: z.ZodRecord<z.ZodEnum<["admin", "senior-staff", "case", "config", "lawyer", "lead-attorney", "repair"]>, z.ZodObject<{
        allowed: z.ZodBoolean;
        reason: z.ZodOptional<z.ZodString>;
        requiredRole: z.ZodOptional<z.ZodString>;
        userRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        allowed: boolean;
        reason?: string | undefined;
        requiredRole?: string | undefined;
        userRoles?: string[] | undefined;
    }, {
        allowed: boolean;
        reason?: string | undefined;
        requiredRole?: string | undefined;
        userRoles?: string[] | undefined;
    }>>;
    allAllowed: z.ZodBoolean;
    anyAllowed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    results: Partial<Record<"admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair", {
        allowed: boolean;
        reason?: string | undefined;
        requiredRole?: string | undefined;
        userRoles?: string[] | undefined;
    }>>;
    allAllowed: boolean;
    anyAllowed: boolean;
}, {
    results: Partial<Record<"admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair", {
        allowed: boolean;
        reason?: string | undefined;
        requiredRole?: string | undefined;
        userRoles?: string[] | undefined;
    }>>;
    allAllowed: boolean;
    anyAllowed: boolean;
}>;
export type BulkPermissionCheckResult = z.infer<typeof BulkPermissionCheckResultSchema>;
//# sourceMappingURL=permission.schema.d.ts.map