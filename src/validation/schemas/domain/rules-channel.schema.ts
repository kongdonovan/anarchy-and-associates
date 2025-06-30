/**
 * @module RulesChannelSchemas
 * @description Zod schemas for rules channel domain entities
 * @category Domain/Validation
 */

import { z } from 'zod';
import { BaseEntitySchema, DiscordSnowflakeSchema } from '../shared';

/**
 * Rule category enum schema
 */
export const RuleCategorySchema = z.enum([
  'general',
  'conduct',
  'cases',
  'staff',
  'clients',
  'confidentiality',
  'communication',
  'fees',
  'other'
]);

export type RuleCategory = z.infer<typeof RuleCategorySchema>;

/**
 * Individual rule schema
 * @description Schema for a single rule within a rules channel
 */
export const RuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(1000),
  category: RuleCategorySchema,
  order: z.number().int().nonnegative(),
  isActive: z.boolean().default(true),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Rule = z.infer<typeof RuleSchema>;

/**
 * Additional field schema for rules channel embeds
 */
export const AdditionalFieldSchema = z.object({
  name: z.string(),
  value: z.string(),
  inline: z.boolean().optional(),
});

/**
 * Rules channel entity schema
 * @description Complete validation schema for rules channels
 */
export const RulesChannelSchema = BaseEntitySchema.extend({
  guildId: DiscordSnowflakeSchema,
  channelId: DiscordSnowflakeSchema,
  messageId: DiscordSnowflakeSchema.optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  rules: z.array(RuleSchema),
  color: z.number().optional(),
  thumbnailUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  footer: z.string().optional(),
  showNumbers: z.boolean().optional(),
  additionalFields: z.array(AdditionalFieldSchema).optional(),
  lastUpdatedBy: DiscordSnowflakeSchema,
  lastUpdatedAt: z.date(),
  createdBy: DiscordSnowflakeSchema,
  version: z.number().int().positive().default(1),
});

export type RulesChannel = z.infer<typeof RulesChannelSchema>;

/**
 * Rules channel creation request schema
 * @description Validates data for creating new rules channels
 */
export const RulesChannelCreateRequestSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  channelId: DiscordSnowflakeSchema,
  rules: z.array(RuleSchema).default([]),
  createdBy: DiscordSnowflakeSchema,
});

export type RulesChannelCreateRequest = z.infer<typeof RulesChannelCreateRequestSchema>;

/**
 * Rule creation request schema
 * @description Validates data for adding a new rule
 */
export const RuleCreateRequestSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(1000),
  category: RuleCategorySchema,
  order: z.number().int().nonnegative().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

export type RuleCreateRequest = z.infer<typeof RuleCreateRequestSchema>;

/**
 * Rule update request schema
 * @description Validates data for updating an existing rule
 */
export const RuleUpdateRequestSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(1000).optional(),
  category: RuleCategorySchema.optional(),
  order: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export type RuleUpdateRequest = z.infer<typeof RuleUpdateRequestSchema>;