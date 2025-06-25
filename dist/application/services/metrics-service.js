"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const job_repository_1 = require("../../infrastructure/repositories/job-repository");
const application_repository_1 = require("../../infrastructure/repositories/application-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const feedback_repository_1 = require("../../infrastructure/repositories/feedback-repository");
const retainer_repository_1 = require("../../infrastructure/repositories/retainer-repository");
const logger_1 = require("../../infrastructure/logger");
const case_1 = require("../../domain/entities/case");
class MetricsService {
    constructor() {
        this.staffRepository = new staff_repository_1.StaffRepository();
        this.jobRepository = new job_repository_1.JobRepository();
        this.applicationRepository = new application_repository_1.ApplicationRepository();
        this.caseRepository = new case_repository_1.CaseRepository();
        this.feedbackRepository = new feedback_repository_1.FeedbackRepository();
        this.retainerRepository = new retainer_repository_1.RetainerRepository();
        this.botStartTime = new Date();
    }
    setBotStartTime(startTime) {
        this.botStartTime = startTime;
    }
    async getBotMetrics(guild) {
        try {
            logger_1.logger.info(`Generating bot metrics for guild ${guild.id}`);
            // Calculate uptime
            const uptime = Date.now() - this.botStartTime.getTime();
            const uptimeDuration = this.formatDuration(uptime);
            // Database metrics
            const [allStaff, activeStaff, allCases, openCases, allApplications, pendingApplications, allJobs, openJobs, allRetainers, allFeedback] = await Promise.all([
                this.staffRepository.findByFilters({ guildId: guild.id }),
                this.staffRepository.findByFilters({ guildId: guild.id, status: 'active' }),
                this.caseRepository.findByFilters({ guildId: guild.id }),
                this.caseRepository.findByFilters({ guildId: guild.id, status: case_1.CaseStatus.IN_PROGRESS }),
                this.applicationRepository.findByFilters({ guildId: guild.id }),
                this.applicationRepository.findByFilters({ guildId: guild.id, status: 'pending' }),
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
        }
        catch (error) {
            logger_1.logger.error('Error generating bot metrics:', error);
            throw error;
        }
    }
    async getLawyerStats(guild, userId) {
        try {
            logger_1.logger.info(`Generating lawyer stats for guild ${guild.id}, user: ${userId || 'all'}`);
            if (userId) {
                return await this.getSingleLawyerStats(guild, userId);
            }
            else {
                return await this.getAllLawyerStats(guild);
            }
        }
        catch (error) {
            logger_1.logger.error('Error generating lawyer stats:', error);
            throw error;
        }
    }
    async getSingleLawyerStats(guild, userId) {
        // Get staff record
        const staffRecord = await this.staffRepository.findByFilters({
            guildId: guild.id,
            userId: userId,
            status: 'active'
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
    async getAllLawyerStats(guild) {
        // Get all active staff
        const allStaff = await this.staffRepository.findByFilters({
            guildId: guild.id,
            status: 'active'
        });
        // Generate stats for each lawyer
        const lawyerStatsPromises = allStaff.map(async (staff) => {
            try {
                return await this.getSingleLawyerStats(guild, staff.userId);
            }
            catch (error) {
                logger_1.logger.warn(`Failed to get stats for lawyer ${staff.userId}:`, error);
                return null;
            }
        });
        const lawyerStatsResults = await Promise.all(lawyerStatsPromises);
        const stats = lawyerStatsResults.filter((stat) => stat !== null);
        // Calculate summary statistics
        const totalCases = stats.reduce((sum, lawyer) => sum + lawyer.stats.totalCases, 0);
        const totalWonCases = stats.reduce((sum, lawyer) => sum + lawyer.stats.wonCases, 0);
        const overallWinRate = totalCases > 0 ? (totalWonCases / totalCases) * 100 : 0;
        const validDurations = stats
            .map(lawyer => lawyer.stats.averageCaseDuration)
            .filter((duration) => duration !== undefined);
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
    calculateCaseStats(cases) {
        const totalCases = cases.length;
        const wonCases = cases.filter(c => c.result === 'win').length;
        const lostCases = cases.filter(c => c.result === 'loss').length;
        const settledCases = cases.filter(c => c.result === 'settlement').length;
        const otherCases = totalCases - wonCases - lostCases - settledCases;
        const winRate = totalCases > 0 ? (wonCases / totalCases) * 100 : 0;
        // Calculate average case duration for closed cases
        const closedCases = cases.filter(c => c.status === case_1.CaseStatus.CLOSED && c.closedAt);
        let averageCaseDuration;
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
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        }
        else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
exports.MetricsService = MetricsService;
//# sourceMappingURL=metrics-service.js.map