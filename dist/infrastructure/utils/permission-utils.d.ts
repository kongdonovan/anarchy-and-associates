import { CommandInteraction } from 'discord.js';
import { PermissionContext } from '../../application/services/permission-service';
/**
 * Utility class for handling permission-related operations consistently across commands
 */
export declare class PermissionUtils {
    /**
     * Create a properly populated PermissionContext from a Discord interaction
     * This ensures consistent population of user roles and guild owner status
     */
    static createPermissionContext(interaction: CommandInteraction): PermissionContext;
}
//# sourceMappingURL=permission-utils.d.ts.map