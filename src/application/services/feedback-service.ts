import { 
  Feedback, 
  FeedbackSearchFilters,
  FeedbackSortOptions,
  FeedbackRating
} from '../../validation';
import { 
  FeedbackPaginationOptions,
  StaffPerformanceMetrics,
  FirmPerformanceMetrics
} from '../../domain/entities/feedback'; // Keep interfaces not yet in validation
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { logger } from '../../infrastructure/logger';
import {
  FeedbackSubmissionSchema,
  ValidationHelpers
} from '../../validation';

export class FeedbackService {
  constructor(
    private feedbackRepository: FeedbackRepository,
    private guildConfigRepository: GuildConfigRepository,
    private staffRepository: StaffRepository
  ) {}

  public async submitFeedback(request: unknown): Promise<Feedback> {
    // Validate input using Zod schema
    const validatedRequest = ValidationHelpers.validateOrThrow(
      FeedbackSubmissionSchema,
      request,
      'Feedback submission request'
    );

    logger.info('Submitting feedback', {
      guildId: validatedRequest.guildId,
      submitterId: validatedRequest.submitterId,
      targetStaffId: validatedRequest.targetStaffId,
      rating: validatedRequest.rating
    });

    // Check if submitter is a staff member (they shouldn't be able to submit feedback)
    const submitterStaff = await this.staffRepository.findByUserId(validatedRequest.guildId, validatedRequest.submitterId);
    if (submitterStaff && submitterStaff.status === 'active') {
      throw new Error('Staff members cannot submit feedback. Only clients can provide feedback.');
    }

    // If targeting a specific staff member, verify they exist
    if (validatedRequest.targetStaffId) {
      const targetStaff = await this.staffRepository.findByUserId(validatedRequest.guildId, validatedRequest.targetStaffId);
      if (!targetStaff || targetStaff.status !== 'active') {
        throw new Error('Target staff member not found');
      }
    }

    // Create feedback data
    const feedbackData: Omit<Feedback, '_id' | 'createdAt' | 'updatedAt'> = {
      guildId: validatedRequest.guildId,
      submitterId: validatedRequest.submitterId,
      submitterUsername: validatedRequest.submitterUsername,
      targetStaffId: validatedRequest.targetStaffId,
      targetStaffUsername: validatedRequest.targetStaffUsername,
      rating: validatedRequest.rating as FeedbackRating,
      comment: validatedRequest.comment,
      isForFirm: !validatedRequest.targetStaffId // If no specific staff, it's for the firm
    };

    const createdFeedback = await this.feedbackRepository.add(feedbackData);

    logger.info('Feedback submitted successfully', {
      feedbackId: createdFeedback._id,
      submitterId: validatedRequest.submitterId,
      targetStaffId: validatedRequest.targetStaffId,
      rating: validatedRequest.rating
    });

    return createdFeedback;
  }

  public async searchFeedback(
    filters: FeedbackSearchFilters,
    sort?: FeedbackSortOptions,
    pagination?: FeedbackPaginationOptions
  ): Promise<{
    feedback: Feedback[];
    total: number;
    page?: number;
    totalPages?: number;
  }> {
    const feedback = await this.feedbackRepository.searchFeedback(filters, sort, pagination);
    const total = await this.feedbackRepository.countFeedback(filters);

    const result: {
      feedback: Feedback[];
      total: number;
      page?: number;
      totalPages?: number;
    } = {
      feedback,
      total
    };

    if (pagination) {
      result.page = pagination.page;
      result.totalPages = Math.ceil(total / pagination.limit);
    }

    return result;
  }

  public async getStaffPerformanceMetrics(staffId: string, guildId: string): Promise<StaffPerformanceMetrics | null> {
    return this.feedbackRepository.getStaffPerformanceMetrics(staffId, guildId);
  }

  public async getFirmPerformanceMetrics(guildId: string): Promise<FirmPerformanceMetrics> {
    return this.feedbackRepository.getFirmPerformanceMetrics(guildId);
  }

  public async getFeedbackStats(guildId: string): Promise<{
    totalFeedback: number;
    averageRating: number;
    ratingDistribution: Record<FeedbackRating, number>;
    topRatedStaff: Array<{
      staffId: string;
      staffUsername: string;
      averageRating: number;
      totalFeedback: number;
    }>;
    recentFeedback: Feedback[];
  }> {
    const firmMetrics = await this.getFirmPerformanceMetrics(guildId);
    const recentFeedback = await this.feedbackRepository.getRecentFeedback(guildId, 5);

    // Get top rated staff (minimum 3 feedback entries)
    const topRatedStaff = firmMetrics.staffMetrics
      .filter(staff => staff.totalFeedback >= 3)
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 5)
      .map(staff => ({
        staffId: staff.staffId,
        staffUsername: staff.staffUsername,
        averageRating: staff.averageRating,
        totalFeedback: staff.totalFeedback
      }));

    return {
      totalFeedback: firmMetrics.totalFeedback,
      averageRating: firmMetrics.averageRating,
      ratingDistribution: firmMetrics.ratingDistribution,
      topRatedStaff,
      recentFeedback
    };
  }

  public async getFeedbackById(feedbackId: string): Promise<Feedback | null> {
    return this.feedbackRepository.findById(feedbackId);
  }

  public async getFeedbackBySubmitter(submitterId: string): Promise<Feedback[]> {
    return this.feedbackRepository.getFeedbackBySubmitter(submitterId);
  }

  public async getFeedbackByStaff(targetStaffId: string): Promise<Feedback[]> {
    return this.feedbackRepository.getFeedbackByStaff(targetStaffId);
  }

  public async getFirmWideFeedback(guildId: string): Promise<Feedback[]> {
    return this.feedbackRepository.getFirmWideFeedback(guildId);
  }

  public async getFeedbackChannelId(guildId: string): Promise<string | null> {
    const config = await this.guildConfigRepository.findByGuildId(guildId);
    return config?.feedbackChannelId || null;
  }

  public async getRecentFeedback(guildId: string, limit = 10): Promise<Feedback[]> {
    return this.feedbackRepository.getRecentFeedback(guildId, limit);
  }

  public async calculateRatingTrend(staffId: string, guildId: string, days = 30): Promise<{
    currentPeriodAverage: number;
    previousPeriodAverage: number;
    trend: 'improving' | 'declining' | 'stable';
    changePercentage: number;
  }> {
    const endDate = new Date();
    const midDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
    const startDate = new Date(midDate.getTime() - (days * 24 * 60 * 60 * 1000));

    // Get feedback for current period
    const currentPeriodFeedback = await this.feedbackRepository.searchFeedback({
      guildId,
      targetStaffId: staffId,
      startDate: midDate,
      endDate
    });

    // Get feedback for previous period
    const previousPeriodFeedback = await this.feedbackRepository.searchFeedback({
      guildId,
      targetStaffId: staffId,
      startDate,
      endDate: midDate
    });

    const currentPeriodAverage = currentPeriodFeedback.length > 0
      ? currentPeriodFeedback.reduce((sum, f) => sum + f.rating, 0) / currentPeriodFeedback.length
      : 0;

    const previousPeriodAverage = previousPeriodFeedback.length > 0
      ? previousPeriodFeedback.reduce((sum, f) => sum + f.rating, 0) / previousPeriodFeedback.length
      : 0;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    let changePercentage = 0;

    if (previousPeriodAverage > 0) {
      changePercentage = ((currentPeriodAverage - previousPeriodAverage) / previousPeriodAverage) * 100;
      
      if (Math.abs(changePercentage) < 5) { // Less than 5% change is considered stable
        trend = 'stable';
      } else if (changePercentage > 0) {
        trend = 'improving';
      } else {
        trend = 'declining';
      }
    }

    return {
      currentPeriodAverage: parseFloat(currentPeriodAverage.toFixed(2)),
      previousPeriodAverage: parseFloat(previousPeriodAverage.toFixed(2)),
      trend,
      changePercentage: parseFloat(changePercentage.toFixed(2))
    };
  }
}