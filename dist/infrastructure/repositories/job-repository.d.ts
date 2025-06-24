import { BaseMongoRepository } from './base-mongo-repository';
import { Job } from '../../domain/entities/job';
import { StaffRole } from '../../domain/entities/staff-role';
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
    findByGuildId(guildId: string): Promise<Job[]>;
    findOpenJobs(guildId: string): Promise<Job[]>;
    findJobsByStaffRole(guildId: string, staffRole: StaffRole): Promise<Job[]>;
    searchJobs(guildId: string, filters: JobSearchFilters, page?: number, limit?: number): Promise<JobListResult>;
    createJob(jobData: Omit<Job, '_id' | 'createdAt' | 'updatedAt'>): Promise<Job>;
    updateJob(jobId: string, updates: Partial<Job>): Promise<Job | null>;
    closeJob(guildId: string, jobId: string, closedBy: string, _removeRole?: boolean): Promise<Job | null>;
    removeJob(guildId: string, jobId: string, removedBy: string): Promise<boolean>;
    incrementApplicationCount(jobId: string): Promise<Job | null>;
    incrementHiredCount(jobId: string): Promise<Job | null>;
    getJobStatistics(guildId: string): Promise<{
        totalJobs: number;
        openJobs: number;
        closedJobs: number;
        totalApplications: number;
        totalHired: number;
        jobsByRole: Record<StaffRole, number>;
    }>;
    findJobsNeedingRoleCleanup(guildId: string): Promise<Job[]>;
    markRoleCleanupComplete(jobId: string): Promise<Job | null>;
    getOpenJobsForRole(guildId: string, staffRole: StaffRole): Promise<Job[]>;
}
//# sourceMappingURL=job-repository.d.ts.map