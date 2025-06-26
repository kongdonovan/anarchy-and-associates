"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const audit_log_1 = require("../../domain/entities/audit-log");
const logger_1 = require("../logger");
class AuditLogRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('audit_logs');
    }
    async logAction(auditLog) {
        try {
            return await this.add(auditLog);
        }
        catch (error) {
            logger_1.logger.error('Error creating audit log entry:', error);
            throw error;
        }
    }
    async findByGuildId(guildId, limit = 50) {
        try {
            const collection = this.collection;
            const logs = await collection
                .find({ guildId })
                .sort({ timestamp: -1 })
                .limit(limit)
                .toArray();
            return logs;
        }
        catch (error) {
            logger_1.logger.error(`Error finding audit logs for guild ${guildId}:`, error);
            throw error;
        }
    }
    async findByAction(guildId, action, limit = 50) {
        try {
            return await this.findMany({ guildId, action }, limit);
        }
        catch (error) {
            logger_1.logger.error(`Error finding audit logs by action ${action} for guild ${guildId}:`, error);
            throw error;
        }
    }
    async findByActor(guildId, actorId, limit = 50) {
        try {
            return await this.findMany({ guildId, actorId }, limit);
        }
        catch (error) {
            logger_1.logger.error(`Error finding audit logs by actor ${actorId} for guild ${guildId}:`, error);
            throw error;
        }
    }
    async findByTarget(guildId, targetId, limit = 50) {
        try {
            return await this.findMany({ guildId, targetId }, limit);
        }
        catch (error) {
            logger_1.logger.error(`Error finding audit logs by target ${targetId} for guild ${guildId}:`, error);
            throw error;
        }
    }
    async findByDateRange(guildId, startDate, endDate, limit = 100) {
        try {
            const collection = this.collection;
            const logs = await collection
                .find({
                guildId,
                timestamp: {
                    $gte: startDate,
                    $lte: endDate,
                },
            })
                .sort({ timestamp: -1 })
                .limit(limit)
                .toArray();
            return logs;
        }
        catch (error) {
            logger_1.logger.error(`Error finding audit logs by date range for guild ${guildId}:`, error);
            throw error;
        }
    }
    async getActionCounts(guildId) {
        try {
            const collection = this.collection;
            const pipeline = [
                { $match: { guildId } },
                { $group: { _id: '$action', count: { $sum: 1 } } },
            ];
            const results = await collection.aggregate(pipeline).toArray();
            const counts = {};
            // Initialize all actions with 0
            Object.values(audit_log_1.AuditAction).forEach(action => {
                counts[action] = 0;
            });
            // Fill in actual counts
            results.forEach(result => {
                if (result._id && Object.values(audit_log_1.AuditAction).includes(result._id)) {
                    counts[result._id] = result.count;
                }
            });
            return counts;
        }
        catch (error) {
            logger_1.logger.error(`Error getting action counts for guild ${guildId}:`, error);
            throw error;
        }
    }
    /**
     * Log a guild owner bypass with detailed tracking
     */
    async logGuildOwnerBypass(guildId, actorId, targetId, businessRuleViolated, originalValidationErrors, bypassReason, metadata) {
        try {
            const auditLog = {
                guildId,
                action: audit_log_1.AuditAction.GUILD_OWNER_BYPASS,
                actorId,
                targetId,
                details: {
                    reason: bypassReason || 'Guild owner bypass executed',
                    metadata,
                    bypassInfo: {
                        bypassType: 'guild-owner',
                        businessRuleViolated,
                        originalValidationErrors,
                        bypassReason,
                        ruleMetadata: metadata
                    }
                },
                timestamp: new Date(),
                isGuildOwnerBypass: true,
                businessRulesBypassed: [businessRuleViolated],
                severity: 'high'
            };
            const result = await this.add(auditLog);
            logger_1.logger.warn('Guild owner bypass logged', {
                guildId,
                actorId,
                targetId,
                businessRuleViolated,
                bypassReason
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error logging guild owner bypass:', error);
            throw error;
        }
    }
    /**
     * Log a role limit bypass specifically
     */
    async logRoleLimitBypass(guildId, actorId, targetId, role, currentCount, maxCount, bypassReason) {
        try {
            const auditLog = {
                guildId,
                action: audit_log_1.AuditAction.ROLE_LIMIT_BYPASSED,
                actorId,
                targetId,
                details: {
                    reason: bypassReason || 'Role limit bypassed by guild owner',
                    metadata: {
                        role,
                        newCount: currentCount + 1,
                        previousLimit: maxCount
                    },
                    bypassInfo: {
                        bypassType: 'guild-owner',
                        businessRuleViolated: 'role-limit',
                        originalValidationErrors: [`Cannot hire ${role}. Maximum limit of ${maxCount} reached (current: ${currentCount})`],
                        bypassReason,
                        currentCount,
                        maxCount,
                        ruleMetadata: { role, newCount: currentCount + 1 }
                    }
                },
                timestamp: new Date(),
                isGuildOwnerBypass: true,
                businessRulesBypassed: ['role-limit'],
                severity: 'medium'
            };
            const result = await this.add(auditLog);
            logger_1.logger.warn('Role limit bypass logged', {
                guildId,
                actorId,
                targetId,
                role,
                currentCount,
                maxCount,
                bypassReason
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error logging role limit bypass:', error);
            throw error;
        }
    }
    /**
     * Log a business rule violation attempt
     */
    async logBusinessRuleViolation(guildId, actorId, ruleViolated, violationDetails, action, targetId, metadata) {
        try {
            const auditLog = {
                guildId,
                action: audit_log_1.AuditAction.BUSINESS_RULE_VIOLATION,
                actorId,
                targetId,
                details: {
                    reason: `Business rule violation: ${ruleViolated}`,
                    metadata: {
                        ...metadata,
                        originalAction: action,
                        violationDetails
                    }
                },
                timestamp: new Date(),
                businessRulesBypassed: [ruleViolated],
                severity: 'high'
            };
            const result = await this.add(auditLog);
            logger_1.logger.warn('Business rule violation logged', {
                guildId,
                actorId,
                targetId,
                ruleViolated,
                violationDetails
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error logging business rule violation:', error);
            throw error;
        }
    }
    /**
     * Find all guild owner bypasses
     */
    async findGuildOwnerBypasses(guildId, limit = 50) {
        try {
            const collection = this.collection;
            const logs = await collection
                .find({
                guildId,
                isGuildOwnerBypass: true
            })
                .sort({ timestamp: -1 })
                .limit(limit)
                .toArray();
            return logs;
        }
        catch (error) {
            logger_1.logger.error(`Error finding guild owner bypasses for guild ${guildId}:`, error);
            throw error;
        }
    }
    /**
     * Find business rule violations
     */
    async findBusinessRuleViolations(guildId, limit = 50) {
        try {
            const collection = this.collection;
            const logs = await collection
                .find({
                guildId,
                action: audit_log_1.AuditAction.BUSINESS_RULE_VIOLATION
            })
                .sort({ timestamp: -1 })
                .limit(limit)
                .toArray();
            return logs;
        }
        catch (error) {
            logger_1.logger.error(`Error finding business rule violations for guild ${guildId}:`, error);
            throw error;
        }
    }
    /**
     * Get bypass statistics for a guild
     */
    async getBypassStats(guildId) {
        try {
            const collection = this.collection;
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const [totalBypasses, roleLimitBypasses, businessRuleViolations, recentBypasses] = await Promise.all([
                collection.countDocuments({ guildId, isGuildOwnerBypass: true }),
                collection.countDocuments({ guildId, action: audit_log_1.AuditAction.ROLE_LIMIT_BYPASSED }),
                collection.countDocuments({ guildId, action: audit_log_1.AuditAction.BUSINESS_RULE_VIOLATION }),
                collection.countDocuments({
                    guildId,
                    isGuildOwnerBypass: true,
                    timestamp: { $gte: sevenDaysAgo }
                })
            ]);
            return {
                totalBypasses,
                roleLimitBypasses,
                businessRuleViolations,
                recentBypasses
            };
        }
        catch (error) {
            logger_1.logger.error(`Error getting bypass stats for guild ${guildId}:`, error);
            throw error;
        }
    }
}
exports.AuditLogRepository = AuditLogRepository;
//# sourceMappingURL=audit-log-repository.js.map