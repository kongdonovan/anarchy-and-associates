import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, User } from "discord.js";
import { CaseRepository } from "../../mongo/repository/cases.js";
import { Logger } from "../../utils/logger.js";
import { buildCaseAssignedEmbed } from "../../services/cases.js";
import { hasActionPermission } from "../../utils/permissions.js";
import { AuditLog } from "../../utils/auditLogDecorator.js";

const caseDb = new CaseRepository();
const logger = new Logger("AssignCaseCommand");

@Discord()
export class AssignCaseCommand {
  /**
   * /assigncase [caseid] [lawyer]
   * Assign a case to a lawyer
   */
  @Slash({ name: "assigncase", description: "Assign a case to a lawyer" })
  @AuditLog({
    action: "Assign Case",
    getTarget: (result, args) => args[1]?.id, // user
    getBefore: (result) => result?.before,
    getAfter: (result) => result?.after,
    getDetails: (result, args) => `Assigned to: <@${args[1]?.id}>`,
    getCaseId: (result, args) => args[0], // caseId
    getChannelId: (result, args) => args[2]?.channelId // interaction
  })
  async assigncase(
    @SlashOption({ name: "caseid", description: "Case ID to assign", required: true, type: 3 }) caseId: string,
    @SlashOption({ name: "user", description: "User to assign", required: true, type: 6 }) user: User,
    interaction: CommandInteraction
  ) {
    try {
      // Only allow in a case channel
      const caseDocs = await caseDb.findByFilters({ channelId: interaction.channelId });
      if (!caseDocs || caseDocs.length === 0) {
        await interaction.reply({ content: "You can only use this command inside a case channel.", ephemeral: true });
        return;
      }

      if (!(await hasActionPermission(interaction, "case"))) {
        const embed = buildCaseAssignedEmbed(caseId, user.id);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Save before state for audit
      const before = { ...caseDocs[0] };
      // Assign case and notify lawyer
      const updated = await caseDb.update(caseId, { assignedTo: user.id, status: "open" });
      const embed = buildCaseAssignedEmbed(caseId, user.id);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      // Return info for audit log
      return {
        before,
        after: { ...before, assignedTo: user.id, status: "open" }
      };
    } catch (error) {
      logger.error("Failed to assign case", error);
      await interaction.reply({ content: "Failed to assign case.", ephemeral: true });
    }
  }
}
