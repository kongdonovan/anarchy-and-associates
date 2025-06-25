"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionUtils = void 0;
/**
 * Utility class for handling permission-related operations consistently across commands
 */
class PermissionUtils {
    /**
     * Create a properly populated PermissionContext from a Discord interaction
     * This ensures consistent population of user roles and guild owner status
     */
    static createPermissionContext(interaction) {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const userRoles = member?.roles.cache.map(role => role.id) || [];
        const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;
        return {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            userRoles,
            isGuildOwner,
        };
    }
}
exports.PermissionUtils = PermissionUtils;
//# sourceMappingURL=permission-utils.js.map