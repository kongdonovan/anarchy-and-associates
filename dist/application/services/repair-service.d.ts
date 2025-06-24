import { Guild } from 'discord.js';
export interface RepairResult {
    success: boolean;
    message: string;
    changes: string[];
    errors: string[];
}
export interface HealthCheckResult {
    healthy: boolean;
    issues: string[];
    checks: {
        database: boolean;
        channels: boolean;
        permissions: boolean;
        botPermissions: boolean;
    };
}
export declare class RepairService {
    private staffRepository;
    private jobRepository;
    private applicationRepository;
    private caseRepository;
    private guildConfigRepository;
    constructor();
    repairStaffRoles(guild: Guild, dryRun?: boolean): Promise<RepairResult>;
    repairJobRoles(guild: Guild, dryRun?: boolean): Promise<RepairResult>;
    repairChannels(guild: Guild, dryRun?: boolean): Promise<RepairResult>;
    repairConfig(guild: Guild, dryRun?: boolean): Promise<RepairResult>;
    repairOrphaned(guild: Guild, dryRun?: boolean): Promise<RepairResult>;
    repairDbIndexes(guild: Guild, dryRun?: boolean): Promise<RepairResult>;
    repairAll(guild: Guild, dryRun?: boolean): Promise<RepairResult>;
    performHealthCheck(guild: Guild): Promise<HealthCheckResult>;
}
//# sourceMappingURL=repair-service.d.ts.map