import { Discord, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  Colors,
  Role,
} from "discord.js";
import { StaffService } from "../../services/staffService.js";
import { Logger } from "../../utils/logger.js";
import type { Job, JobQuestion } from "../../types/types.js";
import { createAALegalEmbed } from "../../utils/embed.js";
import { hasActionPermission } from "../../utils/permissions.js";
import { parseJobQuestions } from "../../services/jobs.js";
import { AuditLog } from "../../utils/auditLogDecorator.js";

const staffService = new StaffService();
const logger = new Logger("EditJobCommand");

@Discord()
export class EditJobCommand {
  /**
   * /editjob [jobid] [title] [description] [limit] [open] [role] [questions]
   * Example: /editjob "123abc" "Associate" "Updated desc" 5 true @Role '[{"id":"...","label":"New Q?","type":"short","required":true}]'
   */
  @Slash({ name: "editjob", description: "Edit an existing job" })
  @AuditLog({
    action: "Edit Job",
    getTarget: (result, args) => args[0], // jobId
    getBefore: (result) => result?.before,
    getAfter: (result) => result?.after,
    getDetails: (result, args) => `Fields updated: ${Object.keys(args[1] || {}).join(", ")}`
  })
  async editjob(
    @SlashOption({ name: "jobid", description: "Job ID to edit", required: true, type: 3 }) jobId: string,
    @SlashOption({ name: "title", description: "New job title", required: false, type: 3 }) title: string | undefined,
    @SlashOption({ name: "description", description: "New job description", required: false, type: 3 }) description: string | undefined,
    @SlashOption({ name: "limit", description: "New limit", required: false, type: 4 }) limit: number | undefined,
    @SlashOption({ name: "open", description: "Set job as open/closed", required: false, type: 5 }) open: boolean | undefined,
    @SlashOption({ name: "role", description: "Role to associate with this job", required: false, type: 8 }) role: Role | undefined,
    @SlashOption({ name: "questions", description: "New questions (JSON array)", required: false, type: 3 }) questions: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "hr"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **editjob** action. If you believe this is an error, please contact an administrator.`,
          color: 0xFF0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      const job = await staffService.jobsDb.getJobById(jobId);
      if (!job) {
        await interaction.reply({ content: "Job not found.", ephemeral: true });
        return;
      }
      // Save before state for audit
      const before = { ...job };
      let parsedQuestions: JobQuestion[] | undefined = undefined;
      if (questions) {
        try {
          parsedQuestions = parseJobQuestions(questions);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await interaction.reply({ content: `Invalid questions JSON: ${msg}`, ephemeral: true });
          return;
        }
      }
      // Build updates object with only provided fields (not typed as Partial<Job> to avoid readonly errors)
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (limit !== undefined) updates.limit = limit;
      if (open !== undefined) updates.open = open;
      if (parsedQuestions && parsedQuestions.length > 0) updates.questions = parsedQuestions;
      if (role) updates.roleId = role.id;
      await staffService.jobsDb.updateJob(jobId, updates);
      // If job is being closed, remove the associated role from all members
      if (open === false && job.roleId && interaction.guild) {
        const roleToRemove = interaction.guild.roles.cache.get(job.roleId);
        if (roleToRemove) {
          for (const member of roleToRemove.members.values()) {
            await member.roles.remove(roleToRemove).catch(() => {});
          }
        }
      }
      const embed = createAALegalEmbed({
        title: "Job Updated",
        description: `Job **${title || job.title}** has been updated.` + (role ? `\nRole: <@&${role.id}>` : job.roleId ? `\nRole: <@&${job.roleId}>` : "") + (open === false ? "\nThis job is now closed." : ""),
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      // Return info for audit log
      return { before, after: { ...before, ...updates } };
    } catch (error) {
      logger.error("Failed to edit job", error);
      await interaction.reply({ content: "Failed to edit job.", ephemeral: true });
    }
  }
}
