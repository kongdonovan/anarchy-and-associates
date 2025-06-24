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
const staff_service_1 = require("../../application/services/staff-service");
const discord_role_sync_service_1 = require("../../application/services/discord-role-sync-service");
const permission_service_1 = require("../../application/services/permission-service");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const logger_1 = require("../../infrastructure/logger");
let StaffCommands = class StaffCommands {
    constructor() {
        this.staffRepository = new staff_repository_1.StaffRepository();
        this.auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        this.guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        this.staffService = new staff_service_1.StaffService(this.staffRepository, this.auditLogRepository);
        this.roleSyncService = new discord_role_sync_service_1.DiscordRoleSyncService(this.staffRepository, this.auditLogRepository);
        this.permissionService = new permission_service_1.PermissionService(this.guildConfigRepository);
    }
    async getPermissionContext(interaction) {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const userRoles = member?.roles.cache.map(role => role.id) || [];
        const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;
        return {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            userRoles,
            isGuildOwner,
        };
    }
    createErrorEmbed(message) {
        return new discord_js_1.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error')
            .setDescription(message)
            .setTimestamp();
    }
    createSuccessEmbed(message) {
        return new discord_js_1.EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Success')
            .setDescription(message)
            .setTimestamp();
    }
    createInfoEmbed(title, description) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(title)
            .setTimestamp();
        if (description) {
            embed.setDescription(description);
        }
        return embed;
    }
    async hireStaff(user, role, robloxUsername, reason, interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'hr');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You do not have permission to hire staff members.')],
                    ephemeral: true,
                });
                return;
            }
            // Validate role
            if (!staff_role_1.RoleUtils.isValidRole(role)) {
                const validRoles = staff_role_1.RoleUtils.getAllRoles().join(', ');
                await interaction.reply({
                    embeds: [this.createErrorEmbed(`Invalid role. Valid roles are: ${validRoles}`)],
                    ephemeral: true,
                });
                return;
            }
            // Check if user performing the action can hire this role
            const actorStaff = await this.staffRepository.findByUserId(interaction.guildId, interaction.user.id);
            if (actorStaff && !context.isGuildOwner) {
                const canHire = staff_role_1.RoleUtils.canPromote(actorStaff.role, role);
                if (!canHire) {
                    await interaction.reply({
                        embeds: [this.createErrorEmbed('You can only hire staff at lower levels than your own role.')],
                        ephemeral: true,
                    });
                    return;
                }
            }
            const result = await this.staffService.hireStaff({
                guildId: interaction.guildId,
                userId: user.id,
                robloxUsername,
                role: role,
                hiredBy: interaction.user.id,
                reason,
            });
            if (!result.success) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed(result.error || 'Failed to hire staff member.')],
                    ephemeral: true,
                });
                return;
            }
            // Sync Discord role
            if (result.staff) {
                await this.roleSyncService.syncStaffRole(interaction.guild, result.staff, interaction.user.id);
            }
            await interaction.reply({
                embeds: [this.createSuccessEmbed(`Successfully hired ${user.displayName} as ${role}.\nRoblox Username: ${robloxUsername}`)],
            });
            logger_1.logger.info(`Staff hired: ${user.id} as ${role} by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in hire staff command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async fireStaff(user, reason, interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'hr');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You do not have permission to fire staff members.')],
                    ephemeral: true,
                });
                return;
            }
            // Check if target exists and get their role
            const targetStaff = await this.staffRepository.findByUserId(interaction.guildId, user.id);
            if (!targetStaff) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('User is not a staff member.')],
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
                        embeds: [this.createErrorEmbed('You can only fire staff members at lower levels than your own role.')],
                        ephemeral: true,
                    });
                    return;
                }
            }
            // Prevent self-firing unless guild owner
            if (user.id === interaction.user.id && !context.isGuildOwner) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You cannot fire yourself.')],
                    ephemeral: true,
                });
                return;
            }
            const result = await this.staffService.fireStaff({
                guildId: interaction.guildId,
                userId: user.id,
                terminatedBy: interaction.user.id,
                reason,
            });
            if (!result.success) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed(result.error || 'Failed to fire staff member.')],
                    ephemeral: true,
                });
                return;
            }
            // Remove Discord roles
            await this.roleSyncService.removeStaffRoles(interaction.guild, user.id, interaction.user.id);
            await interaction.reply({
                embeds: [this.createSuccessEmbed(`Successfully fired ${user.displayName} (${targetStaff.role}).`)],
            });
            logger_1.logger.info(`Staff fired: ${user.id} (${targetStaff.role}) by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in fire staff command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async promoteStaff(user, role, reason, interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'hr');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You do not have permission to promote staff members.')],
                    ephemeral: true,
                });
                return;
            }
            // Validate role
            if (!staff_role_1.RoleUtils.isValidRole(role)) {
                const validRoles = staff_role_1.RoleUtils.getAllRoles().join(', ');
                await interaction.reply({
                    embeds: [this.createErrorEmbed(`Invalid role. Valid roles are: ${validRoles}`)],
                    ephemeral: true,
                });
                return;
            }
            // Check if target exists and get their current role
            const targetStaff = await this.staffRepository.findByUserId(interaction.guildId, user.id);
            if (!targetStaff) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('User is not a staff member.')],
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
                        embeds: [this.createErrorEmbed('You can only promote staff to roles lower than your own.')],
                        ephemeral: true,
                    });
                    return;
                }
            }
            const result = await this.staffService.promoteStaff({
                guildId: interaction.guildId,
                userId: user.id,
                newRole: role,
                promotedBy: interaction.user.id,
                reason,
            });
            if (!result.success) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed(result.error || 'Failed to promote staff member.')],
                    ephemeral: true,
                });
                return;
            }
            // Sync Discord role
            if (result.staff) {
                await this.roleSyncService.syncStaffRole(interaction.guild, result.staff, interaction.user.id);
            }
            await interaction.reply({
                embeds: [this.createSuccessEmbed(`Successfully promoted ${user.displayName} from ${targetStaff.role} to ${role}.`)],
            });
            logger_1.logger.info(`Staff promoted: ${user.id} from ${targetStaff.role} to ${role} by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in promote staff command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async demoteStaff(user, role, reason, interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'hr');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You do not have permission to demote staff members.')],
                    ephemeral: true,
                });
                return;
            }
            // Validate role
            if (!staff_role_1.RoleUtils.isValidRole(role)) {
                const validRoles = staff_role_1.RoleUtils.getAllRoles().join(', ');
                await interaction.reply({
                    embeds: [this.createErrorEmbed(`Invalid role. Valid roles are: ${validRoles}`)],
                    ephemeral: true,
                });
                return;
            }
            // Check if target exists and get their current role
            const targetStaff = await this.staffRepository.findByUserId(interaction.guildId, user.id);
            if (!targetStaff) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('User is not a staff member.')],
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
                        embeds: [this.createErrorEmbed('You can only demote staff members at lower levels than your own role.')],
                        ephemeral: true,
                    });
                    return;
                }
            }
            const result = await this.staffService.demoteStaff({
                guildId: interaction.guildId,
                userId: user.id,
                newRole: role,
                promotedBy: interaction.user.id,
                reason,
            });
            if (!result.success) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed(result.error || 'Failed to demote staff member.')],
                    ephemeral: true,
                });
                return;
            }
            // Sync Discord role
            if (result.staff) {
                await this.roleSyncService.syncStaffRole(interaction.guild, result.staff, interaction.user.id);
            }
            await interaction.reply({
                embeds: [this.createSuccessEmbed(`Successfully demoted ${user.displayName} from ${targetStaff.role} to ${role}.`)],
            });
            logger_1.logger.info(`Staff demoted: ${user.id} from ${targetStaff.role} to ${role} by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in demote staff command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async listStaff(roleFilter, interaction) {
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            // Validate role filter if provided
            if (roleFilter && !staff_role_1.RoleUtils.isValidRole(roleFilter)) {
                const validRoles = staff_role_1.RoleUtils.getAllRoles().join(', ');
                await interaction.reply({
                    embeds: [this.createErrorEmbed(`Invalid role filter. Valid roles are: ${validRoles}`)],
                    ephemeral: true,
                });
                return;
            }
            const result = await this.staffService.getStaffList(interaction.guildId, interaction.user.id, roleFilter, 1, 15);
            if (result.staff.length === 0) {
                const message = roleFilter
                    ? `No staff members found with role: ${roleFilter}`
                    : 'No staff members found.';
                await interaction.reply({
                    embeds: [this.createInfoEmbed('👥 Staff List', message)],
                });
                return;
            }
            const embed = this.createInfoEmbed('👥 Staff List');
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
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async staffInfo(user, interaction) {
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const staff = await this.staffService.getStaffInfo(interaction.guildId, user.id, interaction.user.id);
            if (!staff) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('User is not a staff member.')],
                    ephemeral: true,
                });
                return;
            }
            const embed = this.createInfoEmbed(`👤 Staff Information: ${user.displayName}`);
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
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
};
exports.StaffCommands = StaffCommands;
__decorate([
    (0, discordx_1.Slash)({ name: 'hire', description: 'Hire a new staff member' }),
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
    (0, discordx_1.Slash)({ name: 'fire', description: 'Fire a staff member' }),
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