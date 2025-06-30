/**
 * @module RetainerSchema
 * @description Zod schemas for retainer agreement validation
 * @category Domain/Validation
 */

import { z } from 'zod';
import { BaseEntitySchema, DiscordSnowflakeSchema } from '../shared';

/**
 * Retainer status enum schema
 */
export const RetainerStatusSchema = z.enum(['pending', 'signed', 'cancelled']);

export type RetainerStatus = z.infer<typeof RetainerStatusSchema>;

/**
 * Retainer entity schema
 */
export const RetainerSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  clientId: DiscordSnowflakeSchema,
  lawyerId: DiscordSnowflakeSchema,
  status: RetainerStatusSchema,
  agreementTemplate: z.string(),
  clientRobloxUsername: z.string().optional(),
  digitalSignature: z.string().optional(),
  signedAt: z.date().optional(),
});

export type Retainer = z.infer<typeof RetainerSchema>;

/**
 * Retainer creation request schema
 */
export const RetainerCreationRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  clientId: DiscordSnowflakeSchema,
  lawyerId: DiscordSnowflakeSchema,
});

export type RetainerCreationRequest = z.infer<typeof RetainerCreationRequestSchema>;

/**
 * Retainer signature request schema
 */
export const RetainerSignatureRequestSchema = z.object({
  retainerId: z.string(),
  clientRobloxUsername: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  clientAgreement: z.boolean(),
});

export type RetainerSignatureRequest = z.infer<typeof RetainerSignatureRequestSchema>;

/**
 * Retainer activation request schema
 */
export const RetainerActivationRequestSchema = z.object({
  retainerId: z.string(),
  activatedBy: DiscordSnowflakeSchema,
});

export type RetainerActivationRequest = z.infer<typeof RetainerActivationRequestSchema>;

/**
 * Retainer termination request schema
 */
export const RetainerTerminationRequestSchema = z.object({
  retainerId: z.string(),
  terminatedBy: DiscordSnowflakeSchema,
  reason: z.string().max(500),
});

export type RetainerTerminationRequest = z.infer<typeof RetainerTerminationRequestSchema>;