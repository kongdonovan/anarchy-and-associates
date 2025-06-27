import {
  Discord,
  Slash,
  SlashOption,
  SlashGroup,
} from 'discordx';
import {
  ApplicationCommandOptionType,
  CommandInteraction,
  User,
  EmbedBuilder,
} from 'discord.js';
import { MetricsService, BotMetrics, LawyerStats, AllLawyerStats } from '../../application/services/metrics-service';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { logger } from '../../infrastructure/logger';

@Discord()
@SlashGroup({ name: 'metrics', description: 'Bot metrics and statistics commands' })
@SlashGroup('metrics')
export class MetricsCommands {
  private metricsService: MetricsService;

  constructor() {
    this.metricsService = new MetricsService();
  }

  private createMetricsEmbed(metrics: BotMetrics): EmbedBuilder {
    const embed = EmbedUtils.createAALegalEmbed({
      title: '📊 Bot & Server Metrics',
      description: 'Current system statistics and performance data'
    });

    // Uptime information
    embed.addFields({
      name: '⏱️ Uptime',
      value: `**Duration:** ${metrics.uptime.duration}\n**Started:** <t:${Math.floor(metrics.uptime.startTime.getTime() / 1000)}:R>`,
      inline: true
    });

    // Database metrics
    const dbStats = [
      `**Staff:** ${metrics.database.activeStaff}/${metrics.database.totalStaff} active`,
      `**Cases:** ${metrics.database.openCases}/${metrics.database.totalCases} open`,
      `**Applications:** ${metrics.database.pendingApplications}/${metrics.database.totalApplications} pending`,
      `**Jobs:** ${metrics.database.openJobs}/${metrics.database.totalJobs} open`,
      `**Retainers:** ${metrics.database.totalRetainers} total`,
      `**Feedback:** ${metrics.database.totalFeedback} submissions`
    ].join('\n');

    embed.addFields({
      name: '💾 Database',
      value: dbStats,
      inline: true
    });

    // Discord metrics
    const discordStats = [
      `**Members:** ${metrics.discord.memberCount.toLocaleString()}`,
      `**Channels:** ${metrics.discord.channelCount}`,
      `**Roles:** ${metrics.discord.roleCount}`
    ].join('\n');

    embed.addFields({
      name: '🤖 Discord Server',
      value: discordStats,
      inline: true
    });

    // Performance metrics
    if (metrics.performance.memoryUsage) {
      const memory = metrics.performance.memoryUsage;
      const memoryStats = [
        `**Used:** ${this.metricsService.formatBytes(memory.heapUsed)}`,
        `**Total:** ${this.metricsService.formatBytes(memory.heapTotal)}`,
        `**RSS:** ${this.metricsService.formatBytes(memory.rss)}`
      ].join('\n');

      embed.addFields({
        name: '💾 Memory Usage',
        value: memoryStats,
        inline: true
      });
    }

    return embed;
  }

  private createSingleLawyerStatsEmbed(stats: LawyerStats): EmbedBuilder {
    const embed = EmbedUtils.createAALegalEmbed({
      title: '⚖️ Lawyer Performance Statistics',
      description: `Statistics for ${stats.displayName || stats.username || 'Unknown User'}`
    });

    // Basic info
    embed.addFields({
      name: '👤 Profile',
      value: `**Role:** ${stats.role}\n**User:** <@${stats.userId}>`,
      inline: true
    });

    // Case statistics
    const caseStats = [
      `**Total Cases:** ${stats.stats.totalCases}`,
      `**Won:** ${stats.stats.wonCases} (${stats.stats.winRate.toFixed(1)}%)`,
      `**Lost:** ${stats.stats.lostCases}`,
      `**Settled:** ${stats.stats.settledCases}`,
      `**Other:** ${stats.stats.otherCases}`
    ].join('\n');

    embed.addFields({
      name: '📈 Case Results',
      value: caseStats,
      inline: true
    });

    // Performance metrics
    const performanceStats = [];
    
    if (stats.stats.averageCaseDuration !== undefined) {
      performanceStats.push(`**Avg Case Duration:** ${stats.stats.averageCaseDuration.toFixed(1)} days`);
    }
    
    performanceStats.push(`**Feedback:** ${stats.stats.feedbackCount} submissions`);
    
    if (stats.stats.averageRating !== undefined) {
      const stars = '⭐'.repeat(Math.round(stats.stats.averageRating));
      performanceStats.push(`**Average Rating:** ${stats.stats.averageRating.toFixed(1)}/5 ${stars}`);
    }

    if (performanceStats.length > 0) {
      embed.addFields({
        name: '📊 Performance',
        value: performanceStats.join('\n'),
        inline: true
      });
    }

    // Win rate color coding
    if (stats.stats.winRate >= 70) {
      embed.setColor(0x00FF41); // Green for high win rate
    } else if (stats.stats.winRate >= 50) {
      embed.setColor(0xFF851B); // Orange for medium win rate
    } else if (stats.stats.totalCases > 0) {
      embed.setColor(0xFF4136); // Red for low win rate
    }

    return embed;
  }

  private createAllLawyerStatsEmbed(allStats: AllLawyerStats): EmbedBuilder {
    const embed = EmbedUtils.createAALegalEmbed({
      title: '⚖️ Firm-Wide Lawyer Statistics',
      description: `Performance overview for all ${allStats.totalLawyers} active lawyers`
    });

    // Summary statistics
    const summaryStats = [
      `**Total Cases:** ${allStats.summary.totalCases}`,
      `**Overall Win Rate:** ${allStats.summary.overallWinRate.toFixed(1)}%`,
      `**Avg Case Duration:** ${allStats.summary.averageCaseDuration.toFixed(1)} days`
    ].join('\n');

    embed.addFields({
      name: '📊 Firm Summary',
      value: summaryStats,
      inline: false
    });

    // Top performer
    if (allStats.summary.topPerformer) {
      const top = allStats.summary.topPerformer;
      embed.addFields({
        name: '🏆 Top Performer',
        value: `**${top.displayName || top.username}** (${top.role})\n${top.stats.winRate.toFixed(1)}% win rate with ${top.stats.totalCases} cases`,
        inline: false
      });
    }

    // Top 10 lawyers by total cases
    const topLawyers = allStats.stats.slice(0, 10);
    if (topLawyers.length > 0) {
      const lawyersList = topLawyers.map((lawyer, index) => {
        const winRateEmoji = lawyer.stats.winRate >= 70 ? '🟢' : lawyer.stats.winRate >= 50 ? '🟡' : '🔴';
        return `${index + 1}. **${lawyer.displayName || lawyer.username}** - ${lawyer.stats.totalCases} cases (${lawyer.stats.winRate.toFixed(1)}% win rate) ${winRateEmoji}`;
      }).join('\n');

      EmbedUtils.addFieldSafe(embed, '📋 Top Lawyers by Case Volume', lawyersList, false);
    }

    return embed;
  }

  @Slash({ name: 'overview', description: 'Display bot and server statistics' })
  async metrics(interaction: CommandInteraction): Promise<void> {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      const metrics = await this.metricsService.getBotMetrics(interaction.guild);
      const embed = this.createMetricsEmbed(metrics);

      await interaction.editReply({
        embeds: [embed],
      });

    } catch (error) {
      logger.error('Error in metrics command:', error);
      
      const errorEmbed = EmbedUtils.createErrorEmbed(
        'Metrics Error',
        'Failed to retrieve system metrics. Please try again later.'
      );

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  @Slash({ name: 'lawyer-stats', description: 'View win/loss statistics for lawyers' })
  async stats(
    @SlashOption({
      name: 'user',
      description: 'Lawyer to view stats for (leave empty for all lawyers)',
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    user: User | undefined,
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

      await interaction.deferReply();

      const stats = await this.metricsService.getLawyerStats(interaction.guild, user?.id);

      let embed: EmbedBuilder;

      if (user) {
        // Single lawyer stats
        if ('userId' in stats) {
          embed = this.createSingleLawyerStatsEmbed(stats as LawyerStats);
        } else {
          throw new Error('Unexpected stats format for single user');
        }
      } else {
        // All lawyers stats
        if ('totalLawyers' in stats) {
          embed = this.createAllLawyerStatsEmbed(stats as AllLawyerStats);
        } else {
          throw new Error('Unexpected stats format for all users');
        }
      }

      await interaction.editReply({
        embeds: [embed],
      });

    } catch (error) {
      logger.error('Error in stats command:', error);
      
      let errorMessage = 'Failed to retrieve lawyer statistics. Please try again later.';
      
      if (error instanceof Error) {
        if (error.message.includes('not an active staff member')) {
          errorMessage = user 
            ? `${user.displayName} is not an active staff member.`
            : 'User is not an active staff member.';
        }
      }

      const errorEmbed = EmbedUtils.createErrorEmbed('Statistics Error', errorMessage);

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
}