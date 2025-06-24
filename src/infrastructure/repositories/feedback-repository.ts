import { BaseMongoRepository } from './base-mongo-repository';
import { 
  Feedback, 
  FeedbackSearchFilters, 
  FeedbackSortOptions, 
  FeedbackPaginationOptions,
  StaffPerformanceMetrics,
  FirmPerformanceMetrics,
  FeedbackRating
} from '../../domain/entities/feedback';
import { Filter, Sort } from 'mongodb';
import { logger } from '../logger';

export class FeedbackRepository extends BaseMongoRepository<Feedback> {
  constructor() {
    super('feedback');
  }

  public async searchFeedback(
    filters: FeedbackSearchFilters,
    sort?: FeedbackSortOptions,
    pagination?: FeedbackPaginationOptions
  ): Promise<Feedback[]> {
    try {
      const query = this.buildSearchQuery(filters);
      const sortOptions = this.buildSortOptions(sort);

      logger.info('Searching feedback', {
        filters,
        sort,
        pagination
      });

      if (pagination) {
        const skip = (pagination.page - 1) * pagination.limit;
        return this.findWithComplexFilter(query, sortOptions, pagination.limit, skip);
      } else {
        return this.findWithComplexFilter(query, sortOptions);
      }
    } catch (error) {
      logger.error('Error searching feedback', { error, filters });
      throw error;
    }
  }

  public async countFeedback(filters: FeedbackSearchFilters): Promise<number> {
    try {
      const query = this.buildSearchQuery(filters);
      return this.countWithComplexFilter(query);
    } catch (error) {
      logger.error('Error counting feedback', { error, filters });
      throw error;
    }
  }

  public async getFeedbackBySubmitter(submitterId: string): Promise<Feedback[]> {
    try {
      return this.findByFilters({ submitterId });
    } catch (error) {
      logger.error('Error getting feedback by submitter', { error, submitterId });
      throw error;
    }
  }

  public async getFeedbackByStaff(targetStaffId: string): Promise<Feedback[]> {
    try {
      return this.findByFilters({ targetStaffId });
    } catch (error) {
      logger.error('Error getting feedback by staff', { error, targetStaffId });
      throw error;
    }
  }

  public async getFirmWideFeedback(guildId: string): Promise<Feedback[]> {
    try {
      return this.findByFilters({ 
        guildId,
        isForFirm: true 
      });
    } catch (error) {
      logger.error('Error getting firm-wide feedback', { error, guildId });
      throw error;
    }
  }

  public async getStaffPerformanceMetrics(staffId: string, guildId: string): Promise<StaffPerformanceMetrics | null> {
    try {
      const feedback = await this.findByFilters({
        guildId,
        targetStaffId: staffId
      });

      if (feedback.length === 0) {
        return null;
      }

      // Calculate metrics
      const totalFeedback = feedback.length;
      const totalRating = feedback.reduce((sum, f) => sum + f.rating, 0);
      const averageRating = parseFloat((totalRating / totalFeedback).toFixed(2));

      // Rating distribution
      const ratingDistribution = {
        [FeedbackRating.ONE_STAR]: 0,
        [FeedbackRating.TWO_STAR]: 0,
        [FeedbackRating.THREE_STAR]: 0,
        [FeedbackRating.FOUR_STAR]: 0,
        [FeedbackRating.FIVE_STAR]: 0
      };

      feedback.forEach(f => {
        ratingDistribution[f.rating]++;
      });

      // Recent feedback (last 5)
      const recentFeedback = feedback
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5);

      return {
        staffId,
        staffUsername: feedback[0]?.targetStaffUsername || '',
        totalFeedback,
        averageRating,
        ratingDistribution,
        recentFeedback
      };
    } catch (error) {
      logger.error('Error getting staff performance metrics', { error, staffId, guildId });
      throw error;
    }
  }

  public async getFirmPerformanceMetrics(guildId: string): Promise<FirmPerformanceMetrics> {
    try {
      // Get all feedback for the guild
      const allFeedback = await this.findByFilters({ guildId });
      
      // Separate staff feedback and firm-wide feedback
      const staffFeedback = allFeedback.filter(f => !f.isForFirm);
      const firmWideFeedback = allFeedback.filter(f => f.isForFirm);

      // Calculate overall metrics
      const totalFeedback = allFeedback.length;
      const averageRating = totalFeedback > 0 
        ? parseFloat((allFeedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback).toFixed(2))
        : 0;

      // Overall rating distribution
      const ratingDistribution = {
        [FeedbackRating.ONE_STAR]: 0,
        [FeedbackRating.TWO_STAR]: 0,
        [FeedbackRating.THREE_STAR]: 0,
        [FeedbackRating.FOUR_STAR]: 0,
        [FeedbackRating.FIVE_STAR]: 0
      };

      allFeedback.forEach(f => {
        ratingDistribution[f.rating]++;
      });

      // Get unique staff members who have received feedback
      const uniqueStaffIds = [...new Set(
        staffFeedback
          .filter(f => f.targetStaffId)
          .map(f => f.targetStaffId!)
      )];

      // Get performance metrics for each staff member
      const staffMetrics: StaffPerformanceMetrics[] = [];
      for (const staffId of uniqueStaffIds) {
        const metrics = await this.getStaffPerformanceMetrics(staffId, guildId);
        if (metrics) {
          staffMetrics.push(metrics);
        }
      }

      return {
        guildId,
        totalFeedback,
        averageRating,
        staffMetrics,
        firmWideFeedback,
        ratingDistribution
      };
    } catch (error) {
      logger.error('Error getting firm performance metrics', { error, guildId });
      throw error;
    }
  }

  public async getRecentFeedback(guildId: string, limit = 10): Promise<Feedback[]> {
    try {
      return this.findWithComplexFilter(
        { guildId },
        { createdAt: -1 },
        limit
      );
    } catch (error) {
      logger.error('Error getting recent feedback', { error, guildId, limit });
      throw error;
    }
  }

  private buildSearchQuery(filters: FeedbackSearchFilters): Filter<Feedback> {
    const query: Filter<Feedback> = {
      guildId: filters.guildId
    };

    if (filters.submitterId !== undefined) {
      query.submitterId = filters.submitterId;
    }

    if (filters.targetStaffId !== undefined) {
      query.targetStaffId = filters.targetStaffId;
    }

    if (filters.rating !== undefined) {
      query.rating = filters.rating;
    }

    if (filters.minRating !== undefined || filters.maxRating !== undefined) {
      query.rating = {};
      if (filters.minRating !== undefined) {
        query.rating.$gte = filters.minRating;
      }
      if (filters.maxRating !== undefined) {
        query.rating.$lte = filters.maxRating;
      }
    }

    if (filters.isForFirm !== undefined) {
      query.isForFirm = filters.isForFirm;
    }

    if (filters.startDate !== undefined || filters.endDate !== undefined) {
      query.createdAt = {};
      if (filters.startDate !== undefined) {
        query.createdAt.$gte = filters.startDate;
      }
      if (filters.endDate !== undefined) {
        query.createdAt.$lte = filters.endDate;
      }
    }

    if (filters.searchText !== undefined && filters.searchText.trim() !== '') {
      query.comment = {
        $regex: filters.searchText,
        $options: 'i'
      };
    }

    return query;
  }

  private buildSortOptions(sort?: FeedbackSortOptions): Sort {
    if (!sort) {
      return { createdAt: -1 }; // Default: newest first
    }

    const direction = sort.direction === 'asc' ? 1 : -1;
    return { [sort.field]: direction };
  }
}