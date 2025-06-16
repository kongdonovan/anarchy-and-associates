import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { CommandInteraction, User } from "discord.js";
import { Logger } from "../utils/logger.js";
import { buildFeedbackReceivedEmbed, buildFeedbackSubmittedEmbed } from "../services/feedback.js";
import { FeedbackRepository } from "../mongo/repository/feedback.js";
import { getGuildConfig } from "../utils/botConfig.js";

const logger = new Logger("FeedbackCommandGroup");
const feedbackRepo = new FeedbackRepository();

@Discord()
@SlashGroup({ name: "feedback", description: "Feedback commands" })
@SlashGroup("feedback")
export class FeedbackCommandGroup {
  /**
   * /feedback submit [message] [stars] [ping]
   * Submit feedback to the admins (was /feedback)
   */
  @Slash({ name: "submit", description: "Submit feedback to the admins" })
  async submit(
    @SlashOption({ name: "message", description: "Your feedback", required: true, type: 3 }) message: string,
    @SlashOption({ name: "stars", description: "Star rating (1-5)", required: true, type: 4 }) stars: number,
    @SlashOption({ name: "ping", description: "Optionally ping a user", required: false, type: 6 }) ping: User | undefined,
    interaction: CommandInteraction
  ) {
    try {
      if (stars < 1 || stars > 5) {
        await interaction.reply({ content: "Star rating must be between 1 and 5.", ephemeral: true });
        return;
      }
      const user = interaction.user;
      await feedbackRepo.addFeedback({
        userId: user.id,
        username: user.username,
        message,
        createdAt: new Date(),
        pingedUserId: ping?.id,
        stars,
      });
      const config = await getGuildConfig(interaction.guildId!);
      const feedbackChannelId = config?.feedbackChannelId;
      if (feedbackChannelId) {
        const feedbackEmbed = buildFeedbackSubmittedEmbed(user.id, user.username, message, stars, ping?.id);
        try {
          const channel = await interaction.client.channels.fetch(feedbackChannelId);
          if (channel && 'send' in channel && typeof channel.send === 'function') {
            await channel.send({ embeds: [feedbackEmbed] });
          }
        } catch (e) {
          logger.error("Failed to send feedback to channel", e);
        }
      }
      const embed = buildFeedbackReceivedEmbed(ping?.id, stars);
      await interaction.reply({ embeds: [embed], ephemeral: true, content: ping ? `<@${ping.id}>` : undefined });
    } catch (error) {
      logger.error("Failed to submit feedback", error);
      await interaction.reply({ content: "Failed to submit feedback.", ephemeral: true });
    }
  }

  /**
   * /feedback search [user] [from] [to]
   * Admin: Search feedback by user or date (was /searchfeedback)
   */
  @Slash({ name: "search", description: "Admin: Search feedback by user or date" })
  async search(
    @SlashOption({ name: "user", description: "Filter by user", required: false, type: 6 }) user: User | undefined,
    @SlashOption({ name: "from", description: "From date (YYYY-MM-DD)", required: false, type: 3 }) from: string | undefined,
    @SlashOption({ name: "to", description: "To date (YYYY-MM-DD)", required: false, type: 3 }) to: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      if (!interaction.memberPermissions?.has("Administrator")) {
        await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        return;
      }
      let fromDate: Date | undefined = undefined;
      let toDate: Date | undefined = undefined;
      if (from) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
          await interaction.reply({ content: "Invalid 'from' date format. Use YYYY-MM-DD.", ephemeral: true });
          return;
        }
        fromDate = new Date(from);
        if (isNaN(fromDate.getTime())) {
          await interaction.reply({ content: "Invalid 'from' date.", ephemeral: true });
          return;
        }
      }
      if (to) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
          await interaction.reply({ content: "Invalid 'to' date format. Use YYYY-MM-DD.", ephemeral: true });
          return;
        }
        toDate = new Date(to);
        if (isNaN(toDate.getTime())) {
          await interaction.reply({ content: "Invalid 'to' date.", ephemeral: true });
          return;
        }
      }
      const feedbacks = await feedbackRepo.searchFeedback({ userId: user?.id, from: fromDate, to: toDate });
      if (!feedbacks.length) {
        await interaction.reply({ content: "No feedback found for the given criteria.", ephemeral: true });
        return;
      }
      const lines = feedbacks
        .slice(0, 10)
        .map(
          (f) =>
            `• [${f.createdAt.toISOString().slice(0, 10)}] <@${f.userId}>: ${f.message} ${'★'.repeat(f.stars)}${'☆'.repeat(5-f.stars)}$${
              f.pingedUserId ? ` (pinged <@${f.pingedUserId}>)` : ""
            }`
        );
      await interaction.reply({
        content: `**Feedback Results:**\n${lines.join("\n")}${
          feedbacks.length > 10 ? "\n...and more" : ""
        }`,
        ephemeral: true,
      });
    } catch (error) {
      logger.error("Failed to search feedback", error);
      await interaction.reply({ content: "Failed to search feedback.", ephemeral: true });
    }
  }
}
