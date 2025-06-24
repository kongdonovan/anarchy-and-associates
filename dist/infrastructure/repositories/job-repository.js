"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const logger_1 = require("../logger");
class JobRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('jobs');
    }
    async findByGuildId(guildId) {
        try {
            return await this.findByFilters({ guildId });
        }
        catch (error) {
            logger_1.logger.error(`Error finding jobs for guild ${guildId}:`, error);
            throw error;
        }
    }
    async findOpenJobs(guildId) {
        try {
            return await this.findByFilters({ guildId, isOpen: true });
        }
        catch (error) {
            logger_1.logger.error(`Error finding open jobs for guild ${guildId}:`, error);
            throw error;
        }
    }
    async findJobsByStaffRole(guildId, staffRole) {
        try {
            return await this.findByFilters({ guildId, staffRole });
        }
        catch (error) {
            logger_1.logger.error(`Error finding jobs for staff role ${staffRole} in guild ${guildId}:`, error);
            throw error;
        }
    }
    async searchJobs(guildId, filters, page = 1, limit = 5) {
        try {
            const skip = (page - 1) * limit;
            const mongoFilters = { guildId };
            // Apply filters
            if (filters.isOpen !== undefined) {
                mongoFilters.isOpen = filters.isOpen;
            }
            if (filters.staffRole) {
                mongoFilters.staffRole = filters.staffRole;
            }
            if (filters.postedBy) {
                mongoFilters.postedBy = filters.postedBy;
            }
            // Apply search term
            if (filters.searchTerm) {
                const searchRegex = new RegExp(filters.searchTerm, 'i');
                mongoFilters.$or = [
                    { title: { $regex: searchRegex } },
                    { description: { $regex: searchRegex } },
                ];
            }
            const collection = this.collection;
            // Get total count for pagination
            const total = await collection.countDocuments(mongoFilters);
            const totalPages = Math.ceil(total / limit);
            // Get jobs with pagination, sorted by creation date (newest first)
            const jobs = await collection
                .find(mongoFilters)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();
            return {
                jobs,
                total,
                totalPages,
                currentPage: page,
            };
        }
        catch (error) {
            logger_1.logger.error(`Error searching jobs in guild ${guildId}:`, error);
            throw error;
        }
    }
    async createJob(jobData) {
        try {
            return await this.add(jobData);
        }
        catch (error) {
            logger_1.logger.error('Error creating job:', error);
            throw error;
        }
    }
    async updateJob(jobId, updates) {
        try {
            return await this.update(jobId, updates);
        }
        catch (error) {
            logger_1.logger.error(`Error updating job ${jobId}:`, error);
            throw error;
        }
    }
    async closeJob(guildId, jobId, closedBy, _removeRole = false) {
        try {
            const job = await this.findById(jobId);
            if (!job || job.guildId !== guildId) {
                return null;
            }
            const updates = {
                isOpen: false,
                closedAt: new Date(),
                closedBy,
            };
            const updatedJob = await this.update(jobId, updates);
            if (updatedJob) {
                logger_1.logger.info(`Job closed: ${job.title} (${jobId}) by ${closedBy} in guild ${guildId}`);
            }
            return updatedJob;
        }
        catch (error) {
            logger_1.logger.error(`Error closing job ${jobId}:`, error);
            throw error;
        }
    }
    async removeJob(guildId, jobId, removedBy) {
        try {
            const job = await this.findById(jobId);
            if (!job || job.guildId !== guildId) {
                return false;
            }
            const deleted = await this.delete(jobId);
            if (deleted) {
                logger_1.logger.info(`Job removed: ${job.title} (${jobId}) by ${removedBy} in guild ${guildId}`);
            }
            return deleted;
        }
        catch (error) {
            logger_1.logger.error(`Error removing job ${jobId}:`, error);
            throw error;
        }
    }
    async incrementApplicationCount(jobId) {
        try {
            const job = await this.findById(jobId);
            if (!job) {
                return null;
            }
            return await this.update(jobId, {
                applicationCount: job.applicationCount + 1,
            });
        }
        catch (error) {
            logger_1.logger.error(`Error incrementing application count for job ${jobId}:`, error);
            throw error;
        }
    }
    async incrementHiredCount(jobId) {
        try {
            const job = await this.findById(jobId);
            if (!job) {
                return null;
            }
            return await this.update(jobId, {
                hiredCount: job.hiredCount + 1,
            });
        }
        catch (error) {
            logger_1.logger.error(`Error incrementing hired count for job ${jobId}:`, error);
            throw error;
        }
    }
    async getJobStatistics(guildId) {
        try {
            const collection = this.collection;
            // Get basic counts
            const totalJobs = await collection.countDocuments({ guildId });
            const openJobs = await collection.countDocuments({ guildId, isOpen: true });
            const closedJobs = await collection.countDocuments({ guildId, isOpen: false });
            // Get application and hire totals
            const applicationStats = await collection
                .aggregate([
                { $match: { guildId } },
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
                { $match: { guildId } },
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
            logger_1.logger.error(`Error getting job statistics for guild ${guildId}:`, error);
            throw error;
        }
    }
    async findJobsNeedingRoleCleanup(guildId) {
        try {
            // Find jobs that are closed but still have Discord roles that need cleanup
            const collection = this.collection;
            const jobs = await collection
                .find({
                guildId,
                isOpen: false,
                roleId: { $exists: true, $ne: '' },
            })
                .toArray();
            return jobs;
        }
        catch (error) {
            logger_1.logger.error(`Error finding jobs needing role cleanup in guild ${guildId}:`, error);
            throw error;
        }
    }
    async markRoleCleanupComplete(jobId) {
        try {
            return await this.update(jobId, {
                roleId: '', // Clear the role ID to indicate cleanup is complete
            });
        }
        catch (error) {
            logger_1.logger.error(`Error marking role cleanup complete for job ${jobId}:`, error);
            throw error;
        }
    }
    async getOpenJobsForRole(guildId, staffRole) {
        try {
            return await this.findByFilters({
                guildId,
                staffRole,
                isOpen: true,
            });
        }
        catch (error) {
            logger_1.logger.error(`Error finding open jobs for role ${staffRole} in guild ${guildId}:`, error);
            throw error;
        }
    }
}
exports.JobRepository = JobRepository;
//# sourceMappingURL=job-repository.js.map