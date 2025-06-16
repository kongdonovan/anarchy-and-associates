/**
 * Application service helpers for modals, embeds, and workflow actions.
 * @module services/application
 */
import { ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from "discord.js";
import { GuildTextBasedChannel, ButtonInteraction, ModalSubmitInteraction, ButtonBuilder, ActionRowBuilder, Message } from "discord.js";
import { ApplicationRepository } from "../mongo/repository/applications.js";
import { StaffService } from "./staffService.js";
import { getGuildConfig } from "../utils/botConfig.js";
import { GuildMember } from "discord.js";
import { Logger } from "../utils/logger.js";
import { createAALegalEmbed } from "../utils/embed.js";
const logger = new Logger("ApplicationService");
const staffService = new StaffService();

/**
 * Build a Discord modal for job application questions.
 * @param job - The job object containing title and questions
 * @returns ModalBuilder instance for Discord modal
 */
export function buildApplicationModal(job: any): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(`applyModal_${job._id || job.id || "unknown"}`).setTitle(`Apply: ${job.title}`);
  const defaultQs = [
    { id: "username", label: "What is your Roblox username?", placeholder: "HasteAnarchy", style: TextInputStyle.Short },
    { id: "reason", label: "Why do you want to work for us?", placeholder: "Some message…", style: TextInputStyle.Paragraph },
    { id: "experience", label: "What relevant experience do you have?", placeholder: "Some message…", style: TextInputStyle.Paragraph },
  ];
  // Support JobQuestion objects
  const customQs = (job.questions || []).map((q: any, i: number) => ({
    id: q.id || `custom_${i}`,
    label: q.label || `Question ${i + 1}`,
    placeholder: q.options && Array.isArray(q.options) ? `Options: ${q.options.join(", ")}` : "",
    style: q.type === "short" ? TextInputStyle.Short : TextInputStyle.Paragraph,
    required: q.required !== false // default to true
  }));
  const allQs = [...defaultQs, ...customQs];
  modal.addComponents(
    ...allQs.map((q) =>
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(q.id)
          .setLabel(q.label)
          .setPlaceholder(q.placeholder)
          .setRequired(q.required)
          .setStyle(q.style)
      )
    )
  );
  return modal;
}

/**
 * Build an application review embed (refined for channel display).
 * @param responses - Record of question/answer pairs
 * @param robloxFields - Roblox profile fields to display
 * @param avatarUrl - Roblox avatar URL
 * @param userAvatar - Discord user avatar URL
 * @param applicant - Discord user object (for tag/id)
 * @param jobTitle - Job title (if available)
 * @param applicationId - Application ID (if available)
 * @param questionLabels - Optional mapping of question IDs to labels
 * @returns EmbedBuilder instance for review
 */
export function buildApplicationEmbed(
  responses: Record<string, string>,
  robloxFields: { name: string; value: string }[],
  avatarUrl: string,
  userAvatar: string,
  applicant?: { tag: string; id: string },
  jobTitle?: string,
  applicationId?: string,
  questionLabels?: Record<string, string>
) {
  const fields = [
    ...Object.entries(responses).map(([k, v]) => ({
      name: (questionLabels && questionLabels[k]) || k,
      value: v || "—",
      inline: false
    })),
    ...robloxFields.map(f => ({ name: f.name, value: f.value, inline: false })),
  ];
  return new EmbedBuilder()
    .setColor("#4B006E")
    .setTitle(jobTitle ? `Job Application: ${jobTitle}` : "New Application")
    .addFields(fields)
    .setThumbnail(avatarUrl || userAvatar)
    .setFooter({
      text: `Applicant: ${applicant ? `${applicant.tag} (${applicant.id})` : "Unknown"}${applicationId ? ` • Application ID: ${applicationId}` : ""}`,
    })
    .setTimestamp();
}

/**
 * Shared finisher for application accept/decline actions.
 * Handles DM, DB update, and review message edit.
 * @param params - Object containing interaction, approval, applicantId, etc.
 */
export async function finishApplicationAction({
  inter,
  approved,
  discordId, // renamed from applicantId
  originMsgId,
  declineReason,
  db
}: {
  inter: ButtonInteraction | ModalSubmitInteraction,
  approved: boolean,
  discordId: string, // renamed from applicantId
  originMsgId?: string,
  declineReason?: string,
  db: ApplicationRepository
}) {
  // DM applicant
  const applicant = await inter.client.users.fetch(discordId).catch(() => null);
  if (applicant) {
    // Use branded embed for DM
    const dmEmbed = approved
      ? createAALegalEmbed({
          title: "Application Accepted!",
          description:
            "Congratulations! After careful consideration, we are pleased to welcome you to the team at Anarchy & Associates. Someone from the team will reach out to you shortly to discuss next steps.",
          color: 0x57F287,
          footer: "Anarchy & Associates — Welcome"
        })
      : createAALegalEmbed({
          title: "Application Declined",
          description: `Unfortunately your application was declined.\n\n**Reason:** ${declineReason ?? "n/a"}`,
          color: 0xe74c3c,
          footer: "Anarchy & Associates — Application Update"
        });
    await applicant.send({ embeds: [dmEmbed] }).catch(() => null);
  }
  // Always update application status in DB
  const applications = await db.findByFilters({ discordId });
  const application = applications.find((app) => app.status === "pending");
  if (application) {
    await db.update(application._id.toString(), {
      status: approved ? "accepted" : "rejected",
      updatedAt: new Date(),
      ...(declineReason && { rejectionReason: declineReason })
    });
    // If accepted, assign job role and add to staff DB
    if (approved && inter.guild) {
      const jobId = application.jobId;
      let job, jobRoleId;
      if (jobId) {
        job = await staffService.jobsDb.getJobById(jobId);
        jobRoleId = job?.roleId;
      }
      if (jobRoleId) {
        const member = await inter.guild.members.fetch(discordId).catch(() => null);
        if (member && member.roles && member.roles.cache && !member.roles.cache.has(jobRoleId)) {
          const jobRole = inter.guild.roles.cache.get(jobRoleId);
          if (jobRole) {
            await member.roles.add(jobRole).catch(() => {});
            // Add to staff DB if not present
            const existing = await staffService.getStaffByUserId(discordId);
            if (!existing || existing.length === 0) {
              await staffService.addStaffMember({
                userId: discordId,
                username: member.user.username,
                role: jobRole.name,
              });
            } else {
              await staffService.staffDb.updateStaff(discordId, { role: jobRole.name, updatedAt: new Date() });
            }
          }
        }
      }
    }
  }
  // Edit review message
  try {
    const channel = inter.channel as GuildTextBasedChannel | null;
    const reviewMsg = originMsgId && channel ? await channel.messages.fetch(originMsgId) : inter.isButton() ? inter.message : null;
    if (reviewMsg) {
      // Extract original fields and info
      const original = reviewMsg.embeds[0];
      const fields = original.fields || [];
      const jobTitle = original.title?.replace(/^Job Application: /, "");
      const applicantFooter = original.footer?.text || undefined;
      const statusText = approved ? "✅ Accepted" : "❌ Declined";
      const color = approved ? 0x57F287 : 0xe74c3c;
      // Build a branded status embed
      const statusEmbed = createAALegalEmbed({
        title: jobTitle ? `${statusText} — ${jobTitle}` : statusText,
        description: approved
          ? "This applicant has been **accepted** to Anarchy & Associates."
          : `This application was **declined**.${declineReason ? `\n\n**Reason:** ${declineReason}` : ""}`,
        color,
        fields,
        footer: applicantFooter || undefined,
        thumbnail: original.thumbnail?.url,
        timestamp: true,
      });
      const row = reviewMsg.components[0] as unknown as ActionRowBuilder<ButtonBuilder>;
      if (row) {
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...(row.components as ButtonBuilder[]).map(btn =>
            ButtonBuilder.from(btn).setDisabled(true)
          )
        );
        await reviewMsg.edit({ embeds: [statusEmbed], components: [disabledRow] });
      } else {
        await reviewMsg.edit({ embeds: [statusEmbed] });
      }
    }
  } catch {
    /* swallow */
  }
  // Ack to moderator
  if (inter.isRepliable()) {
    if (inter.isModalSubmit()) {
      await inter.reply({ content: `Applicant has been declined.`, ephemeral: true });
    } else if (inter.isButton()) {
      await inter.update({ content: `Applicant has been ${approved ? "accepted" : "declined"}.`, embeds: inter.message.embeds, components: [] });
    }
  }
}
