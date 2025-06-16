import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, Colors, EmbedBuilder } from "discord.js";
import { Logger } from "../../utils/logger.js";
import { createAALegalEmbed } from "../../utils/embed.js";
import { hasActionPermission } from "../../utils/permissions.js";
import { ArchiveService } from "../../services/archive.js";
import { CaseRepository } from "../../mongo/repository/cases.js";

const logger = new Logger("ArchiveCommand");

@Discord()
export class ArchiveCommand {
  /**
   * /archive [type] [id]
   * Archive a case, application, or other record
   */
  @Slash({ name: "archive", description: "Archive a case, application, or other record" })
  async archive(
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
}
