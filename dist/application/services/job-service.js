"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobService = void 0;
const job_1 = require("../../domain/entities/job");
const staff_role_1 = require("../../domain/entities/staff-role");
const audit_log_1 = require("../../domain/entities/audit-log");
const logger_1 = require("../../infrastructure/logger");
const case_1 = require("../../domain/entities/case");
class JobService {
    constructor(jobRepository, auditLogRepository, _staffRepository, // Future use for staff validation
    permissionService) {
        this.jobRepository = jobRepository;
        this.auditLogRepository = auditLogRepository;
        this.permissionService = permissionService;
        // _staffRepository reserved for future use
    }
    async createJob(context, request) {
        try {
            // Check HR permission for creating jobs
            const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
            if (!hasPermission) {
                return {
                    success: false,
                    error: 'You do not have permission to create job postings',
                };
            }
            const { guildId, title, description, staffRole, roleId, customQuestions, postedBy } = request;
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
            // Log the action
            await this.auditLogRepository.logAction({
                guildId,
                action: audit_log_1.AuditAction.JOB_CREATED,
                actorId: postedBy,
                details: {
                    after: {
                        staffRole,
                    },
                    metadata: {
                        jobId: job._id?.toHexString(),
                        title,
                        roleId,
                    },
                },
                timestamp: new Date(),
            });
            logger_1.logger.info(`Job created: ${title} for ${staffRole} by ${postedBy} in guild ${guildId}`);
            return {
                success: true,
                job,
            };
        }
        catch (error) {
            logger_1.logger.error('Error creating job:', error);
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
                if (existingJobs.some(job => job._id?.toHexString() !== jobId)) {
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
            // Log the action
            await this.auditLogRepository.logAction({
                guildId: context.guildId,
                action: audit_log_1.AuditAction.JOB_UPDATED,
                actorId: context.userId,
                details: {
                    before: {
                        staffRole: existingJob.staffRole,
                    },
                    after: {
                        staffRole: updatedJob.staffRole,
                    },
                    metadata: {
                        jobId,
                        title: updatedJob.title,
                        changes: Object.keys(updates),
                    },
                },
                timestamp: new Date(),
            });
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
    async closeJob(context, jobId) {
        try {
            // Check HR permission for closing jobs
            const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
            if (!hasPermission) {
                return {
                    success: false,
                    error: 'You do not have permission to close job postings',
                };
            }
            const job = await this.jobRepository.closeJob(context.guildId, jobId, context.userId);
            if (!job) {
                return {
                    success: false,
                    error: 'Job not found or already closed',
                };
            }
            // Log the action
            await this.auditLogRepository.logAction({
                guildId: context.guildId,
                action: audit_log_1.AuditAction.JOB_CLOSED,
                actorId: context.userId,
                details: {
                    before: { status: 'open' },
                    after: { status: case_1.CaseStatus.CLOSED },
                    metadata: {
                        jobId,
                        title: job.title,
                        staffRole: job.staffRole,
                    },
                },
                timestamp: new Date(),
            });
            logger_1.logger.info(`Job closed: ${job.title} (${jobId}) by ${context.userId} in guild ${context.guildId}`);
            return {
                success: true,
                job,
            };
        }
        catch (error) {
            logger_1.logger.error('Error closing job:', error);
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
            // Log the action
            await this.auditLogRepository.logAction({
                guildId: context.guildId,
                action: audit_log_1.AuditAction.JOB_REMOVED,
                actorId: context.userId,
                details: {
                    before: { status: job.isOpen ? 'open' : 'closed' },
                    after: { status: 'removed' },
                    metadata: {
                        jobId,
                        title: job.title,
                        staffRole: job.staffRole,
                    },
                },
                timestamp: new Date(),
            });
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
            // Log the action for audit trail
            await this.auditLogRepository.logAction({
                guildId: context.guildId,
                action: audit_log_1.AuditAction.JOB_LIST_VIEWED,
                actorId: context.userId,
                details: {
                    metadata: {
                        filters,
                        page,
                        resultCount: result.jobs.length,
                    },
                },
                timestamp: new Date(),
            });
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
            // Log the action
            await this.auditLogRepository.logAction({
                guildId: context.guildId,
                action: audit_log_1.AuditAction.JOB_INFO_VIEWED,
                actorId: context.userId,
                details: {
                    metadata: {
                        jobId,
                        title: job.title,
                    },
                },
                timestamp: new Date(),
            });
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