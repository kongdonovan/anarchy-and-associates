import { Guild } from 'discord.js';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
export interface CleanupResult {
    success: boolean;
    jobsProcessed: number;
    rolesRemoved: number;
    errors: string[];
}
export interface CleanupJob {
    id: string;
    title: string;
    roleId: string;
    closedAt?: Date;
    closedBy?: string;
}
export declare class JobCleanupService {
    private jobRepository;
    private auditLogRepository;
    constructor(jobRepository: JobRepository, auditLogRepository: AuditLogRepository);
    findJobsNeedingCleanup(guildId: string): Promise<CleanupJob[]>;
    cleanupJobRoles(guild: Guild, dryRun?: boolean): Promise<CleanupResult>;
    private canDeleteRole;
    scheduleAutomaticCleanup(guild: Guild, intervalHours?: number): Promise<void>;
    cleanupExpiredJobs(guildId: string, maxDaysOpen?: number, dryRun?: boolean): Promise<CleanupResult>;
    getCleanupReport(guildId: string): Promise<{
        jobsNeedingCleanup: CleanupJob[];
        expiredJobsCount: number;
        totalOpenJobs: number;
        oldestOpenJob?: {
            title: string;
            daysOpen: number;
        };
    }>;
}
//# sourceMappingURL=job-cleanup-service.d.ts.map