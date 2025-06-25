import { CommandInteraction } from 'discord.js';
import { PermissionContext } from '../../application/services/permission-service';

/**
 * Utility class for handling permission-related operations consistently across commands
 */
export class PermissionUtils {
  /**
   * Create a properly populated PermissionContext from a Discord interaction
   * This ensures consistent population of user roles and guild owner status
   */
  static createPermissionContext(interaction: CommandInteraction): PermissionContext {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const userRoles = member?.roles.cache.map(role => role.id) || [];
    const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;

    return {
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      userRoles,
      isGuildOwner,
    };
  }
}