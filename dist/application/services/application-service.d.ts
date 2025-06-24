import { Application, ApplicationAnswer } from '../../domain/entities/application';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { RobloxService } from '../../infrastructure/external/roblox-service';
export interface ApplicationSubmissionRequest {
    guildId: string;
    jobId: string;
    applicantId: string;
    robloxUsername: string;
    answers: ApplicationAnswer[];
}
export interface ApplicationReviewRequest {
    applicationId: string;
    reviewerId: string;
    approved: boolean;
    reason?: string;
}
export interface ApplicationValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export declare class ApplicationService {
    private applicationRepository;
    private jobRepository;
    private staffRepository;
    private robloxService;
    constructor(applicationRepository: ApplicationRepository, jobRepository: JobRepository, staffRepository: StaffRepository, robloxService: RobloxService);
    submitApplication(request: ApplicationSubmissionRequest): Promise<Application>;
    reviewApplication(request: ApplicationReviewRequest): Promise<Application>;
    validateApplication(request: ApplicationSubmissionRequest): Promise<ApplicationValidationResult>;
    getApplicationById(id: string): Promise<Application | null>;
    getApplicationsByJob(jobId: string): Promise<Application[]>;
    getApplicationsByApplicant(applicantId: string): Promise<Application[]>;
    getPendingApplications(guildId: string): Promise<Application[]>;
    getApplicationStats(guildId: string): Promise<{
        total: number;
        pending: number;
        accepted: number;
        rejected: number;
    }>;
    generateApplicationId(): string;
}
//# sourceMappingURL=application-service.d.ts.map