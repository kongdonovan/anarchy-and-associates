import {
  CommandInteraction,
  ApplicationCommandOptionType,
  User,
  EmbedBuilder
} from 'discord.js';
import { Discord, Slash, SlashOption, SlashGroup } from 'discordx';
import { FeedbackService } from '../../application/services/feedback-service';
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { 
  FeedbackRating, 
  isValidRating,
  getStarDisplay,
  getRatingText
} from '../../domain/entities/feedback';
import { logger } from '../../infrastructure/logger';

@Discord()
@SlashGroup({ description: 'Feedback management commands', name: 'feedback' })
@SlashGroup('feedback')
export class FeedbackCommands {
  private feedbackService: FeedbackService;

  constructor() {
    const feedbackRepository = new FeedbackRepository();
    const guildConfigRepository = new GuildConfigRepository();
    const staffRepository = new StaffRepository();

    this.feedbackService = new FeedbackService(
      feedbackRepository,
      guildConfigRepository,
      staffRepository
    );
  }

  @Slash({
    description: 'Submit feedback for staff or the firm',
    name: 'submit'
  })
  async submitFeedback(
    @SlashOption({
      description: 'Rating from 1-5 stars',
      name: 'rating',
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 1,
      maxValue: 5
    })
    rating: number,
    @SlashOption({
      description: 'Your feedback comment',
      name: 'comment',
      type: ApplicationCommandOptionType.String,
      required: true
    })
    comment: string,
    @SlashOption({
      description: 'Staff member to rate (leave blank for firm-wide feedback)',
      name: 'staff',
      type: ApplicationCommandOptionType.User,
      required: false
    })
    staff: User | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const submitterId = interaction.user.id;
      const submitterUsername = interaction.user.username;

      if (!isValidRating(rating)) {
        const embed = EmbedUtils.createErrorEmbed(
          'Invalid Rating',
          'Rating must be between 1 and 5 stars.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (comment.length > 1000) {
        const embed = EmbedUtils.createErrorEmbed(
          'Comment Too Long',
          'Feedback comments cannot exceed 1000 characters.'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Submit the feedback
      await this.feedbackService.submitFeedback({
        guildId,
        submitterId,
        submitterUsername,
        targetStaffId: staff?.id,
        targetStaffUsername: staff?.username,
        rating: rating as FeedbackRating,
        comment
      });

      // Get feedback channel ID
      const feedbackChannelId = await this.feedbackService.getFeedbackChannelId(guildId);

      // Create feedback embed
      const feedbackEmbed = new EmbedBuilder()
        .setTitle('⭐ New Feedback Received')
        .setColor(this.getRatingColor(rating as FeedbackRating))
        .addFields([
          {
            name: 'From',
            value: `${submitterUsername}`,
            inline: true
          },
          {
            name: 'For',
            value: staff ? `${staff.username}` : 'Anarchy & Associates (Firm-wide)',
            inline: true
          },
          {
            name: 'Rating',
            value: `${getStarDisplay(rating as FeedbackRating)} (${rating}/5 - ${getRatingText(rating as FeedbackRating)})`,
            inline: false
          },
          {
            name: 'Comment',
            value: comment,
            inline: false
          }
        ])
        .setTimestamp()
        .setFooter({
          text: 'Anarchy & Associates',
          iconURL: interaction.guild?.iconURL() || undefined
        });

      // Send to feedback channel if configured
      if (feedbackChannelId) {
        try {
          const feedbackChannel = await interaction.guild?.channels.fetch(feedbackChannelId);
          if (feedbackChannel?.isTextBased()) {
            await feedbackChannel.send({ embeds: [feedbackEmbed] });
          }
        } catch (error) {
          logger.warn('Could not send feedback to configured channel', {
            feedbackChannelId,
            error
          });
        }
      }

      // Notify staff member if targeted feedback
      if (staff) {
        try {
          const notificationEmbed = EmbedUtils.createInfoEmbed(
            'New Feedback Received',
            `You have received ${getStarDisplay(rating as FeedbackRating)} feedback from ${submitterUsername}!\n\n**Comment:** ${comment}`
          );
          await staff.send({ embeds: [notificationEmbed] });
        } catch (error) {
          logger.warn('Could not send DM notification to staff member', {
            staffId: staff?.id,
            error
          });
        }
      }

      // Confirm submission to user
      const confirmEmbed = EmbedUtils.createSuccessEmbed(
        'Feedback Submitted',
        `Thank you for your ${getStarDisplay(rating as FeedbackRating)} feedback${staff ? ` for ${staff.username}` : ' for our firm'}!`
      );
      await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

    } catch (error) {
      logger.error('Error submitting feedback', { error });
      
      const embed = EmbedUtils.createErrorEmbed(
        'Submission Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred while submitting feedback.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  @Slash({
    description: 'View feedback and performance metrics',
    name: 'view'
  })
  async viewFeedback(
    @SlashOption({
      description: 'Staff member to view feedback for (leave blank for firm overview)',
      name: 'staff',
      type: ApplicationCommandOptionType.User,
      required: false
    })
    staff: User | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const guildId = interaction.guildId!;

      if (staff) {
        // View specific staff member's performance
        const metrics = await this.feedbackService.getStaffPerformanceMetrics(staff.id, guildId);
        
        if (!metrics || metrics.totalFeedback === 0) {
          const embed = EmbedUtils.createInfoEmbed(
            'No Feedback Found',
            `${staff.username} has not received any feedback yet.`
          );
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(`📊 Performance Overview - ${staff.username}`)
          .setColor(this.getRatingColor(Math.round(metrics.averageRating) as FeedbackRating))
          .setThumbnail(staff.displayAvatarURL())
          .addFields([
            {
              name: 'Overall Rating',
              value: `${getStarDisplay(Math.round(metrics.averageRating) as FeedbackRating)} ${metrics.averageRating.toFixed(2)}/5.0`,
              inline: true
            },
            {
              name: 'Total Feedback',
              value: `${metrics.totalFeedback} reviews`,
              inline: true
            },
            {
              name: 'Rating Breakdown',
              value: [
                `⭐⭐⭐⭐⭐ ${metrics.ratingDistribution[5]}`,
                `⭐⭐⭐⭐☆ ${metrics.ratingDistribution[4]}`,
                `⭐⭐⭐☆☆ ${metrics.ratingDistribution[3]}`,
                `⭐⭐☆☆☆ ${metrics.ratingDistribution[2]}`,
                `⭐☆☆☆☆ ${metrics.ratingDistribution[1]}`
              ].join('\n'),
              inline: false
            }
          ])
          .setTimestamp()
          .setFooter({
            text: 'Anarchy & Associates Performance Metrics',
            iconURL: interaction.guild?.iconURL() || undefined
          });

        // Add recent feedback if available
        if (metrics.recentFeedback.length > 0) {
          const recentComments = metrics.recentFeedback
            .slice(0, 3)
            .map(f => `${getStarDisplay(f.rating)} "${f.comment.length > 50 ? f.comment.substring(0, 50) + '...' : f.comment}" - ${f.submitterUsername}`)
            .join('\n\n');

          embed.addFields([{
            name: 'Recent Feedback',
            value: recentComments,
            inline: false
          }]);
        }

        await interaction.reply({ embeds: [embed] });

      } else {
        // View firm-wide performance
        const firmMetrics = await this.feedbackService.getFirmPerformanceMetrics(guildId);
        
        if (firmMetrics.totalFeedback === 0) {
          const embed = EmbedUtils.createInfoEmbed(
            'No Feedback Yet',
            'Anarchy & Associates has not received any feedback yet.'
          );
          await interaction.reply({ embeds: [embed] });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('📊 Firm Performance Overview')
          .setColor(this.getRatingColor(Math.round(firmMetrics.averageRating) as FeedbackRating))
          .setThumbnail(interaction.guild?.iconURL() || null)
          .addFields([
            {
              name: 'Overall Firm Rating',
              value: `${getStarDisplay(Math.round(firmMetrics.averageRating) as FeedbackRating)} ${firmMetrics.averageRating.toFixed(2)}/5.0`,
              inline: true
            },
            {
              name: 'Total Feedback',
              value: `${firmMetrics.totalFeedback} reviews`,
              inline: true
            },
            {
              name: 'Staff Members Rated',
              value: `${firmMetrics.staffMetrics.length} staff`,
              inline: true
            },
            {
              name: 'Rating Distribution',
              value: [
                `⭐⭐⭐⭐⭐ ${firmMetrics.ratingDistribution[5]}`,
                `⭐⭐⭐⭐☆ ${firmMetrics.ratingDistribution[4]}`,
                `⭐⭐⭐☆☆ ${firmMetrics.ratingDistribution[3]}`,
                `⭐⭐☆☆☆ ${firmMetrics.ratingDistribution[2]}`,
                `⭐☆☆☆☆ ${firmMetrics.ratingDistribution[1]}`
              ].join('\n'),
              inline: false
            }
          ])
          .setTimestamp()
          .setFooter({
            text: 'Anarchy & Associates',
            iconURL: interaction.guild?.iconURL() || undefined
          });

        // Add top rated staff if available
        if (firmMetrics.staffMetrics.length > 0) {
          const topStaff = firmMetrics.staffMetrics
            .filter(s => s.totalFeedback >= 3)
            .sort((a, b) => b.averageRating - a.averageRating)
            .slice(0, 5)
            .map(s => `${s.staffUsername}: ${getStarDisplay(Math.round(s.averageRating) as FeedbackRating)} ${s.averageRating.toFixed(2)} (${s.totalFeedback} reviews)`)
            .join('\n');

          if (topStaff) {
            embed.addFields([{
              name: 'Top Rated Staff',
              value: topStaff,
              inline: false
            }]);
          }
        }

        await interaction.reply({ embeds: [embed] });
      }

    } catch (error) {
      logger.error('Error viewing feedback', { error });
      
      const embed = EmbedUtils.createErrorEmbed(
        'View Failed',
        'An unexpected error occurred while retrieving feedback information.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private getRatingColor(rating: FeedbackRating): number {
    switch (rating) {
      case FeedbackRating.FIVE_STAR:
        return 0x00ff00; // Green
      case FeedbackRating.FOUR_STAR:
        return 0x9acd32; // Yellow-green
      case FeedbackRating.THREE_STAR:
        return 0xffd700; // Gold
      case FeedbackRating.TWO_STAR:
        return 0xff8c00; // Orange
      case FeedbackRating.ONE_STAR:
        return 0xff0000; // Red
      default:
        return 0x3498db; // Blue
    }
  }
}