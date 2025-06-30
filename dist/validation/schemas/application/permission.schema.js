"use strict";
/**
 * @module PermissionSchemas
 * @description Zod schemas for permission and authorization structures
 * @category Application/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkPermissionCheckResultSchema = exports.BulkPermissionCheckRequestSchema = exports.ActionPermissionResultSchema = exports.PermissionRevokeRequestSchema = exports.PermissionGrantRequestSchema = exports.PermissionCheckRequestSchema = exports.PermissionContextSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Permission context schema
 * @description Runtime context for permission checks
 */
exports.PermissionContextSchema = zod_1.z.object({
    userId: shared_1.DiscordSnowflakeSchema,
    guildId: shared_1.DiscordSnowflakeSchema,
    isGuildOwner: zod_1.z.boolean(),
    hasAdminRole: zod_1.z.boolean(),
    hasSeniorStaffRole: zod_1.z.boolean().optional(),
    hasHRRole: zod_1.z.boolean().optional(),
    hasCaseRole: zod_1.z.boolean().optional(),
    hasConfigRole: zod_1.z.boolean().optional(),
    hasLawyerRole: zod_1.z.boolean().optional(),
    hasLeadAttorneyRole: zod_1.z.boolean().optional(),
    hasRepairRole: zod_1.z.boolean().optional(),
});
/**
 * Permission check request schema
 * @description Request to check if user has specific permission
 */
exports.PermissionCheckRequestSchema = zod_1.z.object({
    context: exports.PermissionContextSchema,
    action: shared_1.PermissionActionSchema,
    targetUserId: shared_1.DiscordSnowflakeSchema.optional(),
    targetRoleLevel: zod_1.z.number().int().optional(),
});
/**
 * Permission grant request schema
 * @description Request to grant permissions to a role
 */
exports.PermissionGrantRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    roleId: shared_1.DiscordSnowflakeSchema,
    action: shared_1.PermissionActionSchema,
    grantedBy: shared_1.DiscordSnowflakeSchema,
});
/**
 * Permission revoke request schema
 * @description Request to revoke permissions from a role
 */
exports.PermissionRevokeRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    roleId: shared_1.DiscordSnowflakeSchema,
    action: shared_1.PermissionActionSchema,
    revokedBy: shared_1.DiscordSnowflakeSchema,
});
/**
 * Action permission result schema
 * @description Result of permission check for an action
 */
exports.ActionPermissionResultSchema = zod_1.z.object({
    allowed: zod_1.z.boolean(),
    reason: zod_1.z.string().optional(),
    requiredRole: zod_1.z.string().optional(),
    userRoles: zod_1.z.array(zod_1.z.string()).optional(),
});
/**
 * Bulk permission check request schema
 * @description Check multiple permissions at once
 */
exports.BulkPermissionCheckRequestSchema = zod_1.z.object({
    context: exports.PermissionContextSchema,
    actions: zod_1.z.array(shared_1.PermissionActionSchema),
});
/**
 * Bulk permission check result schema
 */
exports.BulkPermissionCheckResultSchema = zod_1.z.object({
    results: zod_1.z.record(shared_1.PermissionActionSchema, exports.ActionPermissionResultSchema),
    allAllowed: zod_1.z.boolean(),
    anyAllowed: zod_1.z.boolean(),
});
//# sourceMappingURL=permission.schema.js.map