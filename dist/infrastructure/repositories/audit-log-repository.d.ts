import { BaseMongoRepository } from './base-mongo-repository';
import { AuditLog, AuditAction } from '../../domain/entities/audit-log';
export declare class AuditLogRepository extends BaseMongoRepository<AuditLog> {
    constructor();
    logAction(auditLog: Omit<AuditLog, '_id' | 'createdAt' | 'updatedAt'>): Promise<AuditLog>;
    findByGuildId(guildId: string, limit?: number): Promise<AuditLog[]>;
    findByAction(guildId: string, action: AuditAction, limit?: number): Promise<AuditLog[]>;
    findByActor(guildId: string, actorId: string, limit?: number): Promise<AuditLog[]>;
    findByTarget(guildId: string, targetId: string, limit?: number): Promise<AuditLog[]>;
    findByDateRange(guildId: string, startDate: Date, endDate: Date, limit?: number): Promise<AuditLog[]>;
    getActionCounts(guildId: string): Promise<Record<AuditAction, number>>;
    /**
     * Log a guild owner bypass with detailed tracking
     */
    logGuildOwnerBypass(guildId: string, actorId: string, targetId: string | undefined, businessRuleViolated: string, originalValidationErrors: string[], bypassReason?: string, metadata?: Record<string, any>): Promise<AuditLog>;
    /**
     * Log a role limit bypass specifically
     */
    logRoleLimitBypass(guildId: string, actorId: string, targetId: string, role: string, currentCount: number, maxCount: number, bypassReason?: string): Promise<AuditLog>;
    /**
     * Log a business rule violation attempt
     */
    logBusinessRuleViolation(guildId: string, actorId: string, ruleViolated: string, violationDetails: string[], action: AuditAction, targetId?: string, metadata?: Record<string, any>): Promise<AuditLog>;
    /**
     * Find all guild owner bypasses
     */
    findGuildOwnerBypasses(guildId: string, limit?: number): Promise<AuditLog[]>;
    /**
     * Find business rule violations
     */
    findBusinessRuleViolations(guildId: string, limit?: number): Promise<AuditLog[]>;
    /**
     * Get bypass statistics for a guild
     */
    getBypassStats(guildId: string): Promise<{
        totalBypasses: number;
        roleLimitBypasses: number;
        businessRuleViolations: number;
        recentBypasses: number;
    }>;
}
//# sourceMappingURL=audit-log-repository.d.ts.map