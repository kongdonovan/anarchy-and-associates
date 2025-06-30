import {
  Discord,
  Slash,
  SlashOption,
  SlashGroup,
  ModalComponent,
} from 'discordx';
import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  User,
  Role,
  CommandInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { AnarchyServerSetupService } from '../../application/services/anarchy-server-setup-service';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { ReminderRepository } from '../../infrastructure/repositories/reminder-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { logger } from '../../infrastructure/logger';
import { AuditDecorators } from '../decorators/audit-decorators';
import { Bot } from '../../infrastructure/bot/bot';
import { AuditAction } from '../../domain/entities/audit-log';

@Discord()
@SlashGroup({ name: 'admin', description: 'Administrative commands for managing the bot' })
@SlashGroup('admin')
export class AdminCommands {
  private guildConfigRepository: GuildConfigRepository;
  private permissionService: PermissionService;
  private anarchySetupService: AnarchyServerSetupService;
  private staffRepository: StaffRepository;
  private jobRepository: JobRepository;
  private applicationRepository: ApplicationRepository;
  private caseRepository: CaseRepository;
  private feedbackRepository: FeedbackRepository;
  private retainerRepository: RetainerRepository;
  private reminderRepository: ReminderRepository;
  private auditLogRepository: AuditLogRepository;
  private caseCounterRepository: CaseCounterRepository;

  constructor() {
    this.guildConfigRepository = new GuildConfigRepository();
    this.permissionService = new PermissionService(this.guildConfigRepository);
    this.anarchySetupService = new AnarchyServerSetupService();
    this.staffRepository = new StaffRepository();
    this.jobRepository = new JobRepository();
    this.applicationRepository = new ApplicationRepository();
    this.caseRepository = new CaseRepository();
    this.feedbackRepository = new FeedbackRepository();
    this.retainerRepository = new RetainerRepository();
    this.reminderRepository = new ReminderRepository();
    this.auditLogRepository = new AuditLogRepository();
    this.caseCounterRepository = new CaseCounterRepository();
  }

  private async getPermissionContext(interaction: CommandInteraction): Promise<PermissionContext> {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const userRoles = member?.roles.cache.map(role => role.id) || [];
    const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;

    return {
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      userRoles,
      isGuildOwner,
    };
  }

  private createErrorEmbed(message: string): EmbedBuilder {
    return EmbedUtils.createErrorEmbed('Error', message);
  }

  private createSuccessEmbed(message: string): EmbedBuilder {
    return EmbedUtils.createSuccessEmbed('Success', message);
  }

  private async checkAdminPermission(interaction: CommandInteraction): Promise<boolean> {
    const context = await this.getPermissionContext(interaction);
    return await this.permissionService.hasActionPermission(context, 'admin');
  }

  @Slash({ name: 'add', description: 'Grant admin privileges to a user' })
  @AuditDecorators.AdminAction(AuditAction.PERMISSION_OVERRIDE, 'high')
  async addAdmin(
    @SlashOption({
      name: 'user',
      description: 'User to grant admin privileges',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    interaction: CommandInteraction
  ): Promise<void> {
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

      logger.info(`Admin privileges granted to user ${user.id} by ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Error in add admin command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'remove', description: 'Revoke admin privileges from a user' })
  @AuditDecorators.AdminAction(AuditAction.PERMISSION_OVERRIDE, 'high')
  async removeAdmin(
    @SlashOption({
      name: 'user',
      description: 'User to revoke admin privileges from',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    interaction: CommandInteraction
  ): Promise<void> {
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

      logger.info(`Admin privileges revoked from user ${user.id} by ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Error in remove admin command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'grantrole', description: 'Grant admin privileges to a role' })
  @AuditDecorators.AdminAction(AuditAction.PERMISSION_OVERRIDE, 'high')
  async grantRole(
    @SlashOption({
      name: 'role',
      description: 'Role to grant admin privileges',
      type: ApplicationCommandOptionType.Role,
      required: true,
    })
    role: Role,
    interaction: CommandInteraction
  ): Promise<void> {
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

      logger.info(`Admin privileges granted to role ${role.id} by ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Error in grant role command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'revokerole', description: 'Revoke admin privileges from a role' })
  @AuditDecorators.AdminAction(AuditAction.PERMISSION_OVERRIDE, 'high')
  async revokeRole(
    @SlashOption({
      name: 'role',
      description: 'Role to revoke admin privileges from',
      type: ApplicationCommandOptionType.Role,
      required: true,
    })
    role: Role,
    interaction: CommandInteraction
  ): Promise<void> {
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

      logger.info(`Admin privileges revoked from role ${role.id} by ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Error in revoke role command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'admins', description: 'Display all current admins and admin roles' })
  @AuditDecorators.AdminAction(AuditAction.STAFF_LIST_VIEWED, 'low')
  async listAdmins(interaction: CommandInteraction): Promise<void> {
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

      const fields = [];
      
      // Add admin users
      if (config.adminUsers.length > 0) {
        const userList = config.adminUsers.map(userId => `<@${userId}>`).join('\n');
        fields.push({ name: '§ Authorized Administrative Users', value: userList, inline: false });
      } else {
        fields.push({ name: '§ Authorized Administrative Users', value: '*No administrative users configured*', inline: false });
      }

      // Add admin roles
      if (config.adminRoles.length > 0) {
        const roleList = config.adminRoles.map(roleId => `<@&${roleId}>`).join('\n');
        fields.push({ name: '§ Administrative Roles', value: roleList, inline: false });
      } else {
        fields.push({ name: '§ Administrative Roles', value: '*No administrative roles configured*', inline: false });
      }

      // Add guild owner
      fields.push({ 
        name: '§ Server Proprietor', 
        value: `<@${interaction.guild?.ownerId}> *(Full administrative privileges)*`, 
        inline: false 
      });
      
      const embed = EmbedUtils.createAALegalEmbed({
        title: '⚖️ Administrative Authority Registry',
        description: 'The following individuals and roles possess administrative privileges within this legal establishment.',
        color: 'secondary',
        fields
      });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in list admins command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'configure-permissions', description: 'Configure action permissions for roles' })
  @AuditDecorators.AdminAction(AuditAction.PERMISSION_OVERRIDE, 'high')
  async setPermissionRole(
    @SlashOption({
      name: 'action',
      description: 'Permission action to configure',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    action: 'admin' | 'senior-staff' | 'case' | 'config' | 'lawyer' | 'lead-attorney' | 'repair',
    @SlashOption({
      name: 'role',
      description: 'Role to grant permissions to',
      type: ApplicationCommandOptionType.Role,
      required: true,
    })
    role: Role,
    interaction: CommandInteraction
  ): Promise<void> {
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
      const currentRoles = config.permissions[action as keyof typeof config.permissions] || [];
      
      let updatedRoles: string[];
      let actionText: string;

      if (currentRoles.includes(role.id)) {
        // Remove role
        updatedRoles = currentRoles.filter(id => id !== role.id);
        actionText = 'removed from';
      } else {
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

      logger.info(`Permission role updated: ${role.id} ${actionText} ${action} by ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Error in set permission role command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'setdefaultinfo', description: 'Set the default information channel for the server' })
  @AuditDecorators.AdminAction(AuditAction.PERMISSION_OVERRIDE, 'medium')
  async setDefaultInfoChannel(
    @SlashOption({
      name: 'channel',
      description: 'The channel to set as default information channel',
      type: ApplicationCommandOptionType.Channel,
      required: true,
    })
    channel: any,
    interaction: CommandInteraction
  ): Promise<void> {
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
          embeds: [this.createErrorEmbed('You need admin permissions to set the default information channel.')],
          ephemeral: true,
        });
        return;
      }

      // Verify it's a text channel
      if (channel.type !== 0) { // 0 is GuildText
        await interaction.reply({
          embeds: [this.createErrorEmbed('Please select a text channel.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Update guild config
      const config = await this.guildConfigRepository.ensureGuildConfig(interaction.guildId);
      if (config._id) {
        await this.guildConfigRepository.update(config._id.toString(), {
          defaultInformationChannelId: channel.id
        });

        // Check if there's already an information message in this channel
        const informationChannelService = Bot.getInformationChannelService();
        const existingInfo = await informationChannelService.getInformationChannel(interaction.guildId, channel.id);

        let message = `Successfully set <#${channel.id}> as the default information channel.`;
        
        if (!existingInfo) {
          // Create a default information message
          try {
            await informationChannelService.updateInformationChannel({
              guildId: interaction.guildId,
              channelId: channel.id,
              title: 'Server Information',
              content: `Welcome to **${interaction.guild?.name}**!

This channel contains important information about our server.

**Quick Links**
• Use the bot commands to interact with our services
• Check out other channels for specific topics
• Contact staff if you need assistance

**Getting Started**
Feel free to explore the server and get involved in our community!

*This is an automatically generated information message. Server administrators can customize it using \`/info set\`.*`,
              color: 0x0099FF, // Nice blue color
              footer: `Last updated by ${interaction.user.tag}`,
              updatedBy: interaction.user.id
            });
            
            message += '\n\n✅ A default information message has been created. You can customize it using `/info set`.';
            logger.info(`Default information message created in channel ${channel.id} for guild ${interaction.guildId}`);
          } catch (error) {
            logger.error('Failed to create default information message:', error);
            message += '\n\n⚠️ Failed to create default information message. Please use `/info set` to create one manually.';
          }
        } else {
          message += '\n\n✅ An information message already exists in this channel.';
        }

        await interaction.editReply({
          embeds: [this.createSuccessEmbed(message)]
        });

        logger.info(`Default information channel set to ${channel.id} by ${interaction.user.id} in guild ${interaction.guildId}`);
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Failed to update guild configuration.')]
        });
      }
    } catch (error) {
      logger.error('Error in set default info channel command:', error);
      const errorEmbed = this.createErrorEmbed('An error occurred while setting the default information channel.');
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  @Slash({ name: 'setdefaultrules', description: 'Set the default rules channel for the server' })
  @AuditDecorators.AdminAction(AuditAction.PERMISSION_OVERRIDE, 'medium')
  async setDefaultRulesChannel(
    @SlashOption({
      name: 'channel',
      description: 'The channel to set as default rules channel',
      type: ApplicationCommandOptionType.Channel,
      required: true,
    })
    channel: any,
    interaction: CommandInteraction
  ): Promise<void> {
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
          embeds: [this.createErrorEmbed('You need admin permissions to set the default rules channel.')],
          ephemeral: true,
        });
        return;
      }

      // Verify it's a text channel
      if (channel.type !== 0) { // 0 is GuildText
        await interaction.reply({
          embeds: [this.createErrorEmbed('Please select a text channel.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Update guild config
      const config = await this.guildConfigRepository.ensureGuildConfig(interaction.guildId);
      if (config._id) {
        await this.guildConfigRepository.update(config._id.toString(), {
          defaultRulesChannelId: channel.id
        });

        // Check if there's already a rules message in this channel
        const rulesChannelService = Bot.getRulesChannelService();
        const existingRules = await rulesChannelService.getRulesChannel(interaction.guildId, channel.id);

        let message = `Successfully set <#${channel.id}> as the default rules channel.`;
        
        if (!existingRules) {
          // Create default rules
          try {
            const { RulesChannelService } = await import('../../application/services/rules-channel-service');
            const template = RulesChannelService.generateDefaultRules(
              interaction.guild?.name === 'Anarchy & Associates' ? 'anarchy' : 'general'
            );

            await rulesChannelService.updateRulesChannel({
              guildId: interaction.guildId,
              channelId: channel.id,
              title: template.title || '📋 Server Rules',
              content: template.content || 'Please follow these rules.',
              rules: template.rules || [],
              color: template.color,
              footer: template.footer,
              showNumbers: template.showNumbers,
              additionalFields: template.additionalFields,
              updatedBy: interaction.user.id
            });
            
            message += '\n\n✅ Default rules have been created. You can customize them using `/rules set` and `/rules addrule`.';
            logger.info(`Default rules created in channel ${channel.id} for guild ${interaction.guildId}`);
          } catch (error) {
            logger.error('Failed to create default rules:', error);
            message += '\n\n⚠️ Failed to create default rules. Please use `/rules set` to create them manually.';
          }
        } else {
          message += '\n\n✅ Rules already exist in this channel.';
        }

        await interaction.editReply({
          embeds: [this.createSuccessEmbed(message)]
        });

        logger.info(`Default rules channel set to ${channel.id} by ${interaction.user.id} in guild ${interaction.guildId}`);
      } else {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Failed to update guild configuration.')]
        });
      }
    } catch (error) {
      logger.error('Error in set default rules channel command:', error);
      const errorEmbed = this.createErrorEmbed('An error occurred while setting the default rules channel.');
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  @Slash({ name: 'debug_collection', description: 'View database collection contents' })
  @AuditDecorators.AdminAction(AuditAction.SYSTEM_REPAIR, 'medium')
  async debugCollection(
    @SlashOption({
      name: 'collection',
      description: 'Database collection to view',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    collection: 'staff' | 'jobs' | 'applications' | 'cases' | 'feedback' | 'retainers' | 'reminders' | 'auditLogs' | 'caseCounters' | 'guildConfig',
    interaction: CommandInteraction
  ): Promise<void> {
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

      let data: any[] = [];
      
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

      const embed = EmbedUtils.createAALegalEmbed({
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
      } else {
        embed.addFields({
          name: 'No Records',
          value: 'No records found in this collection for the current guild.',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in debug collection command:', error);
      
      const errorEmbed = this.createErrorEmbed('Failed to retrieve collection data. Please try again later.');
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  @Slash({ name: 'debug_wipe_collections', description: 'Emergency database wipe (DANGEROUS)' })
  @AuditDecorators.AdminAction(AuditAction.SYSTEM_REPAIR, 'critical')
  async debugWipeCollections(interaction: CommandInteraction): Promise<void> {
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
      const modal = new ModalBuilder()
        .setCustomId(`wipe_confirm_${interaction.user.id}`)
        .setTitle('🚨 DANGEROUS: Confirm Database Wipe');

      const confirmInput = new TextInputBuilder()
        .setCustomId('confirmation')
        .setLabel('Type "I confirm" to proceed with database wipe')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('I confirm');

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(confirmInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);

    } catch (error) {
      logger.error('Error showing wipe confirmation modal:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @ModalComponent({ id: /wipe_confirm_.*/ })
  async handleWipeConfirmation(interaction: ModalSubmitInteraction): Promise<void> {
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
        embeds: [EmbedUtils.createInfoEmbed('Database Wipe', 'Starting database wipe for all collections except guildConfig...')],
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

      const wipedCollections: string[] = [];
      const errors: string[] = [];

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
            } catch (deleteError) {
              logger.warn(`Failed to delete individual record from ${collection.name}:`, deleteError);
            }
          }
          
          wipedCollections.push(`${collection.name} (${deleteCount} records)`);
          logger.info(`Wiped ${deleteCount} records from ${collection.name} for guild ${interaction.guildId}`);
        } catch (error) {
          errors.push(`Failed to wipe ${collection.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const resultEmbed = errors.length === 0
        ? EmbedUtils.createSuccessEmbed('Database Wipe Complete', `Wiped ${wipedCollections.length} collections successfully.`)
        : EmbedUtils.createErrorEmbed('Database Wipe Failed', `Completed with ${errors.length} errors.`);

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

      logger.warn(`Database wipe performed by ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Error in wipe confirmation:', error);
      await interaction.followUp({
        embeds: [this.createErrorEmbed('An error occurred during database wipe.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'setupserver', description: 'COMPLETE SERVER WIPE + SETUP (DESTROYS ALL CHANNELS/ROLES)' })
  @AuditDecorators.AdminAction(AuditAction.SYSTEM_REPAIR, 'critical')
  async setupServer(interaction: CommandInteraction): Promise<void> {
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
      const modal = new ModalBuilder()
        .setCustomId(`setup_confirm_${interaction.user.id}`)
        .setTitle('🚨 DESTROY ALL: Complete Server Wipe');

      const confirmInput = new TextInputBuilder()
        .setCustomId('confirmation')
        .setLabel('Type "DELETE EVERYTHING" to proceed')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('DELETE EVERYTHING');

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(confirmInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);

    } catch (error) {
      logger.error('Error showing setup confirmation modal:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @ModalComponent({ id: /setup_confirm_.*/ })
  async handleSetupConfirmation(interaction: ModalSubmitInteraction): Promise<void> {
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
        embeds: [EmbedUtils.createInfoEmbed('Anarchy Server Setup', '🚨 Starting COMPLETE server wipe (ALL channels/roles will be DESTROYED) + Anarchy & Associates setup...')],
        ephemeral: true,
      });

      const result = await this.anarchySetupService.setupAnarchyServer(interaction.guild!);
      
      const resultEmbed = result.success 
        ? EmbedUtils.createSuccessEmbed('Anarchy Server Setup Complete', result.message)
        : EmbedUtils.createErrorEmbed('Anarchy Server Setup Failed', result.message);

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
      } catch (discordError) {
        logger.warn('Failed to send setup completion message (interaction may have expired):', discordError);
        // Try to log to a different channel or just continue - the setup was successful
      }

      logger.warn(`Anarchy server setup performed by ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Error in setup confirmation:', error);
      try {
        await interaction.followUp({
          embeds: [this.createErrorEmbed('An error occurred during server setup.')],
          ephemeral: true,
        });
      } catch (discordError) {
        logger.warn('Failed to send error message (interaction may have expired):', discordError);
      }
    }
  }
}