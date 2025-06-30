import { randomUUID } from 'crypto';
import { Application, ApplicationAnswer } from '../../validation';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { RobloxService } from '../../infrastructure/external/roblox-service';
import { PermissionService, PermissionContext } from './permission-service';
import { logger } from '../../infrastructure/logger';
import {
  ApplicationSubmitRequestSchema,
  ApplicationReviewRequestSchema,
  ValidationHelpers
} from '../../validation';

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

export class ApplicationService {
  constructor(
    private applicationRepository: ApplicationRepository,
    private jobRepository: JobRepository,
    private staffRepository: StaffRepository,
    private robloxService: RobloxService,
    private permissionService: PermissionService
  ) {}

  public async submitApplication(request: unknown): Promise<Application> {
    // Validate input using Zod schema
    const validatedRequest = ValidationHelpers.validateOrThrow(
      ApplicationSubmitRequestSchema,
      request,
      'Application submission request'
    );

    logger.info('Submitting application', { 
      guildId: validatedRequest.guildId, 
      jobId: validatedRequest.jobId, 
      applicantId: validatedRequest.applicantId 
    });

    // Validate the application
    const validation = await this.validateApplication(validatedRequest as ApplicationSubmissionRequest);
    if (!validation.isValid) {
      throw new Error(`Application validation failed: ${validation.errors.join(', ')}`);
    }

    // Create the application
    const application: Omit<Application, '_id' | 'createdAt' | 'updatedAt'> = {
      guildId: validatedRequest.guildId,
      jobId: validatedRequest.jobId.toString(),
      applicantId: validatedRequest.applicantId,
      robloxUsername: validatedRequest.robloxUsername,
      answers: validatedRequest.answers,
      status: 'pending'
    };

    const createdApplication = await this.applicationRepository.add(application);
    
    logger.info('Application submitted successfully', { 
      applicationId: createdApplication._id,
      applicantId: validatedRequest.applicantId,
      jobId: validatedRequest.jobId
    });

    return createdApplication;
  }

  public async reviewApplication(context: PermissionContext, request: unknown): Promise<Application> {
    // Validate input using Zod schema
    const validatedRequest = ValidationHelpers.validateOrThrow(
      ApplicationReviewRequestSchema,
      request,
      'Application review request'
    );

    // Check HR permission for reviewing applications
    const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to review applications');
    }

    logger.info('Reviewing application', { 
      applicationId: validatedRequest.applicationId, 
      reviewerId: validatedRequest.reviewedBy,
      decision: validatedRequest.decision
    });

    const application = await this.applicationRepository.findById(validatedRequest.applicationId.toString());
    if (!application) {
      throw new Error('Application not found');
    }

    if (application.status !== 'pending') {
      throw new Error(`Application is already ${application.status}`);
    }

    const updatedApplication = await this.applicationRepository.update(validatedRequest.applicationId.toString(), {
      status: validatedRequest.decision,
      reviewedBy: validatedRequest.reviewedBy,
      reviewedAt: new Date(),
      reviewReason: validatedRequest.reason
    });

    if (!updatedApplication) {
      throw new Error('Failed to update application');
    }

    logger.info('Application reviewed successfully', { 
      applicationId: validatedRequest.applicationId,
      status: updatedApplication.status,
      reviewerId: validatedRequest.reviewedBy
    });

    return updatedApplication;
  }

  public async validateApplication(request: ApplicationSubmissionRequest): Promise<ApplicationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if job exists and is open
    const job = await this.jobRepository.findById(request.jobId);
    if (!job) {
      errors.push('Job not found');
    } else if (!job.isOpen) {
      errors.push('Job is not open for applications');
    }

    // Check if applicant is active staff (inactive staff can still apply)
    const existingStaff = await this.staffRepository.findByUserId(request.guildId, request.applicantId);
    if (existingStaff && existingStaff.status === 'active') {
      errors.push('Active staff members cannot apply for positions');
    }

    // Validate Roblox username (optional - continues if fails)
    try {
      const robloxValidation = await this.robloxService.validateUsername(request.robloxUsername);
      if (!robloxValidation.isValid) {
        warnings.push(`Roblox validation warning: ${robloxValidation.error}`);
      }
    } catch (error) {
      logger.warn('Roblox validation failed, continuing without validation', { 
        username: request.robloxUsername,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      warnings.push('Could not validate Roblox username - please ensure it is correct');
    }

    // Validate answers
    if (!request.answers || request.answers.length === 0) {
      errors.push('Application answers are required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public async getApplicationById(context: PermissionContext, id: string): Promise<Application | null> {
    // Check HR permission for viewing applications
    const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to view applications');
    }

    return this.applicationRepository.findById(id);
  }

  public async getApplicationsByJob(context: PermissionContext, jobId: string): Promise<Application[]> {
    // Check HR permission for viewing job applications
    const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to view job applications');
    }

    return this.applicationRepository.findByJob(jobId);
  }

  public async getApplicationsByApplicant(context: PermissionContext, applicantId: string): Promise<Application[]> {
    // Users can view their own applications, or HR can view any applications
    const isOwnApplications = context.userId === applicantId;
    const hasHRPermission = await this.permissionService.hasHRPermissionWithContext(context);
    
    if (!isOwnApplications && !hasHRPermission) {
      throw new Error('You do not have permission to view these applications');
    }

    return this.applicationRepository.findByApplicant(applicantId);
  }

  public async getPendingApplications(context: PermissionContext): Promise<Application[]> {
    // Check HR permission for viewing pending applications
    const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to view pending applications');
    }

    return this.applicationRepository.findPendingApplications(context.guildId);
  }

  public async getApplicationStats(context: PermissionContext): Promise<{
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  }> {
    // Check HR permission for viewing application statistics
    const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to view application statistics');
    }

    const allApplications = await this.applicationRepository.findByGuild(context.guildId);
    
    return {
      total: allApplications.length,
      pending: allApplications.filter(app => app.status === 'pending').length,
      accepted: allApplications.filter(app => app.status === 'accepted').length,
      rejected: allApplications.filter(app => app.status === 'rejected').length
    };
  }

  public generateApplicationId(): string {
    return randomUUID();
  }
}