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
}