import {
  Discord,
  Slash,
  SlashOption,
  SlashGroup,
} from 'discordx';
import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { RepairService, RepairResult, HealthCheckResult } from '../../application/services/repair-service';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { logger } from '../../infrastructure/logger';

@Discord()
@SlashGroup({ name: 'repair', description: 'System repair and maintenance commands' })
@SlashGroup('repair')
export class RepairCommands {
  private repairService: RepairService;
  private permissionService: PermissionService;
  private guildConfigRepository: GuildConfigRepository;

  constructor() {
    this.repairService = new RepairService();
    this.guildConfigRepository = new GuildConfigRepository();
    this.permissionService = new PermissionService(this.guildConfigRepository);
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

  private async checkAdminPermission(interaction: CommandInteraction): Promise<boolean> {
    const context = await this.getPermissionContext(interaction);
    return await this.permissionService.hasActionPermission(context, 'admin');
  }

  private createRepairResultEmbed(result: RepairResult, operation: string): EmbedBuilder {
    const embed = EmbedUtils.createAALegalEmbed({
      title: result.success ? `✅ ${operation} Completed` : `❌ ${operation} Failed`,
      description: result.message,
      color: result.success ? 'success' : 'error'
    });

    if (result.changes.length > 0) {
      const changesText = result.changes.slice(0, 10).join('\n');
      const moreChanges = result.changes.length > 10 ? `\n... and ${result.changes.length - 10} more` : '';
      
      EmbedUtils.addFieldSafe(
        embed, 
        'Changes Made', 
        changesText + moreChanges,
        false
      );
    }

    if (result.errors.length > 0) {
      const errorsText = result.errors.slice(0, 5).join('\n');
      const moreErrors = result.errors.length > 5 ? `\n... and ${result.errors.length - 5} more` : '';
      
      EmbedUtils.addFieldSafe(
        embed, 
        'Errors Encountered', 
        errorsText + moreErrors,
        false
      );
    }

    return embed;
  }

  private createHealthCheckEmbed(result: HealthCheckResult): EmbedBuilder {
    const embed = EmbedUtils.createAALegalEmbed({
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

  @Slash({ name: 'staff-roles', description: 'Synchronize staff roles between Discord and database' })
  async repairStaffRoles(
    @SlashOption({
      name: 'dry-run',
      description: 'Preview changes without applying them',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    dryRun: boolean = false,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const hasPermission = await this.checkAdminPermission(interaction);
      if (!hasPermission) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [EmbedUtils.createInfoEmbed('Starting Repair', `Staff roles synchronization ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
        ephemeral: true,
      });

      const result = await this.repairService.repairStaffRoles(interaction.guild, dryRun);
      const embed = this.createRepairResultEmbed(result, 'Staff Roles Repair');

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in staff roles repair command:', error);
      await interaction.followUp({
        embeds: [EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during staff roles repair.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'job-roles', description: 'Synchronize job roles between Discord and database' })
  async repairJobRoles(
    @SlashOption({
      name: 'dry-run',
      description: 'Preview changes without applying them',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    dryRun: boolean = false,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const hasPermission = await this.checkAdminPermission(interaction);
      if (!hasPermission) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [EmbedUtils.createInfoEmbed('Starting Repair', `Job roles synchronization ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
        ephemeral: true,
      });

      const result = await this.repairService.repairJobRoles(interaction.guild, dryRun);
      const embed = this.createRepairResultEmbed(result, 'Job Roles Repair');

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in job roles repair command:', error);
      await interaction.followUp({
        embeds: [EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during job roles repair.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'channels', description: 'Ensure all required channels and categories exist' })
  async repairChannels(
    @SlashOption({
      name: 'dry-run',
      description: 'Preview changes without applying them',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    dryRun: boolean = false,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const hasPermission = await this.checkAdminPermission(interaction);
      if (!hasPermission) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [EmbedUtils.createInfoEmbed('Starting Repair', `Channels repair ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
        ephemeral: true,
      });

      const result = await this.repairService.repairChannels(interaction.guild, dryRun);
      const embed = this.createRepairResultEmbed(result, 'Channels Repair');

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in channels repair command:', error);
      await interaction.followUp({
        embeds: [EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during channels repair.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'validate-config', description: 'Validate and fix configuration inconsistencies' })
  async repairConfig(
    @SlashOption({
      name: 'dry-run',
      description: 'Preview changes without applying them',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    dryRun: boolean = false,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const hasPermission = await this.checkAdminPermission(interaction);
      if (!hasPermission) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [EmbedUtils.createInfoEmbed('Starting Repair', `Configuration repair ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
        ephemeral: true,
      });

      const result = await this.repairService.repairConfig(interaction.guild, dryRun);
      const embed = this.createRepairResultEmbed(result, 'Configuration Repair');

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in config repair command:', error);
      await interaction.followUp({
        embeds: [EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during configuration repair.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'orphaned', description: 'Find and clean orphaned database records' })
  async repairOrphaned(
    @SlashOption({
      name: 'dry-run',
      description: 'Preview changes without applying them',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    dryRun: boolean = false,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const hasPermission = await this.checkAdminPermission(interaction);
      if (!hasPermission) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [EmbedUtils.createInfoEmbed('Starting Repair', `Orphaned records cleanup ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
        ephemeral: true,
      });

      const result = await this.repairService.repairOrphaned(interaction.guild, dryRun);
      const embed = this.createRepairResultEmbed(result, 'Orphaned Records Repair');

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in orphaned records repair command:', error);
      await interaction.followUp({
        embeds: [EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during orphaned records repair.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'db-indexes', description: 'Ensure MongoDB indexes are correct' })
  async repairDbIndexes(
    @SlashOption({
      name: 'dry-run',
      description: 'Preview changes without applying them',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    dryRun: boolean = false,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const hasPermission = await this.checkAdminPermission(interaction);
      if (!hasPermission) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [EmbedUtils.createInfoEmbed('Starting Repair', `Database indexes repair ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
        ephemeral: true,
      });

      const result = await this.repairService.repairDbIndexes(interaction.guild, dryRun);
      const embed = this.createRepairResultEmbed(result, 'Database Indexes Repair');

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in db indexes repair command:', error);
      await interaction.followUp({
        embeds: [EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during database indexes repair.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'all', description: 'Execute all repair routines' })
  async repairAll(
    @SlashOption({
      name: 'dry-run',
      description: 'Preview changes without applying them',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    dryRun: boolean = false,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const hasPermission = await this.checkAdminPermission(interaction);
      if (!hasPermission) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [EmbedUtils.createInfoEmbed('Starting Comprehensive Repair', `All repair operations ${dryRun ? '(dry-run mode)' : ''} in progress...`)],
        ephemeral: true,
      });

      const result = await this.repairService.repairAll(interaction.guild, dryRun);
      const embed = this.createRepairResultEmbed(result, 'Comprehensive Repair');

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in comprehensive repair command:', error);
      await interaction.followUp({
        embeds: [EmbedUtils.createErrorEmbed('Repair Failed', 'An unexpected error occurred during comprehensive repair.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'health', description: 'Comprehensive system health check' })
  async repairHealth(
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const hasPermission = await this.checkAdminPermission(interaction);
      if (!hasPermission) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Permission Denied', 'You need admin permissions to use repair commands.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [EmbedUtils.createInfoEmbed('Starting Health Check', 'Performing comprehensive system health check...')],
        ephemeral: true,
      });

      const result = await this.repairService.performHealthCheck(interaction.guild);
      const embed = this.createHealthCheckEmbed(result);

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in health check command:', error);
      await interaction.followUp({
        embeds: [EmbedUtils.createErrorEmbed('Health Check Failed', 'An unexpected error occurred during system health check.')],
        ephemeral: true,
      });
    }
  }
}