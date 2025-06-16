import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { CommandInteraction } from "discord.js";
import { checkAdminPermission } from "../../services/admin.js";
import * as repair from "../../services/repair.js";

@Discord()
@SlashGroup({ name: "repair", description: "Self-repair and health check commands" })
export class RepairCommands {
  @Slash({ name: "staff-roles", description: "Sync staff roles between Discord and DB" })
  async staffRoles(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const result = await repair.repairStaffRoles(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "job-roles", description: "Sync job roles between Discord and DB" })
  async jobRoles(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const result = await repair.repairJobRoles(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "channels", description: "Ensure all required channels/categories exist and update config" })
  async channels(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const result = await repair.repairChannels(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "config", description: "Validate config keys and fix missing/invalid entries" })
  async config(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const result = await repair.repairConfig(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "orphaned", description: "Find and optionally clean up orphaned DB records" })
  async orphaned(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const result = await repair.repairOrphaned(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "db-indexes", description: "Ensure MongoDB indexes are correct" })
  async dbIndexes(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const result = await repair.repairDbIndexes();
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "all", description: "Run all repair routines" })
  async all(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const result = await repair.repairAll(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "dry-run", description: "Show what would be fixed without making changes" })
  async dryRun(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const result = await repair.repairAll(interaction.guild!, { dryRun: true });
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "health", description: "Run a full health check and report issues" })
  async health(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const result = await repair.healthCheck(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }
}
