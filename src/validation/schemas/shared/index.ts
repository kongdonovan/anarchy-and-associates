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
export const MongoIdSchema = z.union([
  z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId'),
  z.instanceof(ObjectId),
]).transform((val) => typeof val === 'string' ? val : val.toString());

/**
 * Discord Snowflake ID validation schema
 * @description Validates Discord snowflake IDs (18-21 digit strings)
 * @see https://discord.com/developers/docs/reference#snowflakes
 */
export const DiscordSnowflakeSchema = z.string()
  .regex(/^\d{17,21}$/, 'Invalid Discord snowflake ID');

/**
 * Timestamp schemas for date handling
 * @description Provides various timestamp validation and transformation utilities
 */
export const TimestampSchema = z.date();
export const TimestampStringSchema = z.string().datetime();
export const TimestampUnixSchema = z.number().int().positive();

/**
 * Convert various timestamp formats to Date
 */
export const FlexibleTimestampSchema = z.union([
  TimestampSchema,
  TimestampStringSchema.transform(str => new Date(str)),
  TimestampUnixSchema.transform(unix => new Date(unix * 1000)),
]);

/**
 * Staff role enum schema
 * @description Validates staff roles with hierarchy enforcement
 */
export const StaffRoleSchema = z.enum([
  'Managing Partner',
  'Senior Partner',
  'Junior Partner',
  'Senior Associate',
  'Junior Associate',
  'Paralegal'
]);

export type StaffRole = z.infer<typeof StaffRoleSchema>;

/**
 * Staff status enum schema
 */
export const StaffStatusSchema = z.enum(['active', 'terminated', 'on_leave']);

export type StaffStatus = z.infer<typeof StaffStatusSchema>;

/**
 * Case status enum schema
 */
export const CaseStatusSchema = z.enum(['pending', 'in-progress', 'closed']);

export type CaseStatus = z.infer<typeof CaseStatusSchema>;

/**
 * Application status enum schema
 */
export const ApplicationStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'withdrawn']);

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

/**
 * Pagination request schema
 * @description Common pagination parameters for list endpoints
 */
export const PaginationRequestSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationRequest = z.infer<typeof PaginationRequestSchema>;

/**
 * Pagination response schema
 * @description Common pagination metadata for list responses
 */
export const PaginationResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

export type PaginationResponse = z.infer<typeof PaginationResponseSchema>;

/**
 * Base entity schema
 * @description Common fields for all database entities
 */
export const BaseEntitySchema = z.object({
  _id: MongoIdSchema.optional(),
  createdAt: FlexibleTimestampSchema,
  updatedAt: FlexibleTimestampSchema,
});

export type BaseEntity = z.infer<typeof BaseEntitySchema>;

/**
 * Operation result schema
 * @description Standard response format for service operations
 */
export const OperationResultSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

/**
 * Validation error detail schema
 */
export const ValidationErrorDetailSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
  code: z.string().optional(),
});

export type ValidationErrorDetail = z.infer<typeof ValidationErrorDetailSchema>;

/**
 * Validation error response schema
 */
export const ValidationErrorSchema = z.object({
  type: z.literal('validation_error'),
  message: z.string(),
  errors: z.array(ValidationErrorDetailSchema),
});

export type ValidationError = z.infer<typeof ValidationErrorSchema>;

/**
 * Permission action enum schema
 */
export const PermissionActionSchema = z.enum([
  'admin',
  'senior-staff',
  'case',
  'config',
  'lawyer',
  'lead-attorney',
  'repair'
]);

export type PermissionAction = z.infer<typeof PermissionActionSchema>;

/**
 * Audit action enum schema
 */
export const AuditActionSchema = z.enum([
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

export type AuditAction = z.infer<typeof AuditActionSchema>;

/**
 * Helper function to create optional field schema
 * @description Makes a schema optional while preserving undefined behavior
 */
export const optional = <T extends z.ZodTypeAny>(schema: T) => 
  z.union([schema, z.undefined()]);

/**
 * Helper function to create nullable field schema
 * @description Makes a schema nullable while preserving null behavior
 */
export const nullable = <T extends z.ZodTypeAny>(schema: T) => 
  z.union([schema, z.null()]);

/**
 * Helper function to create nullish field schema
 * @description Makes a schema both nullable and optional
 */
export const nullish = <T extends z.ZodTypeAny>(schema: T) => 
  z.union([schema, z.null(), z.undefined()]);

/**
 * Validation helper functions
 */
export const ValidationHelpers = {
  /**
   * Validate data and throw with formatted error
   */
  validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`${context ? context + ': ' : ''}Validation failed - ${details}`);
      }
      throw error;
    }
  },

  /**
   * Validate data without throwing
   */
  validateSafe<T>(schema: z.ZodSchema<T>, data: unknown): 
    { success: true; data: T } | { success: false; error: z.ZodError } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  },

  /**
   * Format Zod error for user display
   */
  formatZodError(error: z.ZodError): ValidationError {
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
