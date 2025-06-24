import { Guild } from 'discord.js';
import { StaffRole } from '../../domain/entities/staff-role';
export interface BotMetrics {
    uptime: {
        duration: string;
        startTime: Date;
    };
    database: {
        totalStaff: number;
        activeStaff: number;
        totalCases: number;
        openCases: number;
        totalApplications: number;
        pendingApplications: number;
        totalJobs: number;
        openJobs: number;
        totalRetainers: number;
        totalFeedback: number;
    };
    discord: {
        memberCount: number;
        channelCount: number;
        roleCount: number;
    };
    performance: {
        memoryUsage?: NodeJS.MemoryUsage;
        commandsExecuted?: number;
    };
}
export interface LawyerStats {
    userId: string;
    username?: string;
    displayName?: string;
    role: StaffRole;
    stats: {
        totalCases: number;
        wonCases: number;
        lostCases: number;
        settledCases: number;
        otherCases: number;
        winRate: number;
        averageCaseDuration?: number;
        feedbackCount: number;
        averageRating?: number;
    };
}
export interface AllLawyerStats {
    totalLawyers: number;
    stats: LawyerStats[];
    summary: {
        totalCases: number;
        overallWinRate: number;
        averageCaseDuration: number;
        topPerformer?: LawyerStats;
    };
}
export declare class MetricsService {
    private staffRepository;
    private jobRepository;
    private applicationRepository;
    private caseRepository;
    private feedbackRepository;
    private retainerRepository;
    private botStartTime;
    constructor();
    setBotStartTime(startTime: Date): void;
    getBotMetrics(guild: Guild): Promise<BotMetrics>;
    getLawyerStats(guild: Guild, userId?: string): Promise<LawyerStats | AllLawyerStats>;
    private getSingleLawyerStats;
    private getAllLawyerStats;
    private calculateCaseStats;
    private formatDuration;
    formatBytes(bytes: number): string;
}
//# sourceMappingURL=metrics-service.d.ts.map