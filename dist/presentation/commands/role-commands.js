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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleCommands = void 0;
const discordx_1 = require("discordx");
const discord_js_1 = require("discord.js");
const permission_service_1 = require("../../application/services/permission-service");
const role_tracking_service_1 = require("../../application/services/role-tracking-service");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const logger_1 = require("../../infrastructure/logger");
let RoleCommands = class RoleCommands {
    constructor() {
        this.guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        this.permissionService = new permission_service_1.PermissionService(this.guildConfigRepository);
        this.roleTrackingService = new role_tracking_service_1.RoleTrackingService();
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
        return embed_utils_1.EmbedUtils.createErrorEmbed('Error', message);
    }
    async syncRoles(interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            // Check permissions - only admin can sync roles
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'admin');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You need admin permissions to sync roles.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.deferReply({ ephemeral: true });
            // Perform role sync
            await this.roleTrackingService.syncGuildRoles(interaction.guild);
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: '🔄 Role Synchronization Complete',
                description: 'Successfully synchronized Discord roles with staff database.'
            });
            embed.addFields({
                name: 'Synchronization Details',
                value: [
                    '✅ Checked all Discord roles against staff database',
                    '✅ Added missing staff records for users with roles',
                    '✅ Marked terminated staff who no longer have roles',
                    '✅ Updated audit logs for all changes'
                ].join('\n'),
                inline: false
            });
            await interaction.editReply({ embeds: [embed] });
            logger_1.logger.info(`Role sync performed by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in role sync command:', error);
            const errorEmbed = this.createErrorEmbed('Failed to synchronize roles. Please try again later.');
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
            else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
    async roleStatus(interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            // Check permissions
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'admin');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You need admin permissions to view role status.')],
                    ephemeral: true,
                });
                return;
            }
            // Count Discord roles vs staff records
            const members = await interaction.guild.members.fetch();
            const staffRoles = ['Managing Partner', 'Senior Partner', 'Partner', 'Senior Associate', 'Associate', 'Paralegal'];
            let discordStaffCount = 0;
            const roleBreakdown = {};
            for (const [, member] of members) {
                const memberStaffRoles = member.roles.cache
                    .map(r => r.name)
                    .filter(name => staffRoles.includes(name));
                if (memberStaffRoles.length > 0) {
                    discordStaffCount++;
                    // Count highest role for each member
                    for (const roleName of staffRoles) {
                        if (memberStaffRoles.includes(roleName)) {
                            roleBreakdown[roleName] = (roleBreakdown[roleName] || 0) + 1;
                            break; // Only count highest role
                        }
                    }
                }
            }
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: '📊 Role Tracking Status',
                description: 'Current state of role tracking system'
            });
            embed.addFields({
                name: '👥 Discord Staff Members',
                value: `${discordStaffCount} members with staff roles`,
                inline: true
            }, {
                name: '🔄 Tracking Status',
                value: '✅ Active and monitoring role changes',
                inline: true
            }, {
                name: '\u200B',
                value: '\u200B',
                inline: true
            });
            // Add role breakdown
            if (Object.keys(roleBreakdown).length > 0) {
                const roleText = Object.entries(roleBreakdown)
                    .map(([role, count]) => `${role}: ${count}`)
                    .join('\n');
                embed.addFields({
                    name: '📋 Role Distribution',
                    value: roleText,
                    inline: false
                });
            }
            embed.addFields({
                name: '⚙️ System Information',
                value: [
                    '• Monitors: `guildMemberUpdate` events',
                    '• Tracks: Hiring, firing, promotions, demotions',
                    '• Logs: All changes to audit log',
                    '• Database: Automatic staff record updates'
                ].join('\n'),
                inline: false
            });
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        catch (error) {
            logger_1.logger.error('Error in role status command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('Failed to retrieve role status.')],
                ephemeral: true,
            });
        }
    }
};
exports.RoleCommands = RoleCommands;
__decorate([
    (0, discordx_1.Slash)({ name: 'sync', description: 'Synchronize Discord roles with staff database' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RoleCommands.prototype, "syncRoles", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'status', description: 'View role tracking system status' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RoleCommands.prototype, "roleStatus", null);
exports.RoleCommands = RoleCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ name: 'role', description: 'Role management and synchronization commands' }),
    (0, discordx_1.SlashGroup)('role'),
    __metadata("design:paramtypes", [])
], RoleCommands);
//# sourceMappingURL=role-commands.js.map