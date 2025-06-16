import { Discord, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  Colors,
  EmbedBuilder,
} from "discord.js";
import { StaffService } from "../../services/staffService.js";
import { Logger } from "../../utils/logger.js";
import type { Job } from "../../types/types.js";
import { createAALegalEmbed } from "../../utils/embed.js";
import { hasActionPermission } from "../../utils/permissions.js";

const staffService = new StaffService();
const logger = new Logger("JobsCommand");

@Discord()
export class JobsCommand {
  @Slash({ name: "jobs", description: "List all jobs" })
  async jobs(
    @SlashOption({ name: "open", description: "Show only open jobs?", required: false, type: 5 }) open: boolean | undefined,
    @SlashOption({ name: "search", description: "Search by title", required: false, type: 3 }) search: string | undefined,
    @SlashOption({ name: "page", description: "Page number", required: false, type: 4 }) page: number | undefined,
    interaction: CommandInteraction
  ) {
    try {
      // TODO: Permissions check for viewing jobs
      // Use a plain object for filter to avoid readonly constraint
      const filter: any = {};
      if (typeof open === "boolean") filter.open = open;
      let jobs = await staffService.jobsDb.listJobs(filter);
      if (search) {
        jobs = jobs.filter(j => j.title.toLowerCase().includes(search.toLowerCase()));
      }
      const pageSize = 5;
      const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
      const currentPage = Math.max(1, Math.min(page || 1, totalPages));
      const paged = jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
      // Show job openings left
      let desc = paged.length
        ? await Promise.all(
            paged.map(async (j) => {
              let openings = "";
              if (j.limit && j.roleId && interaction.guild) {
                const role = interaction.guild.roles.cache.get(j.roleId);
                if (role) {
                  const count = role.members.size;
                  openings = ` (${j.limit - count} openings left)`;
                }
              }
              return `**${j.title}**${j.open ? " (Open)" : " (Closed)"}${openings}\n${j.description || "No description."}`;
            })
          ).then(lines => lines.join("\n\n"))
        : "No jobs found.";
      const embed = createAALegalEmbed({
        title: "Job Listings",
        description: desc,
        footer: `Anarchy & Associates — Legal Operations | Page ${currentPage} of ${totalPages}`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to list jobs", error);
      await interaction.reply({ content: "Failed to list jobs.", ephemeral: true });
    }
  }
}
