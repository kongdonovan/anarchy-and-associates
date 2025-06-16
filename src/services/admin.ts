/**
 * Admin service helpers for permission checks and destructive actions.
 * @module services/admin
 */
import { CommandInteraction, Colors } from "discord.js";
import { createAALegalEmbed } from "../utils/embed.js";
import { hasActionPermission } from "../utils/permissions.js";

/**
 * Check admin permission and reply with a standard embed if denied.
 * @param interaction - The command interaction
 * @param action - The action string to check
 * @returns True if allowed, false if denied (and replies)
 */
export async function checkAdminPermission(interaction: CommandInteraction, action: string): Promise<boolean> {
  if (!(await hasActionPermission(interaction, action))) {
    const embed = createAALegalEmbed({
      title: "Permission Denied",
      description: `You are not allowed to perform the **${action}** action. If you believe this is an error, please contact an administrator.`,
      color: Colors.Red,
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return false;
  }
  return true;
}

/**
 * Wipe all major collections (applications, staff, jobs, cases, feedback, retainers).
 * @returns Promise that resolves when all collections are wiped
 */
export async function wipeAllCollections() {
  const { ApplicationRepository } = await import("../mongo/repository/applications.js");
  const { StaffRepository } = await import("../mongo/repository/staff.js");
  const { JobRepository } = await import("../mongo/repository/jobs.js");
  const { CaseRepository } = await import("../mongo/repository/cases.js");
  const { FeedbackRepository } = await import("../mongo/repository/feedback.js");
  const { RetainerRepository } = await import("../mongo/repository/retainers.js");
  await Promise.all([
    new ApplicationRepository().deleteAll(),
    new StaffRepository().deleteAll(),
    new JobRepository().deleteAll(),
    new CaseRepository().deleteAll(),
    new FeedbackRepository().deleteAll(),
    new RetainerRepository().deleteAll(),
  ]);
}
