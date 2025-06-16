import { Discord, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  Colors,
  Role,
  Guild,
} from "discord.js";
import { Logger } from "../../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import type { Job, JobQuestion } from "../../types/types.js";
import { createAALegalEmbed } from "../../utils/embed.js";
import { hasActionPermission } from "../../utils/permissions.js";
import { parseJobQuestions } from "../../services/jobs.js";
import { StaffService } from "../../services/staffService.js";
import { AuditLog } from "../../utils/auditLogDecorator.js";

const logger = new Logger("AddJobCommand");
const staffService = new StaffService();

@Discord()
export class AddJobCommand {
  /**
   * /addjob [role] [description] [limit] [questions]
   * Example: /addjob @Role "Entry-level legal work" 3 '[{"label":"What is your law experience?","type":"paragraph","required":true}]'
   */
  @Slash({ name: "addjob", description: "Add a new job for applications" })
  @AuditLog({
    action: "Add Job",
    getTarget: (result, args) => args[0]?.id, // role
    getAfter: (result) => result?.job,
    getDetails: (result, args) => `Title: ${args[0]?.name}, Description: ${args[1]}`
  })
  async addjob(
    @SlashOption({ name: "role", description: "Role to use for this job", required: true, type: 8 }) role: Role,
    @SlashOption({ name: "description", description: "Job description", required: false, type: 3 }) description: string | undefined,
    @SlashOption({ name: "limit", description: "Limit on number of open positions", required: false, type: 4 }) limit: number | undefined,
    @SlashOption({ name: "questions", description: "Custom questions (JSON array)", required: false, type: 3 }) questions: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      // Permission check for adding jobs
      if (!(await hasActionPermission(interaction, "hr"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **addjob** action. If you believe this is an error, please contact an administrator.`,
          color: Colors.Red,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      let parsedQuestions: JobQuestion[] = [];
      if (questions) {
        try {
          parsedQuestions = parseJobQuestions(questions);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await interaction.reply({ content: `Invalid questions JSON: ${msg}`, ephemeral: true });
          return;
        }
      }
      const job: Omit<Job, "_id"> = {
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
      // Return info for audit log
      return { job };
    } catch (error) {
      logger.error("Failed to add job", error);
      await interaction.reply({ content: "Failed to add job.", ephemeral: true });
    }
  }
}
