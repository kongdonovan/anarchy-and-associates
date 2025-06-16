import { Discord, Slash, SlashOption, ModalComponent, ButtonComponent, SelectMenuComponent } from "discordx";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildTextBasedChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  CommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
  MessageFlags,
  Colors,
  StringSelectMenuBuilder, // <-- Import directly
} from "discord.js";
import noblox from "noblox.js";
import { ApplicationRepository } from "../mongo/repository/applications.js";
import { StaffService } from "../services/staffService.js";
import { getGuildConfig } from "../utils/botConfig.js";
import { Logger } from "../utils/logger.js";
import { createAALegalEmbed } from "../utils/embed.js";
import { hasActionPermission } from "../utils/permissions.js";
import { getRobloxProfile } from "../services/roblox.js";
import { buildApplicationModal, buildApplicationEmbed, finishApplicationAction } from "../services/application.js";
import { buildOnboardingEmbed } from "../services/onboarding.js";

const db = new ApplicationRepository();
const staffService = new StaffService();
const logger = new Logger("ApplyCommand");

@Discord()
export class ApplyCommand {
  // ==========================================================================
  // Slash command: /apply
  // ==========================================================================
  @Slash({ name: "apply", description: "Submit an application" })
  async apply(interaction: CommandInteraction) {
    try {
      // Prevent users with a staff entry from applying again
      const existingStaff = await staffService.getStaffByUserId(interaction.user.id);
      if (existingStaff && existingStaff.length > 0) {
        await interaction.reply({ content: "You already have a job and cannot apply again.", ephemeral: true });
        return;
      }
      // Fetch open jobs
      const jobs = await staffService.jobsDb.getOpenJobs();
      if (!jobs.length) {
        await interaction.reply({ content: "No jobs are currently open for applications.", ephemeral: true });
        return;
      }
      // Always present a select menu for job selection
      const options = jobs.map((job: any) => ({
        label: job.title,
        value: job._id?.toString() || job.title,
      }));
      await interaction.reply({
        content: "Please select a job to apply for:",
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("apply_job_select")
              .setPlaceholder("Select a job...")
              .addOptions(options)
          )
        ],
        ephemeral: true,
      });
    } catch (error) {
      logger.error("Failed to start application process", error);
      await interaction.reply({ content: "An error occurred while starting your application.", ephemeral: true });
    }
  }

  // Helper to show the application modal for a job
  private async showApplicationModal(interaction: CommandInteraction, job: any) {
    // Use modular modal builder with jobId in customId
    const modal = buildApplicationModal(job);
    await interaction.showModal(modal);
  }

  // ==========================================================================
  // Modal: application submission
  // ==========================================================================
  @ModalComponent({ id: /^applyModal(_.+)?$/ })
  async onApplicationSubmit(int: ModalSubmitInteraction) {
    try {
      const applicantId = int.user.id;
      // Extract jobId from modal customId (applyModal_JOBID)
      const jobIdMatch = int.customId.match(/^applyModal_(.+)$/);
      const jobId = jobIdMatch ? jobIdMatch[1] : undefined;
      // Collect all answers, including custom questions
      const responses: Record<string, string> = {};
      for (const field of int.fields.fields.values()) {
        responses[field.customId] = field.value;
      }
      // Legacy fields for compatibility
      const username = responses.username || "";
      const reason = responses.reason || "";
      const experience = responses.experience || "";
      // Roblox lookup (if username provided)
      let avatarUrl: string | null = null;
      const robloxFields: { name: string; value: string; inline?: boolean }[] = [];
      if (username) {
        const robloxProfile = await getRobloxProfile(username);
        if (robloxProfile) {
          avatarUrl = robloxProfile.avatarUrl;
          robloxFields.push(
            { name: "Display Name", value: robloxProfile.displayName, inline: true },
            { name: "Account Age", value: `${robloxProfile.age} days`, inline: true },
            { name: "Roblox ID", value: robloxProfile.robloxId.toString(), inline: true },
            { name: "Profile", value: `[View](${robloxProfile.profileUrl})` }
          );
        } else {
          robloxFields.push({ name: "Roblox Lookup", value: "❌ Username not found or API error." });
        }
      }
      // Store application in DB, including all answers and jobId
      const result = await db.submitApplication({
        discordId: applicantId,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        responses,
        username,
        reason,
        experience,
        jobId, // <-- ensure jobId is stored
      });
      // Build review embed (refined)
      const applicantInfo = { tag: int.user.tag, id: int.user.id };
      let jobTitle: string | undefined = undefined;
      let questionLabels: Record<string, string> | undefined = undefined;
      if (jobId) {
        const job = await staffService.jobsDb.getJobById(jobId);
        jobTitle = job?.title;
        // Build questionLabels map from default and custom questions
        const defaultQs = [
          { id: "username", label: "What is your Roblox username?" },
          { id: "reason", label: "Why do you want to work for us?" },
          { id: "experience", label: "What relevant experience do you have?" },
        ];
        const customQs = (job?.questions || []).map((q: any, i: number) => ({
          id: q.id || `custom_${i}`,
          label: q.label || `Question ${i + 1}`
        }));
        questionLabels = Object.fromEntries([...defaultQs, ...customQs].map(q => [q.id, q.label]));
      }
      const reviewEmbed = buildApplicationEmbed(
        responses,
        robloxFields,
        avatarUrl ?? int.user.displayAvatarURL(),
        int.user.displayAvatarURL(),
        applicantInfo,
        jobTitle,
        result.insertedId?.toString(),
        questionLabels
      );
      // Buttons
      const acceptBtn = new ButtonBuilder().setCustomId(`app_accept_${applicantId}`).setLabel("Accept").setStyle(ButtonStyle.Success);
      const declineBtn = new ButtonBuilder().setCustomId(`app_deny_${applicantId}`).setLabel("Decline").setStyle(ButtonStyle.Danger);
      const componentsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, declineBtn);
      // Send to review channel
      const config = await getGuildConfig(int.guildId!);
      const applicationChannelId = config?.applicationChannelId;
      let channel: GuildTextBasedChannel | null = null;
      if (applicationChannelId) {
        channel = (await int.client.channels.fetch(applicationChannelId).catch(() => null)) as GuildTextBasedChannel | null;
      }
      if (channel) await channel.send({ embeds: [reviewEmbed], components: [componentsRow] });
      // Ephemeral reply
      const replyEmbed = createAALegalEmbed({
        title: "Application Submitted",
        description: "A team member at Anarchy & Associates will review it shortly. Please save the Application ID below for reference.",
        footer: `Application ID: ${result.insertedId}`,
      });
      await int.reply({ embeds: [replyEmbed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      logger.error("Failed to submit application", error);
      await int.reply({ content: "An error occurred while submitting your application. Please try again later.", ephemeral: true });
    }
  }

  // ==========================================================================
  // Button: Accept
  // ==========================================================================
  @ButtonComponent({ id: /^app_accept_\d+$/ })
  async onAccept(inter: ButtonInteraction) {
    try {
      let member = inter.member as import("discord.js").GuildMember | null;
      if (!member && inter.guild && inter.user) {
        member = await inter.guild.members.fetch(inter.user.id).catch(() => null);
      }
      
      if (!member) {
        await inter.reply({ content: "You must be in the server to accept applications.", ephemeral: true });
        return;
      }
      // Only allow users with 'hr' permission to accept
      const fakeInteraction = { ...inter, member } as any;
      if (!(await hasActionPermission(fakeInteraction, "hr"))) {
        await inter.reply({ content: "You do not have permission to accept applications.", ephemeral: true });
        return;
      }
      // add user to staff
      const userId = inter.user.id;
      const [, , applicantId] = inter.customId.split("_");
      await this.finish(inter, true, applicantId, inter.message.id);

      const applicant = await inter.guild?.members.fetch(applicantId).catch(() => null);
      if (!applicant) {
        await inter.followUp({ content: `<@${applicantId}> is no longer in the server.`, ephemeral: true });
        return;
      }
      // Find the accepted application for this applicant
      const applications = await db.findByFilters({ discordId: applicantId });
      const application = applications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      // Prefer roblox_username from responses, then username, then Discord username
      let robloxUsername = application?.responses?.["roblox_username"]?.trim();
      if (!robloxUsername && typeof application?.username === "string") robloxUsername = application.username.trim();
      if (!robloxUsername) robloxUsername = applicant.user.username;
      if (!robloxUsername) {
        await inter.followUp({ content: `No Roblox username found for <@${applicantId}>.`, ephemeral: true });
        return;
      }
      // Fetch the job the applicant applied for and assign the correct role
      const jobId = application?.jobId;
      let jobRoleId: string | undefined;
      let jobTitle: string | undefined;
      if (jobId) {
        const job = await staffService.jobsDb.getJobById(jobId);
        jobRoleId = job?.roleId;
        jobTitle = job?.title;
      }
      if (!jobRoleId) {
        await inter.followUp({ content: `Could not determine the job role for <@${applicantId}>. Please check the job configuration.`, ephemeral: true });
        return;
      }
      const jobRole = inter.guild?.roles.cache.get(jobRoleId);
      if (!jobRole) {
        await inter.followUp({ content: `Job role not found in the server for <@${applicantId}>.`, ephemeral: true });
        return;
      }
      // Prevent duplicate staff (check DB only)
      const existing = await staffService.getStaffByUserId(applicant.id);
      if (existing && existing.length > 0) {
        // Update existing staff entry with latest info
        await staffService.staffDb.updateStaff(applicant.id, {
          username: robloxUsername,
          role: jobRole.name,
          updatedAt: new Date(),
        });
      } else {
        // Add to staff DB using StaffService
        await staffService.addStaffMember({
          userId: applicant.id,
          username: robloxUsername, // This is the Roblox username
          role: jobRole.name,
        });
      }
      // Remove all staff roles except the new one before assigning
      const allJobs = await staffService.jobsDb.listJobs();
      const allJobRoleIds = allJobs.map(j => j.roleId).filter(Boolean);
      const rolesToRemove = applicant.roles.cache.filter(r => allJobRoleIds.includes(r.id) && r.id !== jobRole.id);
      if (rolesToRemove.size > 0) {
        await applicant.roles.remove(rolesToRemove).catch(() => {});
      }
      // Only add the new job role if the applicant doesn't already have it
      if (!applicant.roles.cache.has(jobRole.id)) {
        await applicant.roles.add(jobRole).catch(() => {});
      }
      // Do NOT update the staff DB in the event handler except for the role field
      // Onboarding message removed as per new requirements
      // const embed = buildOnboardingEmbed(applicantId);
      // await applicant.send({ embeds: [embed] }).catch(() => {
      //   inter.followUp({ content: `Could not DM onboarding checklist to <@${applicantId}>.`, ephemeral: true });
      // });
    } catch (error) {
      logger.error("Failed to accept application", error);
      await inter.reply({ content: "Failed to accept application.", ephemeral: true });
    }
  }

  // ==========================================================================
  // Button: Decline (opens reason modal)
  // ==========================================================================
  @ButtonComponent({ id: /^app_deny_\d+$/ })
  async onDecline(inter: ButtonInteraction) {
    try {
      let member = inter.member as import("discord.js").GuildMember | null;
      if (!member && inter.guild && inter.user) {
        member = await inter.guild.members.fetch(inter.user.id).catch(() => null);
      }
      if (!member) {
        await inter.reply({ content: "You must be in the server to decline applications.", ephemeral: true });
        return;
      }
      // Only allow users with 'hr' permission to decline
      const fakeInteraction = { ...inter, member } as any;
      if (!(await hasActionPermission(fakeInteraction, "hr"))) {
        await inter.reply({ content: "You do not have permission to decline applications.", ephemeral: true });
        return;
      }
      const [, , applicantId] = inter.customId.split("_");
      const originMsgId = inter.message.id;

      const modal = new ModalBuilder().setCustomId(`declineModal_${applicantId}_${originMsgId}`).setTitle("Decline Application");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("reason").setLabel("Reason for declining").setStyle(TextInputStyle.Paragraph).setRequired(true)
        )
      );

      await inter.showModal(modal);
    } catch (error) {
      logger.error("Failed to open decline modal", error);
      await inter.reply({ content: "An error occurred while opening the decline modal.", ephemeral: true });
    }
  }

  // ==========================================================================
  // Modal: Decline reason submission
  // ==========================================================================
  @ModalComponent({ id: /^declineModal_\d+_\d+$/ })
  async onDeclineSubmit(int: ModalSubmitInteraction) {
    try {
      const [, applicantId, originMsgId] = int.customId.split("_");
      const reason = int.fields.getTextInputValue("reason");
      await this.finish(int, false, applicantId, originMsgId, reason);
    } catch (error) {
      logger.error("Failed to submit decline reason", error);
      await int.reply({ content: "An error occurred while submitting the decline reason.", ephemeral: true });
    }
  }

  // ==========================================================================
  // Select Menu: Job Selection for Application
  // ==========================================================================
  @SelectMenuComponent({ id: "apply_job_select" })
  async onJobSelect(inter: any) {
    try {
      const jobId = inter.values[0];
      const job = await staffService.jobsDb.getJobById(jobId);
      if (!job) {
        await inter.reply({ content: "Selected job not found.", ephemeral: true });
        return;
      }
      // Store jobId in a property on the interaction for use in the modal
      inter.client._lastJobId = jobId;
      // Show the application modal for the selected job
      await this.showApplicationModal(inter, job);
    } catch (error) {
      logger.error("Failed to handle job selection", error);
      await inter.reply({ content: "An error occurred while selecting the job.", ephemeral: true });
    }
  }

  // ==========================================================================
  // Shared finisher
  // ==========================================================================
  private async finish(
    inter: ButtonInteraction | ModalSubmitInteraction,
    approved: boolean,
    discordId: string, // renamed from applicantId
    originMsgId?: string,
    declineReason?: string
  ) {
    await finishApplicationAction({
      inter,
      approved,
      discordId, // renamed from applicantId
      originMsgId,
      declineReason,
      db
    });
  }
  private async checkUserHasPendingApplications(userId: string): Promise<boolean> {
    const applications = await db.findByFilters({ discordId: userId });
    // check for any applications with pending status
    return applications.some((app) => app.status === "pending");
  }
}
