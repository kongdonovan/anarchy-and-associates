import {
  CommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  ApplicationCommandOptionType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  User
} from 'discord.js';
import { Discord, Slash, SlashOption, SlashGroup, ButtonComponent, ModalComponent, Guard } from 'discordx';
import { RetainerService } from '../../application/services/retainer-service';
import { PermissionService } from '../../application/services/permission-service';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { RobloxService } from '../../infrastructure/external/roblox-service';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { PermissionUtils } from '../../infrastructure/utils/permission-utils';
import { logger } from '../../infrastructure/logger';
import { AuditDecorators } from '../decorators/audit-decorators';
import { 
  Retainer, 
  RetainerCreationRequest, 
  RetainerSignatureRequest, 
  ValidationHelpers, 
  DiscordSnowflakeSchema 
} from '../../validation';
import { AuditAction } from '../../domain/entities/audit-log';

@Discord()
@SlashGroup({ description: 'Retainer agreement management commands', name: 'retainer' })
@SlashGroup('retainer')
@Guard(
  async (interaction: CommandInteraction, _client, next) => {
    const guildConfigRepository = new GuildConfigRepository();
    const permissionService = new PermissionService(guildConfigRepository);
    const context = PermissionUtils.createPermissionContext(interaction);
    const hasPermission = await permissionService.hasRetainerPermissionWithContext(context);
    
    if (!hasPermission) {
      await interaction.reply({
        content: '❌ You do not have permission to manage retainer agreements. Retainer permission required.',
        ephemeral: true,
      });
      return;
    }
    
    await next();
  }
)
export class RetainerCommands {
  private retainerService: RetainerService;

  constructor() {
    const retainerRepository = new RetainerRepository();
    const guildConfigRepository = new GuildConfigRepository();
    const robloxService = RobloxService.getInstance();
    const permissionService = new PermissionService(guildConfigRepository);

    this.retainerService = new RetainerService(
      retainerRepository,
      guildConfigRepository,
      robloxService,
      permissionService
    );
  }

  @Slash({
    description: 'Send a retainer agreement to a client for signature',
    name: 'sign'
  })
  @AuditDecorators.AdminAction(AuditAction.JOB_CREATED, 'medium')
  async signRetainer(
    @SlashOption({
      description: 'The client to send the retainer agreement to',
      name: 'client',
      type: ApplicationCommandOptionType.User,
      required: true
    })
    client: User,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guildId) {
        const embed = EmbedUtils.createErrorEmbed(
          'Server Required',
          'This command can only be used in a server.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Validate inputs
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        interaction.guildId,
        'Guild ID'
      );

      const guildId = validatedGuildId;
      const lawyerId = interaction.user.id;
      const clientId = client.id;

      // Check if client role is configured
      const hasClientRole = await this.retainerService.hasClientRole(guildId);
      if (!hasClientRole) {
        const embed = EmbedUtils.createErrorEmbed(
          'Configuration Required',
          'Client role must be configured before sending retainer agreements. Please contact an administrator.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Create the retainer agreement
      const request: RetainerCreationRequest = {
        guildId,
        clientId,
        lawyerId
      };

      const context = PermissionUtils.createPermissionContext(interaction);
      const retainer = await this.retainerService.createRetainer(context, request);

      // Send DM to client with retainer agreement
      await this.sendRetainerDM(retainer, client, interaction.user);

      // Confirm to lawyer
      const confirmationEmbed = EmbedUtils.createSuccessEmbed(
        'Retainer Agreement Sent',
        `Retainer agreement has been sent to ${client.displayName} via direct message.\n\n` +
        `**Retainer ID:** \`${retainer._id}\`\n` +
        `**Client:** ${client.displayName} (${client.username})\n` +
        `**Status:** Pending Signature\n\n` +
        `The client will receive a DM with the agreement and can sign it with their Roblox username.`
      );

      await interaction.reply({ embeds: [confirmationEmbed], ephemeral: true });

    } catch (error) {
      logger.error('Error sending retainer agreement:', error);
      
      let errorMessage = 'An unexpected error occurred while sending the retainer agreement.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      const embed = EmbedUtils.createErrorEmbed(
        'Retainer Failed',
        errorMessage
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @Slash({
    description: 'List all active retainer agreements',
    name: 'list'
  })
  @AuditDecorators.AdminAction(AuditAction.JOB_LIST_VIEWED, 'low')
  async listRetainers(interaction: CommandInteraction): Promise<void> {
    try {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const context = {
        guildId: interaction.guildId!,
        userId: interaction.user.id,
        userRoles: member?.roles.cache.map(role => role.id) || [],
        isGuildOwner: interaction.guild?.ownerId === interaction.user.id
      };
      
      const activeRetainers = await this.retainerService.getActiveRetainers(context);
      const pendingRetainers = await this.retainerService.getPendingRetainers(context);
      const stats = await this.retainerService.getRetainerStats(context);

      const embed = EmbedUtils.createAALegalEmbed({
        title: '📋 Retainer Agreements',
        color: 'info'
      });

      embed.addFields(
        { name: '📊 Summary', value: 
          `**Total:** ${stats.total}\n` +
          `**Active:** ${stats.active}\n` +
          `**Pending:** ${stats.pending}\n` +
          `**Cancelled:** ${stats.cancelled}`, 
          inline: true 
        }
      );

      if (activeRetainers.length > 0) {
        const activeList = activeRetainers
          .slice(0, 10) // Limit to 10 for embed length
          .map(retainer => 
            `• <@${retainer.clientId}> (Lawyer: <@${retainer.lawyerId}>)\n` +
            `  Signed: ${retainer.signedAt?.toDateString() || 'Unknown'}\n` +
            `  Roblox: ${retainer.clientRobloxUsername || 'Not provided'}`
          )
          .join('\n\n');

        EmbedUtils.addFieldSafe(embed, '✅ Active Retainers', activeList);
      }

      if (pendingRetainers.length > 0) {
        const pendingList = pendingRetainers
          .slice(0, 5) // Limit to 5 for embed length
          .map(retainer => 
            `• <@${retainer.clientId}> (Lawyer: <@${retainer.lawyerId}>)\n` +
            `  Sent: ${retainer.createdAt?.toDateString() || 'Unknown'}`
          )
          .join('\n\n');

        EmbedUtils.addFieldSafe(embed, '⏳ Pending Signatures', pendingList);
      }

      if (activeRetainers.length === 0 && pendingRetainers.length === 0) {
        embed.addFields({ 
          name: 'No Retainers', 
          value: 'No retainer agreements found. Use `/retainer sign` to create one.', 
          inline: false 
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error listing retainers:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'List Failed',
        'An error occurred while retrieving retainer agreements.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async sendRetainerDM(retainer: Retainer, client: User, lawyer: User): Promise<void> {
    try {
      const dmEmbed = EmbedUtils.createAALegalEmbed({
        title: '📜 Retainer Agreement',
        description: 
          `Hello ${client.displayName}!\n\n` +
          `**${lawyer.displayName}** from Anarchy & Associates has sent you a retainer agreement for review and signature.\n\n` +
          `Please review the agreement below and click the "Sign Agreement" button to proceed with digital signature.`,
        color: 'info'
      });

      // Add agreement preview
      const agreementPreview = retainer.agreementTemplate
        .replace('[CLIENT_NAME]', client.displayName)
        .replace('[LAWYER_NAME]', lawyer.displayName)
        .substring(0, 1500); // Truncate for embed

      EmbedUtils.addFieldSafe(dmEmbed, '📋 Agreement Terms', agreementPreview);

      dmEmbed.addFields(
        { name: '👤 Representing Lawyer', value: lawyer.displayName, inline: true },
        { name: '🆔 Retainer ID', value: `\`${retainer._id}\``, inline: true },
        { name: '⚠️ Important', value: 'By signing this agreement, you acknowledge that you have read and understood all terms.', inline: false }
      );

      // Create sign button
      const signButton = new ButtonBuilder()
        .setCustomId(`retainer_sign_${retainer._id}`)
        .setLabel('Sign Agreement')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✍️');

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(signButton);

      await client.send({
        embeds: [dmEmbed],
        components: [row]
      });

      logger.info('Retainer DM sent successfully', {
        retainerId: retainer._id,
        clientId: client.id,
        lawyerId: lawyer.id
      });

    } catch (error) {
      logger.error('Failed to send retainer DM:', error);
      throw new Error('Failed to send retainer agreement via DM. Please ensure the client allows direct messages.');
    }
  }

  @ButtonComponent({ id: /^retainer_sign_/ })
  async handleRetainerSign(interaction: ButtonInteraction): Promise<void> {
    try {
      const retainerId = interaction.customId.replace('retainer_sign_', '');
      
      // Show signature modal
      const modal = new ModalBuilder()
        .setCustomId(`retainer_signature_${retainerId}`)
        .setTitle('Digital Signature');

      const robloxUsernameInput = new TextInputBuilder()
        .setCustomId('roblox_username')
        .setLabel('Your Roblox Username')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter your exact Roblox username')
        .setRequired(true)
        .setMaxLength(20);

      const confirmationInput = new TextInputBuilder()
        .setCustomId('confirmation')
        .setLabel('Confirmation')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type "I agree to the terms of this retainer agreement" to confirm')
        .setRequired(true)
        .setValue('I agree to the terms of this retainer agreement');

      const robloxRow = new ActionRowBuilder<TextInputBuilder>()
        .addComponents(robloxUsernameInput);

      const confirmRow = new ActionRowBuilder<TextInputBuilder>()
        .addComponents(confirmationInput);

      modal.addComponents(robloxRow, confirmRow);

      await interaction.showModal(modal);

    } catch (error) {
      logger.error('Error showing signature modal:', error);
      
      const embed = EmbedUtils.createErrorEmbed(
        'Signature Error',
        'An error occurred while preparing the signature form. Please try again.'
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @ModalComponent({ id: /^retainer_signature_/ })
  async handleRetainerSignature(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const retainerId = interaction.customId.replace('retainer_signature_', '');
      const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
      const confirmation = interaction.fields.getTextInputValue('confirmation');

      // Validate confirmation text
      if (!confirmation.toLowerCase().includes('i agree')) {
        const embed = EmbedUtils.createErrorEmbed(
          'Signature Invalid',
          'You must confirm that you agree to the terms of the retainer agreement.'
        );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Sign the retainer
      const signatureRequest: RetainerSignatureRequest = {
        retainerId,
        clientRobloxUsername: robloxUsername,
        clientAgreement: true // User agreed via modal confirmation
      };

      const signedRetainer = await this.retainerService.signRetainer(signatureRequest);

      // Success message to client
      const successEmbed = EmbedUtils.createSuccessEmbed(
        'Agreement Signed Successfully! 🎉',
        `Thank you for signing the retainer agreement with Anarchy & Associates!\n\n` +
        `**Retainer ID:** \`${signedRetainer._id}\`\n` +
        `**Signed with:** ${robloxUsername}\n` +
        `**Date:** ${new Date().toDateString()}\n\n` +
        `You should receive your client role shortly. Welcome to Anarchy & Associates!`
      );

      await interaction.reply({ embeds: [successEmbed], ephemeral: true });

      // Handle role assignment and archival
      await this.handleRetainerCompletion(signedRetainer, interaction);

    } catch (error) {
      logger.error('Error processing retainer signature:', error);
      
      let errorMessage = 'An unexpected error occurred while processing your signature.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      const embed = EmbedUtils.createErrorEmbed(
        'Signature Failed',
        errorMessage
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleRetainerCompletion(retainer: Retainer, interaction: ModalSubmitInteraction): Promise<void> {
    try {
      logger.info('Retainer signed, processing completion', {
        retainerId: retainer._id,
        clientId: retainer.clientId
      });

      // Assign client role
      await this.assignClientRole(retainer, interaction);

      // Archive agreement
      await this.archiveRetainerAgreement(retainer, interaction);
      
    } catch (error) {
      logger.error('Error handling retainer completion:', error);
    }
  }

  private async assignClientRole(retainer: Retainer, interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const clientRoleId = await this.retainerService.getClientRoleId(retainer.guildId);
      
      if (!clientRoleId) {
        logger.warn('Client role not configured, skipping role assignment', {
          guildId: retainer.guildId,
          retainerId: retainer._id
        });
        return;
      }

      const guild = await interaction.client.guilds.fetch(retainer.guildId);
      const client = await guild.members.fetch(retainer.clientId);
      const clientRole = await guild.roles.fetch(clientRoleId);

      if (!clientRole) {
        logger.error('Client role not found in guild', {
          guildId: retainer.guildId,
          roleId: clientRoleId
        });
        return;
      }

      // Check if client already has the role
      if (client.roles.cache.has(clientRoleId)) {
        logger.info('Client already has client role', {
          clientId: retainer.clientId,
          roleId: clientRoleId
        });
        return;
      }

      // Assign the role
      await client.roles.add(clientRole, `Retainer agreement signed - ID: ${retainer._id}`);

      logger.info('Client role assigned successfully', {
        clientId: retainer.clientId,
        roleId: clientRoleId,
        retainerId: retainer._id
      });

    } catch (error) {
      logger.error('Error assigning client role:', error);
      // Don't throw error as this shouldn't block the retainer signing process
    }
  }

  private async archiveRetainerAgreement(retainer: Retainer, interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const retainerChannelId = await this.retainerService.getRetainerChannelId(retainer.guildId);
      
      if (!retainerChannelId) {
        logger.warn('Retainer channel not configured, skipping archival', {
          guildId: retainer.guildId,
          retainerId: retainer._id
        });
        return;
      }

      const guild = await interaction.client.guilds.fetch(retainer.guildId);
      const retainerChannel = await guild.channels.fetch(retainerChannelId);
      
      if (!retainerChannel || !retainerChannel.isTextBased()) {
        logger.error('Retainer channel not found or not text-based', {
          guildId: retainer.guildId,
          channelId: retainerChannelId
        });
        return;
      }

      // Get user information for formatting
      const client = await interaction.client.users.fetch(retainer.clientId);
      const lawyer = await interaction.client.users.fetch(retainer.lawyerId);

      // Format the agreement
      const formattedAgreement = await this.retainerService.formatRetainerAgreement(
        retainer,
        client.displayName,
        lawyer.displayName
      );

      // Create archival embed
      const archivalEmbed = EmbedUtils.createAALegalEmbed({
        title: '📜 Retainer Agreement - Signed',
        color: 'success'
      });

      archivalEmbed.addFields(
        { name: '👤 Client', value: `${client.displayName} (@${client.username})`, inline: true },
        { name: '🎮 Roblox Username', value: formattedAgreement.clientRobloxUsername, inline: true },
        { name: '⚖️ Representing Lawyer', value: `${lawyer.displayName} (@${lawyer.username})`, inline: true },
        { name: '📅 Signed Date', value: formattedAgreement.signedAt.toDateString(), inline: true },
        { name: '🆔 Retainer ID', value: `\`${retainer._id}\``, inline: true },
        { name: '✅ Status', value: 'Fully Executed', inline: true }
      );

      // Add the formatted agreement text
      EmbedUtils.addFieldSafe(
        archivalEmbed, 
        '📋 Agreement Document', 
        `\`\`\`\n${formattedAgreement.agreementText}\n\`\`\``
      );

      // Add audit information
      archivalEmbed.addFields({
        name: '🔍 Audit Trail',
        value: 
          `**Created:** ${retainer.createdAt?.toISOString() || 'Unknown'}\n` +
          `**Signed:** ${retainer.signedAt?.toISOString() || 'Unknown'}\n` +
          `**Digital Signature:** ${retainer.digitalSignature}\n` +
          `**Client Discord ID:** ${retainer.clientId}\n` +
          `**Lawyer Discord ID:** ${retainer.lawyerId}`,
        inline: false
      });

      await retainerChannel.send({ embeds: [archivalEmbed] });

      logger.info('Retainer agreement archived successfully', {
        retainerId: retainer._id,
        channelId: retainerChannelId,
        clientId: retainer.clientId,
        lawyerId: retainer.lawyerId
      });

    } catch (error) {
      logger.error('Error archiving retainer agreement:', error);
      // Don't throw error as this shouldn't block the retainer signing process
    }
  }
}