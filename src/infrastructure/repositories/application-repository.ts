import { BaseMongoRepository } from './base-mongo-repository';
import {
  Application,
  ValidationHelpers,
  DiscordSnowflakeSchema,
  ApplicationStatusSchema,
  z
} from '../../validation';

export class ApplicationRepository extends BaseMongoRepository<Application> {
  constructor() {
    super('applications');
  }

  public async findByApplicantAndJob(applicantId: unknown, jobId: unknown): Promise<Application | null> {
    const validatedApplicantId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      applicantId,
      'Applicant ID'
    );
    const validatedJobId = ValidationHelpers.validateOrThrow(
      z.string(),
      jobId,
      'Job ID'
    );
    return this.findOne({ applicantId: validatedApplicantId, jobId: validatedJobId });
  }

  public async findByApplicant(applicantId: unknown): Promise<Application[]> {
    const validatedApplicantId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      applicantId,
      'Applicant ID'
    );
    return this.findByFilters({ applicantId: validatedApplicantId });
  }

  public async findByJob(jobId: unknown): Promise<Application[]> {
    const validatedJobId = ValidationHelpers.validateOrThrow(
      z.string(),
      jobId,
      'Job ID'
    );
    return this.findByFilters({ jobId: validatedJobId });
  }

  public async findByStatus(status: unknown): Promise<Application[]> {
    const validatedStatus = ValidationHelpers.validateOrThrow(
      ApplicationStatusSchema,
      status,
      'Application status'
    );
    return this.findByFilters({ status: validatedStatus as Application['status'] });
  }

  public async findByGuild(guildId: unknown): Promise<Application[]> {
    const validatedGuildId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      guildId,
      'Guild ID'
    );
    return this.findByFilters({ guildId: validatedGuildId });
  }

  public async findPendingApplications(guildId: unknown): Promise<Application[]> {
    const validatedGuildId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      guildId,
      'Guild ID'
    );
    return this.findByFilters({ guildId: validatedGuildId, status: 'pending' });
  }

  public async findApplicationsByJobAndStatus(jobId: unknown, status: unknown): Promise<Application[]> {
    const validatedJobId = ValidationHelpers.validateOrThrow(
      z.string(),
      jobId,
      'Job ID'
    );
    const validatedStatus = ValidationHelpers.validateOrThrow(
      ApplicationStatusSchema,
      status,
      'Application status'
    );
    return this.findByFilters({ jobId: validatedJobId, status: validatedStatus as Application['status'] });
  }

  public async hasExistingApplication(applicantId: unknown, jobId: unknown): Promise<boolean> {
    const existing = await this.findByApplicantAndJob(applicantId, jobId);
    return existing !== null;
  }
}