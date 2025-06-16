import { Discord, Slash, SlashOption, ButtonComponent } from "discordx";
import { CommandInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, EmbedBuilder } from "discord.js";
import { CaseRepository } from "../../mongo/repository/cases.js";
import { Logger } from "../../utils/logger.js";

const caseDb = new CaseRepository();
const logger = new Logger("CaseInfoCommand");

@Discord()
export class CaseInfoCommand {
  @Slash({ name: "caseinfo", description: "View case metadata and documents" })
  async caseinfo(
    @SlashOption({ name: "caseid", description: "Case ID or number", required: false, type: 3 }) caseId: string | undefined,
    @SlashOption({ name: "channel", description: "Case channel (optional)", required: false, type: 7 }) channel: any | undefined,
    interaction: CommandInteraction
  ) {
    try {
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
      // Show overview by default
      const embed = buildCaseOverviewEmbed(caseObj);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`caseinfo_overview_${caseObj._id}`).setLabel("Overview").setStyle(1),
        new ButtonBuilder().setCustomId(`caseinfo_docs_${caseObj._id}`).setLabel("Documents").setStyle(2),
        new ButtonBuilder().setCustomId(`caseinfo_notes_${caseObj._id}`).setLabel("Notes").setStyle(2)
      );
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
    } catch (error) {
      logger.error("Failed to fetch case info", error);
      await interaction.reply({ content: "Failed to fetch case info.", ephemeral: true });
    }
  }

  @ButtonComponent({ id: /^caseinfo_overview_.+$/ })
  async onOverview(inter: ButtonInteraction) {
    const [, , caseId] = inter.customId.split("_");
    const caseObj = await caseDb.findById(caseId);
    if (!caseObj) {
      await inter.reply({ content: "Case not found.", ephemeral: true });
      return;
    }
    const embed = buildCaseOverviewEmbed(caseObj);
    await inter.update({ embeds: [embed] });
  }

  @ButtonComponent({ id: /^caseinfo_docs_.+$/ })
  async onDocs(inter: ButtonInteraction) {
    const [, , caseId] = inter.customId.split("_");
    const caseObj = await caseDb.findById(caseId);
    if (!caseObj) {
      await inter.reply({ content: "Case not found.", ephemeral: true });
      return;
    }
    const embed = buildCaseDocsEmbed(caseObj);
    await inter.update({ embeds: [embed] });
  }

  @ButtonComponent({ id: /^caseinfo_notes_.+$/ })
  async onNotes(inter: ButtonInteraction) {
    const [, , caseId] = inter.customId.split("_");
    const caseObj = await caseDb.findById(caseId);
    if (!caseObj) {
      await inter.reply({ content: "Case not found.", ephemeral: true });
      return;
    }
    const embed = buildCaseNotesEmbed(caseObj);
    await inter.update({ embeds: [embed] });
  }
}

export function buildCaseOverviewEmbed(caseObj: any): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Case Overview: #${caseObj.caseNumber || caseObj._id}`)
    .addFields(
      { name: "Status", value: caseObj.status, inline: true },
      { name: "Client", value: `<@${caseObj.clientId}>`, inline: true },
      { name: "Assigned To", value: caseObj.assignedTo ? `<@${caseObj.assignedTo}>` : "Unassigned", inline: true },
      { name: "Opened", value: caseObj.openedAt ? new Date(caseObj.openedAt).toLocaleString() : "N/A", inline: true },
      { name: "Closed", value: caseObj.closedAt ? new Date(caseObj.closedAt).toLocaleString() : "N/A", inline: true }
    )
    .setDescription(caseObj.details || "No details provided.");
}

export function buildCaseDocsEmbed(caseObj: any): EmbedBuilder {
  const docs = caseObj.documents || [];
  return new EmbedBuilder()
    .setTitle(`Case Documents: #${caseObj.caseNumber || caseObj._id}`)
    .setDescription(docs.length ? docs.map((d: string, i: number) => `**${i + 1}.** [Document](${d})`).join("\n") : "No documents submitted.");
}

export function buildCaseNotesEmbed(caseObj: any): EmbedBuilder {
  const notes = caseObj.notes || [];
  return new EmbedBuilder()
    .setTitle(`Case Notes: #${caseObj.caseNumber || caseObj._id}`)
    .setDescription(notes.length ? notes.map((n: any, i: number) => `**${i + 1}.** ${n.note} _(by <@${n.by}> at ${new Date(n.at).toLocaleString()})_`).join("\n\n") : "No notes for this case.");
}
