"use strict";
/**
 * @module CommandSchemas
 * @description Zod schemas for Discord command validation
 * @category Commands/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandValidationHelpers = exports.JobApplicationModalSchema = exports.ApplicationReviewButtonSchema = exports.JobApplicationButtonSchema = exports.AdminConfigCommandSchema = exports.AdminSetupServerCommandSchema = exports.JobApplyCommandSchema = exports.JobCloseCommandSchema = exports.JobPostCommandSchema = exports.CaseCloseCommandSchema = exports.CaseAssignCommandSchema = exports.CaseOpenCommandSchema = exports.StaffInfoCommandSchema = exports.StaffListCommandSchema = exports.StaffDemoteCommandSchema = exports.StaffPromoteCommandSchema = exports.StaffFireCommandSchema = exports.StaffHireCommandSchema = exports.BaseCommandSchema = void 0;
exports.validateCommand = validateCommand;
const zod_1 = require("zod");
const shared_1 = require("../shared");
const discord_schema_1 = require("../infrastructure/discord.schema");
/**
 * Base command schemas for different interaction types
 */
exports.BaseCommandSchema = zod_1.z.object({
    permissionService: zod_1.z.any(), // Would be z.instanceof(PermissionService) in real code
    crossEntityValidationService: zod_1.z.any().optional(),
    businessRuleValidationService: zod_1.z.any().optional(),
});
/**
 * Staff command input schemas
 */
exports.StaffHireCommandSchema = zod_1.z.object({
    user: discord_schema_1.DiscordUserSchema,
    roleString: zod_1.z.string().optional(),
    discordRole: zod_1.z.object({
        id: shared_1.DiscordSnowflakeSchema,
        name: zod_1.z.string(),
    }).optional(),
    robloxUsername: zod_1.z.string()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/),
    reason: zod_1.z.string().max(500).optional(),
    interaction: discord_schema_1.CommandInteractionSchema,
}).refine((data) => {
    // Ensure at least one role input is provided
    return Boolean(data.roleString || data.discordRole);
}, {
    message: 'Either role name or Discord role must be provided'
});
exports.StaffFireCommandSchema = zod_1.z.object({
    user: discord_schema_1.DiscordUserSchema,
    reason: zod_1.z.string().max(500).optional(),
    interaction: discord_schema_1.CommandInteractionSchema,
});
exports.StaffPromoteCommandSchema = zod_1.z.object({
    user: discord_schema_1.DiscordUserSchema,
    role: shared_1.StaffRoleSchema,
    reason: zod_1.z.string().max(500).optional(),
    interaction: discord_schema_1.CommandInteractionSchema,
});
exports.StaffDemoteCommandSchema = zod_1.z.object({
    user: discord_schema_1.DiscordUserSchema,
    role: shared_1.StaffRoleSchema,
    reason: zod_1.z.string().max(500).optional(),
    interaction: discord_schema_1.CommandInteractionSchema,
});
exports.StaffListCommandSchema = zod_1.z.object({
    roleFilter: shared_1.StaffRoleSchema.optional(),
    interaction: discord_schema_1.CommandInteractionSchema,
});
exports.StaffInfoCommandSchema = zod_1.z.object({
    user: discord_schema_1.DiscordUserSchema,
    interaction: discord_schema_1.CommandInteractionSchema,
});
/**
 * Case command input schemas
 */
exports.CaseOpenCommandSchema = zod_1.z.object({
    title: zod_1.z.string().min(5).max(200),
    description: zod_1.z.string().min(20).max(2000),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    interaction: discord_schema_1.CommandInteractionSchema,
});
exports.CaseAssignCommandSchema = zod_1.z.object({
    caseNumber: zod_1.z.string(),
    lawyer: discord_schema_1.DiscordUserSchema,
    leadAttorney: zod_1.z.boolean().optional(),
    interaction: discord_schema_1.CommandInteractionSchema,
});
exports.CaseCloseCommandSchema = zod_1.z.object({
    caseNumber: zod_1.z.string(),
    result: zod_1.z.enum(['win', 'loss', 'settlement', 'dismissed', 'withdrawn']),
    notes: zod_1.z.string().max(2000).optional(),
    interaction: discord_schema_1.CommandInteractionSchema,
});
/**
 * Job command input schemas
 */
exports.JobPostCommandSchema = zod_1.z.object({
    title: zod_1.z.string().min(5).max(100),
    description: zod_1.z.string().min(20).max(2000),
    role: zod_1.z.union([shared_1.StaffRoleSchema, zod_1.z.string()]),
    interaction: discord_schema_1.CommandInteractionSchema,
});
exports.JobCloseCommandSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    reason: zod_1.z.string().max(500).optional(),
    interaction: discord_schema_1.CommandInteractionSchema,
});
/**
 * Application command input schemas
 */
exports.JobApplyCommandSchema = zod_1.z.object({
    interaction: discord_schema_1.CommandInteractionSchema,
});
/**
 * Admin command input schemas
 */
exports.AdminSetupServerCommandSchema = zod_1.z.object({
    confirmation: zod_1.z.literal('DELETE EVERYTHING'),
    interaction: discord_schema_1.CommandInteractionSchema,
});
exports.AdminConfigCommandSchema = zod_1.z.object({
    setting: zod_1.z.string(),
    value: zod_1.z.string().optional(),
    interaction: discord_schema_1.CommandInteractionSchema,
});
/**
 * Button interaction schemas
 */
exports.JobApplicationButtonSchema = zod_1.z.object({
    customId: zod_1.z.string().regex(/^job_apply_/),
    jobId: zod_1.z.string().transform(id => id.replace('job_apply_', '')),
    interaction: discord_schema_1.ButtonInteractionSchema,
});
exports.ApplicationReviewButtonSchema = zod_1.z.object({
    customId: zod_1.z.string().regex(/^application_(accept|reject)_/),
    action: zod_1.z.enum(['accept', 'reject']),
    applicationId: zod_1.z.string(),
    interaction: discord_schema_1.ButtonInteractionSchema,
});
/**
 * Modal submit schemas
 */
exports.JobApplicationModalSchema = zod_1.z.object({
    customId: zod_1.z.string().regex(/^job_application_/),
    jobId: zod_1.z.string(),
    fields: zod_1.z.object({
        robloxUsername: zod_1.z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
        answers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
    }),
    interaction: discord_schema_1.ModalSubmitInteractionSchema,
});
/**
 * Command validation wrapper
 * @description Validates command inputs before execution
 */
function validateCommand(schema, handler) {
    return async (data) => {
        const validated = shared_1.ValidationHelpers.validateOrThrow(schema, data, 'Command input');
        await handler(validated);
    };
}
/**
 * Interaction validation helpers
 */
exports.CommandValidationHelpers = {
    /**
     * Validate command has required guild context
     */
    validateGuildCommand(interaction) {
        const validated = discord_schema_1.CommandInteractionSchema.parse(interaction);
        if (!validated.guildId) {
            throw new Error('This command can only be used in a server');
        }
    },
    /**
     * Extract role from string or Discord role
     */
    extractStaffRole(roleString, discordRole) {
        if (roleString && shared_1.StaffRoleSchema.safeParse(roleString).success) {
            return roleString;
        }
        if (discordRole) {
            const roleName = discordRole.name;
            if (shared_1.StaffRoleSchema.safeParse(roleName).success) {
                return roleName;
            }
            // Try to extract from job-specific role (e.g., "Senior Associate - Legal")
            const parts = roleName.split(' - ');
            const firstPart = parts[0];
            if (firstPart) {
                const baseRoleName = firstPart.trim();
                if (shared_1.StaffRoleSchema.safeParse(baseRoleName).success) {
                    return baseRoleName;
                }
            }
        }
        throw new Error('Invalid staff role');
    },
};
//# sourceMappingURL=command.schema.js.map