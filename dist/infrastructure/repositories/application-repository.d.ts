import { BaseMongoRepository } from './base-mongo-repository';
import { Application } from '../../validation';
export declare class ApplicationRepository extends BaseMongoRepository<Application> {
    constructor();
    findByApplicantAndJob(applicantId: unknown, jobId: unknown): Promise<Application | null>;
    findByApplicant(applicantId: unknown): Promise<Application[]>;
    findByJob(jobId: unknown): Promise<Application[]>;
    findByStatus(status: unknown): Promise<Application[]>;
    findByGuild(guildId: unknown): Promise<Application[]>;
    findPendingApplications(guildId: unknown): Promise<Application[]>;
    findApplicationsByJobAndStatus(jobId: unknown, status: unknown): Promise<Application[]>;
    hasExistingApplication(applicantId: unknown, jobId: unknown): Promise<boolean>;
}
//# sourceMappingURL=application-repository.d.ts.map