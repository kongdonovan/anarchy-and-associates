import { BaseMongoRepository } from './base-mongo-repository';
import { Job, StaffRole } from '../../validation';
export interface JobSearchFilters {
    isOpen?: boolean;
    staffRole?: StaffRole;
    searchTerm?: string;
    postedBy?: string;
}
export interface JobListResult {
    jobs: Job[];
    total: number;
    totalPages: number;
    currentPage: number;
}
export declare class JobRepository extends BaseMongoRepository<Job> {
    constructor();
    findByGuildId(guildId: unknown): Promise<Job[]>;
    findOpenJobs(guildId: unknown): Promise<Job[]>;
    findJobsByStaffRole(guildId: unknown, staffRole: unknown): Promise<Job[]>;
    searchJobs(guildId: unknown, filters: unknown, page?: unknown, limit?: unknown): Promise<JobListResult>;
    createJob(jobData: unknown): Promise<Job>;
    updateJob(jobId: unknown, updates: unknown): Promise<Job | null>;
    closeJob(guildId: unknown, jobId: unknown, closedBy: unknown, _removeRole?: unknown): Promise<Job | null>;
    removeJob(guildId: unknown, jobId: unknown, removedBy: unknown): Promise<boolean>;
    incrementApplicationCount(jobId: unknown): Promise<Job | null>;
    incrementHiredCount(jobId: unknown): Promise<Job | null>;
    getJobStatistics(guildId: unknown): Promise<{
        totalJobs: number;
        openJobs: number;
        closedJobs: number;
        totalApplications: number;
        totalHired: number;
        jobsByRole: Record<StaffRole, number>;
    }>;
    findJobsNeedingRoleCleanup(guildId: unknown): Promise<Job[]>;
    markRoleCleanupComplete(jobId: unknown): Promise<Job | null>;
    getOpenJobsForRole(guildId: unknown, staffRole: unknown): Promise<Job[]>;
}
//# sourceMappingURL=job-repository.d.ts.map