/**
 * @module StaffSchemas
 * @description Zod schemas for Staff domain entities
 * @category Domain/Validation
 */
import { z } from 'zod';
/**
 * Promotion action type schema
 */
export declare const PromotionActionTypeSchema: z.ZodEnum<["promotion", "demotion", "hire", "fire"]>;
export type PromotionActionType = z.infer<typeof PromotionActionTypeSchema>;
/**
 * Promotion record schema
 * @description Tracks staff role transitions and employment history
 */
export declare const PromotionRecordSchema: z.ZodObject<{
    fromRole: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
    toRole: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
    promotedBy: z.ZodString;
    promotedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    reason: z.ZodOptional<z.ZodString>;
    actionType: z.ZodEnum<["promotion", "demotion", "hire", "fire"]>;
}, "strip", z.ZodTypeAny, {
    fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    promotedBy: string;
    promotedAt: Date;
    actionType: "promotion" | "demotion" | "hire" | "fire";
    reason?: string | undefined;
}, {
    fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    promotedBy: string;
    promotedAt: string | number | Date;
    actionType: "promotion" | "demotion" | "hire" | "fire";
    reason?: string | undefined;
}>;
export type PromotionRecord = z.infer<typeof PromotionRecordSchema>;
/**
 * Staff employment status schema
 */
export declare const StaffEmploymentStatusSchema: z.ZodEnum<["active", "inactive", "terminated"]>;
export type StaffEmploymentStatus = z.infer<typeof StaffEmploymentStatusSchema>;
/**
 * Staff entity schema
 * @description Complete validation schema for staff members
 */
export declare const StaffSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
} & {
    userId: z.ZodString;
    guildId: z.ZodString;
    robloxUsername: z.ZodString;
    role: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
    hiredAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    hiredBy: z.ZodString;
    promotionHistory: z.ZodDefault<z.ZodArray<z.ZodObject<{
        fromRole: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
        toRole: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
        promotedBy: z.ZodString;
        promotedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
        reason: z.ZodOptional<z.ZodString>;
        actionType: z.ZodEnum<["promotion", "demotion", "hire", "fire"]>;
    }, "strip", z.ZodTypeAny, {
        fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        promotedBy: string;
        promotedAt: Date;
        actionType: "promotion" | "demotion" | "hire" | "fire";
        reason?: string | undefined;
    }, {
        fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        promotedBy: string;
        promotedAt: string | number | Date;
        actionType: "promotion" | "demotion" | "hire" | "fire";
        reason?: string | undefined;
    }>, "many">>;
    status: z.ZodEnum<["active", "inactive", "terminated"]>;
    discordRoleId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    userId: string;
    createdAt: Date;
    status: "active" | "terminated" | "inactive";
    updatedAt: Date;
    robloxUsername: string;
    role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    hiredAt: Date;
    hiredBy: string;
    promotionHistory: {
        fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        promotedBy: string;
        promotedAt: Date;
        actionType: "promotion" | "demotion" | "hire" | "fire";
        reason?: string | undefined;
    }[];
    _id?: string | undefined;
    discordRoleId?: string | undefined;
}, {
    guildId: string;
    userId: string;
    createdAt: string | number | Date;
    status: "active" | "terminated" | "inactive";
    updatedAt: string | number | Date;
    robloxUsername: string;
    role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    hiredAt: string | number | Date;
    hiredBy: string;
    _id?: string | import("bson").ObjectId | undefined;
    promotionHistory?: {
        fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        promotedBy: string;
        promotedAt: string | number | Date;
        actionType: "promotion" | "demotion" | "hire" | "fire";
        reason?: string | undefined;
    }[] | undefined;
    discordRoleId?: string | undefined;
}>;
export type Staff = z.infer<typeof StaffSchema>;
/**
 * Staff creation request schema
 * @description Validates data for creating new staff members
 */
export declare const StaffCreateRequestSchema: z.ZodObject<{
    userId: z.ZodString;
    guildId: z.ZodString;
    robloxUsername: z.ZodString;
    role: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
    hiredBy: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    userId: string;
    robloxUsername: string;
    role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    hiredBy: string;
    reason?: string | undefined;
}, {
    guildId: string;
    userId: string;
    robloxUsername: string;
    role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    hiredBy: string;
    reason?: string | undefined;
}>;
export type StaffCreateRequest = z.infer<typeof StaffCreateRequestSchema>;
/**
 * Staff update request schema
 * @description Validates partial updates to staff members
 */
export declare const StaffUpdateRequestSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    guildId: z.ZodOptional<z.ZodString>;
    robloxUsername: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
    hiredBy: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodOptional<z.ZodString>>;
} & {
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "terminated"]>>;
    discordRoleId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId?: string | undefined;
    userId?: string | undefined;
    status?: "active" | "terminated" | "inactive" | undefined;
    reason?: string | undefined;
    robloxUsername?: string | undefined;
    role?: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal" | undefined;
    hiredBy?: string | undefined;
    discordRoleId?: string | undefined;
}, {
    guildId?: string | undefined;
    userId?: string | undefined;
    status?: "active" | "terminated" | "inactive" | undefined;
    reason?: string | undefined;
    robloxUsername?: string | undefined;
    role?: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal" | undefined;
    hiredBy?: string | undefined;
    discordRoleId?: string | undefined;
}>;
export type StaffUpdateRequest = z.infer<typeof StaffUpdateRequestSchema>;
/**
 * Staff search filters schema
 */
export declare const StaffSearchFiltersSchema: z.ZodObject<{
    guildId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "terminated"]>>;
    roles: z.ZodOptional<z.ZodArray<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    guildId?: string | undefined;
    userId?: string | undefined;
    roles?: ("Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal")[] | undefined;
    status?: "active" | "terminated" | "inactive" | undefined;
    role?: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal" | undefined;
}, {
    guildId?: string | undefined;
    userId?: string | undefined;
    roles?: ("Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal")[] | undefined;
    status?: "active" | "terminated" | "inactive" | undefined;
    role?: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal" | undefined;
}>;
export type StaffSearchFilters = z.infer<typeof StaffSearchFiltersSchema>;
/**
 * Staff role change request schema
 */
export declare const StaffRoleChangeRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    userId: z.ZodString;
    newRole: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
    promotedBy: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    userId: string;
    promotedBy: string;
    newRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    reason?: string | undefined;
}, {
    guildId: string;
    userId: string;
    promotedBy: string;
    newRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    reason?: string | undefined;
}>;
export type StaffRoleChangeRequest = z.infer<typeof StaffRoleChangeRequestSchema>;
/**
 * Staff termination request schema
 */
export declare const StaffTerminationRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    userId: z.ZodString;
    terminatedBy: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    userId: string;
    terminatedBy: string;
    reason?: string | undefined;
}, {
    guildId: string;
    userId: string;
    terminatedBy: string;
    reason?: string | undefined;
}>;
export type StaffTerminationRequest = z.infer<typeof StaffTerminationRequestSchema>;
//# sourceMappingURL=staff.schema.d.ts.map