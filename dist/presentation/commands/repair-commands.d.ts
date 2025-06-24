import { CommandInteraction } from 'discord.js';
export declare class RepairCommands {
    private repairService;
    private permissionService;
    private guildConfigRepository;
    constructor();
    private getPermissionContext;
    private checkAdminPermission;
    private createRepairResultEmbed;
    private createHealthCheckEmbed;
    repairStaffRoles(dryRun: boolean | undefined, interaction: CommandInteraction): Promise<void>;
    repairJobRoles(dryRun: boolean | undefined, interaction: CommandInteraction): Promise<void>;
    repairChannels(dryRun: boolean | undefined, interaction: CommandInteraction): Promise<void>;
    repairConfig(dryRun: boolean | undefined, interaction: CommandInteraction): Promise<void>;
    repairOrphaned(dryRun: boolean | undefined, interaction: CommandInteraction): Promise<void>;
    repairDbIndexes(dryRun: boolean | undefined, interaction: CommandInteraction): Promise<void>;
    repairAll(dryRun: boolean | undefined, interaction: CommandInteraction): Promise<void>;
    repairHealth(interaction: CommandInteraction): Promise<void>;
}
//# sourceMappingURL=repair-commands.d.ts.map