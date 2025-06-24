import { Application } from '../../domain/entities/application';
import { BaseMongoRepository } from './base-mongo-repository';
export declare class ApplicationRepository extends BaseMongoRepository<Application> {
    constructor();
    findByApplicantAndJob(applicantId: string, jobId: string): Promise<Application | null>;
    findByApplicant(applicantId: string): Promise<Application[]>;
    findByJob(jobId: string): Promise<Application[]>;
    findByStatus(status: Application['status']): Promise<Application[]>;
    findByGuild(guildId: string): Promise<Application[]>;
    findPendingApplications(guildId: string): Promise<Application[]>;
    findApplicationsByJobAndStatus(jobId: string, status: Application['status']): Promise<Application[]>;
    hasExistingApplication(applicantId: string, jobId: string): Promise<boolean>;
}
//# sourceMappingURL=application-repository.d.ts.map