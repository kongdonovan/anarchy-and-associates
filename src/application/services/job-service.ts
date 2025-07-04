import { JobRepository, JobSearchFilters, JobListResult } from '../../infrastructure/repositories/job-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { DEFAULT_JOB_QUESTIONS } from '../../domain/entities/job'; // Keep constants
import { RoleUtils } from '../../domain/entities/staff-role'; // Keep utility functions
import { Job, JobQuestion, StaffRole } from '../../validation';
import { PermissionService, PermissionContext } from './permission-service';
import { logger } from '../../infrastructure/logger';
import {
  JobPostRequestSchema,
  JobCloseRequestSchema,
  JobOperationResultSchema,
  ValidationHelpers
} from '../../validation';

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

export class JobService {
  private jobRepository: JobRepository;
  private permissionService: PermissionService;

  constructor(
    jobRepository: JobRepository,
    _auditLogRepository: any, // Keep for compatibility but unused
    _staffRepository: StaffRepository, // Future use for staff validation
    permissionService: PermissionService
  ) {
    this.jobRepository = jobRepository;
    this.permissionService = permissionService;
    // _staffRepository reserved for future use
  }

  public async createJob(context: PermissionContext, request: unknown): Promise<{ success: boolean; job?: Job; error?: string }> {
    try {
      // Validate input using Zod schema
      const validatedRequest = ValidationHelpers.validateOrThrow(
        JobPostRequestSchema,
        request,
        'Job creation request'
      );

      // Check HR permission for creating jobs
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to create job postings',
        };
      }

      const { guildId, title, description, roleId, questions: customQuestions, postedBy } = validatedRequest;
      
      // Extract staffRole - it can be either StaffRole or string in the schema
      const staffRole = validatedRequest.staffRole as StaffRole;

      // Validate staff role
      if (!RoleUtils.isValidRole(staffRole)) {
        return {
          success: false,
          error: 'Invalid staff role',
        };
      }

      // Get role limit from hierarchy
      const roleLimit = RoleUtils.getRoleMaxCount(staffRole);

      // Check if there's already an open job for this role
      const existingJobs = await this.jobRepository.getOpenJobsForRole(guildId, staffRole);
      if (existingJobs.length > 0) {
        return {
          success: false,
          error: `There is already an open job posting for ${staffRole}. Close the existing job before creating a new one.`,
        };
      }

      // Validate custom questions
      const questions = customQuestions || [];
      const allQuestions = [...DEFAULT_JOB_QUESTIONS, ...questions];

      const questionValidation = this.validateJobQuestions(allQuestions);
      if (!questionValidation.valid) {
        return {
          success: false,
          error: questionValidation.error,
        };
      }

      // Create job
      const jobData: Omit<Job, '_id' | 'createdAt' | 'updatedAt'> = {
        guildId,
        title,
        description,
        staffRole,
        roleId,
        limit: roleLimit,
        isOpen: true,
        questions: allQuestions,
        postedBy,
        applicationCount: 0,
        hiredCount: 0,
      };

      const job = await this.jobRepository.createJob(jobData);



      logger.info(`Job created: ${title} for ${staffRole} by ${postedBy} in guild ${guildId}`);

      // Validate output
      const result = {
        success: true,
        job,
      };

      return ValidationHelpers.validateOrThrow(
        JobOperationResultSchema,
        result,
        'Job creation result'
      );
    } catch (error) {
      logger.error('Error creating job:', error);
      
      // If it's a validation error, let it propagate
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      
      return {
        success: false,
        error: 'Failed to create job',
      };
    }
  }

  public async updateJob(
    context: PermissionContext,
    jobId: string,
    updates: JobUpdateRequest
  ): Promise<{ success: boolean; job?: Job; error?: string }> {
    try {
      // Check HR permission for updating jobs
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to update job postings',
        };
      }
      const existingJob = await this.jobRepository.findById(jobId);
      if (!existingJob || existingJob.guildId !== context.guildId) {
        return {
          success: false,
          error: 'Job not found',
        };
      }

      // Validate staff role if being updated
      if (updates.staffRole && !RoleUtils.isValidRole(updates.staffRole)) {
        return {
          success: false,
          error: 'Invalid staff role',
        };
      }

      // If changing staff role, check for conflicts
      if (updates.staffRole && updates.staffRole !== existingJob.staffRole) {
        const existingJobs = await this.jobRepository.getOpenJobsForRole(context.guildId, updates.staffRole);
        if (existingJobs.some(job => job._id !== jobId)) {
          return {
            success: false,
            error: `There is already an open job posting for ${updates.staffRole}`,
          };
        }

        // Update role limit if role changed
        updates.limit = RoleUtils.getRoleMaxCount(updates.staffRole);
      }

      // Validate custom questions if provided
      if (updates.customQuestions) {
        const allQuestions = [...DEFAULT_JOB_QUESTIONS, ...updates.customQuestions];
        const questionValidation = this.validateJobQuestions(allQuestions);
        if (!questionValidation.valid) {
          return {
            success: false,
            error: questionValidation.error,
          };
        }
        updates.questions = allQuestions;
        delete updates.customQuestions; // Remove this field as it's not part of the Job interface
      }

      const updatedJob = await this.jobRepository.updateJob(jobId, updates);
      if (!updatedJob) {
        return {
          success: false,
          error: 'Failed to update job',
        };
      }



      logger.info(`Job updated: ${updatedJob.title} (${jobId}) by ${context.userId} in guild ${context.guildId}`);

      return {
        success: true,
        job: updatedJob,
      };
    } catch (error) {
      logger.error('Error updating job:', error);
      return {
        success: false,
        error: 'Failed to update job',
      };
    }
  }

  public async closeJob(
    context: PermissionContext,
    request: unknown
  ): Promise<{ success: boolean; job?: Job; error?: string }> {
    try {
      // Validate input using Zod schema
      const validatedRequest = ValidationHelpers.validateOrThrow(
        JobCloseRequestSchema,
        request,
        'Job close request'
      );

      // Check HR permission for closing jobs
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to close job postings',
        };
      }
      
      const { jobId, closedBy } = validatedRequest;
      
      const job = await this.jobRepository.closeJob(context.guildId, jobId, closedBy);
      if (!job) {
        return {
          success: false,
          error: 'Job not found or already closed',
        };
      }



      logger.info(`Job closed: ${job.title} (${jobId}) by ${closedBy} in guild ${context.guildId}`);

      // Validate output
      const result = {
        success: true,
        job,
      };

      return ValidationHelpers.validateOrThrow(
        JobOperationResultSchema,
        result,
        'Job close result'
      );
    } catch (error) {
      logger.error('Error closing job:', error);
      
      // If it's a validation error, let it propagate
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      
      return {
        success: false,
        error: 'Failed to close job',
      };
    }
  }

  public async removeJob(
    context: PermissionContext,
    jobId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check HR permission for removing jobs
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to remove job postings',
        };
      }
      const job = await this.jobRepository.findById(jobId);
      if (!job || job.guildId !== context.guildId) {
        return {
          success: false,
          error: 'Job not found',
        };
      }

      const deleted = await this.jobRepository.removeJob(context.guildId, jobId, context.userId);
      if (!deleted) {
        return {
          success: false,
          error: 'Failed to remove job',
        };
      }



      logger.info(`Job removed: ${job.title} (${jobId}) by ${context.userId} in guild ${context.guildId}`);

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Error removing job:', error);
      return {
        success: false,
        error: 'Failed to remove job',
      };
    }
  }

  public async listJobs(
    context: PermissionContext,
    filters: JobSearchFilters,
    page: number = 1
  ): Promise<JobListResult> {
    try {
      // Check HR permission for listing jobs
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        throw new Error('You do not have permission to view job listings');
      }
      const result = await this.jobRepository.searchJobs(context.guildId, filters, page, 5);



      return result;
    } catch (error) {
      logger.error('Error listing jobs:', error);
      throw error;
    }
  }

  public async getJobDetails(context: PermissionContext, jobId: string): Promise<Job | null> {
    try {
      // Check HR permission for viewing job details
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        throw new Error('You do not have permission to view job details');
      }
      const job = await this.jobRepository.findById(jobId);
      if (!job || job.guildId !== context.guildId) {
        return null;
      }



      return job;
    } catch (error) {
      logger.error('Error getting job details:', error);
      throw error;
    }
  }

  public async getJobStatistics(context: PermissionContext): Promise<{
    totalJobs: number;
    openJobs: number;
    closedJobs: number;
    totalApplications: number;
    totalHired: number;
    jobsByRole: Record<StaffRole, number>;
  }> {
    try {
      // Check HR permission for viewing job statistics
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        throw new Error('You do not have permission to view job statistics');
      }

      return await this.jobRepository.getJobStatistics(context.guildId);
    } catch (error) {
      logger.error('Error getting job statistics:', error);
      throw error;
    }
  }

  private validateJobQuestions(questions: JobQuestion[]): { valid: boolean; error?: string } {
    try {
      for (const question of questions) {
        // Check required fields
        if (!question.id || !question.question || !question.type) {
          return {
            valid: false,
            error: 'Questions must have id, question, and type fields',
          };
        }

        // Validate question types
        if (!['short', 'paragraph', 'number', 'choice'].includes(question.type)) {
          return {
            valid: false,
            error: `Invalid question type: ${question.type}`,
          };
        }

        // Validate choice questions have choices
        if (question.type === 'choice' && (!question.choices || question.choices.length === 0)) {
          return {
            valid: false,
            error: 'Choice questions must have at least one choice option',
          };
        }

        // Validate number constraints
        if (question.type === 'number') {
          if (question.minValue !== undefined && question.maxValue !== undefined) {
            if (question.minValue >= question.maxValue) {
              return {
                valid: false,
                error: 'minValue must be less than maxValue for number questions',
              };
            }
          }
        }

        // Validate text length constraints
        if ((question.type === 'short' || question.type === 'paragraph') && question.maxLength) {
          if (question.maxLength <= 0) {
            return {
              valid: false,
              error: 'maxLength must be greater than 0 for text questions',
            };
          }
        }
      }

      // Check for duplicate question IDs
      const questionIds = questions.map(q => q.id);
      const uniqueIds = new Set(questionIds);
      if (questionIds.length !== uniqueIds.size) {
        return {
          valid: false,
          error: 'Question IDs must be unique',
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Error validating job questions:', error);
      return {
        valid: false,
        error: 'Failed to validate questions',
      };
    }
  }
}