import { Guild, Role } from 'discord.js';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { AuditAction } from '../../domain/entities/audit-log';
import { logger } from '../../infrastructure/logger';

export interface CleanupResult {
  success: boolean;
  jobsProcessed: number;
  rolesRemoved: number;
  errors: string[];
}

export interface CleanupJob {
  id: string;
  title: string;
  roleId: string;
  closedAt?: Date;
  closedBy?: string;
}

export class JobCleanupService {
  private jobRepository: JobRepository;
  private auditLogRepository: AuditLogRepository;

  constructor(jobRepository: JobRepository, auditLogRepository: AuditLogRepository) {
    this.jobRepository = jobRepository;
    this.auditLogRepository = auditLogRepository;
  }

  public async findJobsNeedingCleanup(guildId: string): Promise<CleanupJob[]> {
    try {
      const jobs = await this.jobRepository.findJobsNeedingRoleCleanup(guildId);
      
      return jobs.map(job => ({
        id: job._id?.toHexString() || 'unknown',
        title: job.title,
        roleId: job.roleId,
        closedAt: job.closedAt,
        closedBy: job.closedBy,
      }));
    } catch (error) {
      logger.error(`Error finding jobs needing cleanup in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async cleanupJobRoles(guild: Guild, dryRun: boolean = false): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      jobsProcessed: 0,
      rolesRemoved: 0,
      errors: [],
    };

    try {
      const guildId = guild.id;
      const jobsNeedingCleanup = await this.findJobsNeedingCleanup(guildId);
      
      if (jobsNeedingCleanup.length === 0) {
        logger.info(`No jobs found needing role cleanup in guild ${guildId}`);
        return result;
      }

      logger.info(`Found ${jobsNeedingCleanup.length} jobs needing role cleanup in guild ${guildId}`);

      for (const cleanupJob of jobsNeedingCleanup) {
        try {
          result.jobsProcessed++;

          // Check if the Discord role still exists
          let discordRole: Role | null = null;
          try {
            discordRole = await guild.roles.fetch(cleanupJob.roleId);
          } catch (error) {
            // Role doesn't exist, mark as cleaned up
            logger.info(`Role ${cleanupJob.roleId} for job "${cleanupJob.title}" no longer exists`);
            
            if (!dryRun) {
              await this.jobRepository.markRoleCleanupComplete(cleanupJob.id);
              await this.auditLogRepository.logAction({
                guildId,
                action: AuditAction.JOB_REMOVED,
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
            logger.info(`Role ${cleanupJob.roleId} for job "${cleanupJob.title}" is still in use by other jobs or systems`);
            result.errors.push(`Role "${discordRole.name}" is still in use by other jobs`);
            continue;
          }

          if (roleMembers > 0) {
            logger.info(`Role ${cleanupJob.roleId} for job "${cleanupJob.title}" still has ${roleMembers} members`);
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
                action: AuditAction.JOB_REMOVED,
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

              logger.info(`Successfully cleaned up role "${discordRole.name}" for job "${cleanupJob.title}"`);
            } catch (deleteError) {
              const errorMsg = `Failed to delete role "${discordRole.name}": ${deleteError}`;
              result.errors.push(errorMsg);
              logger.error(errorMsg, deleteError);
            }
          } else {
            logger.info(`[DRY RUN] Would delete role "${discordRole.name}" for job "${cleanupJob.title}"`);
            result.rolesRemoved++;
          }

        } catch (jobError) {
          const errorMsg = `Error processing job "${cleanupJob.title}": ${jobError}`;
          result.errors.push(errorMsg);
          logger.error(errorMsg, jobError);
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

      logger.info(`Role cleanup completed for guild ${guildId}. Processed: ${result.jobsProcessed}, Removed: ${result.rolesRemoved}, Errors: ${result.errors.length}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`General cleanup error: ${error}`);
      logger.error(`Error during role cleanup in guild ${guild.id}:`, error);
    }

    return result;
  }

  private async canDeleteRole(guildId: string, roleId: string, excludeJobId: string): Promise<boolean> {
    try {
      // Check if any other open jobs are using this role
      const allJobs = await this.jobRepository.findByGuildId(guildId);
      const otherJobsUsingRole = allJobs.filter(job => 
        job.roleId === roleId && 
        job._id?.toHexString() !== excludeJobId &&
        job.isOpen
      );

      if (otherJobsUsingRole.length > 0) {
        logger.info(`Role ${roleId} is still being used by ${otherJobsUsingRole.length} other open jobs`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Error checking if role ${roleId} can be deleted:`, error);
      return false; // Err on the side of caution
    }
  }

  public async scheduleAutomaticCleanup(guild: Guild, intervalHours: number = 24): Promise<void> {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    const runCleanup = async () => {
      try {
        logger.info(`Running scheduled role cleanup for guild ${guild.id}`);
        const result = await this.cleanupJobRoles(guild, false);
        
        if (result.rolesRemoved > 0) {
          logger.info(`Scheduled cleanup completed: ${result.rolesRemoved} roles removed`);
        }
        
        if (result.errors.length > 0) {
          logger.warn(`Scheduled cleanup had ${result.errors.length} errors:`, result.errors);
        }
      } catch (error) {
        logger.error(`Error in scheduled cleanup for guild ${guild.id}:`, error);
      }
    };

    // Run initial cleanup
    await runCleanup();

    // Schedule periodic cleanup
    setInterval(runCleanup, intervalMs);
    
    logger.info(`Scheduled automatic role cleanup every ${intervalHours} hours for guild ${guild.id}`);
  }

  public async cleanupExpiredJobs(guildId: string, maxDaysOpen: number = 30, dryRun: boolean = false): Promise<CleanupResult> {
    const result: CleanupResult = {
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
      const expiredJobs = allJobs.filter(job => 
        job.isOpen && 
        job.createdAt && 
        job.createdAt < cutoffDate
      );

      if (expiredJobs.length === 0) {
        logger.info(`No expired jobs found in guild ${guildId}`);
        return result;
      }

      logger.info(`Found ${expiredJobs.length} expired jobs in guild ${guildId}`);

      for (const job of expiredJobs) {
        try {
          result.jobsProcessed++;

          if (!dryRun) {
            // Close the expired job
            const updatedJob = await this.jobRepository.closeJob(
              guildId,
              job._id?.toHexString() || '',
              'system'
            );

            if (updatedJob) {
              await this.auditLogRepository.logAction({
                guildId,
                action: AuditAction.JOB_CLOSED,
                actorId: 'system',
                details: {
                  before: { status: 'open' },
                  after: { status: 'closed' },
                  metadata: {
                    jobId: job._id?.toHexString(),
                    title: job.title,
                    reason: 'expired',
                    daysOpen: Math.floor((Date.now() - job.createdAt!.getTime()) / (1000 * 60 * 60 * 24)),
                  },
                },
                timestamp: new Date(),
              });

              logger.info(`Automatically closed expired job: ${job.title}`);
            }
          } else {
            logger.info(`[DRY RUN] Would close expired job: ${job.title}`);
          }

        } catch (jobError) {
          const errorMsg = `Error processing expired job "${job.title}": ${jobError}`;
          result.errors.push(errorMsg);
          logger.error(errorMsg, jobError);
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

      logger.info(`Expired job cleanup completed for guild ${guildId}. Processed: ${result.jobsProcessed}, Errors: ${result.errors.length}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`General expired job cleanup error: ${error}`);
      logger.error(`Error during expired job cleanup in guild ${guildId}:`, error);
    }

    return result;
  }

  public async getCleanupReport(guildId: string): Promise<{
    jobsNeedingCleanup: CleanupJob[];
    expiredJobsCount: number;
    totalOpenJobs: number;
    oldestOpenJob?: { title: string; daysOpen: number };
  }> {
    try {
      const jobsNeedingCleanup = await this.findJobsNeedingCleanup(guildId);
      const allJobs = await this.jobRepository.findByGuildId(guildId);
      const openJobs = allJobs.filter(job => job.isOpen);
      
      // Find expired jobs (older than 30 days)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const expiredJobs = openJobs.filter(job => 
        job.createdAt && job.createdAt < cutoffDate
      );

      // Find oldest open job
      let oldestOpenJob: { title: string; daysOpen: number } | undefined;
      if (openJobs.length > 0) {
        const oldest = openJobs.reduce((prev, current) => 
          (prev.createdAt && current.createdAt && prev.createdAt < current.createdAt) ? prev : current
        );
        
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
    } catch (error) {
      logger.error(`Error generating cleanup report for guild ${guildId}:`, error);
      throw error;
    }
  }
}