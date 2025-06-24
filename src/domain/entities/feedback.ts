import { BaseEntity } from './base';

export interface Feedback extends BaseEntity {
  guildId: string;
  submitterId: string; // Discord user ID of person submitting feedback
  submitterUsername: string; // Discord username for display
  targetStaffId?: string; // Discord user ID of staff member (null for firm-wide feedback)
  targetStaffUsername?: string; // Discord username of staff member
  rating: FeedbackRating; // 1-5 star rating
  comment: string; // Text feedback
  isForFirm: boolean; // True if feedback is for the firm as a whole
}

export enum FeedbackRating {
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
  searchText?: string; // Search in comments
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
  recentFeedback: Feedback[]; // Last 5 feedback entries
}

export interface FirmPerformanceMetrics {
  guildId: string;
  totalFeedback: number;
  averageRating: number;
  staffMetrics: StaffPerformanceMetrics[];
  firmWideFeedback: Feedback[]; // Feedback submitted for the firm as a whole
  ratingDistribution: {
    [FeedbackRating.ONE_STAR]: number;
    [FeedbackRating.TWO_STAR]: number;
    [FeedbackRating.THREE_STAR]: number;
    [FeedbackRating.FOUR_STAR]: number;
    [FeedbackRating.FIVE_STAR]: number;
  };
}

// Validation helpers
export function isValidRating(rating: number): rating is FeedbackRating {
  return Object.values(FeedbackRating).includes(rating as FeedbackRating);
}

export function validateFeedbackSubmission(request: FeedbackSubmissionRequest): string[] {
  const errors: string[] = [];

  if (!request.guildId || request.guildId.trim() === '') {
    errors.push('Guild ID is required');
  }

  if (!request.submitterId || request.submitterId.trim() === '') {
    errors.push('Submitter ID is required');
  }

  if (!request.submitterUsername || request.submitterUsername.trim() === '') {
    errors.push('Submitter username is required');
  }

  if (!isValidRating(request.rating)) {
    errors.push('Rating must be between 1 and 5 stars');
  }

  if (!request.comment || request.comment.trim() === '') {
    errors.push('Comment is required');
  }

  if (request.comment && request.comment.length > 1000) {
    errors.push('Comment cannot exceed 1000 characters');
  }

  // If targetStaffId is provided, targetStaffUsername should also be provided
  if (request.targetStaffId && !request.targetStaffUsername) {
    errors.push('Target staff username is required when staff ID is provided');
  }

  return errors;
}

export function getStarDisplay(rating: FeedbackRating): string {
  const filledStar = '⭐';
  const emptyStar = '☆';
  
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= rating ? filledStar : emptyStar;
  }
  
  return stars;
}

export function getRatingText(rating: FeedbackRating): string {
  switch (rating) {
    case FeedbackRating.ONE_STAR:
      return 'Poor';
    case FeedbackRating.TWO_STAR:
      return 'Fair';
    case FeedbackRating.THREE_STAR:
      return 'Good';
    case FeedbackRating.FOUR_STAR:
      return 'Very Good';
    case FeedbackRating.FIVE_STAR:
      return 'Excellent';
    default:
      return 'Unknown';
  }
}