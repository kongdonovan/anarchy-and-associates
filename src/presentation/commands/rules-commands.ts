import { 
  CommandInteraction, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ModalActionRowComponentBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction
} from 'discord.js';
import { Discord, Slash, SlashGroup } from 'discordx';

import { RulesChannelService } from '../../application/services/rules-channel-service';
import { PermissionService } from '../../application/services/permission-service';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { logger } from '../../infrastructure/logger';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { Bot } from '../../infrastructure/bot/bot';

@Discord()
@SlashGroup({ name: 'rules', description: 'Rules channel management commands' })
export class RulesCommands {
  private rulesChannelService: RulesChannelService;
  private permissionService: PermissionService;

  constructor() {
    // Initialize dependencies following the pattern used in other commands
    const guildConfigRepository = new GuildConfigRepository();
    this.permissionService = new PermissionService(guildConfigRepository);
    
    // Get the rules channel service from the Bot singleton
    this.rulesChannelService = Bot.getRulesChannelService();
  }

  private async getPermissionContext(interaction: CommandInteraction) {
    return {
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      userRoles: interaction.member ? 
        (interaction.member.roles as any).cache.map((role: any) => role.id) : [],
      commandName: interaction.commandName,
      subcommandName: undefined
    };
  }

  private createErrorEmbed(title: string, description: string) {
    return EmbedUtils.createErrorEmbed(title, description);
  }

  private createSuccessEmbed(title: string, description: string) {
    return EmbedUtils.createSuccessEmbed(title, description);
  }

  @Slash({
    name: 'set',
    description: 'Set or update the rules message for this channel'
  })
  @SlashGroup('rules')
  async setRules(interaction: CommandInteraction): Promise<void> {
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
      const modal = new ModalBuilder()
        .setCustomId(`rules-set-${interaction.id}`)
        .setTitle('Set Rules Message');

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Title')
        .setPlaceholder('Enter the title for the rules message')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(256)
        .setValue('📜 Server Rules');

      const contentInput = new TextInputBuilder()
        .setCustomId('content')
        .setLabel('Introduction/Description')
        .setPlaceholder('Enter an introduction or description for the rules')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);

      const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Color (Hex)')
        .setPlaceholder('e.g., #FF0000 (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(7);

      const footerInput = new TextInputBuilder()
        .setCustomId('footer')
        .setLabel('Footer Text')
        .setPlaceholder('Footer text (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(2048);

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(titleInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(contentInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(colorInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(footerInput)
      );

      await interaction.showModal(modal);

      // Wait for modal submission
      const modalSubmit = await interaction.awaitModalSubmit({
        time: 300000, // 5 minutes
        filter: (i) => i.customId === `rules-set-${interaction.id}`
      }).catch(() => null);

      if (!modalSubmit) return;

      await this.handleSetRules(modalSubmit);
    } catch (error) {
      logger.error('Error in set rules command:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [this.createErrorEmbed('Error', 'An error occurred while setting the rules message.')],
          ephemeral: true
        });
      }
    }
  }

  private async handleSetRules(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const title = interaction.fields.getTextInputValue('title');
      const content = interaction.fields.getTextInputValue('content');
      const colorHex = interaction.fields.getTextInputValue('color');
      const footer = interaction.fields.getTextInputValue('footer');

      let color: number | undefined;
      if (colorHex) {
        const match = colorHex.match(/^#?([0-9A-Fa-f]{6})$/);
        if (match && match[1]) {
          color = parseInt(match[1], 16);
        }
      }

      // Get existing rules to preserve rule list
      const existing = await this.rulesChannelService.getRulesChannel(
        interaction.guildId!,
        interaction.channelId!
      );

      const result = await this.rulesChannelService.updateRulesChannel({
        guildId: interaction.guildId!,
        channelId: interaction.channelId!,
        title,
        content,
        color,
        footer: footer ? footer : undefined,
        rules: existing?.rules || [],
        showNumbers: existing?.showNumbers !== false,
        updatedBy: interaction.user.id
      });

      await interaction.editReply({
        embeds: [this.createSuccessEmbed(
          'Rules Updated',
          `The rules message has been ${result.createdAt === result.updatedAt ? 'created' : 'updated'} successfully.\n\nUse \`/rules addrule\` to add individual rules.`
        )]
      });
    } catch (error) {
      logger.error('Error handling set rules modal:', error);
      await interaction.editReply({
        embeds: [this.createErrorEmbed(
          'Update Failed',
          error instanceof Error ? error.message : 'Failed to update the rules message.'
        )]
      });
    }
  }

  @Slash({
    name: 'addrule',
    description: 'Add a rule to the rules message'
  })
  @SlashGroup('rules')
  async addRule(interaction: CommandInteraction): Promise<void> {
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
      const existing = await this.rulesChannelService.getRulesChannel(
        interaction.guildId!,
        interaction.channelId!
      );

      if (!existing) {
        await interaction.reply({
          embeds: [this.createErrorEmbed(
            'No Rules Message',
            'This channel does not have a rules message. Use `/rules set` first.'
          )],
          ephemeral: true
        });
        return;
      }

      // Create modal for rule input
      const modal = new ModalBuilder()
        .setCustomId(`rules-addrule-${interaction.id}`)
        .setTitle('Add New Rule');

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Rule Title')
        .setPlaceholder('Short title for the rule')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Rule Description')
        .setPlaceholder('Full description of the rule')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500);

      const categoryInput = new TextInputBuilder()
        .setCustomId('category')
        .setLabel('Category (optional)')
        .setPlaceholder('e.g., General, Voice, Text, Staff')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(50);

      const severityInput = new TextInputBuilder()
        .setCustomId('severity')
        .setLabel('Severity (low/medium/high/critical)')
        .setPlaceholder('Enter severity level (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10)
        .setValue('medium');

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(titleInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(descriptionInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(categoryInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(severityInput)
      );

      await interaction.showModal(modal);

      // Wait for modal submission
      const modalSubmit = await interaction.awaitModalSubmit({
        time: 300000,
        filter: (i) => i.customId === `rules-addrule-${interaction.id}`
      }).catch(() => null);

      if (!modalSubmit) return;

      await this.handleAddRule(modalSubmit);
    } catch (error) {
      logger.error('Error in add rule command:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [this.createErrorEmbed('Error', 'An error occurred while adding the rule.')],
          ephemeral: true
        });
      }
    }
  }

  private async handleAddRule(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const categoryText = interaction.fields.getTextInputValue('category')?.toLowerCase() || 'general';
      const severityText = interaction.fields.getTextInputValue('severity').toLowerCase();
      
      // Validate category
      const validCategories = ['general', 'conduct', 'cases', 'staff', 'clients', 'confidentiality', 'communication', 'fees', 'other'];
      const category = validCategories.includes(categoryText) ? categoryText as any : 'general';
      
      let severity: 'low' | 'medium' | 'high' | 'critical' | undefined;
      if (['low', 'medium', 'high', 'critical'].includes(severityText)) {
        severity = severityText as 'low' | 'medium' | 'high' | 'critical';
      }

      const result = await this.rulesChannelService.addRule(
        interaction.guildId!,
        interaction.channelId!,
        {
          title,
          content: description, // Changed from description to content
          category,
          severity,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        interaction.user.id
      );

      if (result) {
        await interaction.editReply({
          embeds: [this.createSuccessEmbed('Rule Added', 'The rule has been added successfully.')]
        });
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Failed', 'Failed to add the rule.')]
        });
      }
    } catch (error) {
      logger.error('Error handling add rule modal:', error);
      await interaction.editReply({
        embeds: [this.createErrorEmbed(
          'Add Rule Failed',
          error instanceof Error ? error.message : 'Failed to add the rule.'
        )]
      });
    }
  }

  @Slash({
    name: 'removerule',
    description: 'Remove a rule from the rules message'
  })
  @SlashGroup('rules')
  async removeRule(interaction: CommandInteraction): Promise<void> {
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

      const existing = await this.rulesChannelService.getRulesChannel(
        interaction.guildId!,
        interaction.channelId!
      );

      if (!existing || !existing.rules || existing.rules.length === 0) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(
            'No Rules',
            'This channel does not have any rules to remove.'
          )]
        });
        return;
      }

      // Create select menu with rules
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`rules-remove-${interaction.id}`)
        .setPlaceholder('Select a rule to remove')
        .addOptions(
          existing.rules.map(rule => ({
            label: rule.title.substring(0, 100),
            description: rule.content.substring(0, 100),
            value: rule.id
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);

      await interaction.editReply({
        content: 'Select a rule to remove:',
        components: [row]
      });

      // Wait for selection
      const selection = await interaction.channel?.awaitMessageComponent({
        filter: (i) => i.customId === `rules-remove-${interaction.id}` && i.user.id === interaction.user.id,
        time: 60000
      }).catch(() => null) as StringSelectMenuInteraction | null;

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

      const result = await this.rulesChannelService.removeRule(
        interaction.guildId!,
        interaction.channelId!,
        ruleId,
        interaction.user.id
      );

      if (result) {
        await interaction.editReply({
          embeds: [this.createSuccessEmbed('Rule Removed', 'The rule has been removed successfully.')],
          components: []
        });
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Failed', 'Failed to remove the rule.')],
          components: []
        });
      }
    } catch (error) {
      logger.error('Error in remove rule command:', error);
      await interaction.editReply({
        embeds: [this.createErrorEmbed('Error', 'An error occurred while removing the rule.')],
        components: []
      });
    }
  }

  @Slash({
    name: 'remove',
    description: 'Remove the rules message from this channel'
  })
  @SlashGroup('rules')
  async removeRules(interaction: CommandInteraction): Promise<void> {
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

      const deleted = await this.rulesChannelService.deleteRulesChannel(
        interaction.guildId!,
        interaction.channelId!
      );

      if (deleted) {
        await interaction.editReply({
          embeds: [this.createSuccessEmbed(
            'Rules Removed',
            'The rules message has been removed from this channel.'
          )]
        });
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(
            'No Rules Message',
            'This channel does not have a rules message.'
          )]
        });
      }
    } catch (error) {
      logger.error('Error in remove rules command:', error);
      await interaction.editReply({
        embeds: [this.createErrorEmbed('Error', 'An error occurred while removing the rules message.')],
      });
    }
  }

  @Slash({
    name: 'list',
    description: 'List all rules channels in this server'
  })
  @SlashGroup('rules')
  async listRulesChannels(interaction: CommandInteraction): Promise<void> {
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

      const channels = await this.rulesChannelService.listRulesChannels(interaction.guildId!);

      if (channels.length === 0) {
        await interaction.editReply({
          embeds: [EmbedUtils.createInfoEmbed(
            'No Rules Channels',
            'No rules channels have been configured in this server.'
          )]
        });
        return;
      }

      const embed = EmbedUtils.createAALegalEmbed({
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
    } catch (error) {
      logger.error('Error in list rules channels command:', error);
      await interaction.editReply({
        embeds: [this.createErrorEmbed('Error', 'An error occurred while listing rules channels.')],
      });
    }
  }

  @Slash({
    name: 'sync',
    description: 'Re-sync the rules message in this channel'
  })
  @SlashGroup('rules')
  async syncRules(interaction: CommandInteraction): Promise<void> {
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

      const synced = await this.rulesChannelService.syncRulesMessage(
        interaction.guildId!,
        interaction.channelId!
      );

      if (synced) {
        await interaction.editReply({
          embeds: [this.createSuccessEmbed(
            'Rules Synced',
            'The rules message has been re-synced successfully.'
          )]
        });
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed(
            'Sync Failed',
            'This channel does not have a rules message or sync failed.'
          )]
        });
      }
    } catch (error) {
      logger.error('Error in sync rules command:', error);
      await interaction.editReply({
        embeds: [this.createErrorEmbed('Error', 'An error occurred while syncing the rules message.')],
      });
    }
  }
}