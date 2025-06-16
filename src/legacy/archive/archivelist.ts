import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import { ArchiveService } from "../../services/archive.js";

@Discord()
export class ArchiveListCommand {
  @Slash({ name: "archivelist", description: "View all archived cases" })
  async archivelist(
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
