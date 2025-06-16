import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, User, GuildMember } from "discord.js";
import { Logger } from "../../utils/logger.js";
import { createAALegalEmbed } from "../../utils/embed.js";
import { hasActionPermission } from "../../utils/permissions.js";
import { StaffService } from "../../services/staffService.js";
import { AuditLog } from "../../utils/auditLogDecorator.js";

const logger = new Logger("PromoteCommand");

@Discord()
export class PromoteCommand {
  /**
   * /promote [user] [role]
   * Promote a staff member to a specified rank
   */
  @Slash({ name: "promote", description: "Promote a staff member to a specified rank" })
  @AuditLog({
    action: "Promote Staff",
    getTarget: (result: any, args: any[]) => args[0]?.id, // user
    getBefore: (result: any) => result?.before,
    getAfter: (result: any) => result?.after,
    getDetails: (result: any, args: any[]) => `Promoted: <@${args[0]?.id}> to ${args[1]}`,
  })
  async promote(
    @SlashOption({ name: "user", description: "User to promote", required: true, type: 6 }) user: User,
    @SlashOption({ name: "role", description: "New role", required: true, type: 3 }) role: string,
    @SlashOption({ name: "roblox_username", description: "Roblox username", required: false, type: 3 }) robloxUsername: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "hr"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **promote** action. If you believe this is an error, please contact an administrator.`,
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      const guild = interaction.guild;
      if (!guild) throw new Error("This command must be run in a server.");
      const member = await guild.members.fetch(user.id);
      if (!member) throw new Error("User not found in this server.");

      // Get the user's current staff role from MongoDB
      const staffService = new StaffService();
      const staffRecords = await staffService.getStaffByUserId(user.id);
      const staffRecord = staffRecords && staffRecords.length > 0 ? staffRecords[0] : null;
      if (!staffRecord) {
        await interaction.reply({ content: `<@${user.id}> is not a staff member.`, ephemeral: true });
        return;
      }
      // Prevent duplicate staff entries
      if (staffRecords.length > 1) {
        await interaction.reply({ content: `<@${user.id}> already has a job and cannot be promoted again until resolved.`, ephemeral: true });
        return;
      }
      let previousRoleName = staffRecord?.role;
      let previousRole = previousRoleName ? guild.roles.cache.find((r) => r.name === previousRoleName) : undefined;

      // Remove only the previous staff role if it exists
      if (previousRole && member.roles.cache.has(previousRole.id)) {
        await member.roles.remove(previousRole);
      }

      // Find the new role by name (case-insensitive)
      const newRole = guild.roles.cache.find((r) => r.name.toLowerCase() === role.toLowerCase());
      if (!newRole) {
        await interaction.reply({ content: `Role **${role}** not found.`, ephemeral: true });
        return;
      }
      if (member.roles.cache.has(newRole.id)) {
        await interaction.reply({ content: `<@${user.id}> already has the role **${newRole.name}**.`, ephemeral: true });
        return;
      }

      // Check job limit for the new role using StaffService
      const job = await staffService.getJobByRole(newRole);
      if (job && typeof job.limit === "number") {
        const { allowed, limit, count } = await staffService.canAssignJob(job.title);
        if (!allowed) {
          await interaction.reply({ content: `The job limit for **${newRole.name}** has been reached (${count}/${limit}).`, ephemeral: true });
          return;
        }
      }

      // Update staff DB using StaffService
      await staffService.staffDb.updateStaff(user.id, { role: newRole.name, updatedAt: new Date(), ...(robloxUsername ? { username: robloxUsername } : {}) });
      await member.roles.add(newRole).catch(() => {});

      const embed = createAALegalEmbed({
        title: "Promotion Awarded",
        description: `Congratulations <@${user.id}>! You have been promoted to **${newRole.name}** at Anarchy & Associates. Your dedication is recognized and valued.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });

      // After successful promotion, return info for audit log
      return { before: { userId: user.id, previousRole: "..." }, after: { userId: user.id, newRole: role } };
    } catch (error) {
      logger.error("Failed to promote staff member", error);
      await interaction.reply({ content: "Failed to promote staff member.", ephemeral: true });
    }
  }
}
