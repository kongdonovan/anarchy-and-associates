/**
 * @module CaseSchemas
 * @description Zod schemas for Case domain entities
 * @category Domain/Validation
 */

import { z } from 'zod';
import { 
  BaseEntitySchema, 
  DiscordSnowflakeSchema, 
  FlexibleTimestampSchema,
  CaseStatusSchema,
  MongoIdSchema
} from '../shared';

/**
 * Case priority enum schema
 * @description Defines urgency levels for case handling
 */
export const CasePrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export type CasePriority = z.infer<typeof CasePrioritySchema>;

/**
 * Case result enum schema
 * @description Possible outcomes when a case is closed
 */
export const CaseResultSchema = z.enum(['win', 'loss', 'settlement', 'dismissed', 'withdrawn']);

export type CaseResult = z.infer<typeof CaseResultSchema>;

/**
 * Case document schema
 * @description Document attached to a case (evidence, contracts, etc.)
 */
export const CaseDocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000), // Can contain URLs or text
  createdBy: DiscordSnowflakeSchema,
  createdAt: FlexibleTimestampSchema,
});

export type CaseDocument = z.infer<typeof CaseDocumentSchema>;

/**
 * Case note schema
 * @description Notes and updates about a case
 */
export const CaseNoteSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(2000),
  createdBy: DiscordSnowflakeSchema,
  createdAt: FlexibleTimestampSchema,
  isInternal: z.boolean(), // Whether note is visible to client
});

export type CaseNote = z.infer<typeof CaseNoteSchema>;

/**
 * Case number validation regex
 * @description Format: AA-YYYY-NNNN-username
 */
const CASE_NUMBER_REGEX = /^AA-\d{4}-\d{4}-[a-zA-Z0-9_]+$/;

/**
 * Case entity schema
 * @description Complete validation schema for legal cases
 */
export const CaseSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  caseNumber: z.string().regex(CASE_NUMBER_REGEX, 'Invalid case number format'),
  clientId: DiscordSnowflakeSchema,
  clientUsername: z.string().min(1).max(32),
  title: z.string()
    .min(5, 'Case title must be at least 5 characters')
    .max(200, 'Case title must not exceed 200 characters'),
  description: z.string()
    .min(20, 'Case description must be at least 20 characters')
    .max(2000, 'Case description must not exceed 2000 characters'),
  status: CaseStatusSchema,
  priority: CasePrioritySchema,
  leadAttorneyId: DiscordSnowflakeSchema.optional(),
  assignedLawyerIds: z.array(DiscordSnowflakeSchema).default([]),
  channelId: DiscordSnowflakeSchema.optional(),
  result: CaseResultSchema.optional(),
  resultNotes: z.string().max(2000).optional(),
  closedAt: FlexibleTimestampSchema.optional(),
  closedBy: DiscordSnowflakeSchema.optional(),
  documents: z.array(CaseDocumentSchema).default([]),
  notes: z.array(CaseNoteSchema).default([]),
});

export type Case = z.infer<typeof CaseSchema>;

/**
 * Case creation request schema
 * @description Validates data for creating new cases
 */
export const CaseCreationRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  clientId: DiscordSnowflakeSchema,
  clientUsername: z.string().min(1).max(32),
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  priority: CasePrioritySchema.default('medium'),
});

export type CaseCreationRequest = z.infer<typeof CaseCreationRequestSchema>;

/**
 * Case assignment request schema
 * @description Validates lawyer assignment requests
 */
export const CaseAssignmentRequestSchema = z.object({
  caseId: MongoIdSchema,
  lawyerIds: z.array(DiscordSnowflakeSchema).min(1),
  leadAttorneyId: DiscordSnowflakeSchema.optional(),
  assignedBy: DiscordSnowflakeSchema,
});

export type CaseAssignmentRequest = z.infer<typeof CaseAssignmentRequestSchema>;

/**
 * Case update request schema
 * @description Validates partial case updates
 */
export const CaseUpdateRequestSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(20).max(2000).optional(),
  priority: CasePrioritySchema.optional(),
  status: CaseStatusSchema.optional(),
  channelId: DiscordSnowflakeSchema.optional(),
});

/**
 * Case Counter schema
 * @description Tracks case numbers per guild per year
 */
export const CaseCounterSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  year: z.number().int().min(2000).max(3000),
  count: z.number().int().min(0),
});

export type CaseCounter = z.infer<typeof CaseCounterSchema>;

export type CaseUpdateRequest = z.infer<typeof CaseUpdateRequestSchema>;

/**
 * Case closure request schema
 * @description Validates case closure data
 */
export const CaseClosureRequestSchema = z.object({
  caseId: MongoIdSchema,
  result: CaseResultSchema,
  resultNotes: z.string().max(2000).optional(),
  closedBy: DiscordSnowflakeSchema,
});

export type CaseClosureRequest = z.infer<typeof CaseClosureRequestSchema>;

/**
 * Case search filters schema
 */
export const CaseSearchFiltersSchema = z.object({
  guildId: DiscordSnowflakeSchema.optional(),
  clientId: DiscordSnowflakeSchema.optional(),
  status: CaseStatusSchema.optional(),
  priority: CasePrioritySchema.optional(),
  leadAttorneyId: DiscordSnowflakeSchema.optional(),
  assignedLawyerId: DiscordSnowflakeSchema.optional(),
  caseNumber: z.string().optional(),
});

export type CaseSearchFilters = z.infer<typeof CaseSearchFiltersSchema>;

/**
 * Add document request schema
 */
export const AddDocumentRequestSchema = z.object({
  caseId: MongoIdSchema,
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  createdBy: DiscordSnowflakeSchema,
});

export type AddDocumentRequest = z.infer<typeof AddDocumentRequestSchema>;

/**
 * Add note request schema
 */
export const AddNoteRequestSchema = z.object({
  caseId: MongoIdSchema,
  content: z.string().min(1).max(2000),
  createdBy: DiscordSnowflakeSchema,
  isInternal: z.boolean().default(false),
});

export type AddNoteRequest = z.infer<typeof AddNoteRequestSchema>;

