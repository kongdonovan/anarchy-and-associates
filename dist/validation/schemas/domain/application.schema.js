"use strict";
/**
 * @module ApplicationSchemas
 * @description Zod schemas for Job Application domain entities
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApplicationAnswers = exports.ApplicationSearchFiltersSchema = exports.ApplicationSubmissionRequestSchema = exports.ApplicationSchema = exports.ApplicationAnswerSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Application answer schema
 * @description Answer to a job application question
 */
exports.ApplicationAnswerSchema = zod_1.z.object({
    questionId: zod_1.z.string().uuid(),
    answer: zod_1.z.string()
        .min(1, 'Answer cannot be empty')
        .max(2000, 'Answer must not exceed 2000 characters'),
});
/**
 * Application entity schema
 * @description Complete validation schema for job applications
 */
exports.ApplicationSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    jobId: shared_1.MongoIdSchema,
    applicantId: shared_1.DiscordSnowflakeSchema,
    robloxUsername: zod_1.z.string()
        .min(3, 'Roblox username must be at least 3 characters')
        .max(20, 'Roblox username must not exceed 20 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Invalid Roblox username format'),
    answers: zod_1.z.array(exports.ApplicationAnswerSchema),
    status: shared_1.ApplicationStatusSchema,
    reviewedBy: shared_1.DiscordSnowflakeSchema.optional(),
    reviewedAt: shared_1.FlexibleTimestampSchema.optional(),
    reviewReason: zod_1.z.string().max(500).optional(),
});
/**
 * Application submission request schema
 * @description Validates data for submitting new applications
 */
exports.ApplicationSubmissionRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    jobId: shared_1.MongoIdSchema,
    applicantId: shared_1.DiscordSnowflakeSchema,
    robloxUsername: zod_1.z.string()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/),
    answers: zod_1.z.array(exports.ApplicationAnswerSchema),
});
/**
 * Application search filters schema
 */
exports.ApplicationSearchFiltersSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema.optional(),
    jobId: shared_1.MongoIdSchema.optional(),
    applicantId: shared_1.DiscordSnowflakeSchema.optional(),
    status: shared_1.ApplicationStatusSchema.optional(),
    reviewedBy: shared_1.DiscordSnowflakeSchema.optional(),
});
/**
 * Validate application answers against job questions
 * @description Ensures all required questions are answered
 */
const validateApplicationAnswers = (answers, questions) => {
    const answeredQuestionIds = new Set(answers.map(a => a.questionId));
    for (const question of questions) {
        if (question.required && !answeredQuestionIds.has(question.id)) {
            return false;
        }
    }
    return true;
};
exports.validateApplicationAnswers = validateApplicationAnswers;
//# sourceMappingURL=application.schema.js.map