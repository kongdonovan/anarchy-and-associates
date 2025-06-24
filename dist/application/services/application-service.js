"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationService = void 0;
const crypto_1 = require("crypto");
const logger_1 = require("../../infrastructure/logger");
class ApplicationService {
    constructor(applicationRepository, jobRepository, staffRepository, robloxService) {
        this.applicationRepository = applicationRepository;
        this.jobRepository = jobRepository;
        this.staffRepository = staffRepository;
        this.robloxService = robloxService;
    }
    async submitApplication(request) {
        logger_1.logger.info('Submitting application', {
            guildId: request.guildId,
            jobId: request.jobId,
            applicantId: request.applicantId
        });
        // Validate the application
        const validation = await this.validateApplication(request);
        if (!validation.isValid) {
            throw new Error(`Application validation failed: ${validation.errors.join(', ')}`);
        }
        // Create the application
        const application = {
            guildId: request.guildId,
            jobId: request.jobId,
            applicantId: request.applicantId,
            robloxUsername: request.robloxUsername,
            answers: request.answers,
            status: 'pending'
        };
        const createdApplication = await this.applicationRepository.add(application);
        logger_1.logger.info('Application submitted successfully', {
            applicationId: createdApplication._id,
            applicantId: request.applicantId,
            jobId: request.jobId
        });
        return createdApplication;
    }
    async reviewApplication(request) {
        logger_1.logger.info('Reviewing application', {
            applicationId: request.applicationId,
            reviewerId: request.reviewerId,
            approved: request.approved
        });
        const application = await this.applicationRepository.findById(request.applicationId);
        if (!application) {
            throw new Error('Application not found');
        }
        if (application.status !== 'pending') {
            throw new Error(`Application is already ${application.status}`);
        }
        const updatedApplication = await this.applicationRepository.update(request.applicationId, {
            status: request.approved ? 'accepted' : 'rejected',
            reviewedBy: request.reviewerId,
            reviewedAt: new Date(),
            reviewReason: request.reason
        });
        if (!updatedApplication) {
            throw new Error('Failed to update application');
        }
        logger_1.logger.info('Application reviewed successfully', {
            applicationId: request.applicationId,
            status: updatedApplication.status,
            reviewerId: request.reviewerId
        });
        return updatedApplication;
    }
    async validateApplication(request) {
        const errors = [];
        const warnings = [];
        // Check if job exists and is open
        const job = await this.jobRepository.findById(request.jobId);
        if (!job) {
            errors.push('Job not found');
        }
        else if (!job.isOpen) {
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
        }
        catch (error) {
            logger_1.logger.warn('Roblox validation failed, continuing without validation', {
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
    async getApplicationById(id) {
        return this.applicationRepository.findById(id);
    }
    async getApplicationsByJob(jobId) {
        return this.applicationRepository.findByJob(jobId);
    }
    async getApplicationsByApplicant(applicantId) {
        return this.applicationRepository.findByApplicant(applicantId);
    }
    async getPendingApplications(guildId) {
        return this.applicationRepository.findPendingApplications(guildId);
    }
    async getApplicationStats(guildId) {
        const allApplications = await this.applicationRepository.findByGuild(guildId);
        return {
            total: allApplications.length,
            pending: allApplications.filter(app => app.status === 'pending').length,
            accepted: allApplications.filter(app => app.status === 'accepted').length,
            rejected: allApplications.filter(app => app.status === 'rejected').length
        };
    }
    generateApplicationId() {
        return (0, crypto_1.randomUUID)();
    }
}
exports.ApplicationService = ApplicationService;
//# sourceMappingURL=application-service.js.map