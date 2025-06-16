import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, User, GuildMember, Role } from "discord.js";
import { Logger } from "../../utils/logger.js";
import { createAALegalEmbed } from "../../utils/embed.js";
import { hasActionPermission } from "../../utils/permissions.js";
import { StaffService } from "../../services/staffService.js";
import { AuditLog } from "../../utils/auditLogDecorator.js";

const logger = new Logger("HireCommand");

@Discord()
export class HireCommand {
  /**
   * /hire [user] [role]
   * Hire a new staff member
   */
  @Slash({ name: "hire", description: "Hire a new staff member" })
  @AuditLog({
    action: "Hire Staff",
    getTarget: (result, args) => args[0]?.id, // user
    getAfter: (result, args) => result?.staff,
    getDetails: (result, args) => `Hired: <@${args[0]?.id}> as ${args[1]?.name}`,
  })
  async hire(
    @SlashOption({ name: "user", description: "User to hire", required: true, type: 6 }) user: User,
    @SlashOption({ name: "role", description: "Role to assign", required: true, type: 8 }) role: Role,
    @SlashOption({ name: "roblox_username", description: "Roblox username", required: true, type: 3 }) robloxUsername: string,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "hr"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **hire** action. If you believe this is an error, please contact an administrator.`,
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      const staffService = new StaffService();
      // Check if user is already staff
      const existing = await staffService.getStaffByUserId(user.id);
      if (existing && existing.length > 0) {
        await interaction.reply({ content: `<@${user.id}> is already a staff member.`, ephemeral: true });
        return;
      }
      // Check if user is in the server
      const guild = interaction.guild;
      const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
      if (!member) {
        await interaction.reply({ content: `User <@${user.id}> is not in this server.`, ephemeral: true });
        return;
      }
      // Check job limit for this role using StaffService
      const job = await staffService.getJobByRole(role);
      if (job && typeof job.limit === "number") {
        const { allowed, limit, count } = await staffService.canAssignJob(job.title);
        if (!allowed) {
          await interaction.reply({ content: `The job limit for **${role.name}** has been reached (${count}/${limit}).`, ephemeral: true });
          return;
        }
      }
      // Add user to staff database and assign role using StaffService
      await staffService.addStaffMember({
        userId: user.id,
        username: robloxUsername,
        role: role.name,
      });
      await member.roles.add(role).catch(() => {});
      const embed = createAALegalEmbed({
        title: "Staff Hired",
        description: `Welcome <@${user.id}> to Anarchy & Associates as **${role.name}**! We look forward to your contributions to our legacy of excellence.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      // After successful creation, return info for audit log
      return { staff: { userId: user.id, role: role.name, robloxUsername } };
    } catch (error) {
      logger.error("Failed to hire staff", error);
      await interaction.reply({ content: "Failed to hire staff. Please try again later.", ephemeral: true });
    }
  }
}
