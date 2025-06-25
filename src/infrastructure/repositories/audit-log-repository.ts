import { BaseMongoRepository } from './base-mongo-repository';
import { AuditLog, AuditAction } from '../../domain/entities/audit-log';
import { logger } from '../logger';

export class AuditLogRepository extends BaseMongoRepository<AuditLog> {
  constructor() {
    super('audit_logs');
  }

  public async logAction(auditLog: Omit<AuditLog, '_id' | 'createdAt' | 'updatedAt'>): Promise<AuditLog> {
    try {
      return await this.add(auditLog);
    } catch (error) {
      logger.error('Error creating audit log entry:', error);
      throw error;
    }
  }

  public async findByGuildId(guildId: string, limit: number = 50): Promise<AuditLog[]> {
    try {
      const collection = this.collection;
      const logs = await collection
        .find({ guildId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      return logs as AuditLog[];
    } catch (error) {
      logger.error(`Error finding audit logs for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findByAction(
    guildId: string, 
    action: AuditAction, 
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      return await this.findMany({ guildId, action }, limit);
    } catch (error) {
      logger.error(`Error finding audit logs by action ${action} for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findByActor(
    guildId: string,
    actorId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      return await this.findMany({ guildId, actorId }, limit);
    } catch (error) {
      logger.error(`Error finding audit logs by actor ${actorId} for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findByTarget(
    guildId: string,
    targetId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      return await this.findMany({ guildId, targetId }, limit);
    } catch (error) {
      logger.error(`Error finding audit logs by target ${targetId} for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findByDateRange(
    guildId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<AuditLog[]> {
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
      
      return logs as AuditLog[];
    } catch (error) {
      logger.error(`Error finding audit logs by date range for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async getActionCounts(guildId: string): Promise<Record<AuditAction, number>> {
    try {
      const collection = this.collection;
      const pipeline = [
        { $match: { guildId } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
      ];
      
      const results = await collection.aggregate(pipeline).toArray();
      const counts: Record<AuditAction, number> = {} as Record<AuditAction, number>;
      
      // Initialize all actions with 0
      Object.values(AuditAction).forEach(action => {
        counts[action] = 0;
      });
      
      // Fill in actual counts
      results.forEach(result => {
        if (result._id && Object.values(AuditAction).includes(result._id)) {
          counts[result._id as AuditAction] = result.count;
        }
      });
      
      return counts;
    } catch (error) {
      logger.error(`Error getting action counts for guild ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Log a guild owner bypass with detailed tracking
   */
  public async logGuildOwnerBypass(
    guildId: string,
    actorId: string,
    targetId: string | undefined,
    businessRuleViolated: string,
    originalValidationErrors: string[],
    bypassReason?: string,
    metadata?: Record<string, any>
  ): Promise<AuditLog> {
    try {
      const auditLog: Omit<AuditLog, '_id' | 'createdAt' | 'updatedAt'> = {
        guildId,
        action: AuditAction.GUILD_OWNER_BYPASS,
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
      
      logger.warn('Guild owner bypass logged', {
        guildId,
        actorId,
        targetId,
        businessRuleViolated,
        bypassReason
      });
      
      return result;
    } catch (error) {
      logger.error('Error logging guild owner bypass:', error);
      throw error;
    }
  }

  /**
   * Log a role limit bypass specifically
   */
  public async logRoleLimitBypass(
    guildId: string,
    actorId: string,
    targetId: string,
    role: string,
    currentCount: number,
    maxCount: number,
    bypassReason?: string
  ): Promise<AuditLog> {
    try {
      const auditLog: Omit<AuditLog, '_id' | 'createdAt' | 'updatedAt'> = {
        guildId,
        action: AuditAction.ROLE_LIMIT_BYPASSED,
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
      
      logger.warn('Role limit bypass logged', {
        guildId,
        actorId,
        targetId,
        role,
        currentCount,
        maxCount,
        bypassReason
      });
      
      return result;
    } catch (error) {
      logger.error('Error logging role limit bypass:', error);
      throw error;
    }
  }

  /**
   * Log a business rule violation attempt
   */
  public async logBusinessRuleViolation(
    guildId: string,
    actorId: string,
    ruleViolated: string,
    violationDetails: string[],
    action: AuditAction,
    targetId?: string,
    metadata?: Record<string, any>
  ): Promise<AuditLog> {
    try {
      const auditLog: Omit<AuditLog, '_id' | 'createdAt' | 'updatedAt'> = {
        guildId,
        action: AuditAction.BUSINESS_RULE_VIOLATION,
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
      
      logger.warn('Business rule violation logged', {
        guildId,
        actorId,
        targetId,
        ruleViolated,
        violationDetails
      });
      
      return result;
    } catch (error) {
      logger.error('Error logging business rule violation:', error);
      throw error;
    }
  }

  /**
   * Find all guild owner bypasses
   */
  public async findGuildOwnerBypasses(
    guildId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
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
      
      return logs as AuditLog[];
    } catch (error) {
      logger.error(`Error finding guild owner bypasses for guild ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Find business rule violations
   */
  public async findBusinessRuleViolations(
    guildId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      const collection = this.collection;
      const logs = await collection
        .find({ 
          guildId, 
          action: AuditAction.BUSINESS_RULE_VIOLATION 
        })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      return logs as AuditLog[];
    } catch (error) {
      logger.error(`Error finding business rule violations for guild ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Get bypass statistics for a guild
   */
  public async getBypassStats(guildId: string): Promise<{
    totalBypasses: number;
    roleLimitBypasses: number;
    businessRuleViolations: number;
    recentBypasses: number; // Last 7 days
  }> {
    try {
      const collection = this.collection;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [totalBypasses, roleLimitBypasses, businessRuleViolations, recentBypasses] = await Promise.all([
        collection.countDocuments({ guildId, isGuildOwnerBypass: true }),
        collection.countDocuments({ guildId, action: AuditAction.ROLE_LIMIT_BYPASSED }),
        collection.countDocuments({ guildId, action: AuditAction.BUSINESS_RULE_VIOLATION }),
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
    } catch (error) {
      logger.error(`Error getting bypass stats for guild ${guildId}:`, error);
      throw error;
    }
  }
}