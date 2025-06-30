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
import { OrphanedChannelCleanupService } from '../../application/services/orphaned-channel-cleanup-service';
import { CaseChannelArchiveService } from '../../application/services/case-channel-archive-service';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
// import { UnifiedValidationService } from '../../application/validation/unified-validation-service';
import { ValidationServiceFactory } from '../../application/validation/validation-service-factory';
import { IntegrityReport } from '../../application/services/cross-entity-validation-service';
import { CrossEntityValidationService } from '../../application/services/cross-entity-validation-service';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { ReminderRepository } from '../../infrastructure/repositories/reminder-repository';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { logger } from '../../infrastructure/logger';
import { AuditDecorators } from '../decorators/audit-decorators';
import { AuditAction } from '../../domain/entities/audit-log';

@Discord()
@SlashGroup({ name: 'repair', description: 'System repair and maintenance commands' })
@SlashGroup('repair')
export class RepairCommands {
  private repairService: RepairService;
  private permissionService: PermissionService;
  private guildConfigRepository: GuildConfigRepository;
  private orphanedChannelCleanupService: OrphanedChannelCleanupService;
  private crossEntityValidationService: CrossEntityValidationService;

  constructor() {
    this.repairService = new RepairService();
    this.guildConfigRepository = new GuildConfigRepository();
    this.permissionService = new PermissionService(this.guildConfigRepository);
    
    // Initialize services for orphaned channel cleanup
    const caseRepository = new CaseRepository();
    const auditLogRepository = new AuditLogRepository();
    const staffRepository = new StaffRepository();
    const jobRepository = new JobRepository();
    const applicationRepository = new ApplicationRepository();
    const retainerRepository = new RetainerRepository();
    const feedbackRepository = new FeedbackRepository();
    const reminderRepository = new ReminderRepository();
    
    // Create unified validation service
    const validationService = ValidationServiceFactory.createValidationService(
      {
        staffRepository,
        caseRepository,
        guildConfigRepository: this.guildConfigRepository,
        jobRepository,
        applicationRepository
      },
      {
        permissionService: this.permissionService
      }
    );
    
    const caseChannelArchiveService = new CaseChannelArchiveService(
      caseRepository,
      this.guildConfigRepository,
      auditLogRepository,
      this.permissionService,
      validationService
    );
    
    this.orphanedChannelCleanupService = new OrphanedChannelCleanupService(
      caseRepository,
      this.guildConfigRepository,
      auditLogRepository,
      staffRepository,
      this.permissionService,
      validationService,
      caseChannelArchiveService
    );

    this.crossEntityValidationService = new CrossEntityValidationService(
      staffRepository,
      caseRepository,
      applicationRepository,
      jobRepository,
      retainerRepository,
      feedbackRepository,
      reminderRepository,
      auditLogRepository
    );
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
  @AuditDecorators.AdminAction(AuditAction.SYSTEM_REPAIR, 'high')
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
  @AuditDecorators.AdminAction(AuditAction.SYSTEM_REPAIR, 'medium')
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
  @AuditDecorators.AdminAction(AuditAction.SYSTEM_REPAIR, 'critical')
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
  @AuditDecorators.AdminAction(AuditAction.SYSTEM_REPAIR, 'low')
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

  @Slash({ name: 'orphaned-channels', description: 'Scan for orphaned channels that need cleanup' })
  async scanOrphanedChannels(
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
        embeds: [EmbedUtils.createInfoEmbed('Scanning Channels', 'Scanning for orphaned channels...')],
        ephemeral: true,
      });

      const context = await this.getPermissionContext(interaction);
      const orphanedChannels = await this.orphanedChannelCleanupService.scanForOrphanedChannels(
        interaction.guild,
        context
      );

      const embed = EmbedUtils.createAALegalEmbed({
        title: '🔍 Orphaned Channel Scan Results',
        description: `Found ${orphanedChannels.length} potentially orphaned channels.`,
      });

      // Group channels by recommended action
      const toArchive = orphanedChannels.filter(c => c.recommendedAction === 'archive');
      const toDelete = orphanedChannels.filter(c => c.recommendedAction === 'delete');
      const toReview = orphanedChannels.filter(c => c.recommendedAction === 'review');

      if (toArchive.length > 0) {
        const archiveList = toArchive.slice(0, 5).map(c => 
          `• **${c.channelName}** - Inactive ${c.inactiveDays} days`
        ).join('\n');
        const more = toArchive.length > 5 ? `\n...and ${toArchive.length - 5} more` : '';
        
        embed.addFields({
          name: `📁 To Archive (${toArchive.length})`,
          value: archiveList + more,
          inline: false
        });
      }

      if (toDelete.length > 0) {
        const deleteList = toDelete.slice(0, 5).map(c => 
          `• **${c.channelName}** - Inactive ${c.inactiveDays} days`
        ).join('\n');
        const more = toDelete.length > 5 ? `\n...and ${toDelete.length - 5} more` : '';
        
        embed.addFields({
          name: `🗑️ To Delete (${toDelete.length})`,
          value: deleteList + more,
          inline: false
        });
      }

      if (toReview.length > 0) {
        const reviewList = toReview.slice(0, 5).map(c => 
          `• **${c.channelName}** - ${c.reasons[0] || 'Needs review'}`
        ).join('\n');
        const more = toReview.length > 5 ? `\n...and ${toReview.length - 5} more` : '';
        
        embed.addFields({
          name: `👀 Needs Review (${toReview.length})`,
          value: reviewList + more,
          inline: false
        });
      }

      if (orphanedChannels.length > 0) {
        embed.addFields({
          name: 'Next Steps',
          value: 'Use `/repair cleanup-channels` to perform cleanup with optional dry-run mode.',
          inline: false
        });
      }

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in orphaned channels scan command:', error);
      await interaction.followUp({
        embeds: [EmbedUtils.createErrorEmbed('Scan Failed', 'An unexpected error occurred during orphaned channel scan.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'cleanup-channels', description: 'Clean up orphaned channels (archive or delete)' })
  async cleanupOrphanedChannels(
    @SlashOption({
      name: 'dry-run',
      description: 'Preview changes without applying them',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    dryRun: boolean = false,
    @SlashOption({
      name: 'archive-only',
      description: 'Only archive channels, do not delete',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    archiveOnly: boolean = false,
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
        embeds: [EmbedUtils.createInfoEmbed(
          'Starting Cleanup', 
          `Channel cleanup ${dryRun ? '(dry-run mode)' : ''} in progress...`
        )],
        ephemeral: true,
      });

      const context = await this.getPermissionContext(interaction);
      
      // First scan for orphaned channels
      const orphanedChannels = await this.orphanedChannelCleanupService.scanForOrphanedChannels(
        interaction.guild,
        context
      );

      if (orphanedChannels.length === 0) {
        await interaction.followUp({
          embeds: [EmbedUtils.createSuccessEmbed(
            'No Orphaned Channels',
            'No orphaned channels found that need cleanup.'
          )],
          ephemeral: true,
        });
        return;
      }

      // Perform cleanup
      const actionsToPerform = archiveOnly ? ['archive'] : ['archive', 'delete'];
      const report = await this.orphanedChannelCleanupService.performCleanup(
        interaction.guild,
        orphanedChannels,
        context,
        {
          dryRun,
          actionsToPerform: actionsToPerform as any
        }
      );

      // Create result embed
      const embed = EmbedUtils.createAALegalEmbed({
        title: dryRun ? '🧹 Cleanup Preview (Dry Run)' : '✅ Cleanup Complete',
        description: `Processed ${report.totalChannelsScanned} orphaned channels.`,
      });

      embed.addFields(
        {
          name: 'Summary',
          value: [
            `📁 Archived: ${report.channelsArchived}`,
            `🗑️ Deleted: ${report.channelsDeleted}`,
            `⏭️ Skipped: ${report.channelsSkipped}`,
            `❌ Errors: ${report.errors}`
          ].join('\n'),
          inline: false
        }
      );

      // Show some results
      if (report.results.length > 0) {
        const resultsSummary = report.results
          .slice(0, 10)
          .map(r => {
            const icon = r.action === 'archived' ? '📁' : 
                        r.action === 'deleted' ? '🗑️' : 
                        r.action === 'skipped' ? '⏭️' : '❌';
            return `${icon} **${r.channelName}** - ${r.reason}`;
          })
          .join('\n');
        
        const more = report.results.length > 10 ? 
          `\n...and ${report.results.length - 10} more` : '';

        embed.addFields({
          name: 'Actions Taken',
          value: resultsSummary + more,
          inline: false
        });
      }

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in cleanup channels command:', error);
      await interaction.followUp({
        embeds: [EmbedUtils.createErrorEmbed('Cleanup Failed', 'An unexpected error occurred during channel cleanup.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'auto-cleanup', description: 'Configure automatic orphaned channel cleanup' })
  async configureAutoCleanup(
    @SlashOption({
      name: 'enabled',
      description: 'Enable or disable automatic cleanup',
      type: ApplicationCommandOptionType.Boolean,
      required: true,
    })
    enabled: boolean,
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

      const context = await this.getPermissionContext(interaction);
      await this.orphanedChannelCleanupService.setAutoCleanup(
        interaction.guild.id,
        enabled,
        context
      );

      const embed = EmbedUtils.createSuccessEmbed(
        'Auto Cleanup Configuration',
        `Automatic orphaned channel cleanup has been ${enabled ? 'enabled' : 'disabled'}.`
      );

      if (enabled) {
        embed.addFields({
          name: 'ℹ️ Information',
          value: 'The bot will automatically scan and clean up orphaned channels based on the configured schedule.',
          inline: false
        });
      }

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error in auto cleanup configuration command:', error);
      await interaction.reply({
        embeds: [EmbedUtils.createErrorEmbed('Configuration Failed', 'An unexpected error occurred while configuring auto cleanup.')],
        ephemeral: true,
      });
    }
  }

  @Slash({
    name: 'integrity-check',
    description: 'Scan for data integrity issues across all entities'
  })
  async integrityCheck(
    @SlashOption({ 
      name: 'auto-repair',
      description: 'Automatically repair issues that can be fixed',
      type: ApplicationCommandOptionType.Boolean,
      required: false
    }) autoRepair: boolean = false,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      // Check admin permission
      if (!await this.checkAdminPermission(interaction)) {
        return;
      }

      const guildId = interaction.guildId!;

      // Defer reply as this might take a while
      await interaction.deferReply({ ephemeral: true });

      // Run integrity scan
      const report = await this.crossEntityValidationService.scanForIntegrityIssues(
        guildId,
        { client: interaction.client }
      );

      // Create initial report embed
      const reportEmbed = this.createIntegrityReportEmbed(report);

      // If no issues found
      if (report.issues.length === 0) {
        await interaction.editReply({
          embeds: [
            EmbedUtils.createSuccessEmbed(
              'Integrity Check Complete',
              'No integrity issues found! Your data is in good shape.'
            )
          ]
        });
        return;
      }

      // If auto-repair is requested and there are repairable issues
      if (autoRepair && report.repairableIssues > 0) {
        const repairEmbed = EmbedUtils.createWarningEmbed(
          'System Repair Authorization Required',
          `The diagnostic scan has identified **${report.repairableIssues}** issues that can be automatically remediated.\n\n**Proceed with automated repair procedures?**`
        ).addFields(
          { name: '§ Critical Issues', value: `${report.issuesBySeverity.critical} total (${report.issues.filter((i: any) => i.severity === 'critical' && i.canAutoRepair).length} repairable)`, inline: true },
          { name: '§ Warning Level', value: `${report.issuesBySeverity.warning} total (${report.issues.filter((i: any) => i.severity === 'warning' && i.canAutoRepair).length} repairable)`, inline: true },
          { name: '§ Informational', value: `${report.issuesBySeverity.info} total (${report.issues.filter((i: any) => i.severity === 'info' && i.canAutoRepair).length} repairable)`, inline: true }
        );

        await interaction.editReply({
          embeds: [reportEmbed, repairEmbed],
          content: 'Reply with **REPAIR** within 30 seconds to confirm auto-repair.'
        });

        // Wait for confirmation
        const filter = (m: any) => m.author.id === interaction.user.id && m.content === 'REPAIR';
        const collector = (interaction.channel as any)?.createMessageCollector({ filter, time: 30000, max: 1 });

        collector?.on('collect', async (message: any) => {
          try {
            await message.delete();
            
            // Perform auto-repair
            const repairResult = await this.crossEntityValidationService.repairIntegrityIssues(
              report.issues.filter((i: any) => i.canAutoRepair),
              { dryRun: false }
            );

            // Create repair result embed
            const resultEmbed = EmbedUtils.createAALegalEmbed({
              title: '🔧 Automated Repair Complete',
              description: `Successfully repaired **${repairResult.issuesRepaired}** of **${repairResult.totalIssuesFound}** issues.`
            });

            if (repairResult.failedRepairs.length > 0) {
              resultEmbed.addFields({
                name: '⚠️ Failed Repairs',
                value: repairResult.failedRepairs
                  .slice(0, 5)
                  .map((f: any) => `• ${f.issue.message}: ${f.error}`)
                  .join('\n') + (repairResult.failedRepairs.length > 5 ? `\n...and ${repairResult.failedRepairs.length - 5} more` : ''),
                inline: false
              });
            }

            await interaction.followUp({
              embeds: [resultEmbed],
              ephemeral: true
            });
          } catch (error) {
            logger.error('Error in auto-repair process:', error);
            await interaction.followUp({
              embeds: [EmbedUtils.createErrorEmbed('Repair Failed', 'An error occurred during the auto-repair process.')],
              ephemeral: true
            });
          }
        });

        collector?.on('end', (collected: any) => {
          if (collected.size === 0) {
            interaction.followUp({
              embeds: [EmbedUtils.createInfoEmbed('Repair Cancelled', 'Auto-repair was not confirmed within the time limit.')],
              ephemeral: true
            });
          }
        });
      } else {
        // Just show the report
        await interaction.editReply({
          embeds: [reportEmbed]
        });
      }

    } catch (error) {
      logger.error('Error in integrity check command:', error);
      const errorEmbed = EmbedUtils.createErrorEmbed(
        'Integrity Check Failed',
        'An unexpected error occurred during the integrity check.'
      );
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  private createIntegrityReportEmbed(report: IntegrityReport): EmbedBuilder {
    const scanDuration = (report.scanCompletedAt.getTime() - report.scanStartedAt.getTime()) / 1000;
    
    const embedColor = report.issues.length === 0 ? 'success' : 
                      report.issuesBySeverity.critical > 0 ? 'error' : 'warning';
    
    const embed = EmbedUtils.createAALegalEmbed({
      title: '⚖️ System Integrity Diagnostic Report',
      description: `Comprehensive system scan completed. Analyzed **${report.totalEntitiesScanned}** database entities in ${scanDuration.toFixed(2)} seconds.`,
      color: embedColor as any
    });

    if (report.issues.length > 0) {
      embed.addFields(
        { name: 'Total Issues', value: report.issues.length.toString(), inline: true },
        { name: 'Repairable', value: report.repairableIssues.toString(), inline: true },
        { name: 'Manual Fix Required', value: (report.issues.length - report.repairableIssues).toString(), inline: true }
      );

      // Add severity breakdown
      embed.addFields(
        { name: 'Critical Issues', value: report.issuesBySeverity.critical.toString(), inline: true },
        { name: 'Warnings', value: report.issuesBySeverity.warning.toString(), inline: true },
        { name: 'Info', value: report.issuesBySeverity.info.toString(), inline: true }
      );

      // Add entity type breakdown
      if (report.issuesByEntityType.size > 0) {
        const entityBreakdown = Array.from(report.issuesByEntityType.entries())
          .map(([type, count]) => `**${type}**: ${count}`)
          .join('\n');
        embed.addFields({ name: 'Issues by Entity Type', value: entityBreakdown });
      }

      // Add sample issues (up to 5)
      const sampleIssues = report.issues.slice(0, 5);
      const issueDescriptions = sampleIssues.map(issue => 
        `**[${issue.severity.toUpperCase()}]** ${issue.entityType} - ${issue.message} ${issue.canAutoRepair ? '(auto-repairable)' : '(manual fix required)'}`
      ).join('\n');
      
      embed.addFields({ 
        name: `Sample Issues ${report.issues.length > 5 ? `(showing 5 of ${report.issues.length})` : ''}`, 
        value: issueDescriptions 
      });
    } else {
      embed.addFields({ name: 'Result', value: 'No integrity issues found!' });
    }

    return embed;
  }

  
}