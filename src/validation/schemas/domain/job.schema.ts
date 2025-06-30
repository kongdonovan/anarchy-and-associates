/**
 * @module JobSchemas
 * @description Zod schemas for Job/Employment domain entities
 * @category Domain/Validation
 */

import { z } from 'zod';
import { 
  BaseEntitySchema, 
  DiscordSnowflakeSchema, 
  StaffRoleSchema,
  FlexibleTimestampSchema,
  MongoIdSchema
} from '../shared';

/**
 * Job status enum schema
 */
export const JobStatusSchema = z.enum(['open', 'closed', 'removed']);

export type JobStatus = z.infer<typeof JobStatusSchema>;

/**
 * Job question type enum schema
 */
export const JobQuestionTypeSchema = z.enum(['short', 'paragraph', 'number', 'choice']);

export type JobQuestionType = z.infer<typeof JobQuestionTypeSchema>;

/**
 * Job question schema
 * @description Questions for job applications
 */
export const JobQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string()
    .min(5, 'Question must be at least 5 characters')
    .max(500, 'Question must not exceed 500 characters'),
  type: JobQuestionTypeSchema,
  required: z.boolean(),
  choices: z.array(z.string()).optional(),
  placeholder: z.string().max(200).optional(),
  maxLength: z.number().int().positive().max(5000).optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
}).refine((data) => {
  // Validate choices are provided for choice type
  if (data.type === 'choice' && (!data.choices || data.choices.length === 0)) {
    return false;
  }
  // Validate number constraints
  if (data.type === 'number' && data.minValue !== undefined && data.maxValue !== undefined) {
    return data.minValue < data.maxValue;
  }
  return true;
}, {
  message: 'Invalid question configuration'
});

export type JobQuestion = z.infer<typeof JobQuestionSchema>;

/**
 * Job entity schema
 * @description Complete validation schema for job postings
 */
export const JobSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  title: z.string()
    .min(5, 'Job title must be at least 5 characters')
    .max(100, 'Job title must not exceed 100 characters'),
  description: z.string()
    .min(20, 'Job description must be at least 20 characters')
    .max(2000, 'Job description must not exceed 2000 characters'),
  staffRole: z.union([StaffRoleSchema, z.string()]), // Can be enum or custom string
  roleId: DiscordSnowflakeSchema, // Discord role ID
  limit: z.number().int().positive().optional(),
  isOpen: z.boolean(),
  questions: z.array(JobQuestionSchema).default([]),
  postedBy: DiscordSnowflakeSchema,
  closedAt: FlexibleTimestampSchema.optional(),
  closedBy: DiscordSnowflakeSchema.optional(),
  applicationCount: z.number().int().nonnegative().default(0),
  hiredCount: z.number().int().nonnegative().default(0),
});

export type Job = z.infer<typeof JobSchema>;

/**
 * Job creation request schema
 * @description Validates data for creating new job postings
 */
export const JobCreateRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(2000),
  staffRole: z.union([StaffRoleSchema, z.string()]),
  roleId: DiscordSnowflakeSchema,
  limit: z.number().int().positive().optional(),
  questions: z.array(JobQuestionSchema).optional(),
  postedBy: DiscordSnowflakeSchema,
});

export type JobCreateRequest = z.infer<typeof JobCreateRequestSchema>;

/**
 * Job update request schema
 * @description Validates partial job updates
 */
export const JobUpdateRequestSchema = JobCreateRequestSchema.partial().extend({
  isOpen: z.boolean().optional(),
});

export type JobUpdateRequest = z.infer<typeof JobUpdateRequestSchema>;

/**
 * Job search filters schema
 */
export const JobSearchFiltersSchema = z.object({
  guildId: DiscordSnowflakeSchema.optional(),
  staffRole: z.union([StaffRoleSchema, z.string()]).optional(),
  isOpen: z.boolean().optional(),
  postedBy: DiscordSnowflakeSchema.optional(),
});

export type JobSearchFilters = z.infer<typeof JobSearchFiltersSchema>;

/**
 * Job closure request schema
 */
export const JobClosureRequestSchema = z.object({
  jobId: MongoIdSchema,
  closedBy: DiscordSnowflakeSchema,
  reason: z.string().max(500).optional(),
});

export type JobClosureRequest = z.infer<typeof JobClosureRequestSchema>;

/**
 * Default job questions validation
 * @description Ensures default questions meet requirements
 */
export const validateDefaultJobQuestions = (questions: unknown[]): JobQuestion[] => {
  return z.array(JobQuestionSchema).parse(questions);
};
