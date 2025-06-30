"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackService = void 0;
const logger_1 = require("../../infrastructure/logger");
const validation_1 = require("../../validation");
class FeedbackService {
    constructor(feedbackRepository, guildConfigRepository, staffRepository) {
        this.feedbackRepository = feedbackRepository;
        this.guildConfigRepository = guildConfigRepository;
        this.staffRepository = staffRepository;
    }
    async submitFeedback(request) {
        // Validate input using Zod schema
        const validatedRequest = validation_1.ValidationHelpers.validateOrThrow(validation_1.FeedbackSubmissionSchema, request, 'Feedback submission request');
        logger_1.logger.info('Submitting feedback', {
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
        const feedbackData = {
            guildId: validatedRequest.guildId,
            submitterId: validatedRequest.submitterId,
            submitterUsername: validatedRequest.submitterUsername,
            targetStaffId: validatedRequest.targetStaffId,
            targetStaffUsername: validatedRequest.targetStaffUsername,
            rating: validatedRequest.rating,
            comment: validatedRequest.comment,
            isForFirm: !validatedRequest.targetStaffId // If no specific staff, it's for the firm
        };
        const createdFeedback = await this.feedbackRepository.add(feedbackData);
        logger_1.logger.info('Feedback submitted successfully', {
            feedbackId: createdFeedback._id,
            submitterId: validatedRequest.submitterId,
            targetStaffId: validatedRequest.targetStaffId,
            rating: validatedRequest.rating
        });
        return createdFeedback;
    }
    async searchFeedback(filters, sort, pagination) {
        const feedback = await this.feedbackRepository.searchFeedback(filters, sort, pagination);
        const total = await this.feedbackRepository.countFeedback(filters);
        const result = {
            feedback,
            total
        };
        if (pagination) {
            result.page = pagination.page;
            result.totalPages = Math.ceil(total / pagination.limit);
        }
        return result;
    }
    async getStaffPerformanceMetrics(staffId, guildId) {
        return this.feedbackRepository.getStaffPerformanceMetrics(staffId, guildId);
    }
    async getFirmPerformanceMetrics(guildId) {
        return this.feedbackRepository.getFirmPerformanceMetrics(guildId);
    }
    async getFeedbackStats(guildId) {
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
    async getFeedbackById(feedbackId) {
        return this.feedbackRepository.findById(feedbackId);
    }
    async getFeedbackBySubmitter(submitterId) {
        return this.feedbackRepository.getFeedbackBySubmitter(submitterId);
    }
    async getFeedbackByStaff(targetStaffId) {
        return this.feedbackRepository.getFeedbackByStaff(targetStaffId);
    }
    async getFirmWideFeedback(guildId) {
        return this.feedbackRepository.getFirmWideFeedback(guildId);
    }
    async getFeedbackChannelId(guildId) {
        const config = await this.guildConfigRepository.findByGuildId(guildId);
        return config?.feedbackChannelId || null;
    }
    async getRecentFeedback(guildId, limit = 10) {
        return this.feedbackRepository.getRecentFeedback(guildId, limit);
    }
    async calculateRatingTrend(staffId, guildId, days = 30) {
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
        let trend = 'stable';
        let changePercentage = 0;
        if (previousPeriodAverage > 0) {
            changePercentage = ((currentPeriodAverage - previousPeriodAverage) / previousPeriodAverage) * 100;
            if (Math.abs(changePercentage) < 5) { // Less than 5% change is considered stable
                trend = 'stable';
            }
            else if (changePercentage > 0) {
                trend = 'improving';
            }
            else {
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
exports.FeedbackService = FeedbackService;
//# sourceMappingURL=feedback-service.js.map