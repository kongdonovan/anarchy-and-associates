"use strict";
/**
 * @module GuildConfigSchemas
 * @description Zod schemas for Guild Configuration domain entities
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelConfigRequestSchema = exports.AddAdminRequestSchema = exports.SetPermissionRequestSchema = exports.GuildConfigUpdateRequestSchema = exports.GuildConfigSchema = exports.GuildPermissionsSchema = exports.ChannelCleanupConfigSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Channel cleanup configuration schema
 * @description Settings for automated channel cleanup
 */
exports.ChannelCleanupConfigSchema = zod_1.z.object({
    scanInterval: zod_1.z.number().int().positive().min(300000), // Min 5 minutes
    inactivityThreshold: zod_1.z.number().int().positive().min(86400000), // Min 1 day
    archiveThreshold: zod_1.z.number().int().positive().min(604800000), // Min 7 days
    deleteThreshold: zod_1.z.number().int().positive().min(2592000000), // Min 30 days
    batchSize: zod_1.z.number().int().positive().max(50),
    enableAutoCleanup: zod_1.z.boolean(),
    notificationChannelId: shared_1.DiscordSnowflakeSchema.optional(),
    excludedCategories: zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
    excludedChannels: zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
});
/**
 * Guild permissions schema
 * @description Permission mappings for different actions
 */
exports.GuildPermissionsSchema = zod_1.z.object({
    admin: zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
    'senior-staff': zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
    case: zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
    config: zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
    lawyer: zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
    'lead-attorney': zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
    repair: zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
});
/**
 * Guild configuration entity schema
 * @description Complete validation schema for guild settings
 */
exports.GuildConfigSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    feedbackChannelId: shared_1.DiscordSnowflakeSchema.optional(),
    retainerChannelId: shared_1.DiscordSnowflakeSchema.optional(),
    caseReviewCategoryId: shared_1.DiscordSnowflakeSchema.optional(),
    caseArchiveCategoryId: shared_1.DiscordSnowflakeSchema.optional(),
    modlogChannelId: shared_1.DiscordSnowflakeSchema.optional(),
    applicationChannelId: shared_1.DiscordSnowflakeSchema.optional(),
    defaultInformationChannelId: shared_1.DiscordSnowflakeSchema.optional(),
    defaultRulesChannelId: shared_1.DiscordSnowflakeSchema.optional(),
    clientRoleId: shared_1.DiscordSnowflakeSchema.optional(),
    permissions: exports.GuildPermissionsSchema,
    adminRoles: zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
    adminUsers: zod_1.z.array(shared_1.DiscordSnowflakeSchema).default([]),
    channelCleanupConfig: exports.ChannelCleanupConfigSchema.optional(),
});
/**
 * Guild config update request schema
 * @description Validates partial guild config updates
 */
exports.GuildConfigUpdateRequestSchema = exports.GuildConfigSchema
    .omit({ _id: true, createdAt: true, updatedAt: true, guildId: true })
    .partial();
/**
 * Set permission request schema
 * @description Validates permission assignment requests
 */
exports.SetPermissionRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    action: shared_1.PermissionActionSchema,
    roleId: shared_1.DiscordSnowflakeSchema,
});
/**
 * Add admin request schema
 * @description Validates admin role/user addition
 */
exports.AddAdminRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    type: zod_1.z.enum(['role', 'user']),
    id: shared_1.DiscordSnowflakeSchema,
});
/**
 * Channel configuration request schema
 * @description Validates channel configuration updates
 */
exports.ChannelConfigRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    channelType: zod_1.z.enum([
        'feedback',
        'retainer',
        'caseReview',
        'caseArchive',
        'modlog',
        'application',
        'information',
        'rules'
    ]),
    channelId: shared_1.DiscordSnowflakeSchema.nullable(),
});
//# sourceMappingURL=guild-config.schema.js.map