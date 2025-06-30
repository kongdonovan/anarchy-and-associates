import { JobRepository, JobSearchFilters, JobListResult } from '../../infrastructure/repositories/job-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { Job, JobQuestion, StaffRole } from '../../validation';
import { PermissionService, PermissionContext } from './permission-service';
export interface JobCreateRequest {
    guildId: string;
    title: string;
    description: string;
    staffRole: StaffRole;
    roleId: string;
    customQuestions?: JobQuestion[];
    postedBy: string;
}
export interface JobUpdateRequest {
    title?: string;
    description?: string;
    staffRole?: StaffRole;
    roleId?: string;
    isOpen?: boolean;
    customQuestions?: JobQuestion[];
    limit?: number;
    questions?: JobQuestion[];
}
export declare class JobService {
    private jobRepository;
    private permissionService;
    constructor(jobRepository: JobRepository, _auditLogRepository: any, // Keep for compatibility but unused
    _staffRepository: StaffRepository, // Future use for staff validation
    permissionService: PermissionService);
    createJob(context: PermissionContext, request: unknown): Promise<{
        success: boolean;
        job?: Job;
        error?: string;
    }>;
    updateJob(context: PermissionContext, jobId: string, updates: JobUpdateRequest): Promise<{
        success: boolean;
        job?: Job;
        error?: string;
    }>;
    closeJob(context: PermissionContext, request: unknown): Promise<{
        success: boolean;
        job?: Job;
        error?: string;
    }>;
    removeJob(context: PermissionContext, jobId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    listJobs(context: PermissionContext, filters: JobSearchFilters, page?: number): Promise<JobListResult>;
    getJobDetails(context: PermissionContext, jobId: string): Promise<Job | null>;
    getJobStatistics(context: PermissionContext): Promise<{
        totalJobs: number;
        openJobs: number;
        closedJobs: number;
        totalApplications: number;
        totalHired: number;
        jobsByRole: Record<StaffRole, number>;
    }>;
    private validateJobQuestions;
}
//# sourceMappingURL=job-service.d.ts.map