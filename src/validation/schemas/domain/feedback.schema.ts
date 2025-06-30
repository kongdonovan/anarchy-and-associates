/**
 * @module FeedbackSchema
 * @description Zod schemas for feedback validation
 * @category Domain/Validation
 */

import { z } from 'zod';
import { BaseEntitySchema, DiscordSnowflakeSchema } from '../shared';

/**
 * Feedback rating enum schema
 */
export const FeedbackRatingSchema = z.enum(['1', '2', '3', '4', '5'])
  .transform(val => parseInt(val))
  .or(z.number().int().min(1).max(5));

export type FeedbackRating = z.infer<typeof FeedbackRatingSchema>;

/**
 * Feedback entity schema
 */
export const FeedbackSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  submitterId: DiscordSnowflakeSchema,
  submitterUsername: z.string(),
  targetStaffId: DiscordSnowflakeSchema.optional(),
  targetStaffUsername: z.string().optional(),
  rating: FeedbackRatingSchema,
  comment: z.string().min(10).max(2000),
  isForFirm: z.boolean(),
});

export type Feedback = z.infer<typeof FeedbackSchema>;

/**
 * Feedback submission validation
 */
export const FeedbackSubmissionSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  submitterId: DiscordSnowflakeSchema,
  submitterUsername: z.string(),
  targetStaffId: DiscordSnowflakeSchema.optional(),
  targetStaffUsername: z.string().optional(),
  rating: FeedbackRatingSchema,
  comment: z.string().min(10).max(2000).transform(s => s.trim()),
}).refine((data) => {
  // If targetStaffId is provided, targetStaffUsername should also be provided
  if (data.targetStaffId && !data.targetStaffUsername) {
    return false;
  }
  return true;
}, {
  message: 'Target staff username is required when target staff ID is provided'
});

export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;

/**
 * Feedback search filters schema
 */
export const FeedbackSearchFiltersSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  submitterId: DiscordSnowflakeSchema.optional(),
  targetStaffId: DiscordSnowflakeSchema.optional(),
  rating: FeedbackRatingSchema.optional(),
  minRating: z.number().int().min(1).max(5).optional(),
  maxRating: z.number().int().min(1).max(5).optional(),
  isForFirm: z.boolean().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  searchText: z.string().optional(),
}).refine((data) => {
  // Ensure min rating is not greater than max rating
  if (data.minRating && data.maxRating && data.minRating > data.maxRating) {
    return false;
  }
  return true;
}, {
  message: 'Minimum rating cannot be greater than maximum rating'
});

export type FeedbackSearchFilters = z.infer<typeof FeedbackSearchFiltersSchema>;

/**
 * Feedback sort options schema
 */
export const FeedbackSortOptionsSchema = z.object({
  field: z.enum(['createdAt', 'rating', 'submitterUsername', 'targetStaffUsername']),
  direction: z.enum(['asc', 'desc']),
});

export type FeedbackSortOptions = z.infer<typeof FeedbackSortOptionsSchema>;