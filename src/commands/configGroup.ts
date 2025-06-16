import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { CommandInteraction, Role, Channel } from "discord.js";
import { GuildConfigRepository } from "../mongo/repository/guildConfig.js";
import { Logger } from "../utils/logger.js";
import { createAALegalEmbed } from "../utils/embed.js";
import { hasActionPermission } from "../utils/permissions.js";
import { getGuildConfig } from "../utils/botConfig.js";
import { AuditLog } from "../utils/auditLogDecorator.js";

const configDb = new GuildConfigRepository();
const logger = new Logger("ConfigCommandGroup");

@Discord()
@SlashGroup({ name: "config", description: "Server configuration commands" })
@SlashGroup("config")
export class ConfigCommandGroup {
  /**
   * /config set [key] [channel]
   * Set a channel config value (was /setconfig)
   */
  @Slash({ name: "set", description: "Set a channel or category config value" })
  @AuditLog({
    action: "Set Config",
    getTarget: (result, args) => args[0], // key
    getAfter: (result, args) => ({ key: args[0], channelId: args[1]?.id }),
    getDetails: (result, args) => `Set ${args[0]} to <#${args[1]?.id}>`
  })
  async set(
    @SlashOption({ name: "key", description: "Config key (e.g. FEEDBACK_CHANNEL_ID)", required: true, type: 3 }) key: string,
    @SlashOption({ name: "channel", description: "Channel or category to set", required: true, type: 7 }) channel: Channel,
    interaction: CommandInteraction
  ) {
    try {
      if (!(await hasActionPermission(interaction, "config"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **config** action. If you believe this is an error, please contact an administrator.`,
          color: 0xFF0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      await configDb.setChannelConfig(interaction.guildId!, { [key]: channel.id });
      const embed = createAALegalEmbed({
        title: "Config Updated",
        description: `Set **${key}** to <#${channel.id}>.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return { key, channelId: channel.id };
    } catch (error) {
      logger.error("Failed to set config", error);
      await interaction.reply({ content: "Failed to set config.", ephemeral: true });
    }
  }

  /**
   * /config view
   * View all configurable channel/category keys (was /viewconfig)
   */
  @Slash({ name: "view", description: "View all configurable channel/category keys" })
  async view(interaction: CommandInteraction) {
    try {
      if (!(await hasActionPermission(interaction, "config"))) {
        const embed = createAALegalEmbed({
          title: "Permission Denied",
          description: `You are not allowed to perform the **config** action. If you believe this is an error, please contact an administrator.`,
          color: 0xFF0000,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      const config = await getGuildConfig(interaction.guildId!);
      if (!config) {
        await interaction.reply({ content: "No config found for this server.", ephemeral: true });
        return;
      }
      const entries = Object.entries(config)
        .filter(([k, v]) => typeof v === "string" && k.endsWith("Id"))
        .map(([k, v]) => {
          if (k.endsWith("RoleId") || k.endsWith("Roles") || k === "clientRoleId" || k === "adminRoleId") {
            return `**${k}**: <@&${v}>`;
          } else {
            return `**${k}**: <#${v}>`;
          }
        });
      const embed = createAALegalEmbed({
        title: "Server Config",
        description: entries.length ? entries.join("\n") : "No channel/category config set.",
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to view config", error);
      await interaction.reply({ content: "Failed to view config.", ephemeral: true });
    }
  }

  /**
   * /config setclientrole [role]
   * Set the client role for the server (was /setclientrole)
   */
  @Slash({ name: "setclientrole", description: "Set the client role for the server" })
  async setClientRole(
    @SlashOption({ name: "role", description: "Role to assign to clients", required: true, type: 8 }) role: Role,
    interaction: CommandInteraction
  ) {
    if (!(await hasActionPermission(interaction, "config"))) {
      const embed = createAALegalEmbed({
        title: "Permission Denied",
        description: `You are not allowed to perform the **config** action. If you believe this is an error, please contact an administrator.`,
        color: 0xFF0000,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
    await configDb.setChannelConfig(interaction.guildId!, { clientRoleId: role.id });
    const embed = createAALegalEmbed({
      title: "Client Role Set",
      description: `Set the client role to <@&${role.id}>.`,
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
