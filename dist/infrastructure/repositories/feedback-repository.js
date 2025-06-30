"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const logger_1 = require("../logger");
class FeedbackRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('feedback');
    }
    async searchFeedback(filters, sort, pagination) {
        try {
            const query = this.buildSearchQuery(filters);
            const sortOptions = this.buildSortOptions(sort);
            logger_1.logger.info('Searching feedback', {
                filters,
                sort,
                pagination
            });
            if (pagination) {
                const skip = (pagination.page - 1) * pagination.limit;
                return this.findWithComplexFilter(query, sortOptions, pagination.limit, skip);
            }
            else {
                return this.findWithComplexFilter(query, sortOptions);
            }
        }
        catch (error) {
            logger_1.logger.error('Error searching feedback', { error, filters });
            throw error;
        }
    }
    async countFeedback(filters) {
        try {
            const query = this.buildSearchQuery(filters);
            return this.countWithComplexFilter(query);
        }
        catch (error) {
            logger_1.logger.error('Error counting feedback', { error, filters });
            throw error;
        }
    }
    async getFeedbackBySubmitter(submitterId) {
        try {
            return this.findByFilters({ submitterId });
        }
        catch (error) {
            logger_1.logger.error('Error getting feedback by submitter', { error, submitterId });
            throw error;
        }
    }
    async getFeedbackByStaff(targetStaffId) {
        try {
            return this.findByFilters({ targetStaffId });
        }
        catch (error) {
            logger_1.logger.error('Error getting feedback by staff', { error, targetStaffId });
            throw error;
        }
    }
    async getFirmWideFeedback(guildId) {
        try {
            return this.findByFilters({
                guildId,
                isForFirm: true
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting firm-wide feedback', { error, guildId });
            throw error;
        }
    }
    async getStaffPerformanceMetrics(staffId, guildId) {
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
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0
            };
            feedback.forEach(f => {
                if (f.rating && f.rating >= 1 && f.rating <= 5) {
                    const rating = f.rating;
                    const current = ratingDistribution[rating];
                    if (current !== undefined) {
                        ratingDistribution[rating] = current + 1;
                    }
                }
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
                ratingDistribution: ratingDistribution,
                recentFeedback: recentFeedback
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting staff performance metrics', { error, staffId, guildId });
            throw error;
        }
    }
    async getFirmPerformanceMetrics(guildId) {
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
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0
            };
            allFeedback.forEach(f => {
                if (f.rating && f.rating >= 1 && f.rating <= 5) {
                    const rating = f.rating;
                    const current = ratingDistribution[rating];
                    if (current !== undefined) {
                        ratingDistribution[rating] = current + 1;
                    }
                }
            });
            // Get unique staff members who have received feedback
            const uniqueStaffIds = [...new Set(staffFeedback
                    .filter(f => f.targetStaffId)
                    .map(f => f.targetStaffId))];
            // Get performance metrics for each staff member
            const staffMetrics = [];
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
                staffMetrics: staffMetrics,
                firmWideFeedback: firmWideFeedback,
                ratingDistribution: ratingDistribution
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting firm performance metrics', { error, guildId });
            throw error;
        }
    }
    async getRecentFeedback(guildId, limit = 10) {
        try {
            return this.findWithComplexFilter({ guildId }, { createdAt: -1 }, limit);
        }
        catch (error) {
            logger_1.logger.error('Error getting recent feedback', { error, guildId, limit });
            throw error;
        }
    }
    buildSearchQuery(filters) {
        const query = {
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
    buildSortOptions(sort) {
        if (!sort) {
            return { createdAt: -1 }; // Default: newest first
        }
        const direction = sort.direction === 'asc' ? 1 : -1;
        return { [sort.field]: direction };
    }
}
exports.FeedbackRepository = FeedbackRepository;
//# sourceMappingURL=feedback-repository.js.map