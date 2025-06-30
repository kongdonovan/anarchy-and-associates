"use strict";
/**
 * @module StaffSchemas
 * @description Zod schemas for Staff domain entities
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffTerminationRequestSchema = exports.StaffRoleChangeRequestSchema = exports.StaffSearchFiltersSchema = exports.StaffUpdateRequestSchema = exports.StaffCreateRequestSchema = exports.StaffSchema = exports.StaffEmploymentStatusSchema = exports.PromotionRecordSchema = exports.PromotionActionTypeSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Promotion action type schema
 */
exports.PromotionActionTypeSchema = zod_1.z.enum(['promotion', 'demotion', 'hire', 'fire']);
/**
 * Promotion record schema
 * @description Tracks staff role transitions and employment history
 */
exports.PromotionRecordSchema = zod_1.z.object({
    fromRole: shared_1.StaffRoleSchema,
    toRole: shared_1.StaffRoleSchema,
    promotedBy: shared_1.DiscordSnowflakeSchema,
    promotedAt: shared_1.FlexibleTimestampSchema,
    reason: zod_1.z.string().max(500).optional(),
    actionType: exports.PromotionActionTypeSchema,
});
/**
 * Staff employment status schema
 */
exports.StaffEmploymentStatusSchema = zod_1.z.enum(['active', 'inactive', 'terminated']);
/**
 * Staff entity schema
 * @description Complete validation schema for staff members
 */
exports.StaffSchema = shared_1.BaseEntitySchema.extend({
    userId: shared_1.DiscordSnowflakeSchema,
    guildId: shared_1.DiscordSnowflakeSchema,
    robloxUsername: zod_1.z.string()
        .min(3, 'Roblox username must be at least 3 characters')
        .max(20, 'Roblox username must not exceed 20 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Roblox username can only contain letters, numbers, and underscores'),
    role: shared_1.StaffRoleSchema,
    hiredAt: shared_1.FlexibleTimestampSchema,
    hiredBy: shared_1.DiscordSnowflakeSchema,
    promotionHistory: zod_1.z.array(exports.PromotionRecordSchema).default([]),
    status: exports.StaffEmploymentStatusSchema,
    discordRoleId: shared_1.DiscordSnowflakeSchema.optional(),
});
/**
 * Staff creation request schema
 * @description Validates data for creating new staff members
 */
exports.StaffCreateRequestSchema = zod_1.z.object({
    userId: shared_1.DiscordSnowflakeSchema,
    guildId: shared_1.DiscordSnowflakeSchema,
    robloxUsername: zod_1.z.string()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/),
    role: shared_1.StaffRoleSchema,
    hiredBy: shared_1.DiscordSnowflakeSchema,
    reason: zod_1.z.string().max(500).optional(),
});
/**
 * Staff update request schema
 * @description Validates partial updates to staff members
 */
exports.StaffUpdateRequestSchema = exports.StaffCreateRequestSchema.partial().extend({
    status: exports.StaffEmploymentStatusSchema.optional(),
    discordRoleId: shared_1.DiscordSnowflakeSchema.optional(),
});
/**
 * Staff search filters schema
 */
exports.StaffSearchFiltersSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema.optional(),
    userId: shared_1.DiscordSnowflakeSchema.optional(),
    role: shared_1.StaffRoleSchema.optional(),
    status: exports.StaffEmploymentStatusSchema.optional(),
    roles: zod_1.z.array(shared_1.StaffRoleSchema).optional(),
});
/**
 * Staff role change request schema
 */
exports.StaffRoleChangeRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    userId: shared_1.DiscordSnowflakeSchema,
    newRole: shared_1.StaffRoleSchema,
    promotedBy: shared_1.DiscordSnowflakeSchema,
    reason: zod_1.z.string().max(500).optional(),
});
/**
 * Staff termination request schema
 */
exports.StaffTerminationRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    userId: shared_1.DiscordSnowflakeSchema,
    terminatedBy: shared_1.DiscordSnowflakeSchema,
    reason: zod_1.z.string().max(500).optional(),
});
//# sourceMappingURL=staff.schema.js.map