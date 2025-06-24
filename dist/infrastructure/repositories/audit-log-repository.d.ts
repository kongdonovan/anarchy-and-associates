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
}
//# sourceMappingURL=audit-log-repository.d.ts.map