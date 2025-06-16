import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, User } from "discord.js";
import { StaffService } from "../../services/staffService.js";
import { Logger } from "../../utils/logger.js";
import { createAALegalEmbed } from "../../utils/embed.js";
import { hasActionPermission } from "../../utils/permissions.js";
import { AuditLog } from "../../utils/auditLogDecorator.js";

const staffService = new StaffService();
const logger = new Logger("FireCommand");

@Discord()
export class FireCommand {
  /**
   * /fire [user]
   * Remove a staff member (fire)
   */
  @Slash({ name: "fire", description: "Remove a staff member from the team" })
  @AuditLog({
    action: "Fire Staff",
    getTarget: (result, args) => args[0]?.id, // user
    getAfter: (result, args) => result?.removed,
    getDetails: (result, args) => `Fired: <@${args[0]?.id}>`,
  })
  async fire(
    @SlashOption({ name: "user", description: "User to fire", required: true, type: 6 }) user: User,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "hr"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **fire** action. If you believe this is an error, please contact an administrator.`,
          color: 0xff0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      // Remove from staff DB and all job roles using StaffService
      const staffRecords = await staffService.getStaffByUserId(user.id);
      if (!staffRecords || staffRecords.length === 0) {
        await interaction.reply({ content: `<@${user.id}> is not a staff member.`, ephemeral: true });
        return;
      }
      await staffService.fireStaffMember(user.id, interaction.guild!);
      const embed = createAALegalEmbed({
        title: "Staff Removed",
        description: `<@${user.id}> has been removed from the staff team.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      // After successful removal, return info for audit log
      return { removed: { userId: user.id } };
    } catch (error) {
      logger.error("Failed to remove staff member", error);
      await interaction.reply({ content: "Failed to remove staff member.", ephemeral: true });
    }
  }
}
