import { BaseMongoRepository } from './base-mongo-repository';
import { Feedback, FeedbackSearchFilters, FeedbackSortOptions } from '../../validation';
import { FeedbackPaginationOptions, StaffPerformanceMetrics, FirmPerformanceMetrics } from '../../domain/entities/feedback';
export declare class FeedbackRepository extends BaseMongoRepository<Feedback> {
    constructor();
    searchFeedback(filters: FeedbackSearchFilters, sort?: FeedbackSortOptions, pagination?: FeedbackPaginationOptions): Promise<Feedback[]>;
    countFeedback(filters: FeedbackSearchFilters): Promise<number>;
    getFeedbackBySubmitter(submitterId: string): Promise<Feedback[]>;
    getFeedbackByStaff(targetStaffId: string): Promise<Feedback[]>;
    getFirmWideFeedback(guildId: string): Promise<Feedback[]>;
    getStaffPerformanceMetrics(staffId: string, guildId: string): Promise<StaffPerformanceMetrics | null>;
    getFirmPerformanceMetrics(guildId: string): Promise<FirmPerformanceMetrics>;
    getRecentFeedback(guildId: string, limit?: number): Promise<Feedback[]>;
    private buildSearchQuery;
    private buildSortOptions;
}
//# sourceMappingURL=feedback-repository.d.ts.map