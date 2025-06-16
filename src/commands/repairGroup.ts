import { Discord, Slash, SlashGroup } from "discordx";
import { CommandInteraction } from "discord.js";
import { checkAdminPermission } from "../services/admin.js";

@Discord()
@SlashGroup({ name: "repair", description: "Self-repair and health check commands" })
@SlashGroup("repair", "admin")
export class RepairCommandGroup {
  @Slash({ name: "staff-roles", description: "Sync staff roles between Discord and DB" })
  async repairStaffRoles(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const { repairStaffRoles } = await import("../services/repair.js");
    const result = await repairStaffRoles(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "job-roles", description: "Sync job roles between Discord and DB" })
  async repairJobRoles(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const { repairJobRoles } = await import("../services/repair.js");
    const result = await repairJobRoles(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "channels", description: "Ensure all required channels/categories exist and update config" })
  async repairChannels(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const { repairChannels } = await import("../services/repair.js");
    const result = await repairChannels(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "config", description: "Validate config keys and fix missing/invalid entries" })
  async repairConfig(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const { repairConfig } = await import("../services/repair.js");
    const result = await repairConfig(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "orphaned", description: "Find and optionally clean up orphaned DB records" })
  async repairOrphaned(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const { repairOrphaned } = await import("../services/repair.js");
    const result = await repairOrphaned(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "db-indexes", description: "Ensure MongoDB indexes are correct" })
  async repairDbIndexes(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const { repairDbIndexes } = await import("../services/repair.js");
    const result = await repairDbIndexes();
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "all", description: "Run all repair routines" })
  async repairAll(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const { repairAll } = await import("../services/repair.js");
    const result = await repairAll(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "dry-run", description: "Show what would be fixed without making changes" })
  async repairDryRun(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const { repairAll } = await import("../services/repair.js");
    const result = await repairAll(interaction.guild!, { dryRun: true });
    await interaction.reply({ embeds: [result], ephemeral: true });
  }

  @Slash({ name: "health", description: "Run a full health check and report issues" })
  async repairHealth(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "repair"))) return;
    const { healthCheck } = await import("../services/repair.js");
    const result = await healthCheck(interaction.guild!);
    await interaction.reply({ embeds: [result], ephemeral: true });
  }
}
