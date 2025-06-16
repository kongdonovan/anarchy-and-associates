import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, User } from "discord.js";
import { Logger } from "../utils/logger.js";
import { ApplicationRepository } from "../mongo/repository/applications.js";
import { CaseRepository } from "../mongo/repository/cases.js";
import { buildStatsEmbed } from "../services/metrics.js";
import { StaffService } from "../services/staffService.js";

const logger = new Logger("StatsCommand");
const appDb = new ApplicationRepository();
const caseDb = new CaseRepository();
const staffService = new StaffService();

@Discord()
export class StatsCommand {
  /**
   * /stats [user]
   * View win/loss stats for a lawyer
   */
  @Slash({ name: "stats", description: "View win/loss stats for a lawyer" })
  async stats(
    @SlashOption({ name: "user", description: "Lawyer to view stats for", required: false, type: 6 }) user: User | undefined,
    interaction: CommandInteraction
  ) {
    try {
      if (user) {
        // TODO: Fetch and display individual lawyer stats
        await interaction.reply({ content: "User-specific stats coming soon.", ephemeral: true });
      } else {
        const [appCount, jobCount, openCases, closedCases] = await Promise.all([
          appDb.findByFilters({}),
          staffService.jobsDb.listJobs(),
          caseDb.getOpenCases(),
          caseDb.getClosedCases(),
        ]);
        const embed = buildStatsEmbed(appCount.length, jobCount.length, openCases.length, closedCases.length);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (error) {
      logger.error("Failed to fetch stats", error);
      await interaction.reply({ content: "Failed to fetch stats.", ephemeral: true });
    }
  }
}
