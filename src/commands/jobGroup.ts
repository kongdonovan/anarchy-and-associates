import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { CommandInteraction, Role } from "discord.js";
import { StaffService } from "../services/staffService.js";
import { Logger } from "../utils/logger.js";
import { createAALegalEmbed } from "../utils/embed.js";
import { hasActionPermission } from "../utils/permissions.js";
import { parseJobQuestions } from "../services/jobs.js";
import { AuditLog } from "../utils/auditLogDecorator.js";

const staffService = new StaffService();
const logger = new Logger("JobCommandGroup");

@Discord()
@SlashGroup({ name: "job", description: "Job management commands" })
@SlashGroup("job")
export class JobCommandGroup {
  /**
   * /job list [open] [search] [page]
   * List all jobs (was /jobs)
   */
  @Slash({ name: "list", description: "List all jobs" })
  async list(
    @SlashOption({ name: "open", description: "Show only open jobs?", required: false, type: 5 }) open: boolean | undefined,
    @SlashOption({ name: "search", description: "Search by title", required: false, type: 3 }) search: string | undefined,
    @SlashOption({ name: "page", description: "Page number", required: false, type: 4 }) page: number | undefined,
    interaction: CommandInteraction
  ) {
    try {
      const filter: any = {};
      if (typeof open === "boolean") filter.open = open;
      let jobs = await staffService.jobsDb.listJobs(filter);
      if (search) {
        jobs = jobs.filter(j => j.title.toLowerCase().includes(search.toLowerCase()));
      }
      const pageSize = 5;
      const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
      const currentPage = Math.max(1, Math.min(page || 1, totalPages));
      const paged = jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
      let desc = paged.length
        ? await Promise.all(
            paged.map(async (j) => {
              let openings = "";
              if (j.limit && j.roleId && interaction.guild) {
                const role = interaction.guild.roles.cache.get(j.roleId);
                if (role) {
                  const count = role.members.size;
                  openings = ` (${j.limit - count} openings left)`;
                }
              }
              return `**${j.title}**${j.open ? " (Open)" : " (Closed)"}${openings}\n${j.description || "No description."}`;
            })
          ).then(lines => lines.join("\n\n"))
        : "No jobs found.";
      const embed = createAALegalEmbed({
        title: "Job Listings",
        description: desc,
        footer: `Anarchy & Associates — Legal Operations | Page ${currentPage} of ${totalPages}`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to fetch jobs", error);
      await interaction.reply({ content: "Failed to fetch jobs.", ephemeral: true });
    }
  }

  /**
   * /job add [role] [description] [limit] [questions]
   * Add a new job (was /addjob)
   */
  @Slash({ name: "add", description: "Add a new job for applications" })
  @AuditLog({
    action: "Add Job",
    getTarget: (result, args) => args[0]?.id, // role
    getAfter: (result) => result?.job,
    getDetails: (result, args) => `Title: ${args[0]?.name}, Description: ${args[1]}`
  })
  async add(
    @SlashOption({ name: "role", description: "Role to use for this job", required: true, type: 8 }) role: Role,
    @SlashOption({ name: "description", description: "Job description", required: false, type: 3 }) description: string | undefined,
    @SlashOption({ name: "limit", description: "Limit on number of open positions", required: false, type: 4 }) limit: number | undefined,
    @SlashOption({ name: "questions", description: "Custom questions (JSON array)", required: false, type: 3 }) questions: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "hr"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **addjob** action. If you believe this is an error, please contact an administrator.`,
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      let parsedQuestions: any[] = [];
      if (questions) {
        try {
          parsedQuestions = parseJobQuestions(questions);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await interaction.reply({ content: `Invalid questions JSON: ${msg}`, ephemeral: true });
          return;
        }
      }
      const job = {
        title: role.name,
        description,
        limit,
        questions: parsedQuestions,
        open: true,
        statusHistory: [{ status: "opened", at: new Date(), by: interaction.user.id }],
        createdAt: new Date(),
        updatedAt: new Date(),
        roleId: role.id,
      };
      await staffService.jobsDb.addJob(job);
      const embed = createAALegalEmbed({
        title: "Job Added",
        description: `Job **${role.name}** has been added and is now open for applications.\nRole: <@&${role.id}>`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return { job };
    } catch (error) {
      logger.error("Failed to add job", error);
      await interaction.reply({ content: "Failed to add job.", ephemeral: true });
    }
  }

  /**
   * /job edit [jobid] [title] [description] [limit] [open] [role] [questions]
   * Edit an existing job (was /editjob)
   */
  @Slash({ name: "edit", description: "Edit an existing job" })
  @AuditLog({
    action: "Edit Job",
    getTarget: (result, args) => args[0], // jobId
    getBefore: (result) => result?.before,
    getAfter: (result) => result?.after,
    getDetails: (result, args) => `Fields updated: ${Object.keys(args[1] || {}).join(", ")}`
  })
  async edit(
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
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      const job = await staffService.jobsDb.getJobById(jobId);
      if (!job) {
        await interaction.reply({ content: "Job not found.", ephemeral: true });
        return;
      }
      const before = { ...job };
      let parsedQuestions = undefined;
      if (questions) {
        try {
          parsedQuestions = parseJobQuestions(questions);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await interaction.reply({ content: `Invalid questions JSON: ${msg}`, ephemeral: true });
          return;
        }
      }
      const updates: any = {}; // Type fixes for parsedQuestions and updates object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (limit !== undefined) updates.limit = limit;
      if (open !== undefined) updates.open = open;
      if (parsedQuestions && parsedQuestions.length > 0) updates.questions = parsedQuestions;
      if (role) updates.roleId = role.id;
      await staffService.jobsDb.updateJob(jobId, updates);
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
      return { before, after: { ...before, ...updates } };
    } catch (error) {
      logger.error("Failed to edit job", error);
      await interaction.reply({ content: "Failed to edit job.", ephemeral: true });
    }
  }
}
