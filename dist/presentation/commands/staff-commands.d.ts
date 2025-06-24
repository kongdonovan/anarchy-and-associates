import { User, CommandInteraction } from 'discord.js';
export declare class StaffCommands {
    private staffRepository;
    private auditLogRepository;
    private guildConfigRepository;
    private staffService;
    private roleSyncService;
    private permissionService;
    constructor();
    private getPermissionContext;
    private createErrorEmbed;
    private createSuccessEmbed;
    private createInfoEmbed;
    hireStaff(user: User, role: string, robloxUsername: string, reason: string, interaction: CommandInteraction): Promise<void>;
    fireStaff(user: User, reason: string, interaction: CommandInteraction): Promise<void>;
    promoteStaff(user: User, role: string, reason: string, interaction: CommandInteraction): Promise<void>;
    demoteStaff(user: User, role: string, reason: string, interaction: CommandInteraction): Promise<void>;
    listStaff(roleFilter: string, interaction: CommandInteraction): Promise<void>;
    staffInfo(user: User, interaction: CommandInteraction): Promise<void>;
}
//# sourceMappingURL=staff-commands.d.ts.map