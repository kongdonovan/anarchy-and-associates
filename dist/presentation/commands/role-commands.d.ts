import { CommandInteraction } from 'discord.js';
export declare class RoleCommands {
    private guildConfigRepository;
    private permissionService;
    private roleTrackingService;
    constructor();
    private getPermissionContext;
    private createErrorEmbed;
    syncRoles(interaction: CommandInteraction): Promise<void>;
    roleStatus(interaction: CommandInteraction): Promise<void>;
}
//# sourceMappingURL=role-commands.d.ts.map