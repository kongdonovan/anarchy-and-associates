"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobService = void 0;
const job_1 = require("../../domain/entities/job"); // Keep constants
const staff_role_1 = require("../../domain/entities/staff-role"); // Keep utility functions
const logger_1 = require("../../infrastructure/logger");
const validation_1 = require("../../validation");
class JobService {
    constructor(jobRepository, _auditLogRepository, // Keep for compatibility but unused
    _staffRepository, // Future use for staff validation
    permissionService) {
        this.jobRepository = jobRepository;
        this.permissionService = permissionService;
        // _staffRepository reserved for future use
    }
    async createJob(context, request) {
        try {
            // Validate input using Zod schema
            const validatedRequest = validation_1.ValidationHelpers.validateOrThrow(validation_1.JobPostRequestSchema, request, 'Job creation request');
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
            const staffRole = validatedRequest.staffRole;
            // Validate staff role
            if (!staff_role_1.RoleUtils.isValidRole(staffRole)) {
                return {
                    success: false,
                    error: 'Invalid staff role',
                };
            }
            // Get role limit from hierarchy
            const roleLimit = staff_role_1.RoleUtils.getRoleMaxCount(staffRole);
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
            const allQuestions = [...job_1.DEFAULT_JOB_QUESTIONS, ...questions];
            const questionValidation = this.validateJobQuestions(allQuestions);
            if (!questionValidation.valid) {
                return {
                    success: false,
                    error: questionValidation.error,
                };
            }
            // Create job
            const jobData = {
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
            logger_1.logger.info(`Job created: ${title} for ${staffRole} by ${postedBy} in guild ${guildId}`);
            // Validate output
            const result = {
                success: true,
                job,
            };
            return validation_1.ValidationHelpers.validateOrThrow(validation_1.JobOperationResultSchema, result, 'Job creation result');
        }
        catch (error) {
            logger_1.logger.error('Error creating job:', error);
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
    async updateJob(context, jobId, updates) {
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
            if (updates.staffRole && !staff_role_1.RoleUtils.isValidRole(updates.staffRole)) {
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
                updates.limit = staff_role_1.RoleUtils.getRoleMaxCount(updates.staffRole);
            }
            // Validate custom questions if provided
            if (updates.customQuestions) {
                const allQuestions = [...job_1.DEFAULT_JOB_QUESTIONS, ...updates.customQuestions];
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
            logger_1.logger.info(`Job updated: ${updatedJob.title} (${jobId}) by ${context.userId} in guild ${context.guildId}`);
            return {
                success: true,
                job: updatedJob,
            };
        }
        catch (error) {
            logger_1.logger.error('Error updating job:', error);
            return {
                success: false,
                error: 'Failed to update job',
            };
        }
    }
    async closeJob(context, request) {
        try {
            // Validate input using Zod schema
            const validatedRequest = validation_1.ValidationHelpers.validateOrThrow(validation_1.JobCloseRequestSchema, request, 'Job close request');
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
            logger_1.logger.info(`Job closed: ${job.title} (${jobId}) by ${closedBy} in guild ${context.guildId}`);
            // Validate output
            const result = {
                success: true,
                job,
            };
            return validation_1.ValidationHelpers.validateOrThrow(validation_1.JobOperationResultSchema, result, 'Job close result');
        }
        catch (error) {
            logger_1.logger.error('Error closing job:', error);
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
    async removeJob(context, jobId) {
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
            logger_1.logger.info(`Job removed: ${job.title} (${jobId}) by ${context.userId} in guild ${context.guildId}`);
            return {
                success: true,
            };
        }
        catch (error) {
            logger_1.logger.error('Error removing job:', error);
            return {
                success: false,
                error: 'Failed to remove job',
            };
        }
    }
    async listJobs(context, filters, page = 1) {
        try {
            // Check HR permission for listing jobs
            const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
            if (!hasPermission) {
                throw new Error('You do not have permission to view job listings');
            }
            const result = await this.jobRepository.searchJobs(context.guildId, filters, page, 5);
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error listing jobs:', error);
            throw error;
        }
    }
    async getJobDetails(context, jobId) {
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
        }
        catch (error) {
            logger_1.logger.error('Error getting job details:', error);
            throw error;
        }
    }
    async getJobStatistics(context) {
        try {
            // Check HR permission for viewing job statistics
            const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
            if (!hasPermission) {
                throw new Error('You do not have permission to view job statistics');
            }
            return await this.jobRepository.getJobStatistics(context.guildId);
        }
        catch (error) {
            logger_1.logger.error('Error getting job statistics:', error);
            throw error;
        }
    }
    validateJobQuestions(questions) {
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
        }
        catch (error) {
            logger_1.logger.error('Error validating job questions:', error);
            return {
                valid: false,
                error: 'Failed to validate questions',
            };
        }
    }
}
exports.JobService = JobService;
//# sourceMappingURL=job-service.js.map