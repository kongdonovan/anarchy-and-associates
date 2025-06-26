import { Guild } from 'discord.js';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { logger } from '../../infrastructure/logger';
import { StaffRole } from '../../domain/entities/staff-role';
import { CaseStatus } from '../../domain/entities/case';

export interface BotMetrics {
  uptime: {
    duration: string;
    startTime: Date;
  };
  database: {
    totalStaff: number;
    activeStaff: number;
    totalCases: number;
    openCases: number;
    totalApplications: number;
    pendingApplications: number;
    totalJobs: number;
    openJobs: number;
    totalRetainers: number;
    totalFeedback: number;
  };
  discord: {
    memberCount: number;
    channelCount: number;
    roleCount: number;
  };
  performance: {
    memoryUsage?: NodeJS.MemoryUsage;
    commandsExecuted?: number;
  };
}

export interface LawyerStats {
  userId: string;
  username?: string;
  displayName?: string;
  role: StaffRole;
  stats: {
    totalCases: number;
    wonCases: number;
    lostCases: number;
    settledCases: number;
    otherCases: number;
    winRate: number;
    averageCaseDuration?: number; // in days
    feedbackCount: number;
    averageRating?: number;
  };
}

export interface AllLawyerStats {
  totalLawyers: number;
  stats: LawyerStats[];
  summary: {
    totalCases: number;
    overallWinRate: number;
    averageCaseDuration: number;
    topPerformer?: LawyerStats;
  };
}

export class MetricsService {
  private staffRepository: StaffRepository;
  private jobRepository: JobRepository;
  private applicationRepository: ApplicationRepository;
  private caseRepository: CaseRepository;
  private feedbackRepository: FeedbackRepository;
  private retainerRepository: RetainerRepository;
  private botStartTime: Date;

  constructor() {
    this.staffRepository = new StaffRepository();
    this.jobRepository = new JobRepository();
    this.applicationRepository = new ApplicationRepository();
    this.caseRepository = new CaseRepository();
    this.feedbackRepository = new FeedbackRepository();
    this.retainerRepository = new RetainerRepository();
    this.botStartTime = new Date();
  }

  setBotStartTime(startTime: Date): void {
    this.botStartTime = startTime;
  }

  async getBotMetrics(guild: Guild): Promise<BotMetrics> {
    try {
      logger.info(`Generating bot metrics for guild ${guild.id}`);

      // Calculate uptime
      const uptime = Date.now() - this.botStartTime.getTime();
      const uptimeDuration = this.formatDuration(uptime);

      // Database metrics
      const [
        allStaff,
        activeStaff,
        allCases,
        openCases,
        allApplications,
        pendingApplications,
        allJobs,
        openJobs,
        allRetainers,
        allFeedback
      ] = await Promise.all([
        this.staffRepository.findByFilters({ guildId: guild.id }),
        this.staffRepository.findByFilters({ guildId: guild.id, status: RetainerStatus.ACTIVE }),
        this.caseRepository.findByFilters({ guildId: guild.id }),
        this.caseRepository.findByFilters({ guildId: guild.id, status: CaseStatus.IN_PROGRESS }),
        this.applicationRepository.findByFilters({ guildId: guild.id }),
        this.applicationRepository.findByFilters({ guildId: guild.id, status: CaseStatus.PENDING }),
        this.jobRepository.findByFilters({ guildId: guild.id }),
        this.jobRepository.findByFilters({ guildId: guild.id, isOpen: true }),
        this.retainerRepository.findByFilters({ guildId: guild.id }),
        this.feedbackRepository.findByFilters({ guildId: guild.id })
      ]);

      // Discord metrics
      await guild.members.fetch();
      const memberCount = guild.memberCount;
      const channelCount = guild.channels.cache.size;
      const roleCount = guild.roles.cache.size;

      return {
        uptime: {
          duration: uptimeDuration,
          startTime: this.botStartTime
        },
        database: {
          totalStaff: allStaff.length,
          activeStaff: activeStaff.length,
          totalCases: allCases.length,
          openCases: openCases.length,
          totalApplications: allApplications.length,
          pendingApplications: pendingApplications.length,
          totalJobs: allJobs.length,
          openJobs: openJobs.length,
          totalRetainers: allRetainers.length,
          totalFeedback: allFeedback.length
        },
        discord: {
          memberCount,
          channelCount,
          roleCount
        },
        performance: {
          memoryUsage: process.memoryUsage()
        }
      };

    } catch (error) {
      logger.error('Error generating bot metrics:', error);
      throw error;
    }
  }

  async getLawyerStats(guild: Guild, userId?: string): Promise<LawyerStats | AllLawyerStats> {
    try {
      logger.info(`Generating lawyer stats for guild ${guild.id}, user: ${userId || 'all'}`);

      if (userId) {
        return await this.getSingleLawyerStats(guild, userId);
      } else {
        return await this.getAllLawyerStats(guild);
      }

    } catch (error) {
      logger.error('Error generating lawyer stats:', error);
      throw error;
    }
  }

  private async getSingleLawyerStats(guild: Guild, userId: string): Promise<LawyerStats> {
    // Get staff record
    const staffRecord = await this.staffRepository.findByFilters({ 
      guildId: guild.id, 
      userId: userId,
      status: RetainerStatus.ACTIVE
    });

    if (staffRecord.length === 0) {
      throw new Error('User is not an active staff member');
    }

    const staffMember = staffRecord[0];

    // Get Discord member info
    const member = guild.members.cache.get(userId);

    // Get all cases assigned to this lawyer
    const allCases = await this.caseRepository.findByFilters({ guildId: guild.id });
    const assignedCases = allCases.filter(c => c.assignedLawyerIds.includes(userId));

    // Calculate case statistics
    const stats = this.calculateCaseStats(assignedCases);

    // Get feedback for this lawyer
    const feedback = await this.feedbackRepository.findByFilters({
      guildId: guild.id,
      targetStaffId: userId
    });

    const averageRating = feedback.length > 0 
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length 
      : undefined;

    if (!staffMember) {
      throw new Error('Staff member not found');
    }

    return {
      userId,
      username: member?.user.username,
      displayName: member?.displayName,
      role: staffMember.role,
      stats: {
        ...stats,
        feedbackCount: feedback.length,
        averageRating
      }
    };
  }

  private async getAllLawyerStats(guild: Guild): Promise<AllLawyerStats> {
    // Get all active staff
    const allStaff = await this.staffRepository.findByFilters({ 
      guildId: guild.id, 
      status: RetainerStatus.ACTIVE 
    });


    // Generate stats for each lawyer
    const lawyerStatsPromises = allStaff.map(async (staff) => {
      try {
        return await this.getSingleLawyerStats(guild, staff.userId);
      } catch (error) {
        logger.warn(`Failed to get stats for lawyer ${staff.userId}:`, error);
        return null;
      }
    });

    const lawyerStatsResults = await Promise.all(lawyerStatsPromises);
    const stats = lawyerStatsResults.filter((stat): stat is LawyerStats => stat !== null);

    // Calculate summary statistics
    const totalCases = stats.reduce((sum, lawyer) => sum + lawyer.stats.totalCases, 0);
    const totalWonCases = stats.reduce((sum, lawyer) => sum + lawyer.stats.wonCases, 0);
    const overallWinRate = totalCases > 0 ? (totalWonCases / totalCases) * 100 : 0;

    const validDurations = stats
      .map(lawyer => lawyer.stats.averageCaseDuration)
      .filter((duration): duration is number => duration !== undefined);
    
    const averageCaseDuration = validDurations.length > 0 
      ? validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length 
      : 0;

    // Find top performer (highest win rate with at least 3 cases)
    const topPerformer = stats
      .filter(lawyer => lawyer.stats.totalCases >= 3)
      .sort((a, b) => b.stats.winRate - a.stats.winRate)[0];

    return {
      totalLawyers: stats.length,
      stats: stats.sort((a, b) => b.stats.totalCases - a.stats.totalCases), // Sort by total cases
      summary: {
        totalCases,
        overallWinRate,
        averageCaseDuration,
        topPerformer
      }
    };
  }

  private calculateCaseStats(cases: any[]) {
    const totalCases = cases.length;
    
    const wonCases = cases.filter(c => c.result === 'win').length;
    const lostCases = cases.filter(c => c.result === 'loss').length;
    const settledCases = cases.filter(c => c.result === 'settlement').length;
    const otherCases = totalCases - wonCases - lostCases - settledCases;
    
    const winRate = totalCases > 0 ? (wonCases / totalCases) * 100 : 0;

    // Calculate average case duration for closed cases
    const closedCases = cases.filter(c => c.status === CaseStatus.CLOSED && c.closedAt);
    let averageCaseDuration: number | undefined;

    if (closedCases.length > 0) {
      const totalDuration = closedCases.reduce((sum, c) => {
        const duration = new Date(c.closedAt).getTime() - new Date(c.createdAt).getTime();
        return sum + duration;
      }, 0);
      
      averageCaseDuration = totalDuration / closedCases.length / (1000 * 60 * 60 * 24); // Convert to days
    }

    return {
      totalCases,
      wonCases,
      lostCases,
      settledCases,
      otherCases,
      winRate,
      averageCaseDuration
    };
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}