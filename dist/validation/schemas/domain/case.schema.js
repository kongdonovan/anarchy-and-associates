"use strict";
/**
 * @module CaseSchemas
 * @description Zod schemas for Case domain entities
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddNoteRequestSchema = exports.AddDocumentRequestSchema = exports.CaseSearchFiltersSchema = exports.CaseClosureRequestSchema = exports.CaseCounterSchema = exports.CaseUpdateRequestSchema = exports.CaseAssignmentRequestSchema = exports.CaseCreationRequestSchema = exports.CaseSchema = exports.CaseNoteSchema = exports.CaseDocumentSchema = exports.CaseResultSchema = exports.CasePrioritySchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Case priority enum schema
 * @description Defines urgency levels for case handling
 */
exports.CasePrioritySchema = zod_1.z.enum(['low', 'medium', 'high', 'urgent']);
/**
 * Case result enum schema
 * @description Possible outcomes when a case is closed
 */
exports.CaseResultSchema = zod_1.z.enum(['win', 'loss', 'settlement', 'dismissed', 'withdrawn']);
/**
 * Case document schema
 * @description Document attached to a case (evidence, contracts, etc.)
 */
exports.CaseDocumentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1).max(200),
    content: zod_1.z.string().min(1).max(10000), // Can contain URLs or text
    createdBy: shared_1.DiscordSnowflakeSchema,
    createdAt: shared_1.FlexibleTimestampSchema,
});
/**
 * Case note schema
 * @description Notes and updates about a case
 */
exports.CaseNoteSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    content: zod_1.z.string().min(1).max(2000),
    createdBy: shared_1.DiscordSnowflakeSchema,
    createdAt: shared_1.FlexibleTimestampSchema,
    isInternal: zod_1.z.boolean(), // Whether note is visible to client
});
/**
 * Case number validation regex
 * @description Format: AA-YYYY-NNNN-username
 */
const CASE_NUMBER_REGEX = /^AA-\d{4}-\d{4}-[a-zA-Z0-9_]+$/;
/**
 * Case entity schema
 * @description Complete validation schema for legal cases
 */
exports.CaseSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    caseNumber: zod_1.z.string().regex(CASE_NUMBER_REGEX, 'Invalid case number format'),
    clientId: shared_1.DiscordSnowflakeSchema,
    clientUsername: zod_1.z.string().min(1).max(32),
    title: zod_1.z.string()
        .min(5, 'Case title must be at least 5 characters')
        .max(200, 'Case title must not exceed 200 characters'),
    description: zod_1.z.string()
        .min(20, 'Case description must be at least 20 characters')
        .max(2000, 'Case description must not exceed 2000 characters'),
    status: shared_1.CaseStatusSchema,
    priority: exports.CasePrioritySchema,
    leadAttorneyId: shared_1.DiscordSnowflakeSchema.optional(),
    assignedLawyerIds: zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
    channelId: shared_1.DiscordSnowflakeSchema.optional(),
    result: exports.CaseResultSchema.optional(),
    resultNotes: zod_1.z.string().max(2000).optional(),
    closedAt: shared_1.FlexibleTimestampSchema.optional(),
    closedBy: shared_1.DiscordSnowflakeSchema.optional(),
    documents: zod_1.z.array(exports.CaseDocumentSchema).default([]),
    notes: zod_1.z.array(exports.CaseNoteSchema).default([]),
});
/**
 * Case creation request schema
 * @description Validates data for creating new cases
 */
exports.CaseCreationRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    clientId: shared_1.DiscordSnowflakeSchema,
    clientUsername: zod_1.z.string().min(1).max(32),
    title: zod_1.z.string().min(5).max(200),
    description: zod_1.z.string().min(20).max(2000),
    priority: exports.CasePrioritySchema.default('medium'),
});
/**
 * Case assignment request schema
 * @description Validates lawyer assignment requests
 */
exports.CaseAssignmentRequestSchema = zod_1.z.object({
    caseId: shared_1.MongoIdSchema,
    lawyerIds: zod_1.z.array(shared_1.DiscordSnowflakeSchema).min(1),
    leadAttorneyId: shared_1.DiscordSnowflakeSchema.optional(),
    assignedBy: shared_1.DiscordSnowflakeSchema,
});
/**
 * Case update request schema
 * @description Validates partial case updates
 */
exports.CaseUpdateRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(5).max(200).optional(),
    description: zod_1.z.string().min(20).max(2000).optional(),
    priority: exports.CasePrioritySchema.optional(),
    status: shared_1.CaseStatusSchema.optional(),
    channelId: shared_1.DiscordSnowflakeSchema.optional(),
});
/**
 * Case Counter schema
 * @description Tracks case numbers per guild per year
 */
exports.CaseCounterSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    year: zod_1.z.number().int().min(2000).max(3000),
    count: zod_1.z.number().int().min(0),
});
/**
 * Case closure request schema
 * @description Validates case closure data
 */
exports.CaseClosureRequestSchema = zod_1.z.object({
    caseId: shared_1.MongoIdSchema,
    result: exports.CaseResultSchema,
    resultNotes: zod_1.z.string().max(2000).optional(),
    closedBy: shared_1.DiscordSnowflakeSchema,
});
/**
 * Case search filters schema
 */
exports.CaseSearchFiltersSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema.optional(),
    clientId: shared_1.DiscordSnowflakeSchema.optional(),
    status: shared_1.CaseStatusSchema.optional(),
    priority: exports.CasePrioritySchema.optional(),
    leadAttorneyId: shared_1.DiscordSnowflakeSchema.optional(),
    assignedLawyerId: shared_1.DiscordSnowflakeSchema.optional(),
    caseNumber: zod_1.z.string().optional(),
});
/**
 * Add document request schema
 */
exports.AddDocumentRequestSchema = zod_1.z.object({
    caseId: shared_1.MongoIdSchema,
    title: zod_1.z.string().min(1).max(200),
    content: zod_1.z.string().min(1).max(10000),
    createdBy: shared_1.DiscordSnowflakeSchema,
});
/**
 * Add note request schema
 */
exports.AddNoteRequestSchema = zod_1.z.object({
    caseId: shared_1.MongoIdSchema,
    content: zod_1.z.string().min(1).max(2000),
    createdBy: shared_1.DiscordSnowflakeSchema,
    isInternal: zod_1.z.boolean().default(false),
});
//# sourceMappingURL=case.schema.js.map