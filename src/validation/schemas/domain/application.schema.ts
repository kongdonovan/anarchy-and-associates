/**
 * @module ApplicationSchemas
 * @description Zod schemas for Job Application domain entities
 * @category Domain/Validation
 */

import { z } from 'zod';
import { 
  BaseEntitySchema, 
  DiscordSnowflakeSchema, 
  ApplicationStatusSchema,
  FlexibleTimestampSchema,
  MongoIdSchema
} from '../shared';

/**
 * Application answer schema
 * @description Answer to a job application question
 */
export const ApplicationAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string()
    .min(1, 'Answer cannot be empty')
    .max(2000, 'Answer must not exceed 2000 characters'),
});

export type ApplicationAnswer = z.infer<typeof ApplicationAnswerSchema>;

/**
 * Application entity schema
 * @description Complete validation schema for job applications
 */
export const ApplicationSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  jobId: MongoIdSchema,
  applicantId: DiscordSnowflakeSchema,
  robloxUsername: z.string()
    .min(3, 'Roblox username must be at least 3 characters')
    .max(20, 'Roblox username must not exceed 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Invalid Roblox username format'),
  answers: z.array(ApplicationAnswerSchema),
  status: ApplicationStatusSchema,
  reviewedBy: DiscordSnowflakeSchema.optional(),
  reviewedAt: FlexibleTimestampSchema.optional(),
  reviewReason: z.string().max(500).optional(),
});

export type Application = z.infer<typeof ApplicationSchema>;

/**
 * Application submission request schema
 * @description Validates data for submitting new applications
 */
export const ApplicationSubmissionRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  jobId: MongoIdSchema,
  applicantId: DiscordSnowflakeSchema,
  robloxUsername: z.string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
  answers: z.array(ApplicationAnswerSchema),
});

export type ApplicationSubmissionRequest = z.infer<typeof ApplicationSubmissionRequestSchema>;

/**
 * Application search filters schema
 */
export const ApplicationSearchFiltersSchema = z.object({
  guildId: DiscordSnowflakeSchema.optional(),
  jobId: MongoIdSchema.optional(),
  applicantId: DiscordSnowflakeSchema.optional(),
  status: ApplicationStatusSchema.optional(),
  reviewedBy: DiscordSnowflakeSchema.optional(),
});

export type ApplicationSearchFilters = z.infer<typeof ApplicationSearchFiltersSchema>;

/**
 * Validate application answers against job questions
 * @description Ensures all required questions are answered
 */
export const validateApplicationAnswers = (
  answers: ApplicationAnswer[],
  questions: Array<{ id: string; required: boolean }>
): boolean => {
  const answeredQuestionIds = new Set(answers.map(a => a.questionId));
  
  for (const question of questions) {
    if (question.required && !answeredQuestionIds.has(question.id)) {
      return false;
    }
  }
  
  return true;
};
