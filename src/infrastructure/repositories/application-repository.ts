import { Application } from '../../domain/entities/application';
import { BaseMongoRepository } from './base-mongo-repository';

export class ApplicationRepository extends BaseMongoRepository<Application> {
  constructor() {
    super('applications');
  }

  public async findByApplicantAndJob(applicantId: string, jobId: string): Promise<Application | null> {
    return this.findOne({ applicantId, jobId });
  }

  public async findByApplicant(applicantId: string): Promise<Application[]> {
    return this.findByFilters({ applicantId });
  }

  public async findByJob(jobId: string): Promise<Application[]> {
    return this.findByFilters({ jobId });
  }

  public async findByStatus(status: Application['status']): Promise<Application[]> {
    return this.findByFilters({ status });
  }

  public async findByGuild(guildId: string): Promise<Application[]> {
    return this.findByFilters({ guildId });
  }

  public async findPendingApplications(guildId: string): Promise<Application[]> {
    return this.findByFilters({ guildId, status: 'pending' });
  }

  public async findApplicationsByJobAndStatus(jobId: string, status: Application['status']): Promise<Application[]> {
    return this.findByFilters({ jobId, status });
  }

  public async hasExistingApplication(applicantId: string, jobId: string): Promise<boolean> {
    const existing = await this.findByApplicantAndJob(applicantId, jobId);
    return existing !== null;
  }
}