/**
 * @module FeedbackSchema
 * @description Zod schemas for feedback validation
 * @category Domain/Validation
 */
import { z } from 'zod';
/**
 * Feedback rating enum schema
 */
export declare const FeedbackRatingSchema: z.ZodUnion<[z.ZodEffects<z.ZodEnum<["1", "2", "3", "4", "5"]>, number, "1" | "2" | "3" | "4" | "5">, z.ZodNumber]>;
export type FeedbackRating = z.infer<typeof FeedbackRatingSchema>;
/**
 * Feedback entity schema
 */
export declare const FeedbackSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
} & {
    guildId: z.ZodString;
    submitterId: z.ZodString;
    submitterUsername: z.ZodString;
    targetStaffId: z.ZodOptional<z.ZodString>;
    targetStaffUsername: z.ZodOptional<z.ZodString>;
    rating: z.ZodUnion<[z.ZodEffects<z.ZodEnum<["1", "2", "3", "4", "5"]>, number, "1" | "2" | "3" | "4" | "5">, z.ZodNumber]>;
    comment: z.ZodString;
    isForFirm: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    createdAt: Date;
    updatedAt: Date;
    submitterId: string;
    submitterUsername: string;
    rating: number;
    comment: string;
    isForFirm: boolean;
    _id?: string | undefined;
    targetStaffId?: string | undefined;
    targetStaffUsername?: string | undefined;
}, {
    guildId: string;
    createdAt: string | number | Date;
    updatedAt: string | number | Date;
    submitterId: string;
    submitterUsername: string;
    rating: number | "1" | "2" | "3" | "4" | "5";
    comment: string;
    isForFirm: boolean;
    _id?: string | import("bson").ObjectId | undefined;
    targetStaffId?: string | undefined;
    targetStaffUsername?: string | undefined;
}>;
export type Feedback = z.infer<typeof FeedbackSchema>;
/**
 * Feedback submission validation
 */
export declare const FeedbackSubmissionSchema: z.ZodEffects<z.ZodObject<{
    guildId: z.ZodString;
    submitterId: z.ZodString;
    submitterUsername: z.ZodString;
    targetStaffId: z.ZodOptional<z.ZodString>;
    targetStaffUsername: z.ZodOptional<z.ZodString>;
    rating: z.ZodUnion<[z.ZodEffects<z.ZodEnum<["1", "2", "3", "4", "5"]>, number, "1" | "2" | "3" | "4" | "5">, z.ZodNumber]>;
    comment: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    submitterId: string;
    submitterUsername: string;
    rating: number;
    comment: string;
    targetStaffId?: string | undefined;
    targetStaffUsername?: string | undefined;
}, {
    guildId: string;
    submitterId: string;
    submitterUsername: string;
    rating: number | "1" | "2" | "3" | "4" | "5";
    comment: string;
    targetStaffId?: string | undefined;
    targetStaffUsername?: string | undefined;
}>, {
    guildId: string;
    submitterId: string;
    submitterUsername: string;
    rating: number;
    comment: string;
    targetStaffId?: string | undefined;
    targetStaffUsername?: string | undefined;
}, {
    guildId: string;
    submitterId: string;
    submitterUsername: string;
    rating: number | "1" | "2" | "3" | "4" | "5";
    comment: string;
    targetStaffId?: string | undefined;
    targetStaffUsername?: string | undefined;
}>;
export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;
/**
 * Feedback search filters schema
 */
export declare const FeedbackSearchFiltersSchema: z.ZodEffects<z.ZodObject<{
    guildId: z.ZodString;
    submitterId: z.ZodOptional<z.ZodString>;
    targetStaffId: z.ZodOptional<z.ZodString>;
    rating: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodEnum<["1", "2", "3", "4", "5"]>, number, "1" | "2" | "3" | "4" | "5">, z.ZodNumber]>>;
    minRating: z.ZodOptional<z.ZodNumber>;
    maxRating: z.ZodOptional<z.ZodNumber>;
    isForFirm: z.ZodOptional<z.ZodBoolean>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    searchText: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    submitterId?: string | undefined;
    targetStaffId?: string | undefined;
    rating?: number | undefined;
    isForFirm?: boolean | undefined;
    minRating?: number | undefined;
    maxRating?: number | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    searchText?: string | undefined;
}, {
    guildId: string;
    submitterId?: string | undefined;
    targetStaffId?: string | undefined;
    rating?: number | "1" | "2" | "3" | "4" | "5" | undefined;
    isForFirm?: boolean | undefined;
    minRating?: number | undefined;
    maxRating?: number | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    searchText?: string | undefined;
}>, {
    guildId: string;
    submitterId?: string | undefined;
    targetStaffId?: string | undefined;
    rating?: number | undefined;
    isForFirm?: boolean | undefined;
    minRating?: number | undefined;
    maxRating?: number | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    searchText?: string | undefined;
}, {
    guildId: string;
    submitterId?: string | undefined;
    targetStaffId?: string | undefined;
    rating?: number | "1" | "2" | "3" | "4" | "5" | undefined;
    isForFirm?: boolean | undefined;
    minRating?: number | undefined;
    maxRating?: number | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    searchText?: string | undefined;
}>;
export type FeedbackSearchFilters = z.infer<typeof FeedbackSearchFiltersSchema>;
/**
 * Feedback sort options schema
 */
export declare const FeedbackSortOptionsSchema: z.ZodObject<{
    field: z.ZodEnum<["createdAt", "rating", "submitterUsername", "targetStaffUsername"]>;
    direction: z.ZodEnum<["asc", "desc"]>;
}, "strip", z.ZodTypeAny, {
    field: "createdAt" | "submitterUsername" | "targetStaffUsername" | "rating";
    direction: "asc" | "desc";
}, {
    field: "createdAt" | "submitterUsername" | "targetStaffUsername" | "rating";
    direction: "asc" | "desc";
}>;
export type FeedbackSortOptions = z.infer<typeof FeedbackSortOptionsSchema>;
//# sourceMappingURL=feedback.schema.d.ts.map