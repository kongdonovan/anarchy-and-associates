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
exports.RepairCommands = void 0;
const discordx_1 = require("discordx");
const discord_js_1 = require("discord.js");
const repair_service_1 = require("../../application/services/repair-service");
const permission_service_1 = require("../../application/services/permission-service");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const logger_1 = require("../../infrastructure/logger");
let RepairCommands = class RepairCommands {
    constructor() {
        this.repairService = new repair_service_1.RepairService();
        this.guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
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
    async checkAdminPermission(interaction) {
        const context = await this.getPermissionContext(interaction);
        return await this.permissionService.hasActionPermission(context, 'admin');
    }
    createRepairResultEmbed(result, operation) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: result.success ? `✅ ${operation} Completed` : `❌ ${operation} Failed`,
            description: result.message,
            color: result.success ? 'success' : 'error'
        });
        if (result.changes.length > 0) {
            const changesText = result.changes.slice(0, 10).join('\n');
            const moreChanges = result.changes.length > 10 ? `\n... and ${result.changes.length - 10} more` : '';
            embed_utils_1.EmbedUtils.addFieldSafe(embed, 'Changes Made', changesText + moreChanges, false);
        }
        if (result.errors.length > 0) {
            const errorsText = result.errors.slice(0, 5).join('\n');
            const moreErrors = result.errors.length > 5 ? `\n... and ${result.errors.length - 5} more` : '';
            embed_utils_1.EmbedUtils.addFieldSafe(embed, 'Errors Encountered', errorsText + moreErrors, false);
        }
        return embed;
    }
    createHealthCheckEmbed(result) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: result.healthy ? '✅ System Health Check - Healthy' : '⚠️ System Health Check - Issues Found',
            description: result.healthy
                ? 'All system components are functioning properly.'
                : `${result.issues.length} issue(s) detected that require attention.`,
            color: result.healthy ? 'success' : 'warning'
        });
        // Add individual check results
        const checkResults = [
            `Database: ${result.checks.database ? '✅' : '❌'}`,
            `Channels: ${result.checks.channels ? '✅' : '❌'}`,
            `Permissions: ${result.checks.permissions ? '✅' : '❌'}`,
            `Bot Permissions: ${result.checks.botPermissions ? '✅' : '❌'}`
        ].join('\n');
        embed.addFields({ name: 'System Components', value: checkResults, inline: false });
        if (result.issues.length > 0) {
            const issuesText = result.issues.slice(0, 8).join('\n');
            const moreIssues = result.issues.length > 8 ? `\n... and ${result.issues.length - 8} more` : '';
            embed.addFields({
                name: 'Issues Detected',
                value: issuesText + moreIssues,
                inline: false
            });
        }
        return embed;
    }
    async repairStaffRoles(dryRun = false, interaction) {
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('Starting Repair', `Staff roles synchronization ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
                ephemeral: true,
            });
            const result = await this.repairService.repairStaffRoles(interaction.guild, dryRun);
            const embed = this.createRepairResultEmbed(result, 'Staff Roles Repair');
            await interaction.followUp({
                embeds: [embed],
                ephemeral: true,
            });
        }
        catch (error) {
            logger_1.logger.error('Error in staff roles repair command:', error);
            await interaction.followUp({
                embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during staff roles repair.')],
                ephemeral: true,
            });
        }
    }
    async repairJobRoles(dryRun = false, interaction) {
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('Starting Repair', `Job roles synchronization ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
                ephemeral: true,
            });
            const result = await this.repairService.repairJobRoles(interaction.guild, dryRun);
            const embed = this.createRepairResultEmbed(result, 'Job Roles Repair');
            await interaction.followUp({
                embeds: [embed],
                ephemeral: true,
            });
        }
        catch (error) {
            logger_1.logger.error('Error in job roles repair command:', error);
            await interaction.followUp({
                embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during job roles repair.')],
                ephemeral: true,
            });
        }
    }
    async repairChannels(dryRun = false, interaction) {
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('Starting Repair', `Channels repair ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
                ephemeral: true,
            });
            const result = await this.repairService.repairChannels(interaction.guild, dryRun);
            const embed = this.createRepairResultEmbed(result, 'Channels Repair');
            await interaction.followUp({
                embeds: [embed],
                ephemeral: true,
            });
        }
        catch (error) {
            logger_1.logger.error('Error in channels repair command:', error);
            await interaction.followUp({
                embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during channels repair.')],
                ephemeral: true,
            });
        }
    }
    async repairConfig(dryRun = false, interaction) {
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('Starting Repair', `Configuration repair ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
                ephemeral: true,
            });
            const result = await this.repairService.repairConfig(interaction.guild, dryRun);
            const embed = this.createRepairResultEmbed(result, 'Configuration Repair');
            await interaction.followUp({
                embeds: [embed],
                ephemeral: true,
            });
        }
        catch (error) {
            logger_1.logger.error('Error in config repair command:', error);
            await interaction.followUp({
                embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during configuration repair.')],
                ephemeral: true,
            });
        }
    }
    async repairOrphaned(dryRun = false, interaction) {
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('Starting Repair', `Orphaned records cleanup ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
                ephemeral: true,
            });
            const result = await this.repairService.repairOrphaned(interaction.guild, dryRun);
            const embed = this.createRepairResultEmbed(result, 'Orphaned Records Repair');
            await interaction.followUp({
                embeds: [embed],
                ephemeral: true,
            });
        }
        catch (error) {
            logger_1.logger.error('Error in orphaned records repair command:', error);
            await interaction.followUp({
                embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during orphaned records repair.')],
                ephemeral: true,
            });
        }
    }
    async repairDbIndexes(dryRun = false, interaction) {
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('Starting Repair', `Database indexes repair ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
                ephemeral: true,
            });
            const result = await this.repairService.repairDbIndexes(interaction.guild, dryRun);
            const embed = this.createRepairResultEmbed(result, 'Database Indexes Repair');
            await interaction.followUp({
                embeds: [embed],
                ephemeral: true,
            });
        }
        catch (error) {
            logger_1.logger.error('Error in db indexes repair command:', error);
            await interaction.followUp({
                embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during database indexes repair.')],
                ephemeral: true,
            });
        }
    }
    async repairAll(dryRun = false, interaction) {
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('Starting Comprehensive Repair', `All repair operations ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
                ephemeral: true,
            });
            const result = await this.repairService.repairAll(interaction.guild, dryRun);
            const embed = this.createRepairResultEmbed(result, 'Comprehensive Repair');
            await interaction.followUp({
                embeds: [embed],
                ephemeral: true,
            });
        }
        catch (error) {
            logger_1.logger.error('Error in comprehensive repair command:', error);
            await interaction.followUp({
                embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during comprehensive repair.')],
                ephemeral: true,
            });
        }
    }
    async repairHealth(interaction) {
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('Starting Health Check', 'Performing comprehensive system health check...')],
                ephemeral: true,
            });
            const result = await this.repairService.performHealthCheck(interaction.guild);
            const embed = this.createHealthCheckEmbed(result);
            await interaction.followUp({
                embeds: [embed],
                ephemeral: true,
            });
        }
        catch (error) {
            logger_1.logger.error('Error in health check command:', error);
            await interaction.followUp({
                embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Health Check Failed', 'An unexpected error occurred during system health check.')],
                ephemeral: true,
            });
        }
    }
};
exports.RepairCommands = RepairCommands;
__decorate([
    (0, discordx_1.Slash)({ name: 'staff-roles', description: 'Synchronize staff roles between Discord and database' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'dry-run',
        description: 'Preview changes without applying them',
        type: discord_js_1.ApplicationCommandOptionType.Boolean,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RepairCommands.prototype, "repairStaffRoles", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'job-roles', description: 'Synchronize job roles between Discord and database' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'dry-run',
        description: 'Preview changes without applying them',
        type: discord_js_1.ApplicationCommandOptionType.Boolean,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RepairCommands.prototype, "repairJobRoles", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'channels', description: 'Ensure all required channels and categories exist' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'dry-run',
        description: 'Preview changes without applying them',
        type: discord_js_1.ApplicationCommandOptionType.Boolean,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RepairCommands.prototype, "repairChannels", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'validate-config', description: 'Validate and fix configuration inconsistencies' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'dry-run',
        description: 'Preview changes without applying them',
        type: discord_js_1.ApplicationCommandOptionType.Boolean,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RepairCommands.prototype, "repairConfig", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'orphaned', description: 'Find and clean orphaned database records' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'dry-run',
        description: 'Preview changes without applying them',
        type: discord_js_1.ApplicationCommandOptionType.Boolean,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RepairCommands.prototype, "repairOrphaned", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'db-indexes', description: 'Ensure MongoDB indexes are correct' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'dry-run',
        description: 'Preview changes without applying them',
        type: discord_js_1.ApplicationCommandOptionType.Boolean,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RepairCommands.prototype, "repairDbIndexes", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'all', description: 'Execute all repair routines' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'dry-run',
        description: 'Preview changes without applying them',
        type: discord_js_1.ApplicationCommandOptionType.Boolean,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RepairCommands.prototype, "repairAll", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'health', description: 'Comprehensive system health check' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RepairCommands.prototype, "repairHealth", null);
exports.RepairCommands = RepairCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ name: 'repair', description: 'System repair and maintenance commands' }),
    (0, discordx_1.SlashGroup)('repair'),
    __metadata("design:paramtypes", [])
], RepairCommands);
//# sourceMappingURL=repair-commands.js.map