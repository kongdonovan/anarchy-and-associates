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
exports.RoleCommands = void 0;
const discordx_1 = require("discordx");
const discord_js_1 = require("discord.js");
const permission_service_1 = require("../../application/services/permission-service");
const role_tracking_service_1 = require("../../application/services/role-tracking-service");
const role_synchronization_enhancement_service_1 = require("../../application/services/role-synchronization-enhancement-service");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const logger_1 = require("../../infrastructure/logger");
let RoleCommands = class RoleCommands {
    constructor() {
        this.guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        this.permissionService = new permission_service_1.PermissionService(this.guildConfigRepository);
        this.roleTrackingService = new role_tracking_service_1.RoleTrackingService();
        this.roleSyncEnhancementService = new role_synchronization_enhancement_service_1.RoleSynchronizationEnhancementService();
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
        const context = await this.getPermissionContext(interaction);
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
        const context = await this.getPermissionContext(interaction);
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
    async syncCheck(autoResolve = false, interaction) {
        try {
            if (!interaction.guildId || !interaction.guild) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            // Check permissions - only admin can check/resolve conflicts
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'admin');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You need admin permissions to check role conflicts.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.deferReply({ ephemeral: true });
            // Scan for conflicts
            const conflicts = await this.roleSyncEnhancementService.scanGuildForConflicts(interaction.guild);
            if (conflicts.length === 0) {
                const embed = embed_utils_1.EmbedUtils.createSuccessEmbed('✅ No Conflicts Found', 'All staff members have only one staff role assigned. No conflicts detected.');
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            // Create conflict summary embed
            const conflictEmbed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: '⚠️ Staff Role Conflicts Detected',
                description: `Found ${conflicts.length} member(s) with multiple staff roles.`
            });
            // Group conflicts by severity
            const severityGroups = {
                [role_synchronization_enhancement_service_1.ConflictSeverity.CRITICAL]: conflicts.filter(c => c.severity === role_synchronization_enhancement_service_1.ConflictSeverity.CRITICAL),
                [role_synchronization_enhancement_service_1.ConflictSeverity.HIGH]: conflicts.filter(c => c.severity === role_synchronization_enhancement_service_1.ConflictSeverity.HIGH),
                [role_synchronization_enhancement_service_1.ConflictSeverity.MEDIUM]: conflicts.filter(c => c.severity === role_synchronization_enhancement_service_1.ConflictSeverity.MEDIUM),
                [role_synchronization_enhancement_service_1.ConflictSeverity.LOW]: conflicts.filter(c => c.severity === role_synchronization_enhancement_service_1.ConflictSeverity.LOW),
            };
            // Add severity breakdown
            if (severityGroups[role_synchronization_enhancement_service_1.ConflictSeverity.CRITICAL].length > 0) {
                conflictEmbed.addFields({
                    name: '🔴 Critical Conflicts',
                    value: `${severityGroups[role_synchronization_enhancement_service_1.ConflictSeverity.CRITICAL].length} member(s) with multiple high-level roles`,
                    inline: true
                });
            }
            if (severityGroups[role_synchronization_enhancement_service_1.ConflictSeverity.HIGH].length > 0) {
                conflictEmbed.addFields({
                    name: '🟠 High Severity',
                    value: `${severityGroups[role_synchronization_enhancement_service_1.ConflictSeverity.HIGH].length} member(s) with large role differences`,
                    inline: true
                });
            }
            if (severityGroups[role_synchronization_enhancement_service_1.ConflictSeverity.MEDIUM].length > 0) {
                conflictEmbed.addFields({
                    name: '🟡 Medium Severity',
                    value: `${severityGroups[role_synchronization_enhancement_service_1.ConflictSeverity.MEDIUM].length} member(s) with moderate conflicts`,
                    inline: true
                });
            }
            if (severityGroups[role_synchronization_enhancement_service_1.ConflictSeverity.LOW].length > 0) {
                conflictEmbed.addFields({
                    name: '🟢 Low Severity',
                    value: `${severityGroups[role_synchronization_enhancement_service_1.ConflictSeverity.LOW].length} member(s) with minor conflicts`,
                    inline: true
                });
            }
            // Show first 5 conflicts as examples
            const exampleConflicts = conflicts.slice(0, 5);
            const conflictDetails = exampleConflicts.map(c => `• **${c.username}**: ${c.conflictingRoles.map(r => r.roleName).join(', ')} → Keep: ${c.highestRole.roleName}`).join('\n');
            conflictEmbed.addFields({
                name: '📋 Example Conflicts',
                value: conflictDetails + (conflicts.length > 5 ? `\n... and ${conflicts.length - 5} more` : ''),
                inline: false
            });
            // If auto-resolve is requested, proceed with resolution
            if (autoResolve) {
                conflictEmbed.addFields({
                    name: '🔄 Auto-Resolution',
                    value: 'Starting automatic conflict resolution...',
                    inline: false
                });
                await interaction.editReply({ embeds: [conflictEmbed] });
                // Perform bulk resolution with progress updates
                let lastUpdateTime = Date.now();
                const results = await this.roleSyncEnhancementService.bulkResolveConflicts(interaction.guild, conflicts, async (progress) => {
                    // Update every 2 seconds to avoid rate limits
                    if (Date.now() - lastUpdateTime > 2000) {
                        lastUpdateTime = Date.now();
                        const progressEmbed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                            title: '🔄 Resolution in Progress',
                            description: `Processing ${progress.processed}/${progress.total} conflicts...`
                        });
                        progressEmbed.addFields({
                            name: '✅ Resolved',
                            value: progress.conflictsResolved.toString(),
                            inline: true
                        }, {
                            name: '❌ Errors',
                            value: progress.errors.toString(),
                            inline: true
                        }, {
                            name: '📊 Progress',
                            value: `${Math.round((progress.processed / progress.total) * 100)}%`,
                            inline: true
                        });
                        await interaction.editReply({ embeds: [progressEmbed] });
                    }
                });
                // Final resolution summary
                const successCount = results.filter(r => r.resolved).length;
                const failCount = results.filter(r => !r.resolved).length;
                const resultEmbed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                    title: '✅ Conflict Resolution Complete',
                    description: `Successfully resolved ${successCount} out of ${conflicts.length} conflicts.`
                });
                if (failCount > 0) {
                    resultEmbed.addFields({
                        name: '⚠️ Failed Resolutions',
                        value: `${failCount} conflicts could not be resolved automatically. Manual intervention may be required.`,
                        inline: false
                    });
                }
                // Get statistics
                const stats = this.roleSyncEnhancementService.getConflictStatistics(interaction.guildId);
                resultEmbed.addFields({
                    name: '📊 Resolution Statistics',
                    value: [
                        `Total Resolutions: ${stats.totalResolutions}`,
                        `Successful: ${stats.successfulResolutions}`,
                        `Failed: ${stats.failedResolutions}`
                    ].join('\n'),
                    inline: false
                });
                await interaction.editReply({ embeds: [resultEmbed] });
            }
            else {
                // Add confirmation buttons if not auto-resolving
                const confirmButton = new discord_js_1.ButtonBuilder()
                    .setCustomId('resolve-conflicts')
                    .setLabel('Resolve All Conflicts')
                    .setStyle(discord_js_1.ButtonStyle.Danger);
                const cancelButton = new discord_js_1.ButtonBuilder()
                    .setCustomId('cancel-resolution')
                    .setLabel('Cancel')
                    .setStyle(discord_js_1.ButtonStyle.Secondary);
                const row = new discord_js_1.ActionRowBuilder()
                    .addComponents(confirmButton, cancelButton);
                conflictEmbed.addFields({
                    name: '❓ What would you like to do?',
                    value: 'Click "Resolve All Conflicts" to automatically keep the highest role for each member and remove lower roles.',
                    inline: false
                });
                const response = await interaction.editReply({
                    embeds: [conflictEmbed],
                    components: [row]
                });
                // Wait for button interaction
                try {
                    const collector = response.createMessageComponentCollector({
                        componentType: discord_js_1.ComponentType.Button,
                        time: 60000, // 60 seconds timeout
                        filter: (i) => i.user.id === interaction.user.id
                    });
                    collector.on('collect', async (buttonInteraction) => {
                        if (buttonInteraction.customId === 'resolve-conflicts') {
                            await buttonInteraction.deferUpdate();
                            // Perform resolution
                            const results = await this.roleSyncEnhancementService.bulkResolveConflicts(interaction.guild, conflicts);
                            const successCount = results.filter(r => r.resolved).length;
                            const failCount = results.filter(r => !r.resolved).length;
                            const resultEmbed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                                title: '✅ Conflict Resolution Complete',
                                description: `Successfully resolved ${successCount} out of ${conflicts.length} conflicts.`
                            });
                            if (failCount > 0) {
                                resultEmbed.addFields({
                                    name: '⚠️ Failed Resolutions',
                                    value: `${failCount} conflicts could not be resolved automatically.`,
                                    inline: false
                                });
                            }
                            await interaction.editReply({ embeds: [resultEmbed], components: [] });
                        }
                        else {
                            await buttonInteraction.deferUpdate();
                            const cancelEmbed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                                title: '❌ Resolution Cancelled',
                                description: 'No changes were made. Conflicts remain unresolved.'
                            });
                            await interaction.editReply({ embeds: [cancelEmbed], components: [] });
                        }
                        collector.stop();
                    });
                    collector.on('end', async (collected, reason) => {
                        if (reason === 'time') {
                            const timeoutEmbed = embed_utils_1.EmbedUtils.createErrorEmbed('Timeout', 'The conflict resolution request has timed out. No changes were made.');
                            await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
                        }
                    });
                }
                catch (error) {
                    logger_1.logger.error('Error handling button interaction:', error);
                }
            }
            logger_1.logger.info(`Role conflict check performed by ${interaction.user.id} in guild ${interaction.guildId}. Found ${conflicts.length} conflicts.`);
        }
        catch (error) {
            logger_1.logger.error('Error in sync-check command:', error);
            const errorEmbed = this.createErrorEmbed('Failed to check role conflicts. Please try again later.');
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
            else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
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
__decorate([
    (0, discordx_1.Slash)({ name: 'sync-check', description: 'Check for and optionally resolve staff role conflicts' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'auto-resolve',
        description: 'Automatically resolve conflicts by keeping highest role',
        type: discord_js_1.ApplicationCommandOptionType.Boolean,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RoleCommands.prototype, "syncCheck", null);
exports.RoleCommands = RoleCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ name: 'role', description: 'Role management and synchronization commands' }),
    (0, discordx_1.SlashGroup)('role'),
    __metadata("design:paramtypes", [])
], RoleCommands);
//# sourceMappingURL=role-commands.js.map