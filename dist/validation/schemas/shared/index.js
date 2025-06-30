"use strict";
/**
 * @module SharedSchemas
 * @description Common validation schemas used across all layers of the application.
 * These schemas provide runtime type safety for common data types and structures.
 * @category Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationHelpers = exports.nullish = exports.nullable = exports.optional = exports.AuditActionSchema = exports.PermissionActionSchema = exports.ValidationErrorSchema = exports.ValidationErrorDetailSchema = exports.OperationResultSchema = exports.BaseEntitySchema = exports.PaginationResponseSchema = exports.PaginationRequestSchema = exports.ApplicationStatusSchema = exports.CaseStatusSchema = exports.StaffStatusSchema = exports.StaffRoleSchema = exports.FlexibleTimestampSchema = exports.TimestampUnixSchema = exports.TimestampStringSchema = exports.TimestampSchema = exports.DiscordSnowflakeSchema = exports.MongoIdSchema = void 0;
const zod_1 = require("zod");
const mongodb_1 = require("mongodb");
/**
 * MongoDB ObjectId validation schema
 * @description Validates MongoDB ObjectId in both string and ObjectId formats
 * @example
 * ```typescript
 * const id = MongoIdSchema.parse("507f1f77bcf86cd799439011");
 * const objectId = MongoIdSchema.parse(new ObjectId());
 * ```
 */
exports.MongoIdSchema = zod_1.z.union([
    zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId'),
    zod_1.z.instanceof(mongodb_1.ObjectId),
]).transform((val) => typeof val === 'string' ? val : val.toString());
/**
 * Discord Snowflake ID validation schema
 * @description Validates Discord snowflake IDs (18-21 digit strings)
 * @see https://discord.com/developers/docs/reference#snowflakes
 */
exports.DiscordSnowflakeSchema = zod_1.z.string()
    .regex(/^\d{17,21}$/, 'Invalid Discord snowflake ID');
/**
 * Timestamp schemas for date handling
 * @description Provides various timestamp validation and transformation utilities
 */
exports.TimestampSchema = zod_1.z.date();
exports.TimestampStringSchema = zod_1.z.string().datetime();
exports.TimestampUnixSchema = zod_1.z.number().int().positive();
/**
 * Convert various timestamp formats to Date
 */
exports.FlexibleTimestampSchema = zod_1.z.union([
    exports.TimestampSchema,
    exports.TimestampStringSchema.transform(str => new Date(str)),
    exports.TimestampUnixSchema.transform(unix => new Date(unix * 1000)),
]);
/**
 * Staff role enum schema
 * @description Validates staff roles with hierarchy enforcement
 */
exports.StaffRoleSchema = zod_1.z.enum([
    'Managing Partner',
    'Senior Partner',
    'Junior Partner',
    'Senior Associate',
    'Junior Associate',
    'Paralegal'
]);
/**
 * Staff status enum schema
 */
exports.StaffStatusSchema = zod_1.z.enum(['active', 'terminated', 'on_leave']);
/**
 * Case status enum schema
 */
exports.CaseStatusSchema = zod_1.z.enum(['pending', 'in-progress', 'closed']);
/**
 * Application status enum schema
 */
exports.ApplicationStatusSchema = zod_1.z.enum(['pending', 'accepted', 'rejected', 'withdrawn']);
/**
 * Pagination request schema
 * @description Common pagination parameters for list endpoints
 */
exports.PaginationRequestSchema = zod_1.z.object({
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(20),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
/**
 * Pagination response schema
 * @description Common pagination metadata for list responses
 */
exports.PaginationResponseSchema = zod_1.z.object({
    total: zod_1.z.number().int().nonnegative(),
    page: zod_1.z.number().int().positive(),
    limit: zod_1.z.number().int().positive(),
    totalPages: zod_1.z.number().int().nonnegative(),
    hasNext: zod_1.z.boolean(),
    hasPrevious: zod_1.z.boolean(),
});
/**
 * Base entity schema
 * @description Common fields for all database entities
 */
exports.BaseEntitySchema = zod_1.z.object({
    _id: exports.MongoIdSchema.optional(),
    createdAt: exports.FlexibleTimestampSchema,
    updatedAt: exports.FlexibleTimestampSchema,
});
/**
 * Operation result schema
 * @description Standard response format for service operations
 */
const OperationResultSchema = (dataSchema) => zod_1.z.object({
    success: zod_1.z.boolean(),
    data: dataSchema.optional(),
    error: zod_1.z.string().optional(),
    code: zod_1.z.string().optional(),
});
exports.OperationResultSchema = OperationResultSchema;
/**
 * Validation error detail schema
 */
exports.ValidationErrorDetailSchema = zod_1.z.object({
    path: zod_1.z.array(zod_1.z.union([zod_1.z.string(), zod_1.z.number()])),
    message: zod_1.z.string(),
    code: zod_1.z.string().optional(),
});
/**
 * Validation error response schema
 */
exports.ValidationErrorSchema = zod_1.z.object({
    type: zod_1.z.literal('validation_error'),
    message: zod_1.z.string(),
    errors: zod_1.z.array(exports.ValidationErrorDetailSchema),
});
/**
 * Permission action enum schema
 */
exports.PermissionActionSchema = zod_1.z.enum([
    'admin',
    'senior-staff',
    'case',
    'config',
    'lawyer',
    'lead-attorney',
    'repair'
]);
/**
 * Audit action enum schema
 */
exports.AuditActionSchema = zod_1.z.enum([
    'staff_hired',
    'staff_fired',
    'staff_promoted',
    'staff_demoted',
    'staff_info_viewed',
    'staff_list_viewed',
    'role_sync_performed',
    'job_created',
    'job_updated',
    'job_closed',
    'job_removed',
    'job_list_viewed',
    'job_info_viewed',
    // Guild Owner Bypass Actions
    'guild_owner_bypass',
    'business_rule_violation',
    'role_limit_bypassed',
    'permission_override',
    // Case Actions
    'case_created',
    'case_assigned',
    'case_closed',
    'case_archived',
    'channel_archived',
    // Lead Attorney Actions  
    'lead_attorney_changed',
    'lead_attorney_removed',
    // Channel Cleanup Actions
    'channel_cleanup_scan',
    'channel_cleanup_performed',
    'orphaned_channel_deleted',
    // System Maintenance Actions
    'system_repair',
]);
/**
 * Helper function to create optional field schema
 * @description Makes a schema optional while preserving undefined behavior
 */
const optional = (schema) => zod_1.z.union([schema, zod_1.z.undefined()]);
exports.optional = optional;
/**
 * Helper function to create nullable field schema
 * @description Makes a schema nullable while preserving null behavior
 */
const nullable = (schema) => zod_1.z.union([schema, zod_1.z.null()]);
exports.nullable = nullable;
/**
 * Helper function to create nullish field schema
 * @description Makes a schema both nullable and optional
 */
const nullish = (schema) => zod_1.z.union([schema, zod_1.z.null(), zod_1.z.undefined()]);
exports.nullish = nullish;
/**
 * Validation helper functions
 */
exports.ValidationHelpers = {
    /**
     * Validate data and throw with formatted error
     */
    validateOrThrow(schema, data, context) {
        try {
            return schema.parse(data);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                const details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                throw new Error(`${context ? context + ': ' : ''}Validation failed - ${details}`);
            }
            throw error;
        }
    },
    /**
     * Validate data without throwing
     */
    validateSafe(schema, data) {
        const result = schema.safeParse(data);
        if (result.success) {
            return { success: true, data: result.data };
        }
        return { success: false, error: result.error };
    },
    /**
     * Format Zod error for user display
     */
    formatZodError(error) {
        return {
            type: 'validation_error',
            message: 'Validation failed',
            errors: error.errors.map(e => ({
                path: e.path,
                message: e.message,
                code: e.code,
            })),
        };
    },
};
//# sourceMappingURL=index.js.map