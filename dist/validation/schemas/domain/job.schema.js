"use strict";
/**
 * @module JobSchemas
 * @description Zod schemas for Job/Employment domain entities
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDefaultJobQuestions = exports.JobClosureRequestSchema = exports.JobSearchFiltersSchema = exports.JobUpdateRequestSchema = exports.JobCreateRequestSchema = exports.JobSchema = exports.JobQuestionSchema = exports.JobQuestionTypeSchema = exports.JobStatusSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Job status enum schema
 */
exports.JobStatusSchema = zod_1.z.enum(['open', 'closed', 'removed']);
/**
 * Job question type enum schema
 */
exports.JobQuestionTypeSchema = zod_1.z.enum(['short', 'paragraph', 'number', 'choice']);
/**
 * Job question schema
 * @description Questions for job applications
 */
exports.JobQuestionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    question: zod_1.z.string()
        .min(5, 'Question must be at least 5 characters')
        .max(500, 'Question must not exceed 500 characters'),
    type: exports.JobQuestionTypeSchema,
    required: zod_1.z.boolean(),
    choices: zod_1.z.array(zod_1.z.string()).optional(),
    placeholder: zod_1.z.string().max(200).optional(),
    maxLength: zod_1.z.number().int().positive().max(5000).optional(),
    minValue: zod_1.z.number().optional(),
    maxValue: zod_1.z.number().optional(),
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
/**
 * Job entity schema
 * @description Complete validation schema for job postings
 */
exports.JobSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    title: zod_1.z.string()
        .min(5, 'Job title must be at least 5 characters')
        .max(100, 'Job title must not exceed 100 characters'),
    description: zod_1.z.string()
        .min(20, 'Job description must be at least 20 characters')
        .max(2000, 'Job description must not exceed 2000 characters'),
    staffRole: zod_1.z.union([shared_1.StaffRoleSchema, zod_1.z.string()]), // Can be enum or custom string
    roleId: shared_1.DiscordSnowflakeSchema, // Discord role ID
    limit: zod_1.z.number().int().positive().optional(),
    isOpen: zod_1.z.boolean(),
    questions: zod_1.z.array(exports.JobQuestionSchema).default([]),
    postedBy: shared_1.DiscordSnowflakeSchema,
    closedAt: shared_1.FlexibleTimestampSchema.optional(),
    closedBy: shared_1.DiscordSnowflakeSchema.optional(),
    applicationCount: zod_1.z.number().int().nonnegative().default(0),
    hiredCount: zod_1.z.number().int().nonnegative().default(0),
});
/**
 * Job creation request schema
 * @description Validates data for creating new job postings
 */
exports.JobCreateRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    title: zod_1.z.string().min(5).max(100),
    description: zod_1.z.string().min(20).max(2000),
    staffRole: zod_1.z.union([shared_1.StaffRoleSchema, zod_1.z.string()]),
    roleId: shared_1.DiscordSnowflakeSchema,
    limit: zod_1.z.number().int().positive().optional(),
    questions: zod_1.z.array(exports.JobQuestionSchema).optional(),
    postedBy: shared_1.DiscordSnowflakeSchema,
});
/**
 * Job update request schema
 * @description Validates partial job updates
 */
exports.JobUpdateRequestSchema = exports.JobCreateRequestSchema.partial().extend({
    isOpen: zod_1.z.boolean().optional(),
});
/**
 * Job search filters schema
 */
exports.JobSearchFiltersSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema.optional(),
    staffRole: zod_1.z.union([shared_1.StaffRoleSchema, zod_1.z.string()]).optional(),
    isOpen: zod_1.z.boolean().optional(),
    postedBy: shared_1.DiscordSnowflakeSchema.optional(),
});
/**
 * Job closure request schema
 */
exports.JobClosureRequestSchema = zod_1.z.object({
    jobId: shared_1.MongoIdSchema,
    closedBy: shared_1.DiscordSnowflakeSchema,
    reason: zod_1.z.string().max(500).optional(),
});
/**
 * Default job questions validation
 * @description Ensures default questions meet requirements
 */
const validateDefaultJobQuestions = (questions) => {
    return zod_1.z.array(exports.JobQuestionSchema).parse(questions);
};
exports.validateDefaultJobQuestions = validateDefaultJobQuestions;
//# sourceMappingURL=job.schema.js.map