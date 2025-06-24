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
exports.FeedbackCommands = void 0;
const discord_js_1 = require("discord.js");
const discordx_1 = require("discordx");
const feedback_service_1 = require("../../application/services/feedback-service");
const feedback_repository_1 = require("../../infrastructure/repositories/feedback-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const feedback_1 = require("../../domain/entities/feedback");
const logger_1 = require("../../infrastructure/logger");
let FeedbackCommands = class FeedbackCommands {
    constructor() {
        const feedbackRepository = new feedback_repository_1.FeedbackRepository();
        const guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        const staffRepository = new staff_repository_1.StaffRepository();
        this.feedbackService = new feedback_service_1.FeedbackService(feedbackRepository, guildConfigRepository, staffRepository);
    }
    async submitFeedback(rating, comment, staff, interaction) {
        try {
            const guildId = interaction.guildId;
            const submitterId = interaction.user.id;
            const submitterUsername = interaction.user.username;
            if (!(0, feedback_1.isValidRating)(rating)) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Invalid Rating', 'Rating must be between 1 and 5 stars.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            if (comment.length > 1000) {
                const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Comment Too Long', 'Feedback comments cannot exceed 1000 characters.');
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
                rating: rating,
                comment
            });
            // Get feedback channel ID
            const feedbackChannelId = await this.feedbackService.getFeedbackChannelId(guildId);
            // Create feedback embed
            const feedbackEmbed = new discord_js_1.EmbedBuilder()
                .setTitle('⭐ New Feedback Received')
                .setColor(this.getRatingColor(rating))
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
                    value: `${(0, feedback_1.getStarDisplay)(rating)} (${rating}/5 - ${(0, feedback_1.getRatingText)(rating)})`,
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
                }
                catch (error) {
                    logger_1.logger.warn('Could not send feedback to configured channel', {
                        feedbackChannelId,
                        error
                    });
                }
            }
            // Notify staff member if targeted feedback
            if (staff) {
                try {
                    const notificationEmbed = embed_utils_1.EmbedUtils.createInfoEmbed('New Feedback Received', `You have received ${(0, feedback_1.getStarDisplay)(rating)} feedback from ${submitterUsername}!\n\n**Comment:** ${comment}`);
                    await staff.send({ embeds: [notificationEmbed] });
                }
                catch (error) {
                    logger_1.logger.warn('Could not send DM notification to staff member', {
                        staffId: staff?.id,
                        error
                    });
                }
            }
            // Confirm submission to user
            const confirmEmbed = embed_utils_1.EmbedUtils.createSuccessEmbed('Feedback Submitted', `Thank you for your ${(0, feedback_1.getStarDisplay)(rating)} feedback${staff ? ` for ${staff.username}` : ' for our firm'}!`);
            await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
        }
        catch (error) {
            logger_1.logger.error('Error submitting feedback', { error });
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('Submission Failed', error instanceof Error ? error.message : 'An unexpected error occurred while submitting feedback.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    async viewFeedback(staff, interaction) {
        try {
            const guildId = interaction.guildId;
            if (staff) {
                // View specific staff member's performance
                const metrics = await this.feedbackService.getStaffPerformanceMetrics(staff.id, guildId);
                if (!metrics || metrics.totalFeedback === 0) {
                    const embed = embed_utils_1.EmbedUtils.createInfoEmbed('No Feedback Found', `${staff.username} has not received any feedback yet.`);
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(`📊 Performance Overview - ${staff.username}`)
                    .setColor(this.getRatingColor(Math.round(metrics.averageRating)))
                    .setThumbnail(staff.displayAvatarURL())
                    .addFields([
                    {
                        name: 'Overall Rating',
                        value: `${(0, feedback_1.getStarDisplay)(Math.round(metrics.averageRating))} ${metrics.averageRating.toFixed(2)}/5.0`,
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
                        .map(f => `${(0, feedback_1.getStarDisplay)(f.rating)} "${f.comment.length > 50 ? f.comment.substring(0, 50) + '...' : f.comment}" - ${f.submitterUsername}`)
                        .join('\n\n');
                    embed.addFields([{
                            name: 'Recent Feedback',
                            value: recentComments,
                            inline: false
                        }]);
                }
                await interaction.reply({ embeds: [embed] });
            }
            else {
                // View firm-wide performance
                const firmMetrics = await this.feedbackService.getFirmPerformanceMetrics(guildId);
                if (firmMetrics.totalFeedback === 0) {
                    const embed = embed_utils_1.EmbedUtils.createInfoEmbed('No Feedback Yet', 'Anarchy & Associates has not received any feedback yet.');
                    await interaction.reply({ embeds: [embed] });
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('📊 Firm Performance Overview')
                    .setColor(this.getRatingColor(Math.round(firmMetrics.averageRating)))
                    .setThumbnail(interaction.guild?.iconURL() || null)
                    .addFields([
                    {
                        name: 'Overall Firm Rating',
                        value: `${(0, feedback_1.getStarDisplay)(Math.round(firmMetrics.averageRating))} ${firmMetrics.averageRating.toFixed(2)}/5.0`,
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
                        .map(s => `${s.staffUsername}: ${(0, feedback_1.getStarDisplay)(Math.round(s.averageRating))} ${s.averageRating.toFixed(2)} (${s.totalFeedback} reviews)`)
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
        }
        catch (error) {
            logger_1.logger.error('Error viewing feedback', { error });
            const embed = embed_utils_1.EmbedUtils.createErrorEmbed('View Failed', 'An unexpected error occurred while retrieving feedback information.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    getRatingColor(rating) {
        switch (rating) {
            case feedback_1.FeedbackRating.FIVE_STAR:
                return 0x00ff00; // Green
            case feedback_1.FeedbackRating.FOUR_STAR:
                return 0x9acd32; // Yellow-green
            case feedback_1.FeedbackRating.THREE_STAR:
                return 0xffd700; // Gold
            case feedback_1.FeedbackRating.TWO_STAR:
                return 0xff8c00; // Orange
            case feedback_1.FeedbackRating.ONE_STAR:
                return 0xff0000; // Red
            default:
                return 0x3498db; // Blue
        }
    }
};
exports.FeedbackCommands = FeedbackCommands;
__decorate([
    (0, discordx_1.Slash)({
        description: 'Submit feedback for staff or the firm',
        name: 'submit'
    }),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Rating from 1-5 stars',
        name: 'rating',
        type: discord_js_1.ApplicationCommandOptionType.Integer,
        required: true,
        minValue: 1,
        maxValue: 5
    })),
    __param(1, (0, discordx_1.SlashOption)({
        description: 'Your feedback comment',
        name: 'comment',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: true
    })),
    __param(2, (0, discordx_1.SlashOption)({
        description: 'Staff member to rate (leave blank for firm-wide feedback)',
        name: 'staff',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: false
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], FeedbackCommands.prototype, "submitFeedback", null);
__decorate([
    (0, discordx_1.Slash)({
        description: 'View feedback and performance metrics',
        name: 'view'
    }),
    __param(0, (0, discordx_1.SlashOption)({
        description: 'Staff member to view feedback for (leave blank for firm overview)',
        name: 'staff',
        type: discord_js_1.ApplicationCommandOptionType.User,
        required: false
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], FeedbackCommands.prototype, "viewFeedback", null);
exports.FeedbackCommands = FeedbackCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ description: 'Feedback management commands', name: 'feedback' }),
    (0, discordx_1.SlashGroup)('feedback'),
    __metadata("design:paramtypes", [])
], FeedbackCommands);
//# sourceMappingURL=feedback-commands.js.map