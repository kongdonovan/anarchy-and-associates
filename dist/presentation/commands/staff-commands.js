"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffCommands = void 0;
const discordx_1 = require("discordx");
const discord_js_1 = require("discord.js");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const staff_service_1 = require("../../application/services/staff-service");
const discord_role_sync_service_1 = require("../../application/services/discord-role-sync-service");
const permission_service_1 = require("../../application/services/permission-service");
const business_rule_validation_service_1 = require("../../application/services/business-rule-validation-service");
const command_validation_service_1 = require("../../application/services/command-validation-service");
const cross_entity_validation_service_1 = require("../../application/services/cross-entity-validation-service");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const guild_owner_utils_1 = require("../../infrastructure/utils/guild-owner-utils");
const logger_1 = require("../../infrastructure/logger");
const base_command_1 = require("./base-command");
const validation_decorators_1 = require("../decorators/validation-decorators");
const application_repository_1 = require("../../infrastructure/repositories/application-repository");
const job_repository_1 = require("../../infrastructure/repositories/job-repository");
const retainer_repository_1 = require("../../infrastructure/repositories/retainer-repository");
const feedback_repository_1 = require("../../infrastructure/repositories/feedback-repository");
const reminder_repository_1 = require("../../infrastructure/repositories/reminder-repository");
let StaffCommands = class StaffCommands extends base_command_1.BaseCommand {
    // businessRuleValidationService is inherited from BaseCommand
    constructor() {
        super();
        this.staffRepository = new staff_repository_1.StaffRepository();
        this.auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        this.caseRepository = new case_repository_1.CaseRepository();
        this.guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        // Initialize repositories for cross-entity validation
        const applicationRepository = new application_repository_1.ApplicationRepository();
        const jobRepository = new job_repository_1.JobRepository();
        const retainerRepository = new retainer_repository_1.RetainerRepository();
        const feedbackRepository = new feedback_repository_1.FeedbackRepository();
        const reminderRepository = new reminder_repository_1.ReminderRepository();
        // Initialize services
        this.permissionService = new permission_service_1.PermissionService(this.guildConfigRepository);
        this.businessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(this.guildConfigRepository, this.staffRepository, this.caseRepository, this.permissionService);
        this.crossEntityValidationService = new cross_entity_validation_service_1.CrossEntityValidationService(this.staffRepository, this.caseRepository, applicationRepository, jobRepository, retainerRepository, feedbackRepository, reminderRepository, this.auditLogRepository);
        this.commandValidationService = new command_validation_service_1.CommandValidationService(this.businessRuleValidationService, this.crossEntityValidationService);
        // Initialize validation services in base class
        this.initializeValidationServices(this.commandValidationService, this.businessRuleValidationService, this.crossEntityValidationService, this.permissionService);
        this.staffService = new staff_service_1.StaffService(this.staffRepository, this.auditLogRepository, this.permissionService, this.businessRuleValidationService);
        this.roleSyncService = new discord_role_sync_service_1.DiscordRoleSyncService(this.staffRepository, this.auditLogRepository);
    }
    // crossEntityValidationService is inherited from BaseCommand
    async hireStaff(user, role, robloxUsername, reason, interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Server', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            // Validate role
            if (!staff_role_1.RoleUtils.isValidRole(role)) {
                const validRoles = staff_role_1.RoleUtils.getAllRoles().join(', ');
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Role', `Invalid role. Valid roles are: ${validRoles}`)],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            // Check if user performing the action can hire this role
            const actorStaff = await this.staffRepository.findByUserId(interaction.guildId, interaction.user.id);
            if (actorStaff && !context.isGuildOwner) {
                const canHire = staff_role_1.RoleUtils.canPromote(actorStaff.role, role);
                if (!canHire) {
                    await interaction.reply({
                        embeds: [this.createErrorEmbed('Permission Denied', 'You can only hire staff at lower levels than your own role.')],
                        ephemeral: true,
                    });
                    return;
                }
            }
            // Validation decorators have already run, so we can proceed with hiring
            await this.performStaffHiring(interaction, user, role, robloxUsername, reason, context);
        }
        catch (error) {
            logger_1.logger.error('Error in hire staff command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    /**
     * Perform the actual staff hiring (separated for reuse in bypass flow)
     */
    async performStaffHiring(interaction, user, role, robloxUsername, reason, context, bypassReason) {
        try {
            const result = await this.staffService.hireStaff(context, {
                guildId: interaction.guildId,
                userId: user.id,
                robloxUsername,
                role,
                hiredBy: interaction.user.id,
                reason,
                isGuildOwner: context.isGuildOwner
            });
            if (!result.success) {
                const replyMethod = interaction.replied ? 'editReply' : 'reply';
                await interaction[replyMethod]({
                    embeds: [this.createErrorEmbed('Hiring Failed', result.error || 'Failed to hire staff member.')],
                });
                return;
            }
            // Sync Discord role
            if (result.staff) {
                await this.roleSyncService.syncStaffRole(interaction.guild, result.staff, interaction.user.id);
            }
            // Create success message
            let successMessage = `Successfully hired ${user.displayName} as ${role}.\nRoblox Username: ${robloxUsername}`;
            if (bypassReason) {
                successMessage += `\n\n**Guild Owner Bypass Applied**\nReason: ${bypassReason}`;
            }
            const replyMethod = interaction.replied ? 'editReply' : 'reply';
            await interaction[replyMethod]({
                embeds: [bypassReason ?
                        guild_owner_utils_1.GuildOwnerUtils.createBypassSuccessEmbed(role, result.staff?.role ? staff_role_1.RoleUtils.getRoleLevel(result.staff.role) : 1, bypassReason) :
                        this.createSuccessEmbed('Success', successMessage)
                ],
            });
            logger_1.logger.info(`Staff hired: ${user.id} as ${role} by ${interaction.user.id} in guild ${interaction.guildId}`, {
                bypassUsed: !!bypassReason,
                bypassReason
            });
        }
        catch (error) {
            logger_1.logger.error('Error in performStaffHiring:', error);
            const replyMethod = interaction.replied ? 'editReply' : 'reply';
            await interaction[replyMethod]({
                embeds: [this.createErrorEmbed('Hiring Error', 'An error occurred while processing the hiring.')],
            });
        }
    }
    /**
     * Handle guild owner bypass modal submission
     */
    async handleRoleLimitBypass(interaction) {
        try {
            // Verify this is a valid bypass attempt
            if (!guild_owner_utils_1.GuildOwnerUtils.isEligibleForBypass(interaction)) {
                await interaction.reply({
                    embeds: [guild_owner_utils_1.GuildOwnerUtils.createBypassErrorEmbed('You are not authorized to perform bypass operations.')],
                    ephemeral: true
                });
                return;
            }
            // Check if bypass is expired
            if (guild_owner_utils_1.GuildOwnerUtils.isBypassExpired(interaction.customId)) {
                await interaction.reply({
                    embeds: [guild_owner_utils_1.GuildOwnerUtils.createBypassErrorEmbed('Bypass confirmation has expired. Please retry the original command.')],
                    ephemeral: true
                });
                return;
            }
            // Validate bypass confirmation
            const confirmation = guild_owner_utils_1.GuildOwnerUtils.validateBypassConfirmation(interaction);
            if (!confirmation.confirmed) {
                await interaction.reply({
                    embeds: [guild_owner_utils_1.GuildOwnerUtils.createBypassErrorEmbed(confirmation.error || 'Bypass confirmation failed.')],
                    ephemeral: true
                });
                return;
            }
            // Parse bypass information from custom ID
            const bypassInfo = guild_owner_utils_1.GuildOwnerUtils.parseBypassId(interaction.customId);
            if (!bypassInfo) {
                await interaction.reply({
                    embeds: [guild_owner_utils_1.GuildOwnerUtils.createBypassErrorEmbed('Invalid bypass request. Please retry the original command.')],
                    ephemeral: true
                });
                return;
            }
            await interaction.reply({
                embeds: [this.createInfoEmbed('Bypass Confirmed', 'Guild owner bypass has been confirmed. The original operation will now proceed with elevated privileges.\n\n' +
                        '**Note:** You will need to re-run the original hire command as this confirmation does not automatically execute it.')],
                ephemeral: true
            });
            logger_1.logger.info('Guild owner bypass confirmed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                bypassType: bypassInfo.bypassType,
                reason: confirmation.reason
            });
        }
        catch (error) {
            logger_1.logger.error('Error handling role limit bypass:', error);
            await interaction.reply({
                embeds: [guild_owner_utils_1.GuildOwnerUtils.createBypassErrorEmbed('An error occurred while processing the bypass confirmation.')],
                ephemeral: true
            });
        }
    }
    async fireStaff(user, reason, interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Server', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            // Check if target exists and get their role
            const targetStaff = await this.staffRepository.findByUserId(interaction.guildId, user.id);
            if (!targetStaff) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Not Found', 'User is not a staff member.')],
                    ephemeral: true,
                });
                return;
            }
            // Check if user performing the action can fire this staff member
            const actorStaff = await this.staffRepository.findByUserId(interaction.guildId, interaction.user.id);
            if (actorStaff && !context.isGuildOwner) {
                const canFire = staff_role_1.RoleUtils.canDemote(actorStaff.role, targetStaff.role);
                if (!canFire) {
                    await interaction.reply({
                        embeds: [this.createErrorEmbed('Permission Denied', 'You can only fire staff members at lower levels than your own role.')],
                        ephemeral: true,
                    });
                    return;
                }
            }
            // Prevent self-firing unless guild owner
            if (user.id === interaction.user.id && !context.isGuildOwner) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Action', 'You cannot fire yourself.')],
                    ephemeral: true,
                });
                return;
            }
            const result = await this.staffService.fireStaff(context, {
                guildId: interaction.guildId,
                userId: user.id,
                terminatedBy: interaction.user.id,
                reason,
            });
            if (!result.success) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Termination Failed', result.error || 'Failed to fire staff member.')],
                    ephemeral: true,
                });
                return;
            }
            // Remove Discord roles
            await this.roleSyncService.removeStaffRoles(interaction.guild, user.id, interaction.user.id);
            await interaction.reply({
                embeds: [this.createSuccessEmbed('Staff Terminated', `Successfully fired ${user.displayName} (${targetStaff.role}).`)],
            });
            logger_1.logger.info(`Staff fired: ${user.id} (${targetStaff.role}) by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in fire staff command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async promoteStaff(user, role, reason, interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Server', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            // Validate role
            if (!staff_role_1.RoleUtils.isValidRole(role)) {
                const validRoles = staff_role_1.RoleUtils.getAllRoles().join(', ');
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Role', `Invalid role. Valid roles are: ${validRoles}`)],
                    ephemeral: true,
                });
                return;
            }
            // Check if target exists and get their current role
            const targetStaff = await this.staffRepository.findByUserId(interaction.guildId, user.id);
            if (!targetStaff) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Not Found', 'User is not a staff member.')],
                    ephemeral: true,
                });
                return;
            }
            // Check if user performing the action can promote to this role
            const actorStaff = await this.staffRepository.findByUserId(interaction.guildId, interaction.user.id);
            if (actorStaff && !context.isGuildOwner) {
                const canPromote = staff_role_1.RoleUtils.canPromote(actorStaff.role, role);
                if (!canPromote) {
                    await interaction.reply({
                        embeds: [this.createErrorEmbed('Permission Denied', 'You can only promote staff to roles lower than your own.')],
                        ephemeral: true,
                    });
                    return;
                }
            }
            const result = await this.staffService.promoteStaff(context, {
                guildId: interaction.guildId,
                userId: user.id,
                newRole: role,
                promotedBy: interaction.user.id,
                reason,
            });
            if (!result.success) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Promotion Failed', result.error || 'Failed to promote staff member.')],
                    ephemeral: true,
                });
                return;
            }
            // Sync Discord role
            if (result.staff) {
                await this.roleSyncService.syncStaffRole(interaction.guild, result.staff, interaction.user.id);
            }
            await interaction.reply({
                embeds: [this.createSuccessEmbed('Staff Promoted', `Successfully promoted ${user.displayName} from ${targetStaff.role} to ${role}.`)],
            });
            logger_1.logger.info(`Staff promoted: ${user.id} from ${targetStaff.role} to ${role} by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in promote staff command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async demoteStaff(user, role, reason, interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Server', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            // Validate role
            if (!staff_role_1.RoleUtils.isValidRole(role)) {
                const validRoles = staff_role_1.RoleUtils.getAllRoles().join(', ');
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Role', `Invalid role. Valid roles are: ${validRoles}`)],
                    ephemeral: true,
                });
                return;
            }
            // Check if target exists and get their current role
            const targetStaff = await this.staffRepository.findByUserId(interaction.guildId, user.id);
            if (!targetStaff) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Not Found', 'User is not a staff member.')],
                    ephemeral: true,
                });
                return;
            }
            // Check if user performing the action can demote this staff member
            const actorStaff = await this.staffRepository.findByUserId(interaction.guildId, interaction.user.id);
            if (actorStaff && !context.isGuildOwner) {
                const canDemote = staff_role_1.RoleUtils.canDemote(actorStaff.role, targetStaff.role);
                if (!canDemote) {
                    await interaction.reply({
                        embeds: [this.createErrorEmbed('Permission Denied', 'You can only demote staff members at lower levels than your own role.')],
                        ephemeral: true,
                    });
                    return;
                }
            }
            const result = await this.staffService.demoteStaff(context, {
                guildId: interaction.guildId,
                userId: user.id,
                newRole: role,
                promotedBy: interaction.user.id,
                reason,
            });
            if (!result.success) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Demotion Failed', result.error || 'Failed to demote staff member.')],
                    ephemeral: true,
                });
                return;
            }
            // Sync Discord role
            if (result.staff) {
                await this.roleSyncService.syncStaffRole(interaction.guild, result.staff, interaction.user.id);
            }
            await interaction.reply({
                embeds: [this.createSuccessEmbed('Staff Demoted', `Successfully demoted ${user.displayName} from ${targetStaff.role} to ${role}.`)],
            });
            logger_1.logger.info(`Staff demoted: ${user.id} from ${targetStaff.role} to ${role} by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in demote staff command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async listStaff(roleFilter, interaction) {
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Server', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            // Validate role filter if provided
            if (roleFilter && !staff_role_1.RoleUtils.isValidRole(roleFilter)) {
                const validRoles = staff_role_1.RoleUtils.getAllRoles().join(', ');
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Filter', `Invalid role filter. Valid roles are: ${validRoles}`)],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const result = await this.staffService.getStaffList(context, roleFilter, 1, 15);
            if (result.staff.length === 0) {
                const message = roleFilter
                    ? `No staff members found with role: ${roleFilter}`
                    : 'No staff members found.';
                await interaction.reply({
                    embeds: [this.createInfoEmbed('👥 Staff List', message)],
                });
                return;
            }
            const embed = this.createInfoEmbed('👥 Staff List', `Showing ${result.staff.length} staff members`);
            // Group staff by role for better organization
            const staffByRole = new Map();
            result.staff.forEach(staff => {
                if (!staffByRole.has(staff.role)) {
                    staffByRole.set(staff.role, []);
                }
                staffByRole.get(staff.role).push(staff);
            });
            // Sort roles by hierarchy level (highest first)
            const sortedRoles = Array.from(staffByRole.keys()).sort((a, b) => staff_role_1.RoleUtils.getRoleLevel(b) - staff_role_1.RoleUtils.getRoleLevel(a));
            for (const role of sortedRoles) {
                const staffList = staffByRole.get(role);
                const staffNames = staffList.map(staff => `<@${staff.userId}> (${staff.robloxUsername})`).join('\n');
                embed.addFields({
                    name: `${role} (${staffList.length})`,
                    value: staffNames,
                    inline: false,
                });
            }
            embed.addFields({
                name: 'Summary',
                value: `Total: ${result.total} staff members`,
                inline: false,
            });
            await interaction.reply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error in list staff command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async staffInfo(user, interaction) {
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Invalid Server', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const staff = await this.staffService.getStaffInfo(context, user.id);
            if (!staff) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Not Found', 'User is not a staff member.')],
                    ephemeral: true,
                });
                return;
            }
            const embed = this.createInfoEmbed(`👤 Staff Information: ${user.displayName}`, `Detailed information for staff member`);
            embed.addFields({ name: 'Role', value: staff.role, inline: true }, { name: 'Status', value: staff.status, inline: true }, { name: 'Roblox Username', value: staff.robloxUsername, inline: true }, { name: 'Hired Date', value: `<t:${Math.floor(staff.hiredAt.getTime() / 1000)}:F>`, inline: true }, { name: 'Hired By', value: `<@${staff.hiredBy}>`, inline: true }, { name: 'Role Level', value: staff_role_1.RoleUtils.getRoleLevel(staff.role).toString(), inline: true });
            // Add promotion history if available
            if (staff.promotionHistory.length > 0) {
                const recentHistory = staff.promotionHistory
                    .slice(-5) // Last 5 records
                    .map(record => `**${record.actionType}**: ${record.fromRole} → ${record.toRole} by <@${record.promotedBy}> ` +
                    `(<t:${Math.floor(record.promotedAt.getTime() / 1000)}:R>)`)
                    .join('\n');
                embed.addFields({
                    name: 'Recent History',
                    value: recentHistory,
                    inline: false,
                });
            }
            await interaction.reply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error in staff info command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
};
exports.StaffCommands = StaffCommands;
__decorate([
    (0, discordx_1.Slash)({ name: 'hire', description: 'Hire a new staff member' }),
    (0, validation_decorators_1.ValidatePermissions)('senior-staff'),
    (0, validation_decorators_1.ValidateBusinessRules)('role_limit'),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'user',
        description: 'User to hire',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true,
    })),
    __param(1, (0, discordx_1.SlashOption)({
        name: 'role',
        description: 'Role to assign',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true,
    })),
    __param(2, (0, discordx_1.SlashOption)({
        name: 'roblox_username',
        description: 'Roblox username',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true,
    })),
    __param(3, (0, discordx_1.SlashOption)({
        name: 'reason',
        description: 'Reason for hiring',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User, String, String, String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], StaffCommands.prototype, "hireStaff", null);
__decorate([
    (0, discordx_1.ModalComponent)({ id: /role_limit_bypass_.*/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ModalSubmitInteraction]),
    __metadata("design:returntype", Promise)
], StaffCommands.prototype, "handleRoleLimitBypass", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'fire', description: 'Fire a staff member' }),
    (0, validation_decorators_1.ValidatePermissions)('senior-staff'),
    (0, validation_decorators_1.ValidateBusinessRules)('staff_member'),
    (0, validation_decorators_1.ValidateEntity)('staff', 'delete'),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'user',
        description: 'User to fire',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true,
    })),
    __param(1, (0, discordx_1.SlashOption)({
        name: 'reason',
        description: 'Reason for firing',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User, String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], StaffCommands.prototype, "fireStaff", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'promote', description: 'Promote a staff member' }),
    (0, validation_decorators_1.ValidatePermissions)('senior-staff'),
    (0, validation_decorators_1.ValidateBusinessRules)('staff_member', 'role_limit'),
    (0, validation_decorators_1.ValidateEntity)('staff', 'update'),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'user',
        description: 'User to promote',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true,
    })),
    __param(1, (0, discordx_1.SlashOption)({
        name: 'role',
        description: 'New role to assign',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true,
    })),
    __param(2, (0, discordx_1.SlashOption)({
        name: 'reason',
        description: 'Reason for promotion',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User, String, String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], StaffCommands.prototype, "promoteStaff", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'demote', description: 'Demote a staff member' }),
    (0, validation_decorators_1.ValidatePermissions)('senior-staff'),
    (0, validation_decorators_1.ValidateBusinessRules)('staff_member'),
    (0, validation_decorators_1.ValidateEntity)('staff', 'update'),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'user',
        description: 'User to demote',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true,
    })),
    __param(1, (0, discordx_1.SlashOption)({
        name: 'role',
        description: 'New role to assign',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true,
    })),
    __param(2, (0, discordx_1.SlashOption)({
        name: 'reason',
        description: 'Reason for demotion',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User, String, String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], StaffCommands.prototype, "demoteStaff", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'list', description: 'List all staff members' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'role',
        description: 'Filter by role',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], StaffCommands.prototype, "listStaff", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'info', description: 'View detailed staff member information' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'user',
        description: 'User to view information for',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], StaffCommands.prototype, "staffInfo", null);
exports.StaffCommands = StaffCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ name: 'staff', description: 'Staff management commands' }),
    (0, discordx_1.SlashGroup)('staff'),
    __metadata("design:paramtypes", [])
], StaffCommands);
//# sourceMappingURL=staff-commands.js.map