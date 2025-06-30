"use strict";
/**
 * @module InformationChannelSchemas
 * @description Zod schemas for information channel domain entities
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InformationChannelUpdateRequestSchema = exports.InformationChannelCreateRequestSchema = exports.InformationChannelSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Information channel entity schema
 * @description Complete validation schema for information channels
 */
exports.InformationChannelSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    channelId: shared_1.DiscordSnowflakeSchema,
    messageId: shared_1.DiscordSnowflakeSchema.optional(),
    content: zod_1.z.string().min(1).max(4000),
    lastUpdatedBy: shared_1.DiscordSnowflakeSchema,
    lastUpdatedAt: zod_1.z.date(),
    createdBy: shared_1.DiscordSnowflakeSchema,
    version: zod_1.z.number().int().positive().default(1),
});
/**
 * Information channel creation request schema
 * @description Validates data for creating new information channels
 */
exports.InformationChannelCreateRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    channelId: shared_1.DiscordSnowflakeSchema,
    content: zod_1.z.string().min(1).max(4000),
    createdBy: shared_1.DiscordSnowflakeSchema,
});
/**
 * Information channel update request schema
 * @description Validates data for updating information channels
 */
exports.InformationChannelUpdateRequestSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(4000),
    updatedBy: shared_1.DiscordSnowflakeSchema,
});
//# sourceMappingURL=information-channel.schema.js.map