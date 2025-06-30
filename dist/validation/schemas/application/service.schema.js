"use strict";
/**
 * @module ServiceSchemas
 * @description Zod schemas for service method inputs and outputs
 * @category Application/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationReviewRequestSchema = exports.ApplicationSubmitRequestSchema = exports.JobCloseRequestSchema = exports.JobListRequestSchema = exports.JobPostRequestSchema = exports.CaseCloseRequestSchema = exports.CaseListRequestSchema = exports.CaseAssignRequestSchema = exports.CaseOpenRequestSchema = exports.StaffListResponseSchema = exports.StaffListRequestSchema = exports.StaffFireRequestSchema = exports.StaffPromoteRequestSchema = exports.StaffHireRequestSchema = exports.ApplicationOperationResultSchema = exports.JobOperationResultSchema = exports.CaseOperationResultSchema = exports.StaffOperationResultSchema = void 0;
exports.validateServiceMethod = validateServiceMethod;
const zod_1 = require("zod");
const shared_1 = require("../shared");
const domain_1 = require("../domain");
/**
 * Service operation result schemas
 */
exports.StaffOperationResultSchema = (0, shared_1.OperationResultSchema)(domain_1.StaffSchema);
exports.CaseOperationResultSchema = (0, shared_1.OperationResultSchema)(domain_1.CaseSchema);
exports.JobOperationResultSchema = (0, shared_1.OperationResultSchema)(domain_1.JobSchema);
exports.ApplicationOperationResultSchema = (0, shared_1.OperationResultSchema)(domain_1.ApplicationSchema);
/**
 * Staff service request schemas
 */
exports.StaffHireRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    userId: shared_1.DiscordSnowflakeSchema,
    robloxUsername: zod_1.z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
    role: shared_1.StaffRoleSchema,
    hiredBy: shared_1.DiscordSnowflakeSchema,
    reason: zod_1.z.string().max(500).optional(),
    isGuildOwner: zod_1.z.boolean().optional(),
});
exports.StaffPromoteRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    userId: shared_1.DiscordSnowflakeSchema,
    newRole: shared_1.StaffRoleSchema,
    promotedBy: shared_1.DiscordSnowflakeSchema,
    reason: zod_1.z.string().max(500).optional(),
});
exports.StaffFireRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    userId: shared_1.DiscordSnowflakeSchema,
    terminatedBy: shared_1.DiscordSnowflakeSchema,
    reason: zod_1.z.string().max(500).optional(),
});
exports.StaffListRequestSchema = shared_1.PaginationRequestSchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    role: shared_1.StaffRoleSchema.optional(),
    status: zod_1.z.enum(['active', 'inactive', 'terminated']).optional(),
});
exports.StaffListResponseSchema = zod_1.z.object({
    staff: zod_1.z.array(domain_1.StaffSchema),
    pagination: shared_1.PaginationResponseSchema,
    total: zod_1.z.number(),
});
/**
 * Case service request schemas
 */
exports.CaseOpenRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    clientId: shared_1.DiscordSnowflakeSchema,
    clientUsername: zod_1.z.string(),
    title: zod_1.z.string().min(5).max(200),
    description: zod_1.z.string().min(20).max(2000),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});
exports.CaseAssignRequestSchema = zod_1.z.object({
    caseId: zod_1.z.string(),
    lawyerIds: zod_1.z.array(shared_1.DiscordSnowflakeSchema).min(1),
    leadAttorneyId: shared_1.DiscordSnowflakeSchema.optional(),
    assignedBy: shared_1.DiscordSnowflakeSchema,
});
exports.CaseListRequestSchema = shared_1.PaginationRequestSchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    clientId: shared_1.DiscordSnowflakeSchema.optional(),
    lawyerId: shared_1.DiscordSnowflakeSchema.optional(),
    status: zod_1.z.enum(['pending', 'in-progress', 'closed']).optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});
exports.CaseCloseRequestSchema = zod_1.z.object({
    caseId: zod_1.z.string(),
    result: zod_1.z.enum(['win', 'loss', 'settlement', 'dismissed', 'withdrawn']),
    resultNotes: zod_1.z.string().max(2000).optional(),
    closedBy: shared_1.DiscordSnowflakeSchema,
});
/**
 * Job service request schemas
 */
exports.JobPostRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    title: zod_1.z.string().min(5).max(100),
    description: zod_1.z.string().min(20).max(2000),
    staffRole: zod_1.z.union([shared_1.StaffRoleSchema, zod_1.z.string()]),
    roleId: shared_1.DiscordSnowflakeSchema,
    questions: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        question: zod_1.z.string(),
        type: zod_1.z.enum(['short', 'paragraph', 'number', 'choice']),
        required: zod_1.z.boolean(),
        choices: zod_1.z.array(zod_1.z.string()).optional(),
    })).optional(),
    postedBy: shared_1.DiscordSnowflakeSchema,
});
exports.JobListRequestSchema = shared_1.PaginationRequestSchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    isOpen: zod_1.z.boolean().optional(),
    staffRole: zod_1.z.union([shared_1.StaffRoleSchema, zod_1.z.string()]).optional(),
});
exports.JobCloseRequestSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    closedBy: shared_1.DiscordSnowflakeSchema,
    reason: zod_1.z.string().max(500).optional(),
});
/**
 * Application service request schemas
 */
exports.ApplicationSubmitRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    jobId: shared_1.MongoIdSchema,
    applicantId: shared_1.DiscordSnowflakeSchema,
    robloxUsername: zod_1.z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
    answers: zod_1.z.array(zod_1.z.object({
        questionId: zod_1.z.string(),
        answer: zod_1.z.string().min(1).max(2000),
    })),
});
exports.ApplicationReviewRequestSchema = zod_1.z.object({
    applicationId: shared_1.MongoIdSchema,
    decision: zod_1.z.enum(['accepted', 'rejected']),
    reviewedBy: shared_1.DiscordSnowflakeSchema,
    reason: zod_1.z.string().max(500).optional(),
});
/**
 * Service method validator helper
 * @description Wraps service methods with automatic validation
 */
function validateServiceMethod(inputSchema, outputSchema, method) {
    return async (input) => {
        const validatedInput = shared_1.ValidationHelpers.validateOrThrow(inputSchema, input, 'Service method input');
        const result = await method(validatedInput);
        return shared_1.ValidationHelpers.validateOrThrow(outputSchema, result, 'Service method output');
    };
}
//# sourceMappingURL=service.schema.js.map