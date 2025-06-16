import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { CommandInteraction } from "discord.js";
import { Logger } from "../utils/logger.js";
import { hasActionPermission } from "../utils/permissions.js";
import { setTimeout as sleep } from "timers/promises";
import { AuditLog } from "../utils/auditLogDecorator.js";

const logger = new Logger("ReminderCommandGroup");

@Discord()
@SlashGroup({ name: "reminder", description: "Reminder commands" })
@SlashGroup("reminder")
export class ReminderCommandGroup {
  /**
   * /reminder set [user] [time] [message]
   * Set a reminder for a user (was /reminder)
   */
  @Slash({ name: "set", description: "Set a reminder for a user" })
  @AuditLog({
    action: "Set Reminder",
    getTarget: (result, args) => args[0]?.id, // user
    getAfter: (result, args) => ({ userId: args[0]?.id, message: args[2] }),
    getDetails: (result, args) => `Reminder for: <@${args[0]?.id}>: ${args[2]}`
  })
  async set(
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
      const ms = parseTimeString(time);
      if (!ms || ms < 5000 || ms > 1000 * 60 * 60 * 24 * 7) {
        await interaction.reply({ content: "Invalid time format. Use e.g. 10m, 2h, 1d (max 7d).", ephemeral: true });
        return;
      }
      await interaction.reply({ content: `Reminder set for <@${user.id}> in ${time}.`, ephemeral: true });
      sleep(ms).then(async () => {
        try {
          if (interaction.channel && 'send' in interaction.channel) {
            await (interaction.channel as any).send({ content: `<@${user.id}> ⏰ Reminder: ${message}` });
          }
        } catch (e) {}
      });
      return { userId: user.id, message };
    } catch (error) {
      logger.error("Failed to set reminder", error);
      await interaction.reply({ content: "Failed to set reminder.", ephemeral: true });
    }
  }
}

function parseTimeString(str: string): number | null {
  const match = str.match(/^\d+([smhd])$/i);
  if (!match) return null;
  const num = parseInt(str, 10);
  switch (match[1].toLowerCase()) {
    case "s": return num * 1000;
    case "m": return num * 60 * 1000;
    case "h": return num * 60 * 60 * 1000;
    case "d": return num * 24 * 60 * 60 * 1000;
    default: return null;
  }
}
