import { Discord, Slash, SlashOption, ButtonComponent, ModalComponent } from "discordx";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ChannelType, CommandInteraction, GuildMember, TextChannel, PermissionsBitField, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction } from "discord.js";
import { CaseRepository } from "../../mongo/repository/cases.js";
import { Logger } from "../../utils/logger.js";
import { buildCaseReviewEmbed } from "../../services/cases.js";
import { hasActionPermission } from "../../utils/permissions.js";
import { getGuildConfig } from "../../utils/botConfig.js";
import { User } from "discord.js";
import { StaffService } from "../../services/staffService.js";
import { GuildConfigRepository } from "../../mongo/repository/guildConfig.js";
import { ArchiveService } from "../../services/archive.js";
import { AuditLog } from "../../utils/auditLogDecorator.js";

const caseDb = new CaseRepository();
const logger = new Logger("CaseReviewCommand");
const staffService = new StaffService();
const guildConfigDb = new GuildConfigRepository();

@Discord()
export class CaseReviewCommand {
  /**
   * /casereview [details]
   * Request a lawyer to review a case
   */
  @Slash({ name: "casereview", description: "Request a lawyer to review a case" })
  @AuditLog({
    action: "Request Case Review",
    getTarget: (result, args) => args[1]?.user?.id, // interaction.user
    getAfter: (result) => result?.newCase,
    getDetails: (result, args) => `Details: ${args[0]}`,
    getCaseId: (result) => result?.newCase?.caseNumber,
    getChannelId: (result) => result?.channelId
  })
  async casereview(
    @SlashOption({ name: "details", description: "Case details", required: true, type: 3 }) details: string,
    interaction: CommandInteraction
  ) {
    // Always get the latest config at runtime
    const config = await getGuildConfig(interaction.guildId!);
    const CASE_REVIEW_CATEGORY_ID = config?.caseReviewCategoryId;
    const MODLOG_CHANNEL_ID = config?.modlogChannelId;
    if (!CASE_REVIEW_CATEGORY_ID) {
      await interaction.reply({ content: "Case review category is not set in config.", ephemeral: true });
      return;
    }
    if (!MODLOG_CHANNEL_ID) {
      await interaction.reply({ content: "Modlog channel is not set in config.", ephemeral: true });
      return;
    }
    try {
      // Get and increment the case counter for a sequential case number
      const caseCounter = await guildConfigDb.getAndIncrementCaseCounter(interaction.guildId!);
      const year = new Date().getFullYear();
      const caseNumber = `${year}-${String(caseCounter).padStart(4, "0")}`;
      // Store case as review_requested and notify lawyers
      const newCase = await caseDb.addCase({
        caseNumber,
        clientId: interaction.user.id,
        details,
        documents: [],
        status: "review_requested",
        openedAt: new Date(),
      });
      // Create a new text channel under the hardcoded category
      const guild = interaction.guild;
      if (!guild) throw new Error("This command must be run in a server.");
      const categoryChannel = interaction.guild.channels.cache.get(CASE_REVIEW_CATEGORY_ID);
      if (!categoryChannel || categoryChannel.type !== 4) {
        await interaction.reply({ content: "Case review category is not set or invalid.", ephemeral: true });
        return;
      }
      const channelName = `case-${caseNumber}`;
      const caseChannel = await guild.channels.create({
        name: channelName,
        type: 0,
        parent: categoryChannel.id,
        reason: `Case review requested by ${interaction.user.tag}`,
      });
      // Post case details in the new channel with accept/close buttons and keep reference to the message
      const embed = buildCaseReviewEmbed(interaction.user.id, details, caseNumber);
      const acceptBtn = new ButtonBuilder().setCustomId(`case_accept_${newCase.insertedId}`).setLabel("Accept").setStyle(3); // Success
      const closeBtn = new ButtonBuilder().setCustomId(`case_close_${newCase.insertedId}`).setLabel("Close").setStyle(4); // Danger
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, closeBtn);
      // Restrict: Only client and job roles can view
      await caseChannel.permissionOverwrites.set([
        { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        // Add all job roles
        ...((await staffService.jobsDb.listJobs())
          .filter(j => typeof j.roleId === "string")
          .map(j => ({ id: j.roleId as string, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
        )
      ]);
      const caseMsg = await caseChannel.send({ embeds: [embed], components: [row] });
      // Store channelId in the case
      await caseDb.update(newCase.insertedId, { channelId: caseChannel.id });
      await interaction.reply({ content: `Case channel created: <#${caseChannel.id}> (Case #${caseNumber})`, ephemeral: true });
      // Log to modlog
      const modlog = interaction.guild.channels.cache.get(MODLOG_CHANNEL_ID) as TextChannel | undefined;
      if (modlog) {
        await modlog.send({ content: `New case review requested by <@${interaction.user.id}>: <#${caseChannel.id}> (Case #${caseNumber})` });
      }
      // Return info for audit log
      return {
        newCase,
        channelId: categoryChannel.id
      };
    } catch (error) {
      logger.error("Failed to request case review", error);
      await interaction.reply({ content: "Failed to request case review.", ephemeral: true });
    }
  }

  // Button: Accept
  @ButtonComponent({ id: /^case_accept_.+$/ })
  async onCaseAccept(inter: ButtonInteraction) {
    try {
      const config = await getGuildConfig(inter.guildId!);
      const MODLOG_CHANNEL_ID = config?.modlogChannelId;
      if (!MODLOG_CHANNEL_ID) {
        await inter.reply({ content: "Modlog channel is not set in config.", ephemeral: true });
        return;
      }
      const [, , caseId] = inter.customId.split("_");
      const guild = inter.guild;
      if (!guild) return;
      const member = inter.member as GuildMember;
      // Restrict: Only users with a job role can accept
      const jobs = await staffService.jobsDb.listJobs();
      const jobRoleIds = jobs.map(j => j.roleId).filter(Boolean);
      if (!member.roles.cache.some(r => jobRoleIds.includes(r.id))) {
        await inter.reply({ content: "You must have a job role to accept cases.", ephemeral: true });
        return;
      }
      // Assign the staff member and update the case in MongoDB
      await caseDb.update(caseId, { status: "open", assignedTo: member.id, acceptedAt: new Date(), acceptedBy: member.id });
      // Remove buttons and update the first message in the channel, then add a Close Case button for the assigned lawyer
      const channel = inter.channel;
      if (channel && channel.type === ChannelType.GuildText) {
        // Fetch the first message (case details)
        const messages = await channel.messages.fetch({ limit: 1, after: "0" });
        const firstMsg = messages.first();
        if (firstMsg) {
          const updatedEmbed = EmbedBuilder.from(firstMsg.embeds[0] ?? new EmbedBuilder())
            .setTitle("Case Accepted")
            .setColor(0x2ecc71)
            .setFooter({ text: `Case ID: ${caseId}` });
          // Add a Close Case button for the assigned lawyer
          const closeBtn = new ButtonBuilder()
            .setCustomId(`case_lawyerclose_${caseId}_${member.id}`)
            .setLabel("Close Case")
            .setStyle(4); // Danger
          const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(closeBtn);
          await firstMsg.edit({ embeds: [updatedEmbed], components: [closeRow] });
        }
      }
      await inter.reply({ content: `You have accepted this case.`, ephemeral: true });
      // Notify client
      const caseDoc = await caseDb.findById(caseId);
      if (caseDoc && caseDoc.clientId) {
        const clientUser = await inter.client.users.fetch(caseDoc.clientId).catch(() => null);
        if (clientUser) {
          await clientUser.send(`Your case review has been accepted by <@${member.id}> and is now open.`).catch(() => {});
        }
      }
      // Log to modlog
      const modlog = guild.channels.cache.get(MODLOG_CHANNEL_ID) as TextChannel | undefined;
      if (modlog) {
        await modlog.send({ content: `Case <#${inter.channel?.id}> accepted by <@${member.id}>.` });
      }
    } catch (error) {
      logger.error("Failed to accept case review", error);
      await inter.reply({ content: "Failed to accept case review.", ephemeral: true });
    }
  }

  // Button: Close
  @ButtonComponent({ id: /^case_close_.+$/ })
  async onCaseClose(inter: ButtonInteraction) {
    // Show modal to collect result and notes
    const [, , caseId] = inter.customId.split("_");
    const modal = new ModalBuilder()
      .setCustomId(`caseclosemodal_${caseId}`)
      .setTitle("Close Case Review")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("result")
            .setLabel("Result (optional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("notes")
            .setLabel("Notes (optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        )
      );
    await inter.showModal(modal);
  }

  @ModalComponent({ id: /^caseclosemodal_.+$/ })
  async onCaseCloseModal(inter: ModalSubmitInteraction) {
    const caseId = inter.customId.split("_")[1];
    const result = inter.fields.getTextInputValue("result");
    const notes = inter.fields.getTextInputValue("notes");
    const config = await getGuildConfig(inter.guildId!);
    const CASE_ARCHIVE_CATEGORY_ID = config?.caseArchiveCategoryId || "YOUR_ARCHIVE_CATEGORY_ID_HERE";
    const MODLOG_CHANNEL_ID = config?.modlogChannelId;
    const guild = inter.guild;
    if (!guild) return;
    const member = inter.member as GuildMember;
    // Restrict: Only users with a job role can close
    const jobs = await staffService.jobsDb.listJobs();
    const jobRoleIds = jobs.map(j => j.roleId).filter(Boolean);
    if (!member.roles.cache.some(r => jobRoleIds.includes(r.id))) {
      await inter.reply({ content: "You must have a job role to close cases.", ephemeral: true });
      return;
    }
    const channel = inter.channel;
    // Move the channel to the archive category
    if (channel && channel.type === ChannelType.GuildText) {
      await channel.setParent(CASE_ARCHIVE_CATEGORY_ID, { lockPermissions: false });
    }
    // Update the case status in MongoDB and track closure
    await caseDb.update(caseId, { status: "closed", closedAt: new Date(), result, feedback: notes });
    // Archive the case
    const caseDoc = await caseDb.findById(caseId);
    if (caseDoc) {
      await ArchiveService.archiveCase(caseDoc);
    }
    // Notify client
    if (caseDoc && caseDoc.clientId) {
      const clientUser = await inter.client.users.fetch(caseDoc.clientId).catch(() => null);
      if (clientUser) {
        await clientUser.send(`Your case review was closed by <@${member.id}> and has been archived.`).catch(() => {});
      }
    }
    // Log to modlog
    const modlog = guild.channels.cache.get(MODLOG_CHANNEL_ID!);
    if (modlog && "send" in modlog) {
      await (modlog as any).send({ content: `Case <#${inter.channel?.id}> closed by <@${member.id}> and archived.` });
    }
    await inter.reply({ content: `Case review closed. Channel archived.`, ephemeral: true });
  }

  @Slash({ name: "addcasedoc", description: "Add a document (URL) to a case" })
  async addCaseDoc(
    @SlashOption({ name: "case_id", description: "Case ID", required: true, type: 3 }) caseId: string,
    @SlashOption({ name: "url", description: "Document URL", required: true, type: 3 }) url: string,
    interaction: CommandInteraction
  ) {
    try {
      await caseDb.updateWithOperator(caseId, { $push: { documents: url } });
      await interaction.reply({ content: `Document added to case ${caseId}.`, ephemeral: true });
    } catch (error) {
      logger.error("Failed to add document", error);
      await interaction.reply({ content: "Failed to add document.", ephemeral: true });
    }
  }

  @Slash({ name: "addcasenote", description: "Add a note to a case" })
  async addCaseNote(
    @SlashOption({ name: "case_id", description: "Case ID", required: true, type: 3 }) caseId: string,
    @SlashOption({ name: "note", description: "Note text", required: true, type: 3 }) note: string,
    interaction: CommandInteraction
  ) {
    try {
      await caseDb.updateWithOperator(caseId, { $push: { notes: { by: interaction.user.id, at: new Date(), note } } });
      await interaction.reply({ content: `Note added to case ${caseId}.`, ephemeral: true });
    } catch (error) {
      logger.error("Failed to add note", error);
      await interaction.reply({ content: "Failed to add note.", ephemeral: true });
    }
  }

  @Slash({ name: "reassigncase", description: "Reassign a case to another staff member" })
  async reassignCase(
    @SlashOption({ name: "staff", description: "Staff to assign", required: true, type: 6 }) staff: User,
    interaction: CommandInteraction
  ) {
    try {
      // Find the case by channel ID if possible
      let caseDocs = await caseDb.findByFilters({ channelId: interaction.channelId });
      if (!caseDocs || caseDocs.length === 0) {
        await interaction.reply({ content: "No case found for this channel.", ephemeral: true });
        return;
      }
      const caseDoc = caseDocs[0];
      // Only allow assignment to users with a job role
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: "This command must be run in a server.", ephemeral: true });
        return;
      }
      const member = await guild.members.fetch(staff.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "Could not find that user in the server.", ephemeral: true });
        return;
      }
      const jobs = await staffService.jobsDb.listJobs();
      const jobRoleIds = jobs.map(j => j.roleId).filter(Boolean);
      if (!member.roles.cache.some(r => jobRoleIds.includes(r.id))) {
        await interaction.reply({ content: "You can only assign a case to someone with a job role.", ephemeral: true });
        return;
      }
      await caseDb.update(caseDoc._id, { assignedTo: staff.id });
      await interaction.reply({ content: `Case reassigned to <@${staff.id}>.`, ephemeral: true });
    } catch (error) {
      logger.error("Failed to reassign case", error);
      await interaction.reply({ content: "Failed to reassign case.", ephemeral: true });
    }
  }

  @Slash({ name: "searchcases", description: "Search cases by number, client, staff, or status" })
  async searchCases(
    @SlashOption({ name: "case_number", description: "Case Number (e.g. 2025-0001)", required: false, type: 3 }) caseNumber: string | undefined,
    @SlashOption({ name: "client", description: "Client (mention or user ID)", required: false, type: 6 }) client: User | undefined,
    @SlashOption({ name: "staff", description: "Assigned staff (mention or user ID)", required: false, type: 6 }) staff: User | undefined,
    @SlashOption({ name: "status", description: "Case status (open, closed, review_requested)", required: false, type: 3 }) status: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      const filters: any = {};
      if (caseNumber) filters.caseNumber = caseNumber;
      if (client) filters.clientId = client.id;
      if (staff) filters.assignedTo = staff.id;
      if (status) filters.status = status;
      const cases = await caseDb.findByFilters(filters);
      if (!cases.length) {
        await interaction.reply({ content: "No cases found.", ephemeral: true });
        return;
      }
      const MAX = 1900;
      const json = JSON.stringify(cases, null, 2);
      for (let i = 0; i < json.length; i += MAX) {
        await interaction.reply({ content: `${json.slice(i, i + MAX)}`.replace(/\u0007/g, ''), ephemeral: true });
      }
    } catch (error) {
      logger.error("Failed to search cases", error);
      await interaction.reply({ content: "Failed to search cases.", ephemeral: true });
    }
  }
} // End of class
