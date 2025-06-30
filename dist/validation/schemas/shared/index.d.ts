/**
 * @module SharedSchemas
 * @description Common validation schemas used across all layers of the application.
 * These schemas provide runtime type safety for common data types and structures.
 * @category Validation
 */
import { z } from 'zod';
import { ObjectId } from 'mongodb';
/**
 * MongoDB ObjectId validation schema
 * @description Validates MongoDB ObjectId in both string and ObjectId formats
 * @example
 * ```typescript
 * const id = MongoIdSchema.parse("507f1f77bcf86cd799439011");
 * const objectId = MongoIdSchema.parse(new ObjectId());
 * ```
 */
export declare const MongoIdSchema: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<ObjectId, z.ZodTypeDef, ObjectId>]>, string, string | ObjectId>;
/**
 * Discord Snowflake ID validation schema
 * @description Validates Discord snowflake IDs (18-21 digit strings)
 * @see https://discord.com/developers/docs/reference#snowflakes
 */
export declare const DiscordSnowflakeSchema: z.ZodString;
/**
 * Timestamp schemas for date handling
 * @description Provides various timestamp validation and transformation utilities
 */
export declare const TimestampSchema: z.ZodDate;
export declare const TimestampStringSchema: z.ZodString;
export declare const TimestampUnixSchema: z.ZodNumber;
/**
 * Convert various timestamp formats to Date
 */
export declare const FlexibleTimestampSchema: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
/**
 * Staff role enum schema
 * @description Validates staff roles with hierarchy enforcement
 */
export declare const StaffRoleSchema: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
export type StaffRole = z.infer<typeof StaffRoleSchema>;
/**
 * Staff status enum schema
 */
export declare const StaffStatusSchema: z.ZodEnum<["active", "terminated", "on_leave"]>;
export type StaffStatus = z.infer<typeof StaffStatusSchema>;
/**
 * Case status enum schema
 */
export declare const CaseStatusSchema: z.ZodEnum<["pending", "in-progress", "closed"]>;
export type CaseStatus = z.infer<typeof CaseStatusSchema>;
/**
 * Application status enum schema
 */
export declare const ApplicationStatusSchema: z.ZodEnum<["pending", "accepted", "rejected", "withdrawn"]>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
/**
 * Pagination request schema
 * @description Common pagination parameters for list endpoints
 */
export declare const PaginationRequestSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type PaginationRequest = z.infer<typeof PaginationRequestSchema>;
/**
 * Pagination response schema
 * @description Common pagination metadata for list responses
 */
export declare const PaginationResponseSchema: z.ZodObject<{
    total: z.ZodNumber;
    page: z.ZodNumber;
    limit: z.ZodNumber;
    totalPages: z.ZodNumber;
    hasNext: z.ZodBoolean;
    hasPrevious: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}, {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}>;
export type PaginationResponse = z.infer<typeof PaginationResponseSchema>;
/**
 * Base entity schema
 * @description Common fields for all database entities
 */
export declare const BaseEntitySchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<ObjectId, z.ZodTypeDef, ObjectId>]>, string, string | ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    updatedAt: Date;
    _id?: string | undefined;
}, {
    createdAt: string | number | Date;
    updatedAt: string | number | Date;
    _id?: string | ObjectId | undefined;
}>;
export type BaseEntity = z.infer<typeof BaseEntitySchema>;
/**
 * Operation result schema
 * @description Standard response format for service operations
 */
export declare const OperationResultSchema: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}>, any> extends infer T_1 ? { [k in keyof T_1]: z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}>, any>[k]; } : never, z.baseObjectInputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}> extends infer T_2 ? { [k_1 in keyof T_2]: z.baseObjectInputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}>[k_1]; } : never>;
/**
 * Validation error detail schema
 */
export declare const ValidationErrorDetailSchema: z.ZodObject<{
    path: z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">;
    message: z.ZodString;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    path: (string | number)[];
    code?: string | undefined;
}, {
    message: string;
    path: (string | number)[];
    code?: string | undefined;
}>;
export type ValidationErrorDetail = z.infer<typeof ValidationErrorDetailSchema>;
/**
 * Validation error response schema
 */
export declare const ValidationErrorSchema: z.ZodObject<{
    type: z.ZodLiteral<"validation_error">;
    message: z.ZodString;
    errors: z.ZodArray<z.ZodObject<{
        path: z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">;
        message: z.ZodString;
        code: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        path: (string | number)[];
        code?: string | undefined;
    }, {
        message: string;
        path: (string | number)[];
        code?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "validation_error";
    message: string;
    errors: {
        message: string;
        path: (string | number)[];
        code?: string | undefined;
    }[];
}, {
    type: "validation_error";
    message: string;
    errors: {
        message: string;
        path: (string | number)[];
        code?: string | undefined;
    }[];
}>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
/**
 * Permission action enum schema
 */
export declare const PermissionActionSchema: z.ZodEnum<["admin", "senior-staff", "case", "config", "lawyer", "lead-attorney", "repair"]>;
export type PermissionAction = z.infer<typeof PermissionActionSchema>;
/**
 * Audit action enum schema
 */
export declare const AuditActionSchema: z.ZodEnum<["staff_hired", "staff_fired", "staff_promoted", "staff_demoted", "staff_info_viewed", "staff_list_viewed", "role_sync_performed", "job_created", "job_updated", "job_closed", "job_removed", "job_list_viewed", "job_info_viewed", "guild_owner_bypass", "business_rule_violation", "role_limit_bypassed", "permission_override", "case_created", "case_assigned", "case_closed", "case_archived", "channel_archived", "lead_attorney_changed", "lead_attorney_removed", "channel_cleanup_scan", "channel_cleanup_performed", "orphaned_channel_deleted", "system_repair"]>;
export type AuditAction = z.infer<typeof AuditActionSchema>;
/**
 * Helper function to create optional field schema
 * @description Makes a schema optional while preserving undefined behavior
 */
export declare const optional: <T extends z.ZodTypeAny>(schema: T) => z.ZodUnion<[T, z.ZodUndefined]>;
/**
 * Helper function to create nullable field schema
 * @description Makes a schema nullable while preserving null behavior
 */
export declare const nullable: <T extends z.ZodTypeAny>(schema: T) => z.ZodUnion<[T, z.ZodNull]>;
/**
 * Helper function to create nullish field schema
 * @description Makes a schema both nullable and optional
 */
export declare const nullish: <T extends z.ZodTypeAny>(schema: T) => z.ZodUnion<[T, z.ZodNull, z.ZodUndefined]>;
/**
 * Validation helper functions
 */
export declare const ValidationHelpers: {
    /**
     * Validate data and throw with formatted error
     */
    validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T;
    /**
     * Validate data without throwing
     */
    validateSafe<T>(schema: z.ZodSchema<T>, data: unknown): {
        success: true;
        data: T;
    } | {
        success: false;
        error: z.ZodError;
    };
    /**
     * Format Zod error for user display
     */
    formatZodError(error: z.ZodError): ValidationError;
};
//# sourceMappingURL=index.d.ts.map