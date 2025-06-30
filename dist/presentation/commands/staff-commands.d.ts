import { User, CommandInteraction, ModalSubmitInteraction } from 'discord.js';
import { PermissionService } from '../../application/services/permission-service';
import { BaseCommand } from './base-command';
export declare class StaffCommands extends BaseCommand {
    private staffRepository;
    private auditLogRepository;
    private guildConfigRepository;
    private staffService;
    private roleSyncService;
    protected permissionService: PermissionService;
    constructor();
    hireStaff(user: User, roleString: string | undefined, discordRole: any, robloxUsername: string, reason: string, interaction: CommandInteraction): Promise<void>;
    /**
     * Perform the actual staff hiring (separated for reuse in bypass flow)
     */
    private performStaffHiring;
    /**
     * Handle guild owner bypass modal submission
     */
    handleRoleLimitBypass(interaction: ModalSubmitInteraction): Promise<void>;
    fireStaff(user: User, reason: string, interaction: CommandInteraction): Promise<void>;
    promoteStaff(user: User, role: string, reason: string, interaction: CommandInteraction): Promise<void>;
    demoteStaff(user: User, role: string, reason: string, interaction: CommandInteraction): Promise<void>;
    listStaff(roleFilter: string, interaction: CommandInteraction): Promise<void>;
    staffInfo(user: User, interaction: CommandInteraction): Promise<void>;
}
//# sourceMappingURL=staff-commands.d.ts.map