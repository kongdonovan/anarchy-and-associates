import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction } from "discord.js";
import { CaseRepository } from "../../mongo/repository/cases.js";
import { Logger } from "../../utils/logger.js";
import { buildCaseClosedEmbed } from "../../services/cases.js";
import { hasActionPermission } from "../../utils/permissions.js";
import { getGuildConfig } from "../../utils/botConfig.js";
import { ArchiveService } from "../../services/archive.js";
import { AuditLog } from "../../utils/auditLogDecorator.js";

const caseDb = new CaseRepository();
const logger = new Logger("CloseCaseCommand");

@Discord()
export class CloseCaseCommand {
  /**
   * /closecase [caseid] [result] [notes]
   * Close a case, optionally with win/loss and notes
   */
  @Slash({ name: "closecase", description: "Close a case" })
  @AuditLog({
    action: "Close Case",
    getTarget: (result: any) => result?.caseObj?.clientId,
    getBefore: (result: any) => result?.before,
    getAfter: (result: any) => result?.after,
    getDetails: (result: any) => result?.details,
    getCaseId: (result: any) => result?.caseObj?.caseNumber || result?.caseObj?._id,
    getChannelId: (result: any) => result?.caseObj?.channelId
  })
  async closecase(
    @SlashOption({ name: "caseid", description: "Case ID to close", required: false, type: 3 }) caseId: string | undefined,
    @SlashOption({ name: "channel", description: "Case channel (optional)", required: false, type: 7 }) channel: any | undefined,
    @SlashOption({ name: "result", description: "Result (win/loss)", required: false, type: 3 }) result: string | undefined,
    @SlashOption({ name: "notes", description: "Notes", required: false, type: 3 }) notes: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "case"))) {
        await interaction.reply({ content: "You do not have permission to close cases.", ephemeral: true });
        return;
      }
      let caseObj = null;
      if (channel) {
        caseObj = (await caseDb.findByFilters({ channelId: channel.id }))[0];
      }
      if (!caseObj && caseId) {
        if (/^\d{4}-\d{4}$/.test(caseId)) {
          const found = await caseDb.findByFilters({ caseNumber: caseId });
          if (found && found.length) caseObj = found[0];
        }
        if (!caseObj) {
          caseObj = await caseDb.findById(caseId);
        }
      }
      if (!caseObj) {
        await interaction.reply({ content: `No case found with that channel or ID/number.`, ephemeral: true });
        return;
      }
      // Save before state for audit
      const before = { ...caseObj };
      // Close case, update result, store notes
      const updates: any = { status: "closed", closedAt: new Date() };
      if (result) updates.result = result;
      if (notes) updates.feedback = notes;
      await caseDb.update(caseObj._id, updates);
      // Move channel to archive category if possible
      const config = await getGuildConfig(interaction.guildId!);
      const archiveCategoryId = config?.caseArchiveCategoryId;
      if (archiveCategoryId && interaction.channel && 'setParent' in interaction.channel) {
        try {
          await (interaction.channel as any).setParent(archiveCategoryId, { lockPermissions: false });
        } catch (e) {
          // Optionally log error
        }
      }
      // Archive the case in the archive collection automatically
      const caseData = await caseDb.findById(caseObj._id);
      if (caseData) {
        await ArchiveService.archiveCase(caseData);
      }
      const embed = buildCaseClosedEmbed(caseObj.caseNumber || caseObj._id, result, notes);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      // Return info for audit log
      return {
        caseObj,
        before,
        after: { ...caseObj, ...updates },
        details: `Result: ${result || "N/A"}, Notes: ${notes || "N/A"}`
      };
    } catch (error) {
      logger.error("Failed to close case", error);
      await interaction.reply({ content: "Failed to close case.", ephemeral: true });
    }
  }
}

// Patch DiscordX to inject modlogChannel automatically (example, not production)
// In your command registration, fetch modlogChannel from config and pass as last arg
