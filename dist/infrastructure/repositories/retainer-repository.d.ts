import { Retainer, RetainerStatus } from '../../domain/entities/retainer';
import { BaseMongoRepository } from './base-mongo-repository';
export declare class RetainerRepository extends BaseMongoRepository<Retainer> {
    constructor();
    findByClient(clientId: string): Promise<Retainer[]>;
    findByLawyer(lawyerId: string): Promise<Retainer[]>;
    findByStatus(status: RetainerStatus): Promise<Retainer[]>;
    findByGuild(guildId: string): Promise<Retainer[]>;
    findByGuildAndStatus(guildId: string, status: RetainerStatus): Promise<Retainer[]>;
    findActiveRetainers(guildId: string): Promise<Retainer[]>;
    findPendingRetainers(guildId: string): Promise<Retainer[]>;
    findByClientAndStatus(clientId: string, status: RetainerStatus): Promise<Retainer[]>;
    hasActiveRetainer(clientId: string): Promise<boolean>;
    hasPendingRetainer(clientId: string): Promise<boolean>;
    findClientRetainers(clientId: string, includeAll?: boolean): Promise<Retainer[]>;
    getRetainerStats(guildId: string): Promise<{
        total: number;
        active: number;
        pending: number;
        cancelled: number;
    }>;
    cancelPendingRetainers(clientId: string): Promise<number>;
}
//# sourceMappingURL=retainer-repository.d.ts.map