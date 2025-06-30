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
exports.RulesCommands = void 0;
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const permission_service_1 = require("../../application/services/permission-service");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const logger_1 = require("../../infrastructure/logger");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const bot_1 = require("../../infrastructure/bot/bot");
let RulesCommands = class RulesCommands {
    constructor() {
        // Initialize dependencies following the pattern used in other commands
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        this.permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        // Get the rules channel service from the Bot singleton
        this.rulesChannelService = bot_1.Bot.getRulesChannelService();
    }
    async getPermissionContext(interaction) {
        return {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            userRoles: interaction.member ?
                interaction.member.roles.cache.map((role) => role.id) : [],
            commandName: interaction.commandName,
            subcommandName: undefined
        };
    }
    createErrorEmbed(title, description) {
        return embed_utils_1.EmbedUtils.createErrorEmbed(title, description);
    }
    createSuccessEmbed(title, description) {
        return embed_utils_1.EmbedUtils.createSuccessEmbed(title, description);
    }
    async setRules(interaction) {
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to manage rules channels.')],
                    ephemeral: true
                });
                return;
            }
            // Create modal for rules input
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`rules-set-${interaction.id}`)
                .setTitle('Set Rules Message');
            const titleInput = new discord_js_1.TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setPlaceholder('Enter the title for the rules message')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(256)
                .setValue('📜 Server Rules');
            const contentInput = new discord_js_1.TextInputBuilder()
                .setCustomId('content')
                .setLabel('Introduction/Description')
                .setPlaceholder('Enter an introduction or description for the rules')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(2000);
            const colorInput = new discord_js_1.TextInputBuilder()
                .setCustomId('color')
                .setLabel('Color (Hex)')
                .setPlaceholder('e.g., #FF0000 (optional)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(7);
            const footerInput = new discord_js_1.TextInputBuilder()
                .setCustomId('footer')
                .setLabel('Footer Text')
                .setPlaceholder('Footer text (optional)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(2048);
            modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(titleInput), new discord_js_1.ActionRowBuilder().addComponents(contentInput), new discord_js_1.ActionRowBuilder().addComponents(colorInput), new discord_js_1.ActionRowBuilder().addComponents(footerInput));
            await interaction.showModal(modal);
            // Wait for modal submission
            const modalSubmit = await interaction.awaitModalSubmit({
                time: 300000, // 5 minutes
                filter: (i) => i.customId === `rules-set-${interaction.id}`
            }).catch(() => null);
            if (!modalSubmit)
                return;
            await this.handleSetRules(modalSubmit);
        }
        catch (error) {
            logger_1.logger.error('Error in set rules command:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    embeds: [this.createErrorEmbed('Error', 'An error occurred while setting the rules message.')],
                    ephemeral: true
                });
            }
        }
    }
    async handleSetRules(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const title = interaction.fields.getTextInputValue('title');
            const content = interaction.fields.getTextInputValue('content');
            const colorHex = interaction.fields.getTextInputValue('color');
            const footer = interaction.fields.getTextInputValue('footer');
            let color;
            if (colorHex) {
                const match = colorHex.match(/^#?([0-9A-Fa-f]{6})$/);
                if (match && match[1]) {
                    color = parseInt(match[1], 16);
                }
            }
            // Get existing rules to preserve rule list
            const existing = await this.rulesChannelService.getRulesChannel(interaction.guildId, interaction.channelId);
            const result = await this.rulesChannelService.updateRulesChannel({
                guildId: interaction.guildId,
                channelId: interaction.channelId,
                title,
                content,
                color,
                footer: footer ? footer : undefined,
                rules: existing?.rules || [],
                showNumbers: existing?.showNumbers !== false,
                updatedBy: interaction.user.id
            });
            await interaction.editReply({
                embeds: [this.createSuccessEmbed('Rules Updated', `The rules message has been ${result.createdAt === result.updatedAt ? 'created' : 'updated'} successfully.\n\nUse \`/rules addrule\` to add individual rules.`)]
            });
        }
        catch (error) {
            logger_1.logger.error('Error handling set rules modal:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Update Failed', error instanceof Error ? error.message : 'Failed to update the rules message.')]
            });
        }
    }
    async addRule(interaction) {
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to manage rules.')],
                    ephemeral: true
                });
                return;
            }
            // Check if rules exist
            const existing = await this.rulesChannelService.getRulesChannel(interaction.guildId, interaction.channelId);
            if (!existing) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('No Rules Message', 'This channel does not have a rules message. Use `/rules set` first.')],
                    ephemeral: true
                });
                return;
            }
            // Create modal for rule input
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`rules-addrule-${interaction.id}`)
                .setTitle('Add New Rule');
            const titleInput = new discord_js_1.TextInputBuilder()
                .setCustomId('title')
                .setLabel('Rule Title')
                .setPlaceholder('Short title for the rule')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);
            const descriptionInput = new discord_js_1.TextInputBuilder()
                .setCustomId('description')
                .setLabel('Rule Description')
                .setPlaceholder('Full description of the rule')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(500);
            const categoryInput = new discord_js_1.TextInputBuilder()
                .setCustomId('category')
                .setLabel('Category (optional)')
                .setPlaceholder('e.g., General, Voice, Text, Staff')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(50);
            const severityInput = new discord_js_1.TextInputBuilder()
                .setCustomId('severity')
                .setLabel('Severity (low/medium/high/critical)')
                .setPlaceholder('Enter severity level (optional)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(10)
                .setValue('medium');
            modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(titleInput), new discord_js_1.ActionRowBuilder().addComponents(descriptionInput), new discord_js_1.ActionRowBuilder().addComponents(categoryInput), new discord_js_1.ActionRowBuilder().addComponents(severityInput));
            await interaction.showModal(modal);
            // Wait for modal submission
            const modalSubmit = await interaction.awaitModalSubmit({
                time: 300000,
                filter: (i) => i.customId === `rules-addrule-${interaction.id}`
            }).catch(() => null);
            if (!modalSubmit)
                return;
            await this.handleAddRule(modalSubmit);
        }
        catch (error) {
            logger_1.logger.error('Error in add rule command:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    embeds: [this.createErrorEmbed('Error', 'An error occurred while adding the rule.')],
                    ephemeral: true
                });
            }
        }
    }
    async handleAddRule(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const title = interaction.fields.getTextInputValue('title');
            const description = interaction.fields.getTextInputValue('description');
            const categoryText = interaction.fields.getTextInputValue('category')?.toLowerCase() || 'general';
            const severityText = interaction.fields.getTextInputValue('severity').toLowerCase();
            // Validate category
            const validCategories = ['general', 'conduct', 'cases', 'staff', 'clients', 'confidentiality', 'communication', 'fees', 'other'];
            const category = validCategories.includes(categoryText) ? categoryText : 'general';
            let severity;
            if (['low', 'medium', 'high', 'critical'].includes(severityText)) {
                severity = severityText;
            }
            const result = await this.rulesChannelService.addRule(interaction.guildId, interaction.channelId, {
                title,
                content: description, // Changed from description to content
                category,
                severity,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }, interaction.user.id);
            if (result) {
                await interaction.editReply({
                    embeds: [this.createSuccessEmbed('Rule Added', 'The rule has been added successfully.')]
                });
            }
            else {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Failed', 'Failed to add the rule.')]
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error handling add rule modal:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Add Rule Failed', error instanceof Error ? error.message : 'Failed to add the rule.')]
            });
        }
    }
    async removeRule(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to manage rules.')],
                });
                return;
            }
            const existing = await this.rulesChannelService.getRulesChannel(interaction.guildId, interaction.channelId);
            if (!existing || !existing.rules || existing.rules.length === 0) {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('No Rules', 'This channel does not have any rules to remove.')]
                });
                return;
            }
            // Create select menu with rules
            const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(`rules-remove-${interaction.id}`)
                .setPlaceholder('Select a rule to remove')
                .addOptions(existing.rules.map(rule => ({
                label: rule.title.substring(0, 100),
                description: rule.content.substring(0, 100),
                value: rule.id
            })));
            const row = new discord_js_1.ActionRowBuilder()
                .addComponents(selectMenu);
            await interaction.editReply({
                content: 'Select a rule to remove:',
                components: [row]
            });
            // Wait for selection
            const selection = await interaction.channel?.awaitMessageComponent({
                filter: (i) => i.customId === `rules-remove-${interaction.id}` && i.user.id === interaction.user.id,
                time: 60000
            }).catch(() => null);
            if (!selection) {
                await interaction.editReply({
                    content: 'Selection timed out.',
                    components: []
                });
                return;
            }
            await selection.deferUpdate();
            const ruleId = selection.values[0];
            if (!ruleId) {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Error', 'No rule selected.')],
                    components: []
                });
                return;
            }
            const result = await this.rulesChannelService.removeRule(interaction.guildId, interaction.channelId, ruleId, interaction.user.id);
            if (result) {
                await interaction.editReply({
                    embeds: [this.createSuccessEmbed('Rule Removed', 'The rule has been removed successfully.')],
                    components: []
                });
            }
            else {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Failed', 'Failed to remove the rule.')],
                    components: []
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error in remove rule command:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while removing the rule.')],
                components: []
            });
        }
    }
    async removeRules(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to manage rules channels.')],
                });
                return;
            }
            const deleted = await this.rulesChannelService.deleteRulesChannel(interaction.guildId, interaction.channelId);
            if (deleted) {
                await interaction.editReply({
                    embeds: [this.createSuccessEmbed('Rules Removed', 'The rules message has been removed from this channel.')]
                });
            }
            else {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('No Rules Message', 'This channel does not have a rules message.')]
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error in remove rules command:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while removing the rules message.')],
            });
        }
    }
    async listRulesChannels(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to view rules channels.')],
                });
                return;
            }
            const channels = await this.rulesChannelService.listRulesChannels(interaction.guildId);
            if (channels.length === 0) {
                await interaction.editReply({
                    embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('No Rules Channels', 'No rules channels have been configured in this server.')]
                });
                return;
            }
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: 'Rules Channels',
                description: `Found ${channels.length} rules channel${channels.length === 1 ? '' : 's'}:`
            });
            // Add fields separately
            for (const channel of channels) {
                const ruleCount = channel.rules?.length || 0;
                embed.addFields({
                    name: channel.title || 'Rules Channel',
                    value: `<#${channel.channelId}>
Rules: ${ruleCount}
Last updated: <t:${Math.floor(channel.lastUpdatedAt.getTime() / 1000)}:R>`,
                    inline: true
                });
            }
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error in list rules channels command:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while listing rules channels.')],
            });
        }
    }
    async syncRules(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to sync rules channels.')],
                });
                return;
            }
            const synced = await this.rulesChannelService.syncRulesMessage(interaction.guildId, interaction.channelId);
            if (synced) {
                await interaction.editReply({
                    embeds: [this.createSuccessEmbed('Rules Synced', 'The rules message has been re-synced successfully.')]
                });
            }
            else {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Sync Failed', 'This channel does not have a rules message or sync failed.')]
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error in sync rules command:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while syncing the rules message.')],
            });
        }
    }
};
exports.RulesCommands = RulesCommands;
__decorate([
    (0, discordx_1.Slash)({
        name: 'set',
        description: 'Set or update the rules message for this channel'
    }),
    (0, discordx_1.SlashGroup)('rules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RulesCommands.prototype, "setRules", null);
__decorate([
    (0, discordx_1.Slash)({
        name: 'addrule',
        description: 'Add a rule to the rules message'
    }),
    (0, discordx_1.SlashGroup)('rules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RulesCommands.prototype, "addRule", null);
__decorate([
    (0, discordx_1.Slash)({
        name: 'removerule',
        description: 'Remove a rule from the rules message'
    }),
    (0, discordx_1.SlashGroup)('rules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RulesCommands.prototype, "removeRule", null);
__decorate([
    (0, discordx_1.Slash)({
        name: 'remove',
        description: 'Remove the rules message from this channel'
    }),
    (0, discordx_1.SlashGroup)('rules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RulesCommands.prototype, "removeRules", null);
__decorate([
    (0, discordx_1.Slash)({
        name: 'list',
        description: 'List all rules channels in this server'
    }),
    (0, discordx_1.SlashGroup)('rules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RulesCommands.prototype, "listRulesChannels", null);
__decorate([
    (0, discordx_1.Slash)({
        name: 'sync',
        description: 'Re-sync the rules message in this channel'
    }),
    (0, discordx_1.SlashGroup)('rules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RulesCommands.prototype, "syncRules", null);
exports.RulesCommands = RulesCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ name: 'rules', description: 'Rules channel management commands' }),
    __metadata("design:paramtypes", [])
], RulesCommands);
//# sourceMappingURL=rules-commands.js.map