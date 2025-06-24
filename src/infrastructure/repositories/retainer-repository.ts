import { Retainer, RetainerStatus } from '../../domain/entities/retainer';
import { BaseMongoRepository } from './base-mongo-repository';

export class RetainerRepository extends BaseMongoRepository<Retainer> {
  constructor() {
    super('retainers');
  }

  public async findByClient(clientId: string): Promise<Retainer[]> {
    return this.findByFilters({ clientId });
  }

  public async findByLawyer(lawyerId: string): Promise<Retainer[]> {
    return this.findByFilters({ lawyerId });
  }

  public async findByStatus(status: RetainerStatus): Promise<Retainer[]> {
    return this.findByFilters({ status });
  }

  public async findByGuild(guildId: string): Promise<Retainer[]> {
    return this.findByFilters({ guildId });
  }

  public async findByGuildAndStatus(guildId: string, status: RetainerStatus): Promise<Retainer[]> {
    return this.findByFilters({ guildId, status });
  }

  public async findActiveRetainers(guildId: string): Promise<Retainer[]> {
    return this.findByGuildAndStatus(guildId, RetainerStatus.SIGNED);
  }

  public async findPendingRetainers(guildId: string): Promise<Retainer[]> {
    return this.findByGuildAndStatus(guildId, RetainerStatus.PENDING);
  }

  public async findByClientAndStatus(clientId: string, status: RetainerStatus): Promise<Retainer[]> {
    return this.findByFilters({ clientId, status });
  }

  public async hasActiveRetainer(clientId: string): Promise<boolean> {
    const activeRetainers = await this.findByClientAndStatus(clientId, RetainerStatus.SIGNED);
    return activeRetainers.length > 0;
  }

  public async hasPendingRetainer(clientId: string): Promise<boolean> {
    const pendingRetainers = await this.findByClientAndStatus(clientId, RetainerStatus.PENDING);
    return pendingRetainers.length > 0;
  }

  public async findClientRetainers(clientId: string, includeAll = false): Promise<Retainer[]> {
    if (includeAll) {
      return this.findByClient(clientId);
    }
    // Only return active retainers by default
    return this.findByClientAndStatus(clientId, RetainerStatus.SIGNED);
  }

  public async getRetainerStats(guildId: string): Promise<{
    total: number;
    active: number;
    pending: number;
    cancelled: number;
  }> {
    const allRetainers = await this.findByGuild(guildId);
    
    return {
      total: allRetainers.length,
      active: allRetainers.filter(r => r.status === RetainerStatus.SIGNED).length,
      pending: allRetainers.filter(r => r.status === RetainerStatus.PENDING).length,
      cancelled: allRetainers.filter(r => r.status === RetainerStatus.CANCELLED).length
    };
  }

  public async cancelPendingRetainers(clientId: string): Promise<number> {
    const pendingRetainers = await this.findByClientAndStatus(clientId, RetainerStatus.PENDING);
    let cancelledCount = 0;
    
    for (const retainer of pendingRetainers) {
      const updated = await this.update(retainer._id!.toString(), { status: RetainerStatus.CANCELLED });
      if (updated) {
        cancelledCount++;
      }
    }
    
    return cancelledCount;
  }
}