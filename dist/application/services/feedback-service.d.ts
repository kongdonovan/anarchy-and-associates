import { Feedback, FeedbackSearchFilters, FeedbackSortOptions, FeedbackRating } from '../../validation';
import { FeedbackPaginationOptions, StaffPerformanceMetrics, FirmPerformanceMetrics } from '../../domain/entities/feedback';
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
export declare class FeedbackService {
    private feedbackRepository;
    private guildConfigRepository;
    private staffRepository;
    constructor(feedbackRepository: FeedbackRepository, guildConfigRepository: GuildConfigRepository, staffRepository: StaffRepository);
    submitFeedback(request: unknown): Promise<Feedback>;
    searchFeedback(filters: FeedbackSearchFilters, sort?: FeedbackSortOptions, pagination?: FeedbackPaginationOptions): Promise<{
        feedback: Feedback[];
        total: number;
        page?: number;
        totalPages?: number;
    }>;
    getStaffPerformanceMetrics(staffId: string, guildId: string): Promise<StaffPerformanceMetrics | null>;
    getFirmPerformanceMetrics(guildId: string): Promise<FirmPerformanceMetrics>;
    getFeedbackStats(guildId: string): Promise<{
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
    }>;
    getFeedbackById(feedbackId: string): Promise<Feedback | null>;
    getFeedbackBySubmitter(submitterId: string): Promise<Feedback[]>;
    getFeedbackByStaff(targetStaffId: string): Promise<Feedback[]>;
    getFirmWideFeedback(guildId: string): Promise<Feedback[]>;
    getFeedbackChannelId(guildId: string): Promise<string | null>;
    getRecentFeedback(guildId: string, limit?: number): Promise<Feedback[]>;
    calculateRatingTrend(staffId: string, guildId: string, days?: number): Promise<{
        currentPeriodAverage: number;
        previousPeriodAverage: number;
        trend: 'improving' | 'declining' | 'stable';
        changePercentage: number;
    }>;
}
//# sourceMappingURL=feedback-service.d.ts.map