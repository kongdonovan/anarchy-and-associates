import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction } from "discord.js";
import { Logger } from "../../utils/logger.js";
import { buildReminderEmbed } from "../../services/reminders.js";
import { hasActionPermission } from "../../utils/permissions.js";
import { setTimeout as sleep } from "timers/promises";
import { AuditLog } from "../../utils/auditLogDecorator.js";

const logger = new Logger("ReminderCommand");

@Discord()
export class ReminderCommand {
  @Slash({ name: "reminder", description: "Set a reminder for a user" })
  @AuditLog({
    action: "Set Reminder",
    getTarget: (result, args) => args[0]?.id, // user
    getAfter: (result, args) => ({ userId: args[0]?.id, message: args[2] }),
    getDetails: (result, args) => `Reminder for: <@${args[0]?.id}>: ${args[2]}`
  })
  async reminder(
    @SlashOption({ name: "user", description: "User to remind", required: true, type: 6 }) user: any,
    @SlashOption({ name: "time", description: "When to remind (e.g., 10m, 2h)", required: true, type: 3 }) time: string,
    @SlashOption({ name: "message", description: "Reminder message", required: true, type: 3 }) message: string,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "case"))) {
        await interaction.reply({ content: "You do not have permission to set reminders.", ephemeral: true });
        return;
      }
      // Parse time string to ms
      const ms = parseTimeString(time);
      if (!ms || ms < 5000 || ms > 1000 * 60 * 60 * 24 * 7) { // 5s to 7d
        await interaction.reply({ content: "Invalid time format. Use e.g. 10m, 2h, 1d (max 7d).", ephemeral: true });
        return;
      }
      await interaction.reply({ content: `Reminder set for <@${user.id}> in ${time}.`, ephemeral: true });
      // Wait, then send reminder in same channel
      sleep(ms).then(async () => {
        try {
          if (interaction.channel && 'send' in interaction.channel) {
            await (interaction.channel as any).send({ content: `<@${user.id}> ⏰ Reminder: ${message}` });
          }
        } catch (e) {
          // Optionally log error
        }
      });
      // After successful scheduling, return info for audit log
      return { userId: user.id, message };
    } catch (error) {
      logger.error("Failed to set reminder", error);
      await interaction.reply({ content: "Failed to set reminder.", ephemeral: true });
    }
  }
}

function parseTimeString(str: string): number | null {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  switch (match[2].toLowerCase()) {
    case "s": return num * 1000;
    case "m": return num * 60 * 1000;
    case "h": return num * 60 * 60 * 1000;
    case "d": return num * 24 * 60 * 60 * 1000;
    default: return null;
  }
}
