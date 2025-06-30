"use strict";
/**
 * @module FeedbackSchema
 * @description Zod schemas for feedback validation
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackSortOptionsSchema = exports.FeedbackSearchFiltersSchema = exports.FeedbackSubmissionSchema = exports.FeedbackSchema = exports.FeedbackRatingSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Feedback rating enum schema
 */
exports.FeedbackRatingSchema = zod_1.z.enum(['1', '2', '3', '4', '5'])
    .transform(val => parseInt(val))
    .or(zod_1.z.number().int().min(1).max(5));
/**
 * Feedback entity schema
 */
exports.FeedbackSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    submitterId: shared_1.DiscordSnowflakeSchema,
    submitterUsername: zod_1.z.string(),
    targetStaffId: shared_1.DiscordSnowflakeSchema.optional(),
    targetStaffUsername: zod_1.z.string().optional(),
    rating: exports.FeedbackRatingSchema,
    comment: zod_1.z.string().min(10).max(2000),
    isForFirm: zod_1.z.boolean(),
});
/**
 * Feedback submission validation
 */
exports.FeedbackSubmissionSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    submitterId: shared_1.DiscordSnowflakeSchema,
    submitterUsername: zod_1.z.string(),
    targetStaffId: shared_1.DiscordSnowflakeSchema.optional(),
    targetStaffUsername: zod_1.z.string().optional(),
    rating: exports.FeedbackRatingSchema,
    comment: zod_1.z.string().min(10).max(2000).transform(s => s.trim()),
}).refine((data) => {
    // If targetStaffId is provided, targetStaffUsername should also be provided
    if (data.targetStaffId && !data.targetStaffUsername) {
        return false;
    }
    return true;
}, {
    message: 'Target staff username is required when target staff ID is provided'
});
/**
 * Feedback search filters schema
 */
exports.FeedbackSearchFiltersSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    submitterId: shared_1.DiscordSnowflakeSchema.optional(),
    targetStaffId: shared_1.DiscordSnowflakeSchema.optional(),
    rating: exports.FeedbackRatingSchema.optional(),
    minRating: zod_1.z.number().int().min(1).max(5).optional(),
    maxRating: zod_1.z.number().int().min(1).max(5).optional(),
    isForFirm: zod_1.z.boolean().optional(),
    startDate: zod_1.z.date().optional(),
    endDate: zod_1.z.date().optional(),
    searchText: zod_1.z.string().optional(),
}).refine((data) => {
    // Ensure min rating is not greater than max rating
    if (data.minRating && data.maxRating && data.minRating > data.maxRating) {
        return false;
    }
    return true;
}, {
    message: 'Minimum rating cannot be greater than maximum rating'
});
/**
 * Feedback sort options schema
 */
exports.FeedbackSortOptionsSchema = zod_1.z.object({
    field: zod_1.z.enum(['createdAt', 'rating', 'submitterUsername', 'targetStaffUsername']),
    direction: zod_1.z.enum(['asc', 'desc']),
});
//# sourceMappingURL=feedback.schema.js.map