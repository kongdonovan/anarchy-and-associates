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
exports.RetainerCommands = void 0;
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const retainer_service_1 = require("../../application/services/retainer-service");
const permission_service_1 = require("../../application/services/permission-service");
const retainer_repository_1 = require("../../infrastructure/repositories/retainer-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const roblox_service_1 = require("../../infrastructure/external/roblox-service");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const permission_utils_1 = require("../../infrastructure/utils/permission-utils");
const logger_1 = require("../../infrastructure/logger");
const audit_decorators_1 = require("../decorators/audit-decorators");
const validation_1 = require("../../validation");
const audit_log_1 = require("../../domain/entities/audit-log");
let RetainerCommands = class RetainerCommands {
    constructor() {
        const retainerRepository = new retainer_repository_1.RetainerRepository();
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const robloxService = roblox_service_1.RobloxService.getInstance();
        const permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        this.retainerService = new retainer_service_1.RetainerService(retainerRepository, guildConfigRepository, robloxService, permissionService);
    }
    async signRetainer(client, interaction) {
        try {
            if (!interaction.guildId) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Server Required', 'This command can only be used in a server.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Validate inputs
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, interaction.guildId, 'Guild ID');
            const guildId = validatedGuildId;
            const lawyerId = interaction.user.id;
            const clientId = client.id;
            // Check if client role is configured
            const hasClientRole = await this.retainerService.hasClientRole(guildId);
            if (!hasClientRole) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Configuration Required', 'Client role must be configured before sending retainer agreements. Please contact an administrator.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Create the retainer agreement
            const request = {
                guildId,
                clientId,
                lawyerId
            };
            const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
            const retainer = await this.retainerService.createRetainer(context, request);
            // Send DM to client with retainer agreement
            await this.sendRetainerDM(retainer, client, interaction.user);
            // Confirm to lawyer
            const confirmationEmbed = embed_utils_1.EmbedUtils.createSuccessEmbed('Retainer Agreement Sent', `Retainer agreement has been sent to ${client.displayName} via direct message.\n\n` +
                `**Retainer ID:** \`${retainer._id}\`\n` +
                `**Client:** ${client.displayName} (${client.username})\n` +
                `**Status:** Pending Signature\n\n` +
                `The client will receive a DM with the agreement and can sign it with their Roblox username.`);
            await interaction.reply({ embeds: [confirmationEmbed], ephemeral: true });
        }
        catch (error) {
            logger_1.logger.error('Error sending retainer agreement:', error);
            let errorMessage = 'An unexpected error occurred while sending the retainer agreement.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Retainer Failed', errorMessage);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async listRetainers(interaction) {
        try {
            const member = interaction.guild?.members.cache.get(interaction.user.id);
            const context = {
                guildId: interaction.guildId,
                userId: interaction.user.id,
                userRoles: member?.roles.cache.map(role => role.id) || [],
                isGuildOwner: interaction.guild?.ownerId === interaction.user.id
            };
            const activeRetainers = await this.retainerService.getActiveRetainers(context);
            const pendingRetainers = await this.retainerService.getPendingRetainers(context);
            const stats = await this.retainerService.getRetainerStats(context);
            const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: '📋 Retainer Agreements',
                color: 'info'
            });
            embed.addFields({ name: '📊 Summary', value: `**Total:** ${stats.total}\n` +
                    `**Active:** ${stats.active}\n` +
                    `**Pending:** ${stats.pending}\n` +
                    `**Cancelled:** ${stats.cancelled}`,
                inline: true
            });
            if (activeRetainers.length > 0) {
                const activeList = activeRetainers
                    .slice(0, 10) // Limit to 10 for embed length
                    .map(retainer => `• <@${retainer.clientId}> (Lawyer: <@${retainer.lawyerId}>)\n` +
                    `  Signed: ${retainer.signedAt?.toDateString() || 'Unknown'}\n` +
                    `  Roblox: ${retainer.clientRobloxUsername || 'Not provided'}`)
                    .join('\n\n');
                embed_utils_1.EmbedUtils.addFieldSafe(embed, '✅ Active Retainers', activeList);
            }
            if (pendingRetainers.length > 0) {
                const pendingList = pendingRetainers
                    .slice(0, 5) // Limit to 5 for embed length
                    .map(retainer => `• <@${retainer.clientId}> (Lawyer: <@${retainer.lawyerId}>)\n` +
                    `  Sent: ${retainer.createdAt?.toDateString() || 'Unknown'}`)
                    .join('\n\n');
                embed_utils_1.EmbedUtils.addFieldSafe(embed, '⏳ Pending Signatures', pendingList);
            }
            if (activeRetainers.length === 0 && pendingRetainers.length === 0) {
                embed.addFields({
                    name: 'No Retainers',
                    value: 'No retainer agreements found. Use `/retainer sign` to create one.',
                    inline: false
                });
            }
            await interaction.reply({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.error('Error listing retainers:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('List Failed', 'An error occurred while retrieving retainer agreements.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async sendRetainerDM(retainer, client, lawyer) {
        try {
            const dmEmbed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: '📜 Retainer Agreement',
                description: `Hello ${client.displayName}!\n\n` +
                    `**${lawyer.displayName}** from Anarchy & Associates has sent you a retainer agreement for review and signature.\n\n` +
                    `Please review the agreement below and click the "Sign Agreement" button to proceed with digital signature.`,
                color: 'info'
            });
            // Add agreement preview
            const agreementPreview = retainer.agreementTemplate
                .replace('[CLIENT_NAME]', client.displayName)
                .replace('[LAWYER_NAME]', lawyer.displayName)
                .substring(0, 1500); // Truncate for embed
            embed_utils_1.EmbedUtils.addFieldSafe(dmEmbed, '📋 Agreement Terms', agreementPreview);
            dmEmbed.addFields({ name: '👤 Representing Lawyer', value: lawyer.displayName, inline: true }, { name: '🆔 Retainer ID', value: `\`${retainer._id}\``, inline: true }, { name: '⚠️ Important', value: 'By signing this agreement, you acknowledge that you have read and understood all terms.', inline: false });
            // Create sign button
            const signButton = new discord_js_1.ButtonBuilder()
                .setCustomId(`retainer_sign_${retainer._id}`)
                .setLabel('Sign Agreement')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setEmoji('✍️');
            const row = new discord_js_1.ActionRowBuilder()
                .addComponents(signButton);
            await client.send({
                embeds: [dmEmbed],
                components: [row]
            });
            logger_1.logger.info('Retainer DM sent successfully', {
                retainerId: retainer._id,
                clientId: client.id,
                lawyerId: lawyer.id
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send retainer DM:', error);
            throw new Error('Failed to send retainer agreement via DM. Please ensure the client allows direct messages.');
        }
    }
    async handleRetainerSign(interaction) {
        try {
            const retainerId = interaction.customId.replace('retainer_sign_', '');
            // Show signature modal
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`retainer_signature_${retainerId}`)
                .setTitle('Digital Signature');
            const robloxUsernameInput = new discord_js_1.TextInputBuilder()
                .setCustomId('roblox_username')
                .setLabel('Your Roblox Username')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('Enter your exact Roblox username')
                .setRequired(true)
                .setMaxLength(20);
            const confirmationInput = new discord_js_1.TextInputBuilder()
                .setCustomId('confirmation')
                .setLabel('Confirmation')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setPlaceholder('Type "I agree to the terms of this retainer agreement" to confirm')
                .setRequired(true)
                .setValue('I agree to the terms of this retainer agreement');
            const robloxRow = new discord_js_1.ActionRowBuilder()
                .addComponents(robloxUsernameInput);
            const confirmRow = new discord_js_1.ActionRowBuilder()
                .addComponents(confirmationInput);
            modal.addComponents(robloxRow, confirmRow);
            await interaction.showModal(modal);
        }
        catch (error) {
            logger_1.logger.error('Error showing signature modal:', error);
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Signature Error', 'An error occurred while preparing the signature form. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async handleRetainerSignature(interaction) {
        try {
            const retainerId = interaction.customId.replace('retainer_signature_', '');
            const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
            const confirmation = interaction.fields.getTextInputValue('confirmation');
            // Validate confirmation text
            if (!confirmation.toLowerCase().includes('i agree')) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Signature Invalid', 'You must confirm that you agree to the terms of the retainer agreement.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Sign the retainer
            const signatureRequest = {
                retainerId,
                clientRobloxUsername: robloxUsername,
                clientAgreement: true // User agreed via modal confirmation
            };
            const signedRetainer = await this.retainerService.signRetainer(signatureRequest);
            // Success message to client
            const successEmbed = embed_utils_1.EmbedUtils.createSuccessEmbed('Agreement Signed Successfully! 🎉', `Thank you for signing the retainer agreement with Anarchy & Associates!\n\n` +
                `**Retainer ID:** \`${signedRetainer._id}\`\n` +
                `**Signed with:** ${robloxUsername}\n` +
                `**Date:** ${new Date().toDateString()}\n\n` +
                `You should receive your client role shortly. Welcome to Anarchy & Associates!`);
            await interaction.reply({ embeds: [successEmbed], ephemeral: true });
            // Handle role assignment and archival
            await this.handleRetainerCompletion(signedRetainer, interaction);
        }
        catch (error) {
            logger_1.logger.error('Error processing retainer signature:', error);
            let errorMessage = 'An unexpected error occurred while processing your signature.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Signature Failed', errorMessage);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async handleRetainerCompletion(retainer, interaction) {
        try {
            logger_1.logger.info('Retainer signed, processing completion', {
                retainerId: retainer._id,
                clientId: retainer.clientId
            });
            // Assign client role
            await this.assignClientRole(retainer, interaction);
            // Archive agreement
            await this.archiveRetainerAgreement(retainer, interaction);
        }
        catch (error) {
            logger_1.logger.error('Error handling retainer completion:', error);
        }
    }
    async assignClientRole(retainer, interaction) {
        try {
            const clientRoleId = await this.retainerService.getClientRoleId(retainer.guildId);
            if (!clientRoleId) {
                logger_1.logger.warn('Client role not configured, skipping role assignment', {
                    guildId: retainer.guildId,
                    retainerId: retainer._id
                });
                return;
            }
            const guild = await interaction.client.guilds.fetch(retainer.guildId);
            const client = await guild.members.fetch(retainer.clientId);
            const clientRole = await guild.roles.fetch(clientRoleId);
            if (!clientRole) {
                logger_1.logger.error('Client role not found in guild', {
                    guildId: retainer.guildId,
                    roleId: clientRoleId
                });
                return;
            }
            // Check if client already has the role
            if (client.roles.cache.has(clientRoleId)) {
                logger_1.logger.info('Client already has client role', {
                    clientId: retainer.clientId,
                    roleId: clientRoleId
                });
                return;
            }
            // Assign the role
            await client.roles.add(clientRole, `Retainer agreement signed - ID: ${retainer._id}`);
            logger_1.logger.info('Client role assigned successfully', {
                clientId: retainer.clientId,
                roleId: clientRoleId,
                retainerId: retainer._id
            });
        }
        catch (error) {
            logger_1.logger.error('Error assigning client role:', error);
            // Don't throw error as this shouldn't block the retainer signing process
        }
    }
    async archiveRetainerAgreement(retainer, interaction) {
        try {
            const retainerChannelId = await this.retainerService.getRetainerChannelId(retainer.guildId);
            if (!retainerChannelId) {
                logger_1.logger.warn('Retainer channel not configured, skipping archival', {
                    guildId: retainer.guildId,
                    retainerId: retainer._id
                });
                return;
            }
            const guild = await interaction.client.guilds.fetch(retainer.guildId);
            const retainerChannel = await guild.channels.fetch(retainerChannelId);
            if (!retainerChannel || !retainerChannel.isTextBased()) {
                logger_1.logger.error('Retainer channel not found or not text-based', {
                    guildId: retainer.guildId,
                    channelId: retainerChannelId
                });
                return;
            }
            // Get user information for formatting
            const client = await interaction.client.users.fetch(retainer.clientId);
            const lawyer = await interaction.client.users.fetch(retainer.lawyerId);
            // Format the agreement
            const formattedAgreement = await this.retainerService.formatRetainerAgreement(retainer, client.displayName, lawyer.displayName);
            // Create archival embed
            const archivalEmbed = embed_utils_1.EmbedUtils.createAALegalEmbed({
                title: '📜 Retainer Agreement - Signed',
                color: 'success'
            });
            archivalEmbed.addFields({ name: '👤 Client', value: `${client.displayName} (@${client.username})`, inline: true }, { name: '🎮 Roblox Username', value: formattedAgreement.clientRobloxUsername, inline: true }, { name: '⚖️ Representing Lawyer', value: `${lawyer.displayName} (@${lawyer.username})`, inline: true }, { name: '📅 Signed Date', value: formattedAgreement.signedAt.toDateString(), inline: true }, { name: '🆔 Retainer ID', value: `\`${retainer._id}\``, inline: true }, { name: '✅ Status', value: 'Fully Executed', inline: true });
            // Add the formatted agreement text
            embed_utils_1.EmbedUtils.addFieldSafe(archivalEmbed, '📋 Agreement Document', `\`\`\`\n${formattedAgreement.agreementText}\n\`\`\``);
            // Add audit information
            archivalEmbed.addFields({
                name: '🔍 Audit Trail',
                value: `**Created:** ${retainer.createdAt?.toISOString() || 'Unknown'}\n` +
                    `**Signed:** ${retainer.signedAt?.toISOString() || 'Unknown'}\n` +
                    `**Digital Signature:** ${retainer.digitalSignature}\n` +
                    `**Client Discord ID:** ${retainer.clientId}\n` +
                    `**Lawyer Discord ID:** ${retainer.lawyerId}`,
                inline: false
            });
            await retainerChannel.send({ embeds: [archivalEmbed] });
            logger_1.logger.info('Retainer agreement archived successfully', {
                retainerId: retainer._id,
                channelId: retainerChannelId,
                clientId: retainer.clientId,
                lawyerId: retainer.lawyerId
            });
        }
        catch (error) {
            logger_1.logger.error('Error archiving retainer agreement:', error);
            // Don't throw error as this shouldn't block the retainer signing process
        }
    }
};
exports.RetainerCommands = RetainerCommands;
__decorate([
    (0, discordx_1.Slash)({
        description: 'Send a retainer agreement to a client for signature',
        name: 'sign'
    }),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.JOB_CREATED, 'medium'),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'The client to send the retainer agreement to',
        name: 'client',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: true
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.User,
        discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RetainerCommands.prototype, "signRetainer", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'List all active retainer agreements',
        name: 'list'
    }),
    audit_decorators_1.AuditDecorators.AdminAction(audit_log_1.AuditAction.JOB_LIST_VIEWED, 'low'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], RetainerCommands.prototype, "listRetainers", null);
__decorate([
    (0, discordx_1.ButtonComponent)({ id: /^retainer_sign_/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ButtonInteraction]),
    __metadata("design:returntype", Promise)
], RetainerCommands.prototype, "handleRetainerSign", null);
__decorate([
    (0, discordx_1.ModalComponent)({ id: /^retainer_signature_/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discord_js_1.ModalSubmitInteraction]),
    __metadata("design:returntype", Promise)
], RetainerCommands.prototype, "handleRetainerSignature", null);
exports.RetainerCommands = RetainerCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ description: 'Retainer agreement management commands', name: 'retainer' }),
    (0, discordx_1.SlashGroup)('retainer'),
    (0, discordx_1.Guard)(async (interaction, _client, next) => {
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        const context = permission_utils_1.PermissionUtils.createPermissionContext(interaction);
        const hasPermission = await permissionService.hasRetainerPermissionWithContext(context);
        if (!hasPermission) {
            await interaction.reply({
                content: '❌ You do not have permission to manage retainer agreements. Retainer permission required.',
                ephemeral: true,
            });
            return;
        }
        await next();
    }),
    __metadata("design:paramtypes", [])
], RetainerCommands);
//# sourceMappingURL=retainer-commands.js.map