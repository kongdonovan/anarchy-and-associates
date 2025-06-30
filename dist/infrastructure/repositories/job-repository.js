"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const staff_role_1 = require("../../domain/entities/staff-role"); // Keep RoleUtils as it contains business logic
const logger_1 = require("../logger");
const validation_1 = require("../../validation");
// Validation schemas
const JobSearchFiltersSchema = validation_1.z.object({
    isOpen: validation_1.z.boolean().optional(),
    staffRole: validation_1.StaffRoleSchema.optional(),
    searchTerm: validation_1.z.string().optional(),
    postedBy: validation_1.DiscordSnowflakeSchema.optional(),
});
class JobRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('jobs');
    }
    async findByGuildId(guildId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            return await this.findByFilters({ guildId: validatedGuildId });
        }
        catch (error) {
            logger_1.logger.error(`Error finding jobs for guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async findOpenJobs(guildId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            return await this.findByFilters({ guildId: validatedGuildId, isOpen: true });
        }
        catch (error) {
            logger_1.logger.error(`Error finding open jobs for guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async findJobsByStaffRole(guildId, staffRole) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedStaffRole = validation_1.ValidationHelpers.validateOrThrow(validation_1.StaffRoleSchema, staffRole, 'Staff role');
            return await this.findByFilters({
                guildId: validatedGuildId,
                staffRole: validatedStaffRole
            });
        }
        catch (error) {
            logger_1.logger.error(`Error finding jobs for staff role ${String(staffRole)} in guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async searchJobs(guildId, filters, page = 1, limit = 5) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedFilters = validation_1.ValidationHelpers.validateOrThrow(JobSearchFiltersSchema, filters, 'Job search filters');
            const validatedPage = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.number().int().positive(), page, 'Page number');
            const validatedLimit = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.number().int().positive().max(100), limit, 'Page limit');
            const skip = (validatedPage - 1) * validatedLimit;
            const mongoFilters = { guildId: validatedGuildId };
            // Apply filters
            if (validatedFilters.isOpen !== undefined) {
                mongoFilters.isOpen = validatedFilters.isOpen;
            }
            if (validatedFilters.staffRole) {
                mongoFilters.staffRole = validatedFilters.staffRole;
            }
            if (validatedFilters.postedBy) {
                mongoFilters.postedBy = validatedFilters.postedBy;
            }
            // Apply search term
            if (validatedFilters.searchTerm) {
                const searchRegex = new RegExp(validatedFilters.searchTerm, 'i');
                mongoFilters.$or = [
                    { title: { $regex: searchRegex } },
                    { description: { $regex: searchRegex } },
                ];
            }
            const collection = this.collection;
            // Get total count for pagination
            const total = await collection.countDocuments(mongoFilters);
            const totalPages = Math.ceil(total / validatedLimit);
            // Get jobs with pagination, sorted by creation date (newest first)
            const jobDocs = await collection
                .find(mongoFilters)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(validatedLimit)
                .toArray();
            const jobs = jobDocs.map(doc => this.fromMongoDoc(doc)).filter(job => job !== null);
            return {
                jobs,
                total,
                totalPages,
                currentPage: validatedPage,
            };
        }
        catch (error) {
            logger_1.logger.error(`Error searching jobs in guild ${guildId}:`, error);
            throw error;
        }
    }
    async createJob(jobData) {
        try {
            // Create a partial job schema for the input (without _id, createdAt, updatedAt)
            const JobDataSchema = validation_1.z.object({
                guildId: validation_1.DiscordSnowflakeSchema,
                title: validation_1.z.string(),
                description: validation_1.z.string(),
                staffRole: validation_1.z.union([validation_1.StaffRoleSchema, validation_1.z.string()]),
                roleId: validation_1.DiscordSnowflakeSchema,
                limit: validation_1.z.number().int().positive().optional(),
                isOpen: validation_1.z.boolean(),
                questions: validation_1.z.array(validation_1.z.any()).default([]), // Simplified for now
                postedBy: validation_1.DiscordSnowflakeSchema,
                closedAt: validation_1.z.date().optional(),
                closedBy: validation_1.DiscordSnowflakeSchema.optional(),
                applicationCount: validation_1.z.number().int().nonnegative().default(0),
                hiredCount: validation_1.z.number().int().nonnegative().default(0),
            });
            const validatedJobData = validation_1.ValidationHelpers.validateOrThrow(JobDataSchema, jobData, 'Job data');
            return await this.add(validatedJobData);
        }
        catch (error) {
            logger_1.logger.error('Error creating job:', error);
            throw error;
        }
    }
    async updateJob(jobId, updates) {
        try {
            const validatedJobId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), jobId, 'Job ID');
            // Create a partial job schema for updates
            const JobUpdateSchema = validation_1.z.object({
                guildId: validation_1.DiscordSnowflakeSchema.optional(),
                title: validation_1.z.string().optional(),
                description: validation_1.z.string().optional(),
                staffRole: validation_1.z.union([validation_1.StaffRoleSchema, validation_1.z.string()]).optional(),
                roleId: validation_1.DiscordSnowflakeSchema.optional(),
                limit: validation_1.z.number().int().positive().optional(),
                isOpen: validation_1.z.boolean().optional(),
                questions: validation_1.z.array(validation_1.z.any()).optional(),
                postedBy: validation_1.DiscordSnowflakeSchema.optional(),
                closedAt: validation_1.z.date().optional(),
                closedBy: validation_1.DiscordSnowflakeSchema.optional(),
                applicationCount: validation_1.z.number().int().nonnegative().optional(),
                hiredCount: validation_1.z.number().int().nonnegative().optional(),
            }).partial();
            const validatedUpdates = validation_1.ValidationHelpers.validateOrThrow(JobUpdateSchema, updates, 'Job updates');
            return await this.update(validatedJobId, validatedUpdates);
        }
        catch (error) {
            logger_1.logger.error(`Error updating job ${String(jobId)}:`, error);
            throw error;
        }
    }
    async closeJob(guildId, jobId, closedBy, _removeRole = false) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedJobId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), jobId, 'Job ID');
            const validatedClosedBy = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, closedBy, 'Closed by user ID');
            // Validate the removeRole parameter even though it's not used
            validation_1.ValidationHelpers.validateOrThrow(validation_1.z.boolean(), _removeRole, 'Remove role flag');
            const job = await this.findById(validatedJobId);
            if (!job || job.guildId !== validatedGuildId) {
                return null;
            }
            const updates = {
                isOpen: false,
                closedAt: new Date(),
                closedBy: validatedClosedBy,
            };
            const updatedJob = await this.update(validatedJobId, updates);
            if (updatedJob) {
                logger_1.logger.info(`Job closed: ${job.title} (${validatedJobId}) by ${validatedClosedBy} in guild ${validatedGuildId}`);
            }
            return updatedJob;
        }
        catch (error) {
            logger_1.logger.error(`Error closing job ${String(jobId)}:`, error);
            throw error;
        }
    }
    async removeJob(guildId, jobId, removedBy) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedJobId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), jobId, 'Job ID');
            const validatedRemovedBy = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, removedBy, 'Removed by user ID');
            const job = await this.findById(validatedJobId);
            if (!job || job.guildId !== validatedGuildId) {
                return false;
            }
            const deleted = await this.delete(validatedJobId);
            if (deleted) {
                logger_1.logger.info(`Job removed: ${job.title} (${validatedJobId}) by ${validatedRemovedBy} in guild ${validatedGuildId}`);
            }
            return deleted;
        }
        catch (error) {
            logger_1.logger.error(`Error removing job ${String(jobId)}:`, error);
            throw error;
        }
    }
    async incrementApplicationCount(jobId) {
        try {
            const validatedJobId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), jobId, 'Job ID');
            const job = await this.findById(validatedJobId);
            if (!job) {
                return null;
            }
            return await this.update(validatedJobId, {
                applicationCount: job.applicationCount + 1,
            });
        }
        catch (error) {
            logger_1.logger.error(`Error incrementing application count for job ${String(jobId)}:`, error);
            throw error;
        }
    }
    async incrementHiredCount(jobId) {
        try {
            const validatedJobId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), jobId, 'Job ID');
            const job = await this.findById(validatedJobId);
            if (!job) {
                return null;
            }
            return await this.update(validatedJobId, {
                hiredCount: job.hiredCount + 1,
            });
        }
        catch (error) {
            logger_1.logger.error(`Error incrementing hired count for job ${String(jobId)}:`, error);
            throw error;
        }
    }
    async getJobStatistics(guildId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const collection = this.collection;
            // Get basic counts
            const totalJobs = await collection.countDocuments({ guildId: validatedGuildId });
            const openJobs = await collection.countDocuments({ guildId: validatedGuildId, isOpen: true });
            const closedJobs = await collection.countDocuments({ guildId: validatedGuildId, isOpen: false });
            // Get application and hire totals
            const applicationStats = await collection
                .aggregate([
                { $match: { guildId: validatedGuildId } },
                {
                    $group: {
                        _id: null,
                        totalApplications: { $sum: '$applicationCount' },
                        totalHired: { $sum: '$hiredCount' },
                    },
                },
            ])
                .toArray();
            const { totalApplications = 0, totalHired = 0 } = applicationStats[0] || {};
            // Get jobs by role
            const roleStats = await collection
                .aggregate([
                { $match: { guildId: validatedGuildId } },
                { $group: { _id: '$staffRole', count: { $sum: 1 } } },
            ])
                .toArray();
            const jobsByRole = {};
            // Initialize all roles with 0
            staff_role_1.RoleUtils.getAllRoles().forEach(role => {
                jobsByRole[role] = 0;
            });
            // Fill in actual counts
            roleStats.forEach(stat => {
                if (staff_role_1.RoleUtils.isValidRole(stat._id)) {
                    jobsByRole[stat._id] = stat.count;
                }
            });
            return {
                totalJobs,
                openJobs,
                closedJobs,
                totalApplications,
                totalHired,
                jobsByRole,
            };
        }
        catch (error) {
            logger_1.logger.error(`Error getting job statistics for guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async findJobsNeedingRoleCleanup(guildId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            // Find jobs that are closed but still have Discord roles that need cleanup
            const collection = this.collection;
            const jobDocs = await collection
                .find({
                guildId: validatedGuildId,
                isOpen: false,
                roleId: { $exists: true, $ne: '' },
            })
                .toArray();
            const jobs = jobDocs.map(doc => this.fromMongoDoc(doc)).filter(job => job !== null);
            return jobs;
        }
        catch (error) {
            logger_1.logger.error(`Error finding jobs needing role cleanup in guild ${String(guildId)}:`, error);
            throw error;
        }
    }
    async markRoleCleanupComplete(jobId) {
        try {
            const validatedJobId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), jobId, 'Job ID');
            return await this.update(validatedJobId, {
                roleId: '', // Clear the role ID to indicate cleanup is complete
            });
        }
        catch (error) {
            logger_1.logger.error(`Error marking role cleanup complete for job ${String(jobId)}:`, error);
            throw error;
        }
    }
    async getOpenJobsForRole(guildId, staffRole) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedStaffRole = validation_1.ValidationHelpers.validateOrThrow(validation_1.StaffRoleSchema, staffRole, 'Staff role');
            return await this.findByFilters({
                guildId: validatedGuildId,
                staffRole: validatedStaffRole,
                isOpen: true,
            });
        }
        catch (error) {
            logger_1.logger.error(`Error finding open jobs for role ${String(staffRole)} in guild ${String(guildId)}:`, error);
            throw error;
        }
    }
}
exports.JobRepository = JobRepository;
//# sourceMappingURL=job-repository.js.map