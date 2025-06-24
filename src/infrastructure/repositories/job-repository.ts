import { BaseMongoRepository } from './base-mongo-repository';
import { Job } from '../../domain/entities/job';
import { StaffRole, RoleUtils } from '../../domain/entities/staff-role';
import { logger } from '../logger';

export interface JobSearchFilters {
  isOpen?: boolean;
  staffRole?: StaffRole;
  searchTerm?: string;
  postedBy?: string;
}

export interface JobListResult {
  jobs: Job[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export class JobRepository extends BaseMongoRepository<Job> {
  constructor() {
    super('jobs');
  }

  public async findByGuildId(guildId: string): Promise<Job[]> {
    try {
      return await this.findByFilters({ guildId });
    } catch (error) {
      logger.error(`Error finding jobs for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findOpenJobs(guildId: string): Promise<Job[]> {
    try {
      return await this.findByFilters({ guildId, isOpen: true });
    } catch (error) {
      logger.error(`Error finding open jobs for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findJobsByStaffRole(guildId: string, staffRole: StaffRole): Promise<Job[]> {
    try {
      return await this.findByFilters({ guildId, staffRole });
    } catch (error) {
      logger.error(`Error finding jobs for staff role ${staffRole} in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async searchJobs(
    guildId: string,
    filters: JobSearchFilters,
    page: number = 1,
    limit: number = 5
  ): Promise<JobListResult> {
    try {
      const skip = (page - 1) * limit;
      const mongoFilters: any = { guildId };

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
        .toArray() as Job[];

      return {
        jobs,
        total,
        totalPages,
        currentPage: page,
      };
    } catch (error) {
      logger.error(`Error searching jobs in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async createJob(jobData: Omit<Job, '_id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
    try {
      return await this.add(jobData);
    } catch (error) {
      logger.error('Error creating job:', error);
      throw error;
    }
  }

  public async updateJob(jobId: string, updates: Partial<Job>): Promise<Job | null> {
    try {
      return await this.update(jobId, updates);
    } catch (error) {
      logger.error(`Error updating job ${jobId}:`, error);
      throw error;
    }
  }

  public async closeJob(
    guildId: string,
    jobId: string,
    closedBy: string,
    _removeRole: boolean = false
  ): Promise<Job | null> {
    try {
      const job = await this.findById(jobId);
      if (!job || job.guildId !== guildId) {
        return null;
      }

      const updates: Partial<Job> = {
        isOpen: false,
        closedAt: new Date(),
        closedBy,
      };

      const updatedJob = await this.update(jobId, updates);
      
      if (updatedJob) {
        logger.info(`Job closed: ${job.title} (${jobId}) by ${closedBy} in guild ${guildId}`);
      }

      return updatedJob;
    } catch (error) {
      logger.error(`Error closing job ${jobId}:`, error);
      throw error;
    }
  }

  public async removeJob(guildId: string, jobId: string, removedBy: string): Promise<boolean> {
    try {
      const job = await this.findById(jobId);
      if (!job || job.guildId !== guildId) {
        return false;
      }

      const deleted = await this.delete(jobId);
      
      if (deleted) {
        logger.info(`Job removed: ${job.title} (${jobId}) by ${removedBy} in guild ${guildId}`);
      }

      return deleted;
    } catch (error) {
      logger.error(`Error removing job ${jobId}:`, error);
      throw error;
    }
  }

  public async incrementApplicationCount(jobId: string): Promise<Job | null> {
    try {
      const job = await this.findById(jobId);
      if (!job) {
        return null;
      }

      return await this.update(jobId, {
        applicationCount: job.applicationCount + 1,
      });
    } catch (error) {
      logger.error(`Error incrementing application count for job ${jobId}:`, error);
      throw error;
    }
  }

  public async incrementHiredCount(jobId: string): Promise<Job | null> {
    try {
      const job = await this.findById(jobId);
      if (!job) {
        return null;
      }

      return await this.update(jobId, {
        hiredCount: job.hiredCount + 1,
      });
    } catch (error) {
      logger.error(`Error incrementing hired count for job ${jobId}:`, error);
      throw error;
    }
  }

  public async getJobStatistics(guildId: string): Promise<{
    totalJobs: number;
    openJobs: number;
    closedJobs: number;
    totalApplications: number;
    totalHired: number;
    jobsByRole: Record<StaffRole, number>;
  }> {
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

      const jobsByRole: Record<StaffRole, number> = {} as Record<StaffRole, number>;
      
      // Initialize all roles with 0
      RoleUtils.getAllRoles().forEach(role => {
        jobsByRole[role] = 0;
      });

      // Fill in actual counts
      roleStats.forEach(stat => {
        if (RoleUtils.isValidRole(stat._id)) {
          jobsByRole[stat._id as StaffRole] = stat.count;
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
    } catch (error) {
      logger.error(`Error getting job statistics for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findJobsNeedingRoleCleanup(guildId: string): Promise<Job[]> {
    try {
      // Find jobs that are closed but still have Discord roles that need cleanup
      const collection = this.collection;
      const jobs = await collection
        .find({
          guildId,
          isOpen: false,
          roleId: { $exists: true, $ne: '' },
        })
        .toArray() as Job[];

      return jobs;
    } catch (error) {
      logger.error(`Error finding jobs needing role cleanup in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async markRoleCleanupComplete(jobId: string): Promise<Job | null> {
    try {
      return await this.update(jobId, {
        roleId: '', // Clear the role ID to indicate cleanup is complete
      });
    } catch (error) {
      logger.error(`Error marking role cleanup complete for job ${jobId}:`, error);
      throw error;
    }
  }

  public async getOpenJobsForRole(guildId: string, staffRole: StaffRole): Promise<Job[]> {
    try {
      return await this.findByFilters({
        guildId,
        staffRole,
        isOpen: true,
      });
    } catch (error) {
      logger.error(`Error finding open jobs for role ${staffRole} in guild ${guildId}:`, error);
      throw error;
    }
  }
}