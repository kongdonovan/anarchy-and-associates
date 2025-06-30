import { BaseMongoRepository } from './base-mongo-repository';
import { RoleUtils } from '../../domain/entities/staff-role'; // Keep RoleUtils as it contains business logic
import { logger } from '../logger';
import { 
  Job,
  StaffRole,
  ValidationHelpers,
  DiscordSnowflakeSchema,
  StaffRoleSchema,
  z
} from '../../validation';

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

// Validation schemas
const JobSearchFiltersSchema = z.object({
  isOpen: z.boolean().optional(),
  staffRole: StaffRoleSchema.optional(),
  searchTerm: z.string().optional(),
  postedBy: DiscordSnowflakeSchema.optional(),
});

export class JobRepository extends BaseMongoRepository<Job> {
  constructor() {
    super('jobs');
  }

  public async findByGuildId(guildId: unknown): Promise<Job[]> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      return await this.findByFilters({ guildId: validatedGuildId });
    } catch (error) {
      logger.error(`Error finding jobs for guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async findOpenJobs(guildId: unknown): Promise<Job[]> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      return await this.findByFilters({ guildId: validatedGuildId, isOpen: true });
    } catch (error) {
      logger.error(`Error finding open jobs for guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async findJobsByStaffRole(guildId: unknown, staffRole: unknown): Promise<Job[]> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedStaffRole = ValidationHelpers.validateOrThrow(
        StaffRoleSchema,
        staffRole,
        'Staff role'
      );
      return await this.findByFilters({ 
        guildId: validatedGuildId, 
        staffRole: validatedStaffRole as StaffRole 
      });
    } catch (error) {
      logger.error(`Error finding jobs for staff role ${String(staffRole)} in guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async searchJobs(
    guildId: unknown,
    filters: unknown,
    page: unknown = 1,
    limit: unknown = 5
  ): Promise<JobListResult> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedFilters = ValidationHelpers.validateOrThrow(
        JobSearchFiltersSchema,
        filters,
        'Job search filters'
      );
      const validatedPage = ValidationHelpers.validateOrThrow(
        z.number().int().positive(),
        page,
        'Page number'
      );
      const validatedLimit = ValidationHelpers.validateOrThrow(
        z.number().int().positive().max(100),
        limit,
        'Page limit'
      );

      const skip = (validatedPage - 1) * validatedLimit;
      const mongoFilters: any = { guildId: validatedGuildId };

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
      
      const jobs = jobDocs.map(doc => this.fromMongoDoc(doc)).filter(job => job !== null) as Job[];

      return {
        jobs,
        total,
        totalPages,
        currentPage: validatedPage,
      };
    } catch (error) {
      logger.error(`Error searching jobs in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async createJob(jobData: unknown): Promise<Job> {
    try {
      // Create a partial job schema for the input (without _id, createdAt, updatedAt)
      const JobDataSchema = z.object({
        guildId: DiscordSnowflakeSchema,
        title: z.string(),
        description: z.string(),
        staffRole: z.union([StaffRoleSchema, z.string()]),
        roleId: DiscordSnowflakeSchema,
        limit: z.number().int().positive().optional(),
        isOpen: z.boolean(),
        questions: z.array(z.any()).default([]), // Simplified for now
        postedBy: DiscordSnowflakeSchema,
        closedAt: z.date().optional(),
        closedBy: DiscordSnowflakeSchema.optional(),
        applicationCount: z.number().int().nonnegative().default(0),
        hiredCount: z.number().int().nonnegative().default(0),
      });
      
      const validatedJobData = ValidationHelpers.validateOrThrow(
        JobDataSchema,
        jobData,
        'Job data'
      );
      
      return await this.add(validatedJobData as Omit<Job, '_id' | 'createdAt' | 'updatedAt'>);
    } catch (error) {
      logger.error('Error creating job:', error);
      throw error;
    }
  }

  public async updateJob(jobId: unknown, updates: unknown): Promise<Job | null> {
    try {
      const validatedJobId = ValidationHelpers.validateOrThrow(
        z.string(),
        jobId,
        'Job ID'
      );
      
      // Create a partial job schema for updates
      const JobUpdateSchema = z.object({
        guildId: DiscordSnowflakeSchema.optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        staffRole: z.union([StaffRoleSchema, z.string()]).optional(),
        roleId: DiscordSnowflakeSchema.optional(),
        limit: z.number().int().positive().optional(),
        isOpen: z.boolean().optional(),
        questions: z.array(z.any()).optional(),
        postedBy: DiscordSnowflakeSchema.optional(),
        closedAt: z.date().optional(),
        closedBy: DiscordSnowflakeSchema.optional(),
        applicationCount: z.number().int().nonnegative().optional(),
        hiredCount: z.number().int().nonnegative().optional(),
      }).partial();
      
      const validatedUpdates = ValidationHelpers.validateOrThrow(
        JobUpdateSchema,
        updates,
        'Job updates'
      );
      
      return await this.update(validatedJobId, validatedUpdates as Partial<Job>);
    } catch (error) {
      logger.error(`Error updating job ${String(jobId)}:`, error);
      throw error;
    }
  }

  public async closeJob(
    guildId: unknown,
    jobId: unknown,
    closedBy: unknown,
    _removeRole: unknown = false
  ): Promise<Job | null> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedJobId = ValidationHelpers.validateOrThrow(
        z.string(),
        jobId,
        'Job ID'
      );
      const validatedClosedBy = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        closedBy,
        'Closed by user ID'
      );
      // Validate the removeRole parameter even though it's not used
      ValidationHelpers.validateOrThrow(
        z.boolean(),
        _removeRole,
        'Remove role flag'
      );

      const job = await this.findById(validatedJobId);
      if (!job || job.guildId !== validatedGuildId) {
        return null;
      }

      const updates: Partial<Job> = {
        isOpen: false,
        closedAt: new Date(),
        closedBy: validatedClosedBy,
      };

      const updatedJob = await this.update(validatedJobId, updates);
      
      if (updatedJob) {
        logger.info(`Job closed: ${job.title} (${validatedJobId}) by ${validatedClosedBy} in guild ${validatedGuildId}`);
      }

      return updatedJob;
    } catch (error) {
      logger.error(`Error closing job ${String(jobId)}:`, error);
      throw error;
    }
  }

  public async removeJob(guildId: unknown, jobId: unknown, removedBy: unknown): Promise<boolean> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedJobId = ValidationHelpers.validateOrThrow(
        z.string(),
        jobId,
        'Job ID'
      );
      const validatedRemovedBy = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        removedBy,
        'Removed by user ID'
      );

      const job = await this.findById(validatedJobId);
      if (!job || job.guildId !== validatedGuildId) {
        return false;
      }

      const deleted = await this.delete(validatedJobId);
      
      if (deleted) {
        logger.info(`Job removed: ${job.title} (${validatedJobId}) by ${validatedRemovedBy} in guild ${validatedGuildId}`);
      }

      return deleted;
    } catch (error) {
      logger.error(`Error removing job ${String(jobId)}:`, error);
      throw error;
    }
  }

  public async incrementApplicationCount(jobId: unknown): Promise<Job | null> {
    try {
      const validatedJobId = ValidationHelpers.validateOrThrow(
        z.string(),
        jobId,
        'Job ID'
      );

      const job = await this.findById(validatedJobId);
      if (!job) {
        return null;
      }

      return await this.update(validatedJobId, {
        applicationCount: job.applicationCount + 1,
      });
    } catch (error) {
      logger.error(`Error incrementing application count for job ${String(jobId)}:`, error);
      throw error;
    }
  }

  public async incrementHiredCount(jobId: unknown): Promise<Job | null> {
    try {
      const validatedJobId = ValidationHelpers.validateOrThrow(
        z.string(),
        jobId,
        'Job ID'
      );

      const job = await this.findById(validatedJobId);
      if (!job) {
        return null;
      }

      return await this.update(validatedJobId, {
        hiredCount: job.hiredCount + 1,
      });
    } catch (error) {
      logger.error(`Error incrementing hired count for job ${String(jobId)}:`, error);
      throw error;
    }
  }

  public async getJobStatistics(guildId: unknown): Promise<{
    totalJobs: number;
    openJobs: number;
    closedJobs: number;
    totalApplications: number;
    totalHired: number;
    jobsByRole: Record<StaffRole, number>;
  }> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );

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
      logger.error(`Error getting job statistics for guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async findJobsNeedingRoleCleanup(guildId: unknown): Promise<Job[]> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );

      // Find jobs that are closed but still have Discord roles that need cleanup
      const collection = this.collection;
      const jobDocs = await collection
        .find({
          guildId: validatedGuildId,
          isOpen: false,
          roleId: { $exists: true, $ne: '' },
        })
        .toArray();
      
      const jobs = jobDocs.map(doc => this.fromMongoDoc(doc)).filter(job => job !== null) as Job[];

      return jobs;
    } catch (error) {
      logger.error(`Error finding jobs needing role cleanup in guild ${String(guildId)}:`, error);
      throw error;
    }
  }

  public async markRoleCleanupComplete(jobId: unknown): Promise<Job | null> {
    try {
      const validatedJobId = ValidationHelpers.validateOrThrow(
        z.string(),
        jobId,
        'Job ID'
      );

      return await this.update(validatedJobId, {
        roleId: '', // Clear the role ID to indicate cleanup is complete
      });
    } catch (error) {
      logger.error(`Error marking role cleanup complete for job ${String(jobId)}:`, error);
      throw error;
    }
  }

  public async getOpenJobsForRole(guildId: unknown, staffRole: unknown): Promise<Job[]> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedStaffRole = ValidationHelpers.validateOrThrow(
        StaffRoleSchema,
        staffRole,
        'Staff role'
      );

      return await this.findByFilters({
        guildId: validatedGuildId,
        staffRole: validatedStaffRole as StaffRole,
        isOpen: true,
      });
    } catch (error) {
      logger.error(`Error finding open jobs for role ${String(staffRole)} in guild ${String(guildId)}:`, error);
      throw error;
    }
  }
}