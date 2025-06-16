import { Discord, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  Colors,
  EmbedBuilder,
} from "discord.js";
import { StaffService } from "../../services/staffService.js";
import { Logger } from "../../utils/logger.js";
import type { Staff } from "../../types/types.js";
import { createAALegalEmbed } from "../../utils/embed.js";

const staffService = new StaffService();
const logger = new Logger("StaffCommand");

@Discord()
export class StaffCommand {
  /**
   * /staff [role]
   * View all staff, optionally filtered by role
   */
  @Slash({ name: "staff", description: "View all staff and their roles" })
  async staff(
    @SlashOption({ name: "role", description: "Filter by role", required: false, type: 3 }) role: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      // TODO: Add permissions check for viewing staff list
      // TODO: Add pagination and search for large staff lists
      const staff = await staffService.getAllStaff();
      const filtered = role ? staff.filter((s: Staff) => s.role === role) : staff;
      if (!filtered.length) {
        await interaction.reply({ content: "No staff found.", ephemeral: true });
        return;
      }
      // Fetch all feedbacks for staff (pingedUserId)
      const feedbackRepo = (await import("../../mongo/repository/feedback.js")).FeedbackRepository;
      const feedbackDb = new feedbackRepo();
      const embed = createAALegalEmbed({
        title: "Staff Directory",
        description: filtered.length
          ? await Promise.all(filtered.map(async (s: Staff) => {
              // Get feedbacks where this staff was pinged
              const feedbacks = await feedbackDb.searchFeedback({ userId: undefined });
              const theirFeedback = feedbacks.filter(f => f.pingedUserId === s.userId);
              if (theirFeedback.length) {
                const avg = theirFeedback.reduce((sum, f) => sum + (f.stars || 0), 0) / theirFeedback.length;
                return `**${s.username || s.userId}** — ${s.role || "(no role)"} — ⭐ ${avg.toFixed(2)} (${theirFeedback.length} rating${theirFeedback.length > 1 ? "s" : ""})`;
              } else {
                return `**${s.username || s.userId}** — ${s.role || "(no role)"} — _No ratings yet_`;
              }
            })).then(lines => lines.join("\n"))
          : "No staff found.",
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to fetch staff list", error);
      await interaction.reply({ content: "Failed to fetch staff list.", ephemeral: true });
    }
  }
}
