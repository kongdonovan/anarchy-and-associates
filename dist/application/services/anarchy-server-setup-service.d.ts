import { Guild } from 'discord.js';
import { AnarchyServerConfig } from '../../config/server-setup.config';
export interface AnarchySetupResult {
    success: boolean;
    message: string;
    created: {
        roles: string[];
        channels: string[];
        categories: string[];
        jobs: number;
    };
    wiped: {
        collections: string[];
        channels: number;
        roles: number;
    };
    errors: string[];
}
export declare class AnarchyServerSetupService {
    private guildConfigRepository;
    private staffRepository;
    private jobRepository;
    private applicationRepository;
    private caseRepository;
    private feedbackRepository;
    private retainerRepository;
    private reminderRepository;
    private auditLogRepository;
    private caseCounterRepository;
    constructor();
    setupAnarchyServer(guild: Guild, customConfig?: AnarchyServerConfig): Promise<AnarchySetupResult>;
    private wipeServer;
    private parseColor;
    private getCategoryPermissions;
    private getChannelPermissions;
    private setupGuildConfig;
    private setupRolePermissions;
}
//# sourceMappingURL=anarchy-server-setup-service.d.ts.map