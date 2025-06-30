"use strict";
/**
 * @module RulesChannelSchemas
 * @description Zod schemas for rules channel domain entities
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleUpdateRequestSchema = exports.RuleCreateRequestSchema = exports.RulesChannelCreateRequestSchema = exports.RulesChannelSchema = exports.AdditionalFieldSchema = exports.RuleSchema = exports.RuleCategorySchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Rule category enum schema
 */
exports.RuleCategorySchema = zod_1.z.enum([
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
/**
 * Individual rule schema
 * @description Schema for a single rule within a rules channel
 */
exports.RuleSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1).max(100),
    content: zod_1.z.string().min(1).max(1000),
    category: exports.RuleCategorySchema,
    order: zod_1.z.number().int().nonnegative(),
    isActive: zod_1.z.boolean().default(true),
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']).optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
/**
 * Additional field schema for rules channel embeds
 */
exports.AdditionalFieldSchema = zod_1.z.object({
    name: zod_1.z.string(),
    value: zod_1.z.string(),
    inline: zod_1.z.boolean().optional(),
});
/**
 * Rules channel entity schema
 * @description Complete validation schema for rules channels
 */
exports.RulesChannelSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    channelId: shared_1.DiscordSnowflakeSchema,
    messageId: shared_1.DiscordSnowflakeSchema.optional(),
    title: zod_1.z.string().optional(),
    content: zod_1.z.string().optional(),
    rules: zod_1.z.array(exports.RuleSchema),
    color: zod_1.z.number().optional(),
    thumbnailUrl: zod_1.z.string().url().optional(),
    imageUrl: zod_1.z.string().url().optional(),
    footer: zod_1.z.string().optional(),
    showNumbers: zod_1.z.boolean().optional(),
    additionalFields: zod_1.z.array(exports.AdditionalFieldSchema).optional(),
    lastUpdatedBy: shared_1.DiscordSnowflakeSchema,
    lastUpdatedAt: zod_1.z.date(),
    createdBy: shared_1.DiscordSnowflakeSchema,
    version: zod_1.z.number().int().positive().default(1),
});
/**
 * Rules channel creation request schema
 * @description Validates data for creating new rules channels
 */
exports.RulesChannelCreateRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    channelId: shared_1.DiscordSnowflakeSchema,
    rules: zod_1.z.array(exports.RuleSchema).default([]),
    createdBy: shared_1.DiscordSnowflakeSchema,
});
/**
 * Rule creation request schema
 * @description Validates data for adding a new rule
 */
exports.RuleCreateRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(100),
    content: zod_1.z.string().min(1).max(1000),
    category: exports.RuleCategorySchema,
    order: zod_1.z.number().int().nonnegative().optional(),
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']).optional(),
});
/**
 * Rule update request schema
 * @description Validates data for updating an existing rule
 */
exports.RuleUpdateRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(100).optional(),
    content: zod_1.z.string().min(1).max(1000).optional(),
    category: exports.RuleCategorySchema.optional(),
    order: zod_1.z.number().int().nonnegative().optional(),
    isActive: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=rules-channel.schema.js.map