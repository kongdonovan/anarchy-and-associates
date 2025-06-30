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
exports.InformationCommands = void 0;
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const permission_service_1 = require("../../application/services/permission-service");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const logger_1 = require("../../infrastructure/logger");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const bot_1 = require("../../infrastructure/bot/bot");
let InformationCommands = class InformationCommands {
    constructor() {
        // Initialize dependencies following the pattern used in other commands
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        this.permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        // Get the information channel service from the Bot singleton
        this.informationChannelService = bot_1.Bot.getInformationChannelService();
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
    async setInformation(interaction) {
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to manage information channels.')],
                    ephemeral: true
                });
                return;
            }
            // Create modal for information input
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`info-set-${interaction.id}`)
                .setTitle('Set Information Message');
            const titleInput = new discord_js_1.TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setPlaceholder('Enter the title for the information message')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(256);
            const contentInput = new discord_js_1.TextInputBuilder()
                .setCustomId('content')
                .setLabel('Content')
                .setPlaceholder('Enter the main content of the information message')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(4000);
            const colorInput = new discord_js_1.TextInputBuilder()
                .setCustomId('color')
                .setLabel('Color (Hex)')
                .setPlaceholder('e.g., #FF0000 (optional)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(7);
            const thumbnailInput = new discord_js_1.TextInputBuilder()
                .setCustomId('thumbnail')
                .setLabel('Thumbnail URL')
                .setPlaceholder('URL for thumbnail image (optional)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false);
            const footerInput = new discord_js_1.TextInputBuilder()
                .setCustomId('footer')
                .setLabel('Footer Text')
                .setPlaceholder('Footer text (optional)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(2048);
            modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(titleInput), new discord_js_1.ActionRowBuilder().addComponents(contentInput), new discord_js_1.ActionRowBuilder().addComponents(colorInput), new discord_js_1.ActionRowBuilder().addComponents(thumbnailInput), new discord_js_1.ActionRowBuilder().addComponents(footerInput));
            await interaction.showModal(modal);
            // Wait for modal submission
            const modalSubmit = await interaction.awaitModalSubmit({
                time: 300000, // 5 minutes
                filter: (i) => i.customId === `info-set-${interaction.id}`
            }).catch(() => null);
            if (!modalSubmit)
                return;
            await this.handleSetInformation(modalSubmit);
        }
        catch (error) {
            logger_1.logger.error('Error in set information command:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    embeds: [this.createErrorEmbed('Error', 'An error occurred while setting the information message.')],
                    ephemeral: true
                });
            }
        }
    }
    async handleSetInformation(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const title = interaction.fields.getTextInputValue('title');
            const content = interaction.fields.getTextInputValue('content');
            const colorHex = interaction.fields.getTextInputValue('color');
            const thumbnailUrl = interaction.fields.getTextInputValue('thumbnail');
            const footer = interaction.fields.getTextInputValue('footer');
            let color;
            if (colorHex) {
                const match = colorHex.match(/^#?([0-9A-Fa-f]{6})$/);
                if (match && match[1]) {
                    color = parseInt(match[1], 16);
                }
            }
            const result = await this.informationChannelService.updateInformationChannel({
                guildId: interaction.guildId,
                channelId: interaction.channelId,
                title,
                content,
                color,
                thumbnailUrl: thumbnailUrl ? thumbnailUrl : undefined,
                footer: footer ? footer : undefined,
                updatedBy: interaction.user.id
            });
            await interaction.editReply({
                embeds: [this.createSuccessEmbed('Information Updated', `The information message has been ${result.createdAt === result.updatedAt ? 'created' : 'updated'} successfully.`)]
            });
        }
        catch (error) {
            logger_1.logger.error('Error handling set information modal:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Update Failed', error instanceof Error ? error.message : 'Failed to update the information message.')]
            });
        }
    }
    async addField(interaction) {
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to manage information channels.')],
                    ephemeral: true
                });
                return;
            }
            // Check if information exists
            const existing = await this.informationChannelService.getInformationChannel(interaction.guildId, interaction.channelId);
            if (!existing) {
                await interaction.reply({
                    embeds: [this.createErrorEmbed('No Information Message', 'This channel does not have an information message. Use `/info set` first.')],
                    ephemeral: true
                });
                return;
            }
            // Create modal for field input
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`info-addfield-${interaction.id}`)
                .setTitle('Add Information Field');
            const nameInput = new discord_js_1.TextInputBuilder()
                .setCustomId('name')
                .setLabel('Field Name')
                .setPlaceholder('Enter the field name')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(256);
            const valueInput = new discord_js_1.TextInputBuilder()
                .setCustomId('value')
                .setLabel('Field Value')
                .setPlaceholder('Enter the field value')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1024);
            const inlineInput = new discord_js_1.TextInputBuilder()
                .setCustomId('inline')
                .setLabel('Inline (yes/no)')
                .setPlaceholder('Should this field be inline? (yes or no)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setValue('no')
                .setMaxLength(3);
            modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(nameInput), new discord_js_1.ActionRowBuilder().addComponents(valueInput), new discord_js_1.ActionRowBuilder().addComponents(inlineInput));
            await interaction.showModal(modal);
            // Wait for modal submission
            const modalSubmit = await interaction.awaitModalSubmit({
                time: 300000,
                filter: (i) => i.customId === `info-addfield-${interaction.id}`
            }).catch(() => null);
            if (!modalSubmit)
                return;
            await this.handleAddField(modalSubmit, existing);
        }
        catch (error) {
            logger_1.logger.error('Error in add field command:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    embeds: [this.createErrorEmbed('Error', 'An error occurred while adding the field.')],
                    ephemeral: true
                });
            }
        }
    }
    async handleAddField(interaction, existing) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const name = interaction.fields.getTextInputValue('name');
            const value = interaction.fields.getTextInputValue('value');
            const inlineText = interaction.fields.getTextInputValue('inline').toLowerCase();
            const inline = inlineText === 'yes' || inlineText === 'y' || inlineText === 'true';
            const fields = existing.fields || [];
            if (fields.length >= 25) {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Field Limit Reached', 'Discord embeds can only have a maximum of 25 fields.')]
                });
                return;
            }
            fields.push({ name, value, inline });
            await this.informationChannelService.updateInformationChannel({
                guildId: interaction.guildId,
                channelId: interaction.channelId,
                title: existing.title,
                content: existing.content,
                color: existing.color,
                thumbnailUrl: existing.thumbnailUrl,
                imageUrl: existing.imageUrl,
                footer: existing.footer,
                fields,
                updatedBy: interaction.user.id
            });
            await interaction.editReply({
                embeds: [this.createSuccessEmbed('Field Added', 'The field has been added successfully.')]
            });
        }
        catch (error) {
            logger_1.logger.error('Error handling add field modal:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Add Field Failed', error instanceof Error ? error.message : 'Failed to add the field.')]
            });
        }
    }
    async removeInformation(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to manage information channels.')],
                });
                return;
            }
            const deleted = await this.informationChannelService.deleteInformationChannel(interaction.guildId, interaction.channelId);
            if (deleted) {
                await interaction.editReply({
                    embeds: [this.createSuccessEmbed('Information Removed', 'The information message has been removed from this channel.')]
                });
            }
            else {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('No Information Message', 'This channel does not have an information message.')]
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error in remove information command:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while removing the information message.')],
            });
        }
    }
    async listInformationChannels(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to view information channels.')],
                });
                return;
            }
            const channels = await this.informationChannelService.listInformationChannels(interaction.guildId);
            if (channels.length === 0) {
                await interaction.editReply({
                    embeds: [embed_utils_1.EmbedUtils.createInfoEmbed('No Information Channels', 'No information channels have been configured in this server.')]
                });
                return;
            }
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: 'Information Channels',
                description: `Found ${channels.length} information channel${channels.length === 1 ? '' : 's'}:`
            });
            // Add fields separately
            for (const channel of channels) {
                embed.addFields({
                    name: `Channel Info`,
                    value: `<#${channel.channelId}>
Last updated: <t:${Math.floor(channel.lastUpdatedAt.getTime() / 1000)}:R>`,
                    inline: true
                });
            }
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error in list information channels command:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while listing information channels.')],
            });
        }
    }
    async syncInformation(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const context = await this.getPermissionContext(interaction);
            const hasPermission = await this.permissionService.hasActionPermission(context, 'config');
            if (!hasPermission) {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Permission Denied', 'You do not have permission to sync information channels.')],
                });
                return;
            }
            const synced = await this.informationChannelService.syncInformationMessage(interaction.guildId, interaction.channelId);
            if (synced) {
                await interaction.editReply({
                    embeds: [this.createSuccessEmbed('Information Synced', 'The information message has been re-synced successfully.')]
                });
            }
            else {
                await interaction.editReply({
                    embeds: [this.createErrorEmbed('Sync Failed', 'This channel does not have an information message or sync failed.')]
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error in sync information command:', error);
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Error', 'An error occurred while syncing the information message.')],
            });
        }
    }
};
exports.InformationCommands = InformationCommands;
__decorate([
    (0, discordx_1.Slash)({
        name: 'set',
        description: 'Set or update the information message for this channel'
    }),
    (0, discordx_1.SlashGroup)('info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], InformationCommands.prototype, "setInformation", null);
__decorate([
    (0, discordx_1.Slash)({
        name: 'addfield',
        description: 'Add a field to the information message'
    }),
    (0, discordx_1.SlashGroup)('info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], InformationCommands.prototype, "addField", null);
__decorate([
    (0, discordx_1.Slash)({
        name: 'remove',
        description: 'Remove the information message from this channel'
    }),
    (0, discordx_1.SlashGroup)('info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], InformationCommands.prototype, "removeInformation", null);
__decorate([
    (0, discordx_1.Slash)({
        name: 'list',
        description: 'List all information channels in this server'
    }),
    (0, discordx_1.SlashGroup)('info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], InformationCommands.prototype, "listInformationChannels", null);
__decorate([
    (0, discordx_1.Slash)({
        name: 'sync',
        description: 'Re-sync the information message in this channel'
    }),
    (0, discordx_1.SlashGroup)('info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], InformationCommands.prototype, "syncInformation", null);
exports.InformationCommands = InformationCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ name: 'info', description: 'Information channel management commands' }),
    __metadata("design:paramtypes", [])
], InformationCommands);
//# sourceMappingURL=information-commands.js.map