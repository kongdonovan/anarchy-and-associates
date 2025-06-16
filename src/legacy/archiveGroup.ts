import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import { Logger } from "../utils/logger.js";
import { createAALegalEmbed } from "../utils/embed.js";
import { hasActionPermission } from "../utils/permissions.js";
import { ArchiveService } from "../services/archive.js";
import { CaseRepository } from "../mongo/repository/cases.js";

const logger = new Logger("ArchiveCommandGroup");

@Discord()
@SlashGroup({ name: "archive", description: "Archive and archival listing commands" })
@SlashGroup("archive")
export class ArchiveCommandGroup {
  /**
   * /archive record [type] [id]
   * Archive a case, application, or other record (was /archive)
   */
  @Slash({ name: "record", description: "Archive a case, application, or other record" })
  async record(
    @SlashOption({ name: "type", description: "Type to archive (case, application, etc.)", required: true, type: 3 }) type: string,
    @SlashOption({ name: "id", description: "ID of the record to archive", required: true, type: 3 }) id: string,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "archive"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **archive** action. If you believe this is an error, please contact an administrator.`,
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      if (type === "case") {
        const caseDb = new CaseRepository();
        const caseObj = await caseDb.findById(id);
        if (caseObj) {
          await ArchiveService.archiveCase(caseObj);
        }
      }
      const embed = createAALegalEmbed({
        title: "Record Archived",
        description: `The ${type} with ID **${id}** has been archived. If you need to restore or review this record, please contact a system administrator at Anarchy & Associates.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to archive record", error);
      await interaction.reply({ content: "Failed to archive record.", ephemeral: true });
    }
  }

  /**
   * /archive list [page]
   * View all archived cases (was /archivelist)
   */
  @Slash({ name: "list", description: "View all archived cases" })
  async list(
    @SlashOption({ name: "page", description: "Page number", required: false, type: 4 }) page: number | undefined,
    interaction: CommandInteraction
  ) {
    const pageSize = 5;
    const currentPage = Math.max(1, page || 1);
    const skip = (currentPage - 1) * pageSize;
    const archivedCases = await ArchiveService.getArchivedCases({}, { limit: pageSize, skip });
    if (!archivedCases.length) {
      await interaction.reply({ content: "No archived cases found.", ephemeral: true });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle("Archived Cases")
      .setDescription(
        archivedCases.map(c => `**#${c.caseNumber || c._id}** — ${c.status.toUpperCase()}\n👤 Client: <@${c.clientId}>${c.assignedTo ? `\n👨‍⚖️ Assigned: <@${c.assignedTo}>` : ""}\n${c.details}`)
          .join("\n\n")
      )
      .setFooter({ text: `Page ${currentPage}` });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
