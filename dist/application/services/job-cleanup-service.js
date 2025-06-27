"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobCleanupService = void 0;
const audit_log_1 = require("../../domain/entities/audit-log");
const logger_1 = require("../../infrastructure/logger");
class JobCleanupService {
    constructor(jobRepository, auditLogRepository) {
        this.jobRepository = jobRepository;
        this.auditLogRepository = auditLogRepository;
    }
    async findJobsNeedingCleanup(guildId) {
        try {
            const jobs = await this.jobRepository.findJobsNeedingRoleCleanup(guildId);
            return jobs.map(job => ({
                id: job._id?.toHexString() || 'unknown',
                title: job.title,
                roleId: job.roleId,
                closedAt: job.closedAt,
                closedBy: job.closedBy,
            }));
        }
        catch (error) {
            logger_1.logger.error(`Error finding jobs needing cleanup in guild ${guildId}:`, error);
            throw error;
        }
    }
    async cleanupJobRoles(guild, dryRun = false) {
        const result = {
            success: true,
            jobsProcessed: 0,
            rolesRemoved: 0,
            errors: [],
        };
        try {
            const guildId = guild.id;
            const jobsNeedingCleanup = await this.findJobsNeedingCleanup(guildId);
            if (jobsNeedingCleanup.length === 0) {
                logger_1.logger.info(`No jobs found needing role cleanup in guild ${guildId}`);
                return result;
            }
            logger_1.logger.info(`Found ${jobsNeedingCleanup.length} jobs needing role cleanup in guild ${guildId}`);
            for (const cleanupJob of jobsNeedingCleanup) {
                try {
                    result.jobsProcessed++;
                    // Check if the Discord role still exists
                    let discordRole = null;
                    try {
                        discordRole = await guild.roles.fetch(cleanupJob.roleId);
                    }
                    catch (error) {
                        // Role doesn't exist, mark as cleaned up
                        logger_1.logger.info(`Role ${cleanupJob.roleId} for job "${cleanupJob.title}" no longer exists`);
                        if (!dryRun) {
                            await this.jobRepository.markRoleCleanupComplete(cleanupJob.id);
                            await this.auditLogRepository.logAction({
                                guildId,
                                action: audit_log_1.AuditAction.JOB_REMOVED,
                                actorId: 'system',
                                details: {
                                    before: { status: 'cleanup_needed' },
                                    after: { status: 'cleanup_complete' },
                                    metadata: {
                                        jobId: cleanupJob.id,
                                        title: cleanupJob.title,
                                        roleId: cleanupJob.roleId,
                                        reason: 'role_already_deleted',
                                    },
                                },
                                timestamp: new Date(),
                            });
                        }
                        continue;
                    }
                    if (!discordRole) {
                        continue;
                    }
                    // Check if role is being used by other jobs or has members
                    const roleMembers = discordRole.members.size;
                    const canDelete = await this.canDeleteRole(guildId, cleanupJob.roleId, cleanupJob.id);
                    if (!canDelete) {
                        logger_1.logger.info(`Role ${cleanupJob.roleId} for job "${cleanupJob.title}" is still in use by other jobs or systems`);
                        result.errors.push(`Role "${discordRole.name}" is still in use by other jobs`);
                        continue;
                    }
                    if (roleMembers > 0) {
                        logger_1.logger.info(`Role ${cleanupJob.roleId} for job "${cleanupJob.title}" still has ${roleMembers} members`);
                        result.errors.push(`Role "${discordRole.name}" still has ${roleMembers} members`);
                        continue;
                    }
                    // Safe to delete the role
                    if (!dryRun) {
                        try {
                            await discordRole.delete(`Automatic cleanup for closed job: ${cleanupJob.title}`);
                            result.rolesRemoved++;
                            // Mark cleanup as complete
                            await this.jobRepository.markRoleCleanupComplete(cleanupJob.id);
                            // Log the cleanup action
                            await this.auditLogRepository.logAction({
                                guildId,
                                action: audit_log_1.AuditAction.JOB_REMOVED,
                                actorId: 'system',
                                details: {
                                    before: { status: 'cleanup_needed' },
                                    after: { status: 'cleanup_complete' },
                                    metadata: {
                                        jobId: cleanupJob.id,
                                        title: cleanupJob.title,
                                        roleId: cleanupJob.roleId,
                                        roleName: discordRole.name,
                                    },
                                },
                                timestamp: new Date(),
                            });
                            logger_1.logger.info(`Successfully cleaned up role "${discordRole.name}" for job "${cleanupJob.title}"`);
                        }
                        catch (deleteError) {
                            const errorMsg = `Failed to delete role "${discordRole.name}": ${deleteError}`;
                            result.errors.push(errorMsg);
                            logger_1.logger.error(errorMsg, deleteError);
                        }
                    }
                    else {
                        logger_1.logger.info(`[DRY RUN] Would delete role "${discordRole.name}" for job "${cleanupJob.title}"`);
                        result.rolesRemoved++;
                    }
                }
                catch (jobError) {
                    const errorMsg = `Error processing job "${cleanupJob.title}": ${jobError}`;
                    result.errors.push(errorMsg);
                    logger_1.logger.error(errorMsg, jobError);
                }
            }
            if (result.errors.length > 0) {
                result.success = false;
            }
            logger_1.logger.info(`Role cleanup completed for guild ${guildId}. Processed: ${result.jobsProcessed}, Removed: ${result.rolesRemoved}, Errors: ${result.errors.length}`);
        }
        catch (error) {
            result.success = false;
            result.errors.push(`General cleanup error: ${error}`);
            logger_1.logger.error(`Error during role cleanup in guild ${guild.id}:`, error);
        }
        return result;
    }
    async canDeleteRole(guildId, roleId, excludeJobId) {
        try {
            // Check if any other open jobs are using this role
            const allJobs = await this.jobRepository.findByGuildId(guildId);
            const otherJobsUsingRole = allJobs.filter(job => job.roleId === roleId &&
                job._id?.toHexString() !== excludeJobId &&
                job.isOpen);
            if (otherJobsUsingRole.length > 0) {
                logger_1.logger.info(`Role ${roleId} is still being used by ${otherJobsUsingRole.length} other open jobs`);
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Error checking if role ${roleId} can be deleted:`, error);
            return false; // Err on the side of caution
        }
    }
    async scheduleAutomaticCleanup(guild, intervalHours = 24) {
        const intervalMs = intervalHours * 60 * 60 * 1000;
        const runCleanup = async () => {
            try {
                logger_1.logger.info(`Running scheduled role cleanup for guild ${guild.id}`);
                const result = await this.cleanupJobRoles(guild, false);
                if (result.rolesRemoved > 0) {
                    logger_1.logger.info(`Scheduled cleanup completed: ${result.rolesRemoved} roles removed`);
                }
                if (result.errors.length > 0) {
                    logger_1.logger.warn(`Scheduled cleanup had ${result.errors.length} errors:`, result.errors);
                }
            }
            catch (error) {
                logger_1.logger.error(`Error in scheduled cleanup for guild ${guild.id}:`, error);
            }
        };
        // Run initial cleanup
        await runCleanup();
        // Schedule periodic cleanup
        setInterval(runCleanup, intervalMs);
        logger_1.logger.info(`Scheduled automatic role cleanup every ${intervalHours} hours for guild ${guild.id}`);
    }
    async cleanupExpiredJobs(guildId, maxDaysOpen = 30, dryRun = false) {
        const result = {
            success: true,
            jobsProcessed: 0,
            rolesRemoved: 0,
            errors: [],
        };
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxDaysOpen);
            // Find old open jobs
            const allJobs = await this.jobRepository.findByGuildId(guildId);
            const expiredJobs = allJobs.filter(job => job.isOpen &&
                job.createdAt &&
                job.createdAt < cutoffDate);
            if (expiredJobs.length === 0) {
                logger_1.logger.info(`No expired jobs found in guild ${guildId}`);
                return result;
            }
            logger_1.logger.info(`Found ${expiredJobs.length} expired jobs in guild ${guildId}`);
            for (const job of expiredJobs) {
                try {
                    result.jobsProcessed++;
                    if (!dryRun) {
                        // Close the expired job
                        const updatedJob = await this.jobRepository.closeJob(guildId, job._id?.toHexString() || '', 'system');
                        if (updatedJob) {
                            await this.auditLogRepository.logAction({
                                guildId,
                                action: audit_log_1.AuditAction.JOB_CLOSED,
                                actorId: 'system',
                                details: {
                                    before: { status: 'open' },
                                    after: { status: 'closed' },
                                    metadata: {
                                        jobId: job._id?.toHexString(),
                                        title: job.title,
                                        reason: 'expired',
                                        daysOpen: Math.floor((Date.now() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
                                    },
                                },
                                timestamp: new Date(),
                            });
                            logger_1.logger.info(`Automatically closed expired job: ${job.title}`);
                        }
                    }
                    else {
                        logger_1.logger.info(`[DRY RUN] Would close expired job: ${job.title}`);
                    }
                }
                catch (jobError) {
                    const errorMsg = `Error processing expired job "${job.title}": ${jobError}`;
                    result.errors.push(errorMsg);
                    logger_1.logger.error(errorMsg, jobError);
                }
            }
            if (result.errors.length > 0) {
                result.success = false;
            }
            logger_1.logger.info(`Expired job cleanup completed for guild ${guildId}. Processed: ${result.jobsProcessed}, Errors: ${result.errors.length}`);
        }
        catch (error) {
            result.success = false;
            result.errors.push(`General expired job cleanup error: ${error}`);
            logger_1.logger.error(`Error during expired job cleanup in guild ${guildId}:`, error);
        }
        return result;
    }
    async getCleanupReport(guildId) {
        try {
            const jobsNeedingCleanup = await this.findJobsNeedingCleanup(guildId);
            const allJobs = await this.jobRepository.findByGuildId(guildId);
            const openJobs = allJobs.filter(job => job.isOpen);
            // Find expired jobs (older than 30 days)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30);
            const expiredJobs = openJobs.filter(job => job.createdAt && job.createdAt < cutoffDate);
            // Find oldest open job
            let oldestOpenJob;
            if (openJobs.length > 0) {
                const oldest = openJobs.reduce((prev, current) => (prev.createdAt && current.createdAt && prev.createdAt < current.createdAt) ? prev : current);
                if (oldest.createdAt) {
                    const daysOpen = Math.floor((Date.now() - oldest.createdAt.getTime()) / (1000 * 60 * 60 * 24));
                    oldestOpenJob = {
                        title: oldest.title,
                        daysOpen,
                    };
                }
            }
            return {
                jobsNeedingCleanup,
                expiredJobsCount: expiredJobs.length,
                totalOpenJobs: openJobs.length,
                oldestOpenJob,
            };
        }
        catch (error) {
            logger_1.logger.error(`Error generating cleanup report for guild ${guildId}:`, error);
            throw error;
        }
    }
}
exports.JobCleanupService = JobCleanupService;
//# sourceMappingURL=job-cleanup-service.js.map