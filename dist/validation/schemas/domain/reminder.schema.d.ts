/**
 * @module ReminderSchemas
 * @description Zod schemas for reminder domain entities
 * @category Domain/Validation
 */
import { z } from 'zod';
/**
 * Reminder type enum schema
 */
export declare const ReminderTypeSchema: z.ZodEnum<["custom", "case_update", "court_date", "filing_deadline", "meeting", "follow_up"]>;
export type ReminderType = z.infer<typeof ReminderTypeSchema>;
/**
 * Reminder entity schema
 */
export declare const ReminderSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
} & {
    guildId: z.ZodString;
    userId: z.ZodString;
    username: z.ZodString;
    channelId: z.ZodString;
    message: z.ZodString;
    scheduledFor: z.ZodDate;
    type: z.ZodDefault<z.ZodEnum<["custom", "case_update", "court_date", "filing_deadline", "meeting", "follow_up"]>>;
    caseId: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    deliveredAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    userId: string;
    type: "custom" | "case_update" | "court_date" | "filing_deadline" | "meeting" | "follow_up";
    createdAt: Date;
    message: string;
    updatedAt: Date;
    channelId: string;
    username: string;
    scheduledFor: Date;
    isActive: boolean;
    metadata?: Record<string, unknown> | undefined;
    _id?: string | undefined;
    caseId?: string | undefined;
    deliveredAt?: Date | undefined;
}, {
    guildId: string;
    userId: string;
    createdAt: string | number | Date;
    message: string;
    updatedAt: string | number | Date;
    channelId: string;
    username: string;
    scheduledFor: Date;
    metadata?: Record<string, unknown> | undefined;
    type?: "custom" | "case_update" | "court_date" | "filing_deadline" | "meeting" | "follow_up" | undefined;
    _id?: string | import("bson").ObjectId | undefined;
    caseId?: string | import("bson").ObjectId | undefined;
    isActive?: boolean | undefined;
    deliveredAt?: Date | undefined;
}>;
export type Reminder = z.infer<typeof ReminderSchema>;
/**
 * Reminder creation request schema
 */
export declare const ReminderCreationRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    userId: z.ZodString;
    username: z.ZodString;
    channelId: z.ZodString;
    message: z.ZodString;
    scheduledFor: z.ZodDate;
    type: z.ZodOptional<z.ZodEnum<["custom", "case_update", "court_date", "filing_deadline", "meeting", "follow_up"]>>;
    caseId: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    userId: string;
    message: string;
    channelId: string;
    username: string;
    scheduledFor: Date;
    metadata?: Record<string, unknown> | undefined;
    type?: "custom" | "case_update" | "court_date" | "filing_deadline" | "meeting" | "follow_up" | undefined;
    caseId?: string | undefined;
}, {
    guildId: string;
    userId: string;
    message: string;
    channelId: string;
    username: string;
    scheduledFor: Date;
    metadata?: Record<string, unknown> | undefined;
    type?: "custom" | "case_update" | "court_date" | "filing_deadline" | "meeting" | "follow_up" | undefined;
    caseId?: string | import("bson").ObjectId | undefined;
}>;
export type ReminderCreationRequest = z.infer<typeof ReminderCreationRequestSchema>;
/**
 * Reminder search filters schema
 */
export declare const ReminderSearchFiltersSchema: z.ZodObject<{
    guildId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["custom", "case_update", "court_date", "filing_deadline", "meeting", "follow_up"]>>;
    caseId: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    channelId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    guildId?: string | undefined;
    userId?: string | undefined;
    type?: "custom" | "case_update" | "court_date" | "filing_deadline" | "meeting" | "follow_up" | undefined;
    channelId?: string | undefined;
    caseId?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    isActive?: boolean | undefined;
}, {
    guildId?: string | undefined;
    userId?: string | undefined;
    type?: "custom" | "case_update" | "court_date" | "filing_deadline" | "meeting" | "follow_up" | undefined;
    channelId?: string | undefined;
    caseId?: string | import("bson").ObjectId | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    isActive?: boolean | undefined;
}>;
export type ReminderSearchFilters = z.infer<typeof ReminderSearchFiltersSchema>;
/**
 * Reminder sort options schema
 */
export declare const ReminderSortOptionsSchema: z.ZodObject<{
    field: z.ZodDefault<z.ZodEnum<["scheduledFor", "createdAt", "type"]>>;
    order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    field: "type" | "createdAt" | "scheduledFor";
    order: "asc" | "desc";
}, {
    field?: "type" | "createdAt" | "scheduledFor" | undefined;
    order?: "asc" | "desc" | undefined;
}>;
export type ReminderSortOptions = z.infer<typeof ReminderSortOptionsSchema>;
//# sourceMappingURL=reminder.schema.d.ts.map