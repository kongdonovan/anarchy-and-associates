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
exports.AdminCommands = void 0;
const discordx_1 = require("discordx");
const discord_js_1 = require("discord.js");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const permission_service_1 = require("../../application/services/permission-service");
const anarchy_server_setup_service_1 = require("../../application/services/anarchy-server-setup-service");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const job_repository_1 = require("../../infrastructure/repositories/job-repository");
const application_repository_1 = require("../../infrastructure/repositories/application-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const feedback_repository_1 = require("../../infrastructure/repositories/feedback-repository");
const retainer_repository_1 = require("../../infrastructure/repositories/retainer-repository");
const reminder_repository_1 = require("../../infrastructure/repositories/reminder-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const logger_1 = require("../../infrastructure/logger");
let AdminCommands = class AdminCommands {
    constructor() {
        this.guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        this.permissionService = new permission_service_1.PermissionService(this.guildConfigRepository);
        this.anarchySetupService = new anarchy_server_setup_service_1.AnarchyServerSetupService();
        this.staffRepository = new staff_repository_1.StaffRepository();
        this.jobRepository = new job_repository_1.JobRepository();
        this.applicationRepository = new application_repository_1.ApplicationRepository();
        this.caseRepository = new case_repository_1.CaseRepository();
        this.feedbackRepository = new feedback_repository_1.FeedbackRepository();
        this.retainerRepository = new retainer_repository_1.RetainerRepository();
        this.reminderRepository = new reminder_repository_1.ReminderRepository();
        this.auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        this.caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
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
    createSuccessEmbed(message) {
        return embed_utils_1.EmbedUtils.createSuccessEmbed('Success', message);
    }
    async checkAdminPermission(interaction) {
        const context = await this.getPermissionContext(interaction);
        return await this.permissionService.hasActionPermission(context, 'admin');
    }
    async addAdmin(user, interaction) {
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const canManageAdmins = await this.permissionService.canManageAdmins(context);
            if (!canManageAdmins) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You do not have permission to manage administrators.')],
                    ephemeral: true,
                });
                return;
            }
            const result = await this.guildConfigRepository.addAdminUser(interaction.guildId, user.id);
            if (!result) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Failed to add admin user. Please try again.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [this.createSuccessEmbed(`Successfully granted admin privileges to ${user.displayName}.`)],
            });
            logger_1.logger.info(`Admin privileges granted to user ${user.id} by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in add admin command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async removeAdmin(user, interaction) {
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const canManageAdmins = await this.permissionService.canManageAdmins(context);
            if (!canManageAdmins) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You do not have permission to manage administrators.')],
                    ephemeral: true,
                });
                return;
            }
            // Prevent removing yourself unless you're the guild owner
            if (user.id === interaction.user.id && !context.isGuildOwner) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You cannot remove your own admin privileges.')],
                    ephemeral: true,
                });
                return;
            }
            const result = await this.guildConfigRepository.removeAdminUser(interaction.guildId, user.id);
            if (!result) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Failed to remove admin user. Please try again.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [this.createSuccessEmbed(`Successfully revoked admin privileges from ${user.displayName}.`)],
            });
            logger_1.logger.info(`Admin privileges revoked from user ${user.id} by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in remove admin command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async grantRole(role, interaction) {
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const canManageAdmins = await this.permissionService.canManageAdmins(context);
            if (!canManageAdmins) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You do not have permission to manage administrators.')],
                    ephemeral: true,
                });
                return;
            }
            const result = await this.guildConfigRepository.addAdminRole(interaction.guildId, role.id);
            if (!result) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Failed to grant admin role. Please try again.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [this.createSuccessEmbed(`Successfully granted admin privileges to role ${role.name}.`)],
            });
            logger_1.logger.info(`Admin privileges granted to role ${role.id} by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in grant role command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async revokeRole(role, interaction) {
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const canManageAdmins = await this.permissionService.canManageAdmins(context);
            if (!canManageAdmins) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You do not have permission to manage administrators.')],
                    ephemeral: true,
                });
                return;
            }
            const result = await this.guildConfigRepository.removeAdminRole(interaction.guildId, role.id);
            if (!result) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Failed to revoke admin role. Please try again.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [this.createSuccessEmbed(`Successfully revoked admin privileges from role ${role.name}.`)],
            });
            logger_1.logger.info(`Admin privileges revoked from role ${role.id} by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in revoke role command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async listAdmins(interaction) {
        const context = await this.getPermissionContext(interaction);
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const context = await this.getPermissionContext(interaction);
            const canView = await this.permissionService.isAdmin(context);
            if (!canView) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You do not have permission to view admin information.')],
                    ephemeral: true,
                });
                return;
            }
            const config = await this.guildConfigRepository.findByGuildId(interaction.guildId);
            if (!config) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Guild configuration not found.')],
                    ephemeral: true,
                });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('🛡️ Administrator Information')
                .setTimestamp();
            // Add admin users
            if (config.adminUsers.length > 0) {
                const userList = config.adminUsers.map(userId => `<@${userId}>`).join('\n');
                embed.addFields({ name: 'Admin Users', value: userList, inline: false });
            }
            else {
                embed.addFields({ name: 'Admin Users', value: 'None configured', inline: false });
            }
            // Add admin roles
            if (config.adminRoles.length > 0) {
                const roleList = config.adminRoles.map(roleId => `<@&${roleId}>`).join('\n');
                embed.addFields({ name: 'Admin Roles', value: roleList, inline: false });
            }
            else {
                embed.addFields({ name: 'Admin Roles', value: 'None configured', inline: false });
            }
            // Add guild owner
            embed.addFields({
                name: 'Guild Owner',
                value: `<@${interaction.guild?.ownerId}>`,
                inline: false
            });
            await interaction.reply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error in list admins command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async setPermissionRole(action, role, interaction) {
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You need admin permissions to configure role permissions.')],
                    ephemeral: true,
                });
                return;
            }
            const config = await this.guildConfigRepository.ensureGuildConfig(interaction.guildId);
            const currentRoles = config.permissions[action] || [];
            let updatedRoles;
            let actionText;
            if (currentRoles.includes(role.id)) {
                // Remove role
                updatedRoles = currentRoles.filter(id => id !== role.id);
                actionText = 'removed from';
            }
            else {
                // Add role
                updatedRoles = [...currentRoles, role.id];
                actionText = 'added to';
            }
            const permissions = { ...config.permissions };
            permissions[action] = updatedRoles;
            await this.guildConfigRepository.updateConfig(interaction.guildId, { permissions });
            await interaction.reply({
                embeds: [this.createSuccessEmbed(`Role ${role.name} ${actionText} ${action} permissions.`)],
            });
            logger_1.logger.info(`Permission role updated: ${role.id} ${actionText} ${action} by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in set permission role command:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async debugCollection(collection, interaction) {
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You need admin permissions to use debug commands.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.deferReply({ ephemeral: true });
            let data = [];
            // Get repository based on collection name
            switch (collection) {
                case 'staff':
                    data = await this.staffRepository.findByFilters({ guildId: interaction.guildId });
                    break;
                case 'jobs':
                    data = await this.jobRepository.findByFilters({ guildId: interaction.guildId });
                    break;
                case 'applications':
                    data = await this.applicationRepository.findByFilters({ guildId: interaction.guildId });
                    break;
                case 'cases':
                    data = await this.caseRepository.findByFilters({ guildId: interaction.guildId });
                    break;
                case 'feedback':
                    data = await this.feedbackRepository.findByFilters({ guildId: interaction.guildId });
                    break;
                case 'retainers':
                    data = await this.retainerRepository.findByFilters({ guildId: interaction.guildId });
                    break;
                case 'reminders':
                    data = await this.reminderRepository.findByFilters({ guildId: interaction.guildId });
                    break;
                case 'auditLogs':
                    data = await this.auditLogRepository.findByFilters({ guildId: interaction.guildId });
                    break;
                case 'caseCounters':
                    data = await this.caseCounterRepository.findByFilters({ guildId: interaction.guildId });
                    break;
                case 'guildConfig':
                    const config = await this.guildConfigRepository.findByGuildId(interaction.guildId);
                    data = config ? [config] : [];
                    break;
                default:
                    throw new Error('Invalid collection name');
            }
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: `🔍 Debug: ${collection} Collection`,
                description: `Found ${data.length} records in ${collection} for this guild.`
            });
            if (data.length > 0) {
                // Show first few records with key information
                const preview = data.slice(0, 5).map((item, index) => {
                    const id = item._id ? item._id.toString().slice(-8) : 'unknown';
                    const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'unknown';
                    return `${index + 1}. ID: ...${id} | Created: ${createdAt}`;
                }).join('\n');
                embed.addFields({
                    name: 'Sample Records',
                    value: preview + (data.length > 5 ? `\n... and ${data.length - 5} more` : ''),
                    inline: false
                });
                // Add JSON dump of first record (truncated)
                if (data[0]) {
                    const jsonString = JSON.stringify(data[0], null, 2);
                    const truncatedJson = jsonString.length > 800
                        ? jsonString.substring(0, 800) + '...\n}'
                        : jsonString;
                    embed.addFields({
                        name: 'First Record (JSON)',
                        value: `\`\`\`json\n${truncatedJson}\`\`\``,
                        inline: false
                    });
                }
            }
            else {
                embed.addFields({
                    name: 'No Records',
                    value: 'No records found in this collection for the current guild.',
                    inline: false
                });
            }
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error in debug collection command:', error);
            const errorEmbed = this.createErrorEmbed('Failed to retrieve collection data. Please try again later.');
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
            else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
    async debugWipeCollections(interaction) {
        const context = await this.getPermissionContext(interaction);
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You need admin permissions to use debug commands.')],
                    ephemeral: true,
                });
                return;
            }
            // Create confirmation modal
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`wipe_confirm_${interaction.user.id}`)
                .setTitle('🚨 DANGEROUS: Confirm Database Wipe');
            const confirmInput = new discord_js_1.TextInputBuilder()
                .setCustomId('confirmation')
                .setLabel('Type "I confirm" to proceed with database wipe')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('I confirm');
            const actionRow = new discord_js_1.ActionRowBuilder().addComponents(confirmInput);
            modal.addComponents(actionRow);
            await interaction.showModal(modal);
        }
        catch (error) {
            logger_1.logger.error('Error showing wipe confirmation modal:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async handleWipeConfirmation(interaction) {
        try {
            const confirmation = interaction.fields.getTextInputValue('confirmation');
            if (confirmation !== 'I confirm') {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Confirmation text incorrect. Database wipe cancelled.')],
                    ephemeral: true,
                });
                return;
            }
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('Database Wipe', 'Starting database wipe for all collections except guildConfig...')],
                ephemeral: true,
            });
            // Simple database wipe using repositories
            const collections = [
                { name: 'staff', repository: this.staffRepository },
                { name: 'jobs', repository: this.jobRepository },
                { name: 'applications', repository: this.applicationRepository },
                { name: 'cases', repository: this.caseRepository },
                { name: 'feedback', repository: this.feedbackRepository },
                { name: 'retainers', repository: this.retainerRepository },
                { name: 'reminders', repository: this.reminderRepository },
                { name: 'auditLogs', repository: this.auditLogRepository },
                { name: 'caseCounters', repository: this.caseCounterRepository }
            ];
            const wipedCollections = [];
            const errors = [];
            for (const collection of collections) {
                try {
                    const records = await collection.repository.findByFilters({ guildId: interaction.guildId });
                    let deleteCount = 0;
                    for (const record of records) {
                        try {
                            if (record._id) {
                                await collection.repository.delete(record._id.toString());
                                deleteCount++;
                            }
                        }
                        catch (deleteError) {
                            logger_1.logger.warn(`Failed to delete individual record from ${collection.name}:`, deleteError);
                        }
                    }
                    wipedCollections.push(`${collection.name} (${deleteCount} records)`);
                    logger_1.logger.info(`Wiped ${deleteCount} records from ${collection.name} for guild ${interaction.guildId}`);
                }
                catch (error) {
                    errors.push(`Failed to wipe ${collection.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            const resultEmbed = errors.length === 0
                ? embed_utils_1.EmbedUtils.createSuccessEmbed('Database Wipe Complete', `Wiped ${wipedCollections.length} collections successfully.`)
                : embed_utils_1.EmbedUtils.createErrorEmbed('Database Wipe Failed', `Completed with ${errors.length} errors.`);
            if (wipedCollections.length > 0) {
                resultEmbed.addFields({
                    name: 'Collections Wiped',
                    value: wipedCollections.join('\n'),
                    inline: false
                });
            }
            if (errors.length > 0) {
                const errorText = errors.slice(0, 5).join('\n');
                resultEmbed.addFields({
                    name: 'Errors',
                    value: errorText + (errors.length > 5 ? `\n... and ${errors.length - 5} more` : ''),
                    inline: false
                });
            }
            await interaction.followUp({ embeds: [resultEmbed], ephemeral: true });
            logger_1.logger.warn(`Database wipe performed by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in wipe confirmation:', error);
            await interaction.followUp({
                embeds: [this.createErrorEmbed('An error occurred during database wipe.')],
                ephemeral: true,
            });
        }
    }
    async setupServer(interaction) {
        const context = await this.getPermissionContext(interaction);
        try {
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = await this.checkAdminPermission(interaction);
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('You need admin permissions to use server setup.')],
                    ephemeral: true,
                });
                return;
            }
            // Create confirmation modal
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`setup_confirm_${interaction.user.id}`)
                .setTitle('🚨 DESTROY ALL: Complete Server Wipe');
            const confirmInput = new discord_js_1.TextInputBuilder()
                .setCustomId('confirmation')
                .setLabel('Type "DELETE EVERYTHING" to proceed')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('DELETE EVERYTHING');
            const actionRow = new discord_js_1.ActionRowBuilder().addComponents(confirmInput);
            modal.addComponents(actionRow);
            await interaction.showModal(modal);
        }
        catch (error) {
            logger_1.logger.error('Error showing setup confirmation modal:', error);
            await interaction.reply({
                embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
                ephemeral: true,
            });
        }
    }
    async handleSetupConfirmation(interaction) {
        try {
            const confirmation = interaction.fields.getTextInputValue('confirmation');
            if (confirmation !== 'DELETE EVERYTHING') {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Confirmation text incorrect. Server setup cancelled.')],
                    ephemeral: true,
                });
                return;
            }
            if (!interaction.guildId) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({
                embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('Anarchy Server Setup', '🚨 Starting COMPLETE server wipe (ALL channels/roles will be DESTROYED) + Anarchy & Associates setup...')],
                ephemeral: true,
            });
            const result = await this.anarchySetupService.setupAnarchyServer(interaction.guild);
            const resultEmbed = result.success
                ? embed_utils_1.EmbedUtils.createSuccessEmbed('Anarchy Server Setup Complete', result.message)
                : embed_utils_1.EmbedUtils.createErrorEmbed('Anarchy Server Setup Failed', result.message);
            // Add created items
            if (result.created.roles.length > 0) {
                resultEmbed.addFields({
                    name: 'Roles Created',
                    value: result.created.roles.join(', '),
                    inline: false
                });
            }
            if (result.created.channels.length > 0) {
                resultEmbed.addFields({
                    name: 'Channels Created',
                    value: result.created.channels.slice(0, 10).join(', ') + (result.created.channels.length > 10 ? `\n... and ${result.created.channels.length - 10} more` : ''),
                    inline: false
                });
            }
            if (result.created.categories.length > 0) {
                resultEmbed.addFields({
                    name: 'Categories Created',
                    value: result.created.categories.join(', '),
                    inline: false
                });
            }
            if (result.created.jobs > 0) {
                resultEmbed.addFields({
                    name: 'Jobs Created',
                    value: `${result.created.jobs} job postings`,
                    inline: false
                });
            }
            if (result.wiped.collections.length > 0) {
                resultEmbed.addFields({
                    name: 'Collections Wiped',
                    value: result.wiped.collections.slice(0, 5).join('\n') + (result.wiped.collections.length > 5 ? `\n... and ${result.wiped.collections.length - 5} more` : ''),
                    inline: false
                });
            }
            if (result.errors.length > 0) {
                const errorText = result.errors.slice(0, 3).join('\n');
                resultEmbed.addFields({
                    name: 'Errors',
                    value: errorText + (result.errors.length > 3 ? `\n... and ${result.errors.length - 3} more errors` : ''),
                    inline: false
                });
            }
            try {
                await interaction.followUp({ embeds: [resultEmbed], ephemeral: true });
            }
            catch (discordError) {
                logger_1.logger.warn('Failed to send setup completion message (interaction may have expired):', discordError);
                // Try to log to a different channel or just continue - the setup was successful
            }
            logger_1.logger.warn(`Anarchy server setup performed by ${interaction.user.id} in guild ${interaction.guildId}`);
        }
        catch (error) {
            logger_1.logger.error('Error in setup confirmation:', error);
            try {
                await interaction.followUp({
                    embeds: [this.createErrorEmbed('An error occurred during server setup.')],
                    ephemeral: true,
                });
            }
            catch (discordError) {
                logger_1.logger.warn('Failed to send error message (interaction may have expired):', discordError);
            }
        }
    }
};
exports.AdminCommands = AdminCommands;
__decorate([
    (0, discordx_1.Slash)({ name: 'add', description: 'Grant admin privileges to a user' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'user',
        description: 'User to grant admin privileges',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "addAdmin", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'remove', description: 'Revoke admin privileges from a user' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'user',
        description: 'User to revoke admin privileges from',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "removeAdmin", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'grantrole', description: 'Grant admin privileges to a role' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'role',
        description: 'Role to grant admin privileges',
        type: discord_js_1.ApplicationCommandOptionType.Role,
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.Role,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "grantRole", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'revokerole', description: 'Revoke admin privileges from a role' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'role',
        description: 'Role to revoke admin privileges from',
        type: discord_js_1.ApplicationCommandOptionType.Role,
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.Role,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "revokeRole", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'admins', description: 'Display all current admins and admin roles' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "listAdmins", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'configure-permissions', description: 'Configure action permissions for roles' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'action',
        description: 'Permission action to configure',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true,
    })),
    __param(1, (0, discordx_1.SlashOption)({
        name: 'role',
        description: 'Role to grant permissions to',
        type: discord_js_1.ApplicationCommandOptionType.Role,
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.Role,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "setPermissionRole", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'debug_collection', description: 'View database collection contents' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'collection',
        description: 'Database collection to view',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "debugCollection", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'debug_wipe_collections', description: 'Emergency database wipe (DANGEROUS)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "debugWipeCollections", null);
__decorate([
    (0, discordx_1.ModalComponent)({ id: /wipe_confirm_.*/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ModalSubmitInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "handleWipeConfirmation", null);
__decorate([
    (0, discordx_1.Slash)({ name: 'setupserver', description: 'COMPLETE SERVER WIPE + SETUP (DESTROYS ALL CHANNELS/ROLES)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "setupServer", null);
__decorate([
    (0, discordx_1.ModalComponent)({ id: /setup_confirm_.*/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ModalSubmitInteraction]),
    __metadata("design:returntype", Promise)
], AdminCommands.prototype, "handleSetupConfirmation", null);
exports.AdminCommands = AdminCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ name: 'admin', description: 'Administrative commands for managing the bot' }),
    (0, discordx_1.SlashGroup)('admin'),
    __metadata("design:paramtypes", [])
], AdminCommands);
//# sourceMappingURL=admin-commands.js.map