import { BaseMongoRepository } from './base-mongo-repository';
import { Retainer } from '../../validation';
export declare class RetainerRepository extends BaseMongoRepository<Retainer> {
    constructor();
    findByClient(clientId: unknown): Promise<Retainer[]>;
    findByLawyer(lawyerId: unknown): Promise<Retainer[]>;
    findByStatus(status: unknown): Promise<Retainer[]>;
    findByGuild(guildId: unknown): Promise<Retainer[]>;
    findByGuildAndStatus(guildId: unknown, status: unknown): Promise<Retainer[]>;
    findActiveRetainers(guildId: unknown): Promise<Retainer[]>;
    findPendingRetainers(guildId: unknown): Promise<Retainer[]>;
    findByClientAndStatus(clientId: unknown, status: unknown): Promise<Retainer[]>;
    hasActiveRetainer(clientId: unknown): Promise<boolean>;
    hasPendingRetainer(clientId: unknown): Promise<boolean>;
    findClientRetainers(clientId: unknown, includeAll?: unknown): Promise<Retainer[]>;
    getRetainerStats(guildId: unknown): Promise<{
        total: number;
        active: number;
        pending: number;
        cancelled: number;
    }>;
    cancelPendingRetainers(clientId: unknown): Promise<number>;
}
//# sourceMappingURL=retainer-repository.d.ts.map