import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, Guild, PermissionsBitField, Role, User } from "discord.js";
import { createAALegalEmbed } from "../utils/embed.js";
import { Logger } from "../utils/logger.js";
import { GuildConfigRepository } from "../mongo/repository/guildConfig.js";
import { checkAdminPermission, wipeAllCollections } from "../services/admin.js";

const logger = new Logger("AdminCommand");
const configDb = new GuildConfigRepository();

@Discord()
export class AdminCommand {
  /**
   * /admin add [user]
   * Grant admin privileges to a user
   */
  @Slash({ name: "admin_add", description: "Grant admin privileges to a user" })
  async addAdmin(
    @SlashOption({ name: "user", description: "User to grant admin", required: true, type: 6 }) user: User,
    interaction: CommandInteraction
  ) {
    if (!(await checkAdminPermission(interaction, "admin"))) return;
    try {
      await configDb.addAdmin(interaction.guildId!, user.id);
      const embed = createAALegalEmbed({
        title: "Admin Granted",
        description: `<@${user.id}> has been granted admin privileges.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to add admin", error);
      await interaction.reply({ content: "Failed to add admin.", ephemeral: true });
    }
  }

  /**
   * /admin remove [user]
   * Remove admin privileges from a user
   */
  @Slash({ name: "admin_remove", description: "Remove admin privileges from a user" })
  async removeAdmin(
    @SlashOption({ name: "user", description: "User to remove admin", required: true, type: 6 }) user: User,
    interaction: CommandInteraction
  ) {
    if (!(await checkAdminPermission(interaction, "admin"))) return;
    try {
      await configDb.removeAdmin(interaction.guildId!, user.id);
      const embed = createAALegalEmbed({
        title: "Admin Revoked",
        description: `<@${user.id}>'s admin privileges have been revoked.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to remove admin", error);
      await interaction.reply({ content: "Failed to remove admin.", ephemeral: true });
    }
  }

  /**
   * /admin grantrole [role]
   * Grant admin privileges to all members of a role
   */
  @Slash({ name: "admin_grantrole", description: "Grant admin privileges to a role" })
  async grantRoleAdmin(
    @SlashOption({ name: "role", description: "Role to grant admin", required: true, type: 8 }) role: Role,
    interaction: CommandInteraction
  ) {
    if (!(await checkAdminPermission(interaction, "admin"))) return;
    try {
      await configDb.addAdminRole(interaction.guildId!, role.id);
      const embed = createAALegalEmbed({
        title: "Role Admin Granted",
        description: `All members of <@&${role.id}> now have admin privileges.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to grant role admin", error);
      await interaction.reply({ content: "Failed to grant role admin.", ephemeral: true });
    }
  }

  /**
   * /admin revokerole [role]
   * Remove admin privileges from all members of a role
   */
  @Slash({ name: "admin_revokerole", description: "Remove admin privileges from a role" })
  async revokeRoleAdmin(
    @SlashOption({ name: "role", description: "Role to revoke admin", required: true, type: 8 }) role: Role,
    interaction: CommandInteraction
  ) {
    if (!(await checkAdminPermission(interaction, "admin"))) return;
    try {
      await configDb.removeAdminRole(interaction.guildId!, role.id);
      const embed = createAALegalEmbed({
        title: "Role Admin Revoked",
        description: `Admin privileges have been revoked from all members of <@&${role.id}>.`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to revoke role admin", error);
      await interaction.reply({ content: "Failed to revoke role admin.", ephemeral: true });
    }
  }

  /**
   * /admin list
   * List all current admins and admin roles
   */
  @Slash({ name: "admin_list", description: "List all current admins and admin roles" })
  async listAdmins(interaction: CommandInteraction) {
    if (!(await checkAdminPermission(interaction, "admin"))) return;
    try {
      const config = await configDb.getConfig(interaction.guildId!);
      const adminUsers = config?.admins?.map((id: string) => `<@${id}>`).join(", ") || "None";
      const adminRoles = config?.adminRoles?.map((id: string) => `<@&${id}>`).join(", ") || "None";
      const embed = createAALegalEmbed({
        title: "Current Admins",
        description: `**Users:** ${adminUsers}\n**Roles:** ${adminRoles}`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error("Failed to list admins", error);
      await interaction.reply({ content: "Failed to list admins.", ephemeral: true });
    }
  }

  /**
   * /admin debug_collection
   * View the contents of a collection (admin only)
   */
  @Slash({ name: "debug_collection", description: "View the contents of a collection (admin only)" })
  async debugCollection(
    @SlashOption({ name: "collection", description: "Collection name (applications, staff, jobs, cases)", required: true, type: 3 }) collection: string,
    interaction: CommandInteraction
  ) {
    if (!(await checkAdminPermission(interaction, "admin"))) return;
    // Move repository initializations here
    const { ApplicationRepository } = await import("../mongo/repository/applications.js");
    const { StaffRepository } = await import("../mongo/repository/staff.js");
    const { JobRepository } = await import("../mongo/repository/jobs.js");
    const { CaseRepository } = await import("../mongo/repository/cases.js");
    let data: any[] = [];
    if (collection === "applications") data = await new ApplicationRepository().findByFilters({});
    if (collection === "staff") data = await new StaffRepository().getAllStaff();
    if (collection === "jobs") data = await new JobRepository().findByFilters({});
    if (collection === "cases") data = await new CaseRepository().findByFilters({});
    if (!data.length) {
      await interaction.reply({ content: `No documents found in ${collection}.`, ephemeral: true });
      return;
    }
    const MAX = 1900;
    const json = JSON.stringify(data, null, 2);
    let first = true;
    for (let i = 0; i < json.length; i += MAX) {
      const chunk = json.slice(i, i + MAX);
      if (first) {
        await interaction.reply({ content: chunk, ephemeral: true });
        first = false;
      } else {
        await interaction.followUp({ content: chunk, ephemeral: true });
      }
    }
  }

  /**
   * /admin setupserver
   * Wipe and set up the server from scratch (DANGEROUS)
   */
  @Slash({ name: "setupserver", description: "Wipe and set up the server from scratch (DANGEROUS)" })
  async setupServer(
    @SlashOption({ name: "confirm", description: "Type YES to confirm full server wipe", required: true, type: 3 }) confirm: string,
    interaction: CommandInteraction
  ) {
    try {
      // Only allow the server owner or bot owner
      if (interaction.user.id !== interaction.guild?.ownerId) {
        await interaction.reply({ content: "Only the server owner can run this command.", ephemeral: true });
        return;
      }
      if (confirm !== "YES") {
        await interaction.reply({ content: "You must type YES to confirm server wipe.", ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild as Guild;
      // Import SERVER_SETUP here
      const { SERVER_SETUP } = await import("../utils/serverSetupConfig.js");
      // 1. Delete all channels
      for (const channel of guild.channels.cache.values()) {
        await channel.delete().catch(() => {});
      }
      // --- Wipe MongoDB collections ---
      const { wipeAllCollections } = await import("../services/admin.js");
      await wipeAllCollections();
      // ---------------------------------
      // 2. Delete all roles except @everyone and bot roles
      for (const role of guild.roles.cache.values()) {
        if (role.managed || role.id === guild.id) continue;
        await role.delete().catch(() => {});
      }
      // --- Wipe GuildConfig for this guild ---
      await configDb.deleteGuildConfig(guild.id);
      // ---------------------------------------

      // 3. Create roles
      const createdRoles: Record<string, string> = {};
      for (const roleDef of SERVER_SETUP.roles) {
        const role = await guild.roles.create({
          name: roleDef.name,
          color: roleDef.color as any, // Accepts string or number
          permissions: roleDef.permissions as any, // Accepts string[]
          hoist: roleDef.hoist ?? false
        });
        createdRoles[roleDef.name] = role.id;
      }

      // --- Set up actionRoles in GuildConfig ---
      const { DEFAULT_ROLE_PERMISSIONS } = await import("../utils/serverSetupConfig.js");
      const actionRoles: Record<string, string[]> = {};
      for (const [roleName, actions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        const roleId = createdRoles[roleName];
        if (!roleId) continue;
        for (const action of actions) {
          if (!actionRoles[action]) actionRoles[action] = [];
          actionRoles[action].push(roleId);
        }
      }
      await configDb.setConfig(guild.id, { actionRoles });
      // -----------------------------------------

      // --- Create default jobs in DB ---
      const { setupDefaultJobs } = await import("../services/repair.js");
      await setupDefaultJobs(guild);
      // ---------------------------------

      // 4. Create categories and channels
      for (const cat of SERVER_SETUP.categories) {
        const category = await guild.channels.create({
          name: cat.name,
          type: 4 // GUILD_CATEGORY
        });
        for (const ch of cat.channels) {
          await guild.channels.create({
            name: ch.name,
            type: ch.type === "GUILD_TEXT" ? 0 : 2, // 0: text, 2: voice
            parent: category.id
          });
        }
      }

      // --- Auto-configure GuildConfig with default channel/category IDs ---
      // (this will upsert, not overwrite actionRoles)
      const { DEFAULT_CHANNEL_MAPPINGS } = await import("../utils/serverSetupConfig.js");
      const configUpdate: Record<string, string> = {};
      for (const [configKey, mapping] of Object.entries(DEFAULT_CHANNEL_MAPPINGS)) {
        const found = guild.channels.cache.find(
          c => c.name.toLowerCase() === mapping.name.toLowerCase() &&
            ((mapping.type === "GUILD_TEXT" && c.type === 0) || (mapping.type === "GUILD_CATEGORY" && c.type === 4))
        );
        if (found) configUpdate[configKey] = found.id;
      }
      await configDb.setChannelConfig(guild.id, configUpdate);
      // ---------------------------------------------------------------

      await interaction.editReply("Server setup complete!");
    } catch (error) {
      logger.error("Failed to set up server", error);
      try {
        await interaction.editReply("Failed to set up server.");
      } catch {}
    }
  }

  /**
   * /admin debug_wipecollections
   * DANGEROUS: Wipe all major collections
   */
  @Slash({ name: "debug_wipecollections", description: "DANGEROUS: Wipe all major collections" })
  async debugWipeCollections(interaction: CommandInteraction) {
    try {
      if (!(await checkAdminPermission(interaction, "admin"))) return;
      await interaction.deferReply({ ephemeral: true });
      await wipeAllCollections();
      await interaction.editReply("All major collections wiped.");
    } catch (error) {
      logger.error("Failed to wipe collections", error);
      try {
        await interaction.editReply("Failed to wipe collections.");
      } catch {}
    }
  }

  /**
   * /setpermissionrole [action] [role]
   * Grant a role permission for a specific action
   */
  @Slash({ name: "setpermissionrole", description: "Grant a role permission for a specific action" })
  async setPermissionRole(
    @SlashOption({ name: "action", description: "Permission action", required: true, type: 3, autocomplete: true }) action: string,
    @SlashOption({ name: "role", description: "Role to grant permission", required: true, type: 8 }) role: Role,
    interaction: CommandInteraction
  ) {
    if (!(await checkAdminPermission(interaction, "admin"))) return;
    // Validate action
    const { PERMISSION_ACTIONS } = await import("../utils/permissions.js");
    if (!(PERMISSION_ACTIONS as readonly string[]).includes(action)) {
      await interaction.reply({ content: `Invalid action: ${action}`, ephemeral: true });
      return;
    }
    const configDb = new (await import("../mongo/repository/guildConfig.js")).GuildConfigRepository();
    const guildId = interaction.guildId!;
    // Get current roles for this action
    const current = await configDb.getActionRoles(guildId, action);
    // Add the new role if not present
    if (!current.includes(role.id)) current.push(role.id);
    await configDb.setActionRoles(guildId, action, current);
    await interaction.reply({ content: `Granted **${action}** permission to <@&${role.id}>.`, ephemeral: true });
  }
}
