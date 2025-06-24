import { BaseEntity } from './base';
export interface Feedback extends BaseEntity {
    guildId: string;
    submitterId: string;
    submitterUsername: string;
    targetStaffId?: string;
    targetStaffUsername?: string;
    rating: FeedbackRating;
    comment: string;
    isForFirm: boolean;
}
export declare enum FeedbackRating {
    ONE_STAR = 1,
    TWO_STAR = 2,
    THREE_STAR = 3,
    FOUR_STAR = 4,
    FIVE_STAR = 5
}
export interface FeedbackSubmissionRequest {
    guildId: string;
    submitterId: string;
    submitterUsername: string;
    targetStaffId?: string;
    targetStaffUsername?: string;
    rating: FeedbackRating;
    comment: string;
}
export interface FeedbackSearchFilters {
    guildId: string;
    submitterId?: string;
    targetStaffId?: string;
    rating?: FeedbackRating;
    minRating?: number;
    maxRating?: number;
    isForFirm?: boolean;
    startDate?: Date;
    endDate?: Date;
    searchText?: string;
}
export interface FeedbackSortOptions {
    field: 'createdAt' | 'rating' | 'submitterUsername' | 'targetStaffUsername';
    direction: 'asc' | 'desc';
}
export interface FeedbackPaginationOptions {
    page: number;
    limit: number;
}
export interface StaffPerformanceMetrics {
    staffId: string;
    staffUsername: string;
    totalFeedback: number;
    averageRating: number;
    ratingDistribution: {
        [FeedbackRating.ONE_STAR]: number;
        [FeedbackRating.TWO_STAR]: number;
        [FeedbackRating.THREE_STAR]: number;
        [FeedbackRating.FOUR_STAR]: number;
        [FeedbackRating.FIVE_STAR]: number;
    };
    recentFeedback: Feedback[];
}
export interface FirmPerformanceMetrics {
    guildId: string;
    totalFeedback: number;
    averageRating: number;
    staffMetrics: StaffPerformanceMetrics[];
    firmWideFeedback: Feedback[];
    ratingDistribution: {
        [FeedbackRating.ONE_STAR]: number;
        [FeedbackRating.TWO_STAR]: number;
        [FeedbackRating.THREE_STAR]: number;
        [FeedbackRating.FOUR_STAR]: number;
        [FeedbackRating.FIVE_STAR]: number;
    };
}
export declare function isValidRating(rating: number): rating is FeedbackRating;
export declare function validateFeedbackSubmission(request: FeedbackSubmissionRequest): string[];
export declare function getStarDisplay(rating: FeedbackRating): string;
export declare function getRatingText(rating: FeedbackRating): string;
//# sourceMappingURL=feedback.d.ts.map