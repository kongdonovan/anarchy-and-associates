import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, ApplicationCommandOptionType } from "discord.js";
import { infoEmbed } from "../utils/embed.js";

@Discord()
export class HelpCommand {
  @Slash({ name: "help", description: "Show available commands and usage" })
  async help(
    @SlashOption({ name: "command", description: "Command, group, or subcommand to get help for", required: false, type: 3 }) command: string | undefined,
    interaction: CommandInteraction
  ) {
    // Only proceed if interaction.reply exists (i.e., it's a CommandInteraction)
    if (typeof interaction.reply !== "function") {
      return;
    }
    const commands = await interaction.client.application.commands.fetch();
    if (command) {
      // Check for group subcommand (e.g., "case assign")
      const parts = command.split(" ");
      if (parts.length === 2) {
        // Try to find a subcommand in a group
        for (const cmd of commands.values()) {
          if (cmd.options) {
            for (const opt of cmd.options) {
              if (opt.type === ApplicationCommandOptionType.SubcommandGroup && opt.name === parts[0]) {
                const sub = opt.options?.find((s: any) => s.name === parts[1]);
                if (sub) {
                  const usage = `/${cmd.name} ${opt.name} ${sub.name}`;
                  await interaction.reply({
                    embeds: [infoEmbed(usage, `**Description:** ${sub.description || "No description"}\n**Usage:** ${usage}`)],
                    ephemeral: true
                  });
                  return;
                }
              }
            }
          }
        }
      }
      // Check for subcommand (e.g., "job add")
      if (parts.length === 2) {
        for (const cmd of commands.values()) {
          if (cmd.name === parts[0] && cmd.options) {
            const sub = cmd.options.find(opt => opt.type === ApplicationCommandOptionType.Subcommand && opt.name === parts[1]);
            if (sub) {
              const usage = `/${cmd.name} ${sub.name}`;
              await interaction.reply({
                embeds: [infoEmbed(usage, `**Description:** ${sub.description || "No description"}\n**Usage:** ${usage}`)],
                ephemeral: true
              });
              return;
            }
          }
        }
      }
      // Check for group (subcommand group)
      let foundGroup: any = null;
      let parentCmd: any = null;
      for (const cmd of commands.values()) {
        if (cmd.options) {
          for (const opt of cmd.options) {
            if (opt.type === ApplicationCommandOptionType.SubcommandGroup && opt.name === command) {
              foundGroup = opt;
              parentCmd = cmd;
              break;
            }
          }
        }
        if (foundGroup) break;
      }
      if (foundGroup && parentCmd) {
        const lines = foundGroup.options.map((sub: any) => `• **/${parentCmd.name} ${foundGroup.name} ${sub.name}** — ${sub.description || "No description"}`);
        await interaction.reply({
          embeds: [infoEmbed(`/${parentCmd.name} ${foundGroup.name} subcommands`, lines.join("\n"))],
          ephemeral: true
        });
        return;
      }
      // Otherwise, show command details as before
      const cmd = Array.from(commands.values()).find(c => c.name === command);
      if (!cmd) {
        await interaction.reply({ embeds: [infoEmbed("Command Not Found", `No command, group, or subcommand named "${command}" was found.`)], ephemeral: true });
        return;
      }
      let usage = `/${cmd.name}`;
      if (cmd.options && cmd.options.length > 0) {
        usage +=
          " " +
          cmd.options
            .filter(opt =>
              opt.type === ApplicationCommandOptionType.String ||
              opt.type === ApplicationCommandOptionType.Integer ||
              opt.type === ApplicationCommandOptionType.Boolean ||
              opt.type === ApplicationCommandOptionType.User ||
              opt.type === ApplicationCommandOptionType.Channel ||
              opt.type === ApplicationCommandOptionType.Role ||
              opt.type === ApplicationCommandOptionType.Mentionable ||
              opt.type === ApplicationCommandOptionType.Number ||
              opt.type === ApplicationCommandOptionType.Attachment
            )
            .map(opt =>
              ("required" in opt && opt.required) ? `<${opt.name}>` : `[${opt.name}]`
            )
            .join(" ");
      }
      await interaction.reply({
        embeds: [
          infoEmbed(
            `/${cmd.name}`,
            `**Description:** ${cmd.description || "No description"}\n**Usage:** ${usage}`
          )
        ],
        ephemeral: true
      });
      return;
    }
    // List all global commands
    const lines = Array.from(commands.values()).map(cmd => `• **/${cmd.name}** — ${cmd.description || "No description"}`);
    await interaction.reply({
      embeds: [infoEmbed("Available Commands", lines.join("\n"))],
      ephemeral: true
    });
  }
}
