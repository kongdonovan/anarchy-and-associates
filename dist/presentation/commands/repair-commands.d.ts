import { CommandInteraction } from 'discord.js';
export declare class RepairCommands {
    private repairService;
    private permissionService;
    private guildConfigRepository;
    private orphanedChannelCleanupService;
    private crossEntityValidationService;
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
    scanOrphanedChannels(interaction: CommandInteraction): Promise<void>;
    cleanupOrphanedChannels(dryRun: boolean | undefined, archiveOnly: boolean | undefined, interaction: CommandInteraction): Promise<void>;
    configureAutoCleanup(enabled: boolean, interaction: CommandInteraction): Promise<void>;
    integrityCheck(interaction: CommandInteraction, autoRepair?: boolean): Promise<void>;
    private createIntegrityReportEmbed;
    private createValidationRepairResultEmbed;
}
//# sourceMappingURL=repair-commands.d.ts.map