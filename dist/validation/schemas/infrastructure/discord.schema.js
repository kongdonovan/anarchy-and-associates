"use strict";
/**
 * @module DiscordSchemas
 * @description Zod schemas for Discord.js interactions and data structures
 * @category Infrastructure/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEmbedSize = exports.DiscordEmbedSchema = exports.DiscordEmbedFieldSchema = exports.ModalSubmitInteractionSchema = exports.SelectMenuInteractionSchema = exports.ButtonInteractionSchema = exports.CommandInteractionSchema = exports.DiscordInteractionBaseSchema = exports.DiscordGuildMemberSchema = exports.DiscordUserSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Discord user schema
 * @description Validates Discord user objects
 */
exports.DiscordUserSchema = zod_1.z.object({
    id: shared_1.DiscordSnowflakeSchema,
    username: zod_1.z.string().min(1).max(32),
    discriminator: zod_1.z.string().regex(/^\d{4}$/),
    displayName: zod_1.z.string().optional(),
    avatar: zod_1.z.string().nullable().optional(),
    bot: zod_1.z.boolean().optional(),
});
/**
 * Discord guild member schema
 * @description Validates Discord guild member objects
 */
exports.DiscordGuildMemberSchema = zod_1.z.object({
    user: exports.DiscordUserSchema.optional(),
    nick: zod_1.z.string().nullable().optional(),
    roles: zod_1.z.array(shared_1.DiscordSnowflakeSchema),
    joinedAt: zod_1.z.string().nullable(),
    premiumSince: zod_1.z.string().nullable().optional(),
});
/**
 * Discord interaction schema
 * @description Base validation for Discord interactions
 */
exports.DiscordInteractionBaseSchema = zod_1.z.object({
    id: shared_1.DiscordSnowflakeSchema,
    applicationId: shared_1.DiscordSnowflakeSchema,
    guildId: shared_1.DiscordSnowflakeSchema.nullable(),
    channelId: shared_1.DiscordSnowflakeSchema.nullable(),
    user: exports.DiscordUserSchema,
    member: exports.DiscordGuildMemberSchema.optional(),
    token: zod_1.z.string(),
    version: zod_1.z.number(),
});
/**
 * Command interaction validation schema
 * @description Validates Discord slash command interactions
 */
exports.CommandInteractionSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    channelId: shared_1.DiscordSnowflakeSchema,
    user: zod_1.z.object({
        id: shared_1.DiscordSnowflakeSchema,
        username: zod_1.z.string(),
        displayName: zod_1.z.string().optional(),
    }),
    member: zod_1.z.object({
        roles: zod_1.z.array(shared_1.DiscordSnowflakeSchema),
    }).optional(),
    guild: zod_1.z.any(), // Discord.js Guild object
    replied: zod_1.z.boolean().optional(),
    deferred: zod_1.z.boolean().optional(),
});
/**
 * Button interaction validation schema
 * @description Validates Discord button interactions
 */
exports.ButtonInteractionSchema = zod_1.z.object({
    customId: zod_1.z.string(),
    guildId: shared_1.DiscordSnowflakeSchema.nullable(),
    channelId: shared_1.DiscordSnowflakeSchema,
    user: exports.DiscordUserSchema,
    message: zod_1.z.any(), // Discord.js Message object
});
/**
 * Select menu interaction validation schema
 * @description Validates Discord select menu interactions
 */
exports.SelectMenuInteractionSchema = zod_1.z.object({
    customId: zod_1.z.string(),
    values: zod_1.z.array(zod_1.z.string()),
    guildId: shared_1.DiscordSnowflakeSchema.nullable(),
    channelId: shared_1.DiscordSnowflakeSchema,
    user: exports.DiscordUserSchema,
});
/**
 * Modal submit interaction validation schema
 * @description Validates Discord modal submissions
 */
exports.ModalSubmitInteractionSchema = zod_1.z.object({
    customId: zod_1.z.string(),
    fields: zod_1.z.any(), // ModalSubmitFieldsResolver
    guildId: shared_1.DiscordSnowflakeSchema.nullable(),
    channelId: shared_1.DiscordSnowflakeSchema,
    user: exports.DiscordUserSchema,
});
/**
 * Discord embed field schema
 * @description Validates embed field structure
 */
exports.DiscordEmbedFieldSchema = zod_1.z.object({
    name: zod_1.z.string().max(256),
    value: zod_1.z.string().max(1024),
    inline: zod_1.z.boolean().optional(),
});
/**
 * Discord embed schema
 * @description Validates Discord embed structure
 */
exports.DiscordEmbedSchema = zod_1.z.object({
    title: zod_1.z.string().max(256).optional(),
    description: zod_1.z.string().max(4096).optional(),
    url: zod_1.z.string().url().optional(),
    color: zod_1.z.number().int().min(0).max(16777215).optional(),
    timestamp: zod_1.z.string().datetime().optional(),
    fields: zod_1.z.array(exports.DiscordEmbedFieldSchema).max(25).optional(),
    thumbnail: zod_1.z.object({
        url: zod_1.z.string().url(),
    }).optional(),
    image: zod_1.z.object({
        url: zod_1.z.string().url(),
    }).optional(),
    author: zod_1.z.object({
        name: zod_1.z.string().max(256),
        url: zod_1.z.string().url().optional(),
        iconURL: zod_1.z.string().url().optional(),
    }).optional(),
    footer: zod_1.z.object({
        text: zod_1.z.string().max(2048),
        iconURL: zod_1.z.string().url().optional(),
    }).optional(),
});
/**
 * Validate total embed size
 * @description Ensures embed doesn't exceed Discord's 6000 character limit
 */
const validateEmbedSize = (embed) => {
    let totalSize = 0;
    if (embed.title)
        totalSize += embed.title.length;
    if (embed.description)
        totalSize += embed.description.length;
    if (embed.fields) {
        embed.fields.forEach(field => {
            totalSize += field.name.length + field.value.length;
        });
    }
    if (embed.footer?.text)
        totalSize += embed.footer.text.length;
    if (embed.author?.name)
        totalSize += embed.author.name.length;
    return totalSize <= 6000;
};
exports.validateEmbedSize = validateEmbedSize;
//# sourceMappingURL=discord.schema.js.map