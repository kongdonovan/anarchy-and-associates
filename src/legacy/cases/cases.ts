import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, User } from "discord.js";
import { CaseRepository } from "../../mongo/repository/cases.js";
import { Logger } from "../../utils/logger.js";
import { buildCaseListEmbed } from "../../services/cases.js";

const caseDb = new CaseRepository();
const logger = new Logger("CasesCommand");

@Discord()
export class CasesCommand {
  /**
   * /cases [user] [status] [search] [page]
   * View all cases, filter by staff, status, search, and paginate
   */
  @Slash({ name: "cases", description: "View all cases taken on by Anarchy & Associates" })
  async cases(
    @SlashOption({ name: "user", description: "Staff to filter by", required: false, type: 6 }) user: User | undefined,
    @SlashOption({ name: "status", description: "Case status (open/closed/review_requested)", required: false, type: 3 }) status: string | undefined,
    @SlashOption({ name: "search", description: "Search by client/case details", required: false, type: 3 }) search: string | undefined,
    @SlashOption({ name: "page", description: "Page number", required: false, type: 4 }) page: number | undefined,
    interaction: CommandInteraction
  ) {
    try {
      // TODO: Permissions check for viewing cases
      let filter: any = {};
      if (user) filter.assignedTo = user.id;
      if (status) filter.status = status;
      let cases = await caseDb.findByFilters(filter);
      if (search) {
        cases = cases.filter(c =>
          c.details.toLowerCase().includes(search.toLowerCase()) ||
          (c.clientId && c.clientId.includes(search))
        );
      }
      const pageSize = 5;
      const totalPages = Math.max(1, Math.ceil(cases.length / pageSize));
      const currentPage = Math.max(1, Math.min(page || 1, totalPages));
      const paged = cases.slice((currentPage - 1) * pageSize, currentPage * pageSize);
      const embed = buildCaseListEmbed(paged, currentPage, totalPages);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to fetch cases", error);
      await interaction.reply({ content: "Failed to fetch cases.", ephemeral: true });
    }
  }
}
