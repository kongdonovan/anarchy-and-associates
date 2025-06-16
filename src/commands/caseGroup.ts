import { Discord, Slash, SlashGroup, SlashOption, ButtonComponent, ModalComponent } from "discordx";
import { CommandInteraction, User, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction, Role, ChannelType, GuildMember, TextChannel, PermissionsBitField, EmbedBuilder } from "discord.js";
import { CaseRepository } from "../mongo/repository/cases.js";
import { Logger } from "../utils/logger.js";
import { buildCaseClosedEmbed, buildCaseAssignedEmbed, buildCaseListEmbed, buildCaseReviewEmbed, buildCaseOverviewEmbed, buildCaseDocsEmbed, buildCaseNotesEmbed } from "../services/cases.js";
import { hasActionPermission } from "../utils/permissions.js";
import { getGuildConfig } from "../utils/botConfig.js";
import { AuditLog } from "../utils/auditLogDecorator.js";
import { StaffService } from "../services/staffService.js";
import { GuildConfigRepository } from "../mongo/repository/guildConfig.js";
import { createAALegalEmbed } from "../utils/embed.js";

const caseDb = new CaseRepository();
const logger = new Logger("CaseCommandGroup");
const staffService = new StaffService();
const guildConfigDb = new GuildConfigRepository();

@Discord()
@SlashGroup({ name: "case", description: "Case management commands" })
@SlashGroup("case")
export class CaseCommandGroup {
  // ...existing code for each command will be inserted here...

  /**
   * /case info [caseid] [channel]
   * View case metadata and documents (was /caseinfo)
   */
  @Slash({ name: "info", description: "View case metadata and documents" })
  async info(
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

  /**
   * /case close [caseid] [channel] [result] [notes]
   * Close a case (was /closecase)
   */
  @Slash({ name: "close", description: "Close a case" })
  @AuditLog({
    action: "Close Case",
    getTarget: (result: any) => result?.caseObj?.clientId,
    getBefore: (result: any) => result?.before,
    getAfter: (result: any) => result?.after,
    getDetails: (result: any) => result?.details,
    getCaseId: (result: any) => result?.caseObj?.caseNumber || result?.caseObj?._id,
    getChannelId: (result: any) => result?.caseObj?.channelId
  })
  async close(
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
      const embed = buildCaseClosedEmbed(caseObj.caseNumber || caseObj._id, result, notes);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      // Move channel to Case Archive category if possible (close via button or command)
      const config = await getGuildConfig(interaction.guildId!);
      const archiveCategoryId = config?.caseArchiveCategoryId || config?.caseReviewCategoryId;
      const caseChannel = interaction.channel && interaction.channel.type === ChannelType.GuildText ? (interaction.channel as TextChannel) : null;
      if (archiveCategoryId && caseChannel && 'setParent' in caseChannel) {
        try {
          await (caseChannel as any).setParent(archiveCategoryId, { lockPermissions: false });
        } catch (e) {}
      }
      // Send a professional embed notification in the channel
      if (caseChannel) {
        await caseChannel.send({ embeds: [createAALegalEmbed({
          title: "Case Closed",
          description: `This case has been closed manually.`
        })] });
      }
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

  /**
   * /case assign [user]
   * Assign a case to a lawyer (adds to assignedTo array, does not overwrite)
   */
  @Slash({ name: "assign", description: "Assign a case to a lawyer" })
  @AuditLog({
    action: "Assign Case",
    getTarget: (result, args) => args[0]?.id, // user
    getBefore: (result) => result?.before,
    getAfter: (result) => result?.after,
    getDetails: (result, args) => `Assigned to: <@${args[0]?.id}>`,
    getCaseId: (result, args) => (args && args.length && args[0] && args[0].channelId ? args[0].channelId : ""),
    getChannelId: (result, args) => (args && args.length && args[0] && args[0].channelId ? args[0].channelId : "")
  })
  async assign(
    @SlashOption({ name: "user", description: "User to assign", required: true, type: 6 }) user: User,
    interaction: CommandInteraction
  ) {
    try {
      // Only allow in a case channel
      const caseDocs = await caseDb.findByFilters({ channelId: interaction.channelId });
      if (!caseDocs || caseDocs.length === 0) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Not a Case Channel", description: "You can only use this command inside a case channel." })], ephemeral: true });
        return;
      }
      if (!(await hasActionPermission(interaction, "case"))) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Permission Denied", description: "You do not have permission to assign staff to this case." })], ephemeral: true });
        return;
      }
      const before = { ...caseDocs[0] };
      const assignedTo = Array.isArray(before.assignedTo) ? [...before.assignedTo] : before.assignedTo ? [before.assignedTo] : [];
      if (!assignedTo.includes(user.id)) assignedTo.push(user.id);
      // If no leadAttorney, set to first assigned
      const leadAttorney = before.leadAttorney || assignedTo[0];
      await caseDb.update(before._id, { assignedTo, leadAttorney, status: "open" });
      // Use correct buildCaseAssignedEmbed signature for multiple staff
      const embed = buildCaseAssignedEmbed(before.caseNumber, assignedTo, leadAttorney);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      // Send an embed message to the case channel
      const channel = interaction.channel as TextChannel;
      if (channel) {
        await channel.send({ embeds: [createAALegalEmbed({
          title: "Lawyer Assigned",
          description: `<@${user.id}> has been assigned to this case.`
        })] });
      }
      return {
        before,
        after: { ...before, assignedTo, leadAttorney, status: "open" }
      };
    } catch (error) {
      logger.error("Failed to assign case", error);
      await interaction.reply({ embeds: [createAALegalEmbed({ title: "Error", description: "Failed to assign case." })], ephemeral: true });
    }
  }

  /**
   * /case reassign [user] [newchannel]
   * Move a user from this case to another case channel (removes from here, adds to there)
   */
  @Slash({ name: "reassign", description: "Move a lawyer from this case to another case channel" })
  @AuditLog({
    action: "Reassign Case",
    getTarget: (result, args) => args[0]?.id, // user
    getBefore: (result) => result?.before,
    getAfter: (result) => result?.after,
    getDetails: (result, args) => `Moved <@${args[0]?.id}> to <#${args[1]?.id}>`,
    getCaseId: (result, args) => "",
    getChannelId: (result, args) => ""
  })
  async reassign(
    @SlashOption({ name: "user", description: "User to move", required: true, type: 6 }) user: User,
    @SlashOption({ name: "newchannel", description: "Target case channel", required: true, type: 7 }) newChannel: TextChannel,
    interaction: CommandInteraction
  ) {
    try {
      // Only allow in a case channel
      const currentCaseDocs = await caseDb.findByFilters({ channelId: interaction.channelId });
      if (!currentCaseDocs || currentCaseDocs.length === 0) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Not a Case Channel", description: "You can only use this command inside a case channel." })], ephemeral: true });
        return;
      }
      if (!(await hasActionPermission(interaction, "case"))) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Permission Denied", description: "You do not have permission to reassign staff for this case." })], ephemeral: true });
        return;
      }
      if (interaction.channelId === newChannel.id) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Invalid Channel", description: "You must select a different case channel to move the user to." })], ephemeral: true });
        return;
      }
      // Validate new channel is a case channel
      const targetCaseDocs = await caseDb.findByFilters({ channelId: newChannel.id });
      if (!targetCaseDocs || targetCaseDocs.length === 0) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Invalid Channel", description: "The target channel is not a valid case channel." })], ephemeral: true });
        return;
      }
      const currentCase = { ...currentCaseDocs[0] };
      const targetCase = { ...targetCaseDocs[0] };
      let currentAssigned = Array.isArray(currentCase.assignedTo) ? [...currentCase.assignedTo] : currentCase.assignedTo ? [currentCase.assignedTo] : [];
      let targetAssigned = Array.isArray(targetCase.assignedTo) ? [...targetCase.assignedTo] : targetCase.assignedTo ? [targetCase.assignedTo] : [];
      // Edge: user must be assigned to current, not already assigned to target
      if (!currentAssigned.includes(user.id)) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Not Assigned", description: `That user is not assigned to this case.` })], ephemeral: true });
        return;
      }
      if (targetAssigned.includes(user.id)) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Already Assigned", description: `That user is already assigned to the target case.` })], ephemeral: true });
        return;
      }
      // Remove from current
      currentAssigned = currentAssigned.filter(id => id !== user.id);
      let currentLead = currentCase.leadAttorney;
      if (currentLead === user.id) currentLead = currentAssigned.length > 0 ? currentAssigned[0] : undefined;
      await caseDb.update(currentCase._id, { assignedTo: currentAssigned, leadAttorney: currentLead });
      // Add to target
      targetAssigned.push(user.id);
      let targetLead = targetCase.leadAttorney || user.id;
      await caseDb.update(targetCase._id, { assignedTo: targetAssigned, leadAttorney: targetLead, status: "open" });
      // Notify both channels
      const currentChannel = interaction.channel as TextChannel;
      if (currentChannel) {
        await currentChannel.send({ embeds: [createAALegalEmbed({
          title: "Lawyer Moved",
          description: `<@${user.id}> has been moved from this case to <#${newChannel.id}>.`
        })] });
      }
      await newChannel.send({ embeds: [createAALegalEmbed({
        title: "Lawyer Assigned",
        description: `<@${user.id}> has been assigned to this case from <#${interaction.channelId}>.`
      })] });
      await interaction.reply({ embeds: [createAALegalEmbed({ title: "Reassignment Complete", description: `<@${user.id}> has been moved to <#${newChannel.id}>.` })], ephemeral: true });
      return {
        before: { currentCase, targetCase },
        after: {
          currentCase: { ...currentCase, assignedTo: currentAssigned, leadAttorney: currentLead },
          targetCase: { ...targetCase, assignedTo: targetAssigned, leadAttorney: targetLead }
        }
      };
    } catch (error) {
      logger.error("Failed to reassign case", error);
      await interaction.reply({ embeds: [createAALegalEmbed({ title: "Error", description: "Failed to reassign case." })], ephemeral: true });
    }
  }

  /**
   * /case unassign [user]
   * Remove a lawyer from this case (removes from assignedTo, updates lead if needed)
   */
  @Slash({ name: "unassign", description: "Remove a lawyer from this case" })
  @AuditLog({
    action: "Unassign Case",
    getTarget: (result, args) => args[0]?.id, // user
    getBefore: (result) => result?.before,
    getAfter: (result) => result?.after,
    getDetails: (result, args) => `Unassigned: <@${args[0]?.id}>`,
    getCaseId: (result, args) => "",
    getChannelId: (result, args) => ""
  })
  async unassign(
    @SlashOption({ name: "user", description: "User to remove", required: true, type: 6 }) user: User,
    interaction: CommandInteraction
  ) {
    try {
      // Only allow in a case channel
      const caseDocs = await caseDb.findByFilters({ channelId: interaction.channelId });
      if (!caseDocs || caseDocs.length === 0) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Not a Case Channel", description: "You can only use this command inside a case channel." })], ephemeral: true });
        return;
      }
      if (!(await hasActionPermission(interaction, "case"))) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Permission Denied", description: "You do not have permission to unassign staff from this case." })], ephemeral: true });
        return;
      }
      const before = { ...caseDocs[0] };
      let assignedTo = Array.isArray(before.assignedTo) ? [...before.assignedTo] : before.assignedTo ? [before.assignedTo] : [];
      if (!assignedTo.includes(user.id)) {
        await interaction.reply({ embeds: [createAALegalEmbed({ title: "Not Assigned", description: `That user is not assigned to this case.` })], ephemeral: true });
        return;
      }
      assignedTo = assignedTo.filter(id => id !== user.id);
      let leadAttorney = before.leadAttorney;
      if (leadAttorney === user.id) {
        leadAttorney = assignedTo.length > 0 ? assignedTo[0] : undefined;
      }
      await caseDb.update(before._id, { assignedTo, leadAttorney });
      const embed = buildCaseAssignedEmbed(before.caseNumber, assignedTo, leadAttorney);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      const channel = interaction.channel as TextChannel;
      if (channel) {
        await channel.send({ embeds: [createAALegalEmbed({
          title: "Lawyer Unassigned",
          description: `<@${user.id}> has been removed from this case.`
        })] });
      }
      return {
        before,
        after: { ...before, assignedTo, leadAttorney }
      };
    } catch (error) {
      logger.error("Failed to unassign case", error);
      await interaction.reply({ embeds: [createAALegalEmbed({ title: "Error", description: "Failed to unassign case." })], ephemeral: true });
    }
  }

  /**
   * /case list [user] [status] [search] [page]
   * View all cases (was /cases)
   */
  @Slash({ name: "list", description: "View all cases taken on by Anarchy & Associates" })
  async list(
    @SlashOption({ name: "user", description: "Staff to filter by", required: false, type: 6 }) user: User | undefined,
    @SlashOption({ name: "status", description: "Case status (open/closed/review_requested)", required: false, type: 3 }) status: string | undefined,
    @SlashOption({ name: "search", description: "Search by client/case details", required: false, type: 3 }) search: string | undefined,
    @SlashOption({ name: "page", description: "Page number", required: false, type: 4 }) page: number | undefined,
    interaction: CommandInteraction
  ) {
    try {
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

  /**
   * /case review [details]
   * Request a lawyer to review a case (was /casereview)
   */
  @Slash({ name: "review", description: "Request a lawyer to review a case" })
  @AuditLog({
    action: "Request Case Review",
    getTarget: (result, args) => args[1]?.user?.id, // interaction.user
    getAfter: (result) => result?.newCase,
    getDetails: (result, args) => `Details: ${args[0]}`,
    getCaseId: (result) => result?.newCase?.caseNumber,
    getChannelId: (result) => result?.channelId
  })
  async review(
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
      const caseCounter = await guildConfigDb.getAndIncrementCaseCounter(interaction.guildId!);
      const year = new Date().getFullYear();
      const caseNumber = `${year}-${String(caseCounter).padStart(4, "0")}`;
      const newCase = await caseDb.addCase({
        caseNumber,
        clientId: interaction.user.id,
        details,
        documents: [],
        status: "review_requested",
        openedAt: new Date(),
      });
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
      const embed = buildCaseReviewEmbed(interaction.user.id, details, caseNumber);
      const acceptBtn = new ButtonBuilder().setCustomId(`case_accept_${newCase.insertedId}`).setLabel("Accept").setStyle(3);
      const closeBtn = new ButtonBuilder().setCustomId(`case_close_${newCase.insertedId}`).setLabel("Close").setStyle(4);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, closeBtn);
      await caseChannel.permissionOverwrites.set([
        { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ...((await staffService.getCachedJobs())
          .filter(j => typeof j.roleId === "string")
          .map(j => ({ id: j.roleId as string, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
        )
      ]);
      // L7-perf: Cache the original case message ID for fast lookup in button handlers.
      const caseMsg = await caseChannel.send({ embeds: [embed], components: [row] });
      await caseDb.update(newCase.insertedId, { channelId: caseChannel.id, caseMsgId: caseMsg.id }); // L7-perf: Store caseMsgId
      await interaction.reply({ content: `Case channel created: <#${caseChannel.id}> (Case #${caseNumber})`, ephemeral: true });
      const modlog = interaction.guild.channels.cache.get(MODLOG_CHANNEL_ID) as TextChannel | undefined;
      if (modlog) {
        await modlog.send({ content: `New case review requested by <@${interaction.user.id}>: <#${caseChannel.id}> (Case #${caseNumber})` });
      }
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
      const [, , caseId] = inter.customId.split("_");
      const caseDoc = await caseDb.findById(caseId);
      if (!caseDoc) {
        await inter.reply({ content: "Case not found.", ephemeral: true });
        return;
      }
      if (caseDoc.status === "closed") {
        await inter.reply({ content: "This case is already closed. No further actions can be taken.", ephemeral: true });
        return;
      }
      const config = await getGuildConfig(inter.guildId!);
      const MODLOG_CHANNEL_ID = config?.modlogChannelId;
      if (!MODLOG_CHANNEL_ID) {
        await inter.reply({ content: "Modlog channel is not set in config.", ephemeral: true });
        return;
      }
      const guild = inter.guild;
      if (!guild) return;
      const member = inter.member as GuildMember;
      const jobs = await staffService.getCachedJobs();
      const jobRoleIds = jobs.map(j => j.roleId).filter(Boolean);
      if (!member.roles.cache.some(r => jobRoleIds.includes(r.id))) {
        await inter.reply({ content: "You must have a job role to accept cases.", ephemeral: true });
        return;
      }
      let assignedTo = Array.isArray(caseDoc?.assignedTo) ? [...caseDoc.assignedTo] : caseDoc?.assignedTo ? [caseDoc.assignedTo] : [];
      let leadAttorney = caseDoc?.leadAttorney;
      if (!assignedTo.includes(member.id)) assignedTo.push(member.id);
      if (!leadAttorney) leadAttorney = member.id;
      // L7-perf: Batch DB update and fetch in one call to avoid redundant roundtrips
      const updateResult = await caseDb.updateAndReturn(caseId, { status: "open", assignedTo, leadAttorney, acceptedAt: new Date(), acceptedBy: member.id });
      const updatedCaseDoc = updateResult || await caseDb.findById(caseId); // fallback if updateAndReturn not implemented
      const embed = buildCaseOverviewEmbed(updatedCaseDoc);
      const channel = inter.channel;
      if (channel && channel.type === ChannelType.GuildText) {
        // L7-perf: Use cached caseMsgId for direct fetch
        let targetMsg = null;
        if (caseDoc.caseMsgId) {
          try {
            targetMsg = await channel.messages.fetch(caseDoc.caseMsgId);
          } catch (e) {
            // TODO(L7): If message was deleted, fallback to old method
          }
        }
        if (!targetMsg) {
          // Fallback: legacy support
          const messages = await channel.messages.fetch({ limit: 10 });
          targetMsg = messages.find(m => m.embeds && m.embeds.length > 0 && m.components.length > 0);
        }
        if (targetMsg) {
          // Remove only the accept button, keep others (e.g., close)
          const newRows = targetMsg.components.map(row => {
            const rowData = row.toJSON();
            if ('components' in rowData && Array.isArray(rowData.components)) {
              return {
                type: rowData.type,
                components: rowData.components.filter((btn: any) => !(btn.custom_id && btn.custom_id.startsWith("case_accept_")))
              };
            }
            return rowData;
          });
          await targetMsg.edit({ embeds: [embed], components: newRows });
        }
      }
      await inter.reply({ content: `You have accepted this case.`, ephemeral: true });
      // Only fetch caseDoc once for client notification
      const acceptedCaseDoc = await caseDb.findById(caseId);
      if (acceptedCaseDoc && acceptedCaseDoc.clientId) {
        const clientUser = await inter.client.users.fetch(acceptedCaseDoc.clientId).catch(() => null);
        if (clientUser) {
          await clientUser.send(`Your case review has been accepted by <@${member.id}> and is now open.`).catch(() => {});
        }
      }
      // Send a professional embed notification in the channel
      const caseChannel = inter.channel && inter.channel.type === ChannelType.GuildText ? (inter.channel as TextChannel) : null;
      if (caseChannel) {
        await caseChannel.send({ embeds: [createAALegalEmbed({
          title: "Case Accepted",
          description: `This case has been accepted by <@${member.id}> and is now open.`
        })] });
      }
    } catch (error) {
      logger.error("Failed to accept case", error);
      await inter.reply({ content: "Failed to accept case.", ephemeral: true });
    }
  }

  // Button: Close (manual close from case channel)
  @ButtonComponent({ id: /^case_close_.+$/ })
  async onCaseClose(inter: ButtonInteraction) {
    try {
      const [, , caseId] = inter.customId.split("_");
      const caseObj = await caseDb.findById(caseId);
      if (!caseObj) {
        await inter.reply({ content: "Case not found.", ephemeral: true });
        return;
      }
      if (caseObj.status === "closed") {
        await inter.reply({ content: "This case is already closed. No further actions can be taken.", ephemeral: true });
        return;
      }
      // Close case, update result, store notes
      const updates: any = { status: "closed", closedAt: new Date() };
      await caseDb.update(caseObj._id, updates);
      const embed = buildCaseClosedEmbed(caseObj.caseNumber || caseObj._id, "manual", "Closed by staff");
      await inter.reply({ embeds: [embed], ephemeral: true });
      // Move channel to Case Archive category if possible (close via button or command)
      const config = await getGuildConfig(inter.guildId!);
      const archiveCategoryId = config?.caseArchiveCategoryId || config?.caseReviewCategoryId;
      const caseChannel = inter.channel && inter.channel.type === ChannelType.GuildText ? (inter.channel as TextChannel) : null;
      if (archiveCategoryId && caseChannel && 'setParent' in caseChannel) {
        try {
          await (caseChannel as any).setParent(archiveCategoryId, { lockPermissions: false });
        } catch (e) {}
      }
      // Send a professional embed notification in the channel
      if (caseChannel) {
        await caseChannel.send({ embeds: [createAALegalEmbed({
          title: "Case Closed",
          description: `This case has been closed manually.`
        })] });
      }
    } catch (error) {
      logger.error("Failed to close case", error);
      await inter.reply({ content: "Failed to close case.", ephemeral: true });
    }
  }
}
