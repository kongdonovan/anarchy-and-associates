import { Discord, Slash } from "discordx";
import { CommandInteraction } from "discord.js";
import { buildMetricsEmbed } from "../services/metrics.js";
import { ApplicationRepository } from "../mongo/repository/applications.js";
import { StaffService } from "../services/staffService.js";
import { CaseRepository } from "../mongo/repository/cases.js";
import { FeedbackRepository } from "../mongo/repository/feedback.js";
import { RetainerRepository } from "../mongo/repository/retainers.js";

const staffService = new StaffService();

@Discord()
export class BotMetricsCommand {
  @Slash({ name: "metrics", description: "Show bot/server stats and health." })
  async metrics(interaction: CommandInteraction) {
    // Count documents in each collection
    const [applications, staff, jobs, cases, feedback, retainers] = await Promise.all([
      new ApplicationRepository().findByFilters({}),
      staffService.getAllStaff(),
      staffService.jobsDb.listJobs(),
      new CaseRepository().findByFilters({}),
      new FeedbackRepository().findByFilters({}),
      new RetainerRepository().findByFilters({}),
    ]);
    const metrics = {
      Applications: applications.length,
      Staff: staff.length,
      Jobs: jobs.length,
      Cases: cases.length,
      Feedback: feedback.length,
      Retainers: retainers.length,
    };
    const embed = buildMetricsEmbed(metrics, process.uptime());
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
