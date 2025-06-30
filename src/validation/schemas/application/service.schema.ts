/**
 * @module ServiceSchemas
 * @description Zod schemas for service method inputs and outputs
 * @category Application/Validation
 */

import { z } from 'zod';
import { 
  DiscordSnowflakeSchema, 
  MongoIdSchema,
  StaffRoleSchema,
  OperationResultSchema,
  PaginationRequestSchema,
  PaginationResponseSchema,
  ValidationHelpers
} from '../shared';
import { 
  StaffSchema,
  CaseSchema,
  JobSchema,
  ApplicationSchema
} from '../domain';

/**
 * Service operation result schemas
 */
export const StaffOperationResultSchema = OperationResultSchema(StaffSchema);
export const CaseOperationResultSchema = OperationResultSchema(CaseSchema);
export const JobOperationResultSchema = OperationResultSchema(JobSchema);
export const ApplicationOperationResultSchema = OperationResultSchema(ApplicationSchema);

export type StaffOperationResult = z.infer<typeof StaffOperationResultSchema>;
export type CaseOperationResult = z.infer<typeof CaseOperationResultSchema>;
export type JobOperationResult = z.infer<typeof JobOperationResultSchema>;
export type ApplicationOperationResult = z.infer<typeof ApplicationOperationResultSchema>;

/**
 * Staff service request schemas
 */
export const StaffHireRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  userId: DiscordSnowflakeSchema,
  robloxUsername: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  role: StaffRoleSchema,
  hiredBy: DiscordSnowflakeSchema,
  reason: z.string().max(500).optional(),
  isGuildOwner: z.boolean().optional(),
});

export type StaffHireRequest = z.infer<typeof StaffHireRequestSchema>;

export const StaffPromoteRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  userId: DiscordSnowflakeSchema,
  newRole: StaffRoleSchema,
  promotedBy: DiscordSnowflakeSchema,
  reason: z.string().max(500).optional(),
});

export type StaffPromoteRequest = z.infer<typeof StaffPromoteRequestSchema>;

export const StaffFireRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  userId: DiscordSnowflakeSchema,
  terminatedBy: DiscordSnowflakeSchema,
  reason: z.string().max(500).optional(),
});

export type StaffFireRequest = z.infer<typeof StaffFireRequestSchema>;

export const StaffListRequestSchema = PaginationRequestSchema.extend({
  guildId: DiscordSnowflakeSchema,
  role: StaffRoleSchema.optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
});

export type StaffListRequest = z.infer<typeof StaffListRequestSchema>;

export const StaffListResponseSchema = z.object({
  staff: z.array(StaffSchema),
  pagination: PaginationResponseSchema,
  total: z.number(),
});

export type StaffListResponse = z.infer<typeof StaffListResponseSchema>;

/**
 * Case service request schemas
 */
export const CaseOpenRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  clientId: DiscordSnowflakeSchema,
  clientUsername: z.string(),
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

export type CaseOpenRequest = z.infer<typeof CaseOpenRequestSchema>;

export const CaseAssignRequestSchema = z.object({
  caseId: z.string(),
  lawyerIds: z.array(DiscordSnowflakeSchema).min(1),
  leadAttorneyId: DiscordSnowflakeSchema.optional(),
  assignedBy: DiscordSnowflakeSchema,
});

export type CaseAssignRequest = z.infer<typeof CaseAssignRequestSchema>;

export const CaseListRequestSchema = PaginationRequestSchema.extend({
  guildId: DiscordSnowflakeSchema,
  clientId: DiscordSnowflakeSchema.optional(),
  lawyerId: DiscordSnowflakeSchema.optional(),
  status: z.enum(['pending', 'in-progress', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export type CaseListRequest = z.infer<typeof CaseListRequestSchema>;

export const CaseCloseRequestSchema = z.object({
  caseId: z.string(),
  result: z.enum(['win', 'loss', 'settlement', 'dismissed', 'withdrawn']),
  resultNotes: z.string().max(2000).optional(),
  closedBy: DiscordSnowflakeSchema,
});

export type CaseCloseRequest = z.infer<typeof CaseCloseRequestSchema>;

/**
 * Job service request schemas  
 */
export const JobPostRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(2000),
  staffRole: z.union([StaffRoleSchema, z.string()]),
  roleId: DiscordSnowflakeSchema,
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    type: z.enum(['short', 'paragraph', 'number', 'choice']),
    required: z.boolean(),
    choices: z.array(z.string()).optional(),
  })).optional(),
  postedBy: DiscordSnowflakeSchema,
});

export type JobPostRequest = z.infer<typeof JobPostRequestSchema>;

export const JobListRequestSchema = PaginationRequestSchema.extend({
  guildId: DiscordSnowflakeSchema,
  isOpen: z.boolean().optional(),
  staffRole: z.union([StaffRoleSchema, z.string()]).optional(),
});

export type JobListRequest = z.infer<typeof JobListRequestSchema>;

export const JobCloseRequestSchema = z.object({
  jobId: z.string(),
  closedBy: DiscordSnowflakeSchema,
  reason: z.string().max(500).optional(),
});

export type JobCloseRequest = z.infer<typeof JobCloseRequestSchema>;

/**
 * Application service request schemas
 */
export const ApplicationSubmitRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  jobId: MongoIdSchema,
  applicantId: DiscordSnowflakeSchema,
  robloxUsername: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.string().min(1).max(2000),
  })),
});

export type ApplicationSubmitRequest = z.infer<typeof ApplicationSubmitRequestSchema>;

export const ApplicationReviewRequestSchema = z.object({
  applicationId: MongoIdSchema,
  decision: z.enum(['accepted', 'rejected']),
  reviewedBy: DiscordSnowflakeSchema,
  reason: z.string().max(500).optional(),
});

export type ApplicationReviewRequest = z.infer<typeof ApplicationReviewRequestSchema>;

/**
 * Service method validator helper
 * @description Wraps service methods with automatic validation
 */
export function validateServiceMethod<TInput, TOutput>(
  inputSchema: z.ZodSchema<TInput>,
  outputSchema: z.ZodSchema<TOutput>,
  method: (input: TInput) => Promise<TOutput>
): (input: unknown) => Promise<TOutput> {
  return async (input: unknown) => {
    const validatedInput = ValidationHelpers.validateOrThrow(inputSchema, input, 'Service method input');
    const result = await method(validatedInput);
    return ValidationHelpers.validateOrThrow(outputSchema, result, 'Service method output');
  };
}
