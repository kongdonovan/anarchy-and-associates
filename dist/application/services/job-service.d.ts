import { JobRepository, JobSearchFilters, JobListResult } from '../../infrastructure/repositories/job-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { Job, JobQuestion } from '../../domain/entities/job';
import { StaffRole } from '../../domain/entities/staff-role';
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
    private auditLogRepository;
    constructor(jobRepository: JobRepository, auditLogRepository: AuditLogRepository, _staffRepository: StaffRepository);
    createJob(request: JobCreateRequest): Promise<{
        success: boolean;
        job?: Job;
        error?: string;
    }>;
    updateJob(guildId: string, jobId: string, updates: JobUpdateRequest, updatedBy: string): Promise<{
        success: boolean;
        job?: Job;
        error?: string;
    }>;
    closeJob(guildId: string, jobId: string, closedBy: string): Promise<{
        success: boolean;
        job?: Job;
        error?: string;
    }>;
    removeJob(guildId: string, jobId: string, removedBy: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    listJobs(guildId: string, filters: JobSearchFilters, page: number | undefined, requestedBy: string): Promise<JobListResult>;
    getJobDetails(guildId: string, jobId: string, requestedBy: string): Promise<Job | null>;
    getJobStatistics(guildId: string): Promise<{
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