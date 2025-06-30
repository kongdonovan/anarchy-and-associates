import { BaseMongoRepository } from './base-mongo-repository';
import {
  Retainer,
  RetainerStatus,
  ValidationHelpers,
  DiscordSnowflakeSchema,
  RetainerStatusSchema,
  z
} from '../../validation';
import { RetainerStatus as RetainerStatusEnum } from '../../domain/entities/retainer';

export class RetainerRepository extends BaseMongoRepository<Retainer> {
  constructor() {
    super('retainers');
  }

  public async findByClient(clientId: unknown): Promise<Retainer[]> {
    const validatedClientId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      clientId,
      'Client ID'
    );
    return this.findByFilters({ clientId: validatedClientId });
  }

  public async findByLawyer(lawyerId: unknown): Promise<Retainer[]> {
    const validatedLawyerId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      lawyerId,
      'Lawyer ID'
    );
    return this.findByFilters({ lawyerId: validatedLawyerId });
  }

  public async findByStatus(status: unknown): Promise<Retainer[]> {
    const validatedStatus = ValidationHelpers.validateOrThrow(
      RetainerStatusSchema,
      status,
      'Retainer status'
    );
    return this.findByFilters({ status: validatedStatus as RetainerStatus });
  }

  public async findByGuild(guildId: unknown): Promise<Retainer[]> {
    const validatedGuildId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      guildId,
      'Guild ID'
    );
    return this.findByFilters({ guildId: validatedGuildId });
  }

  public async findByGuildAndStatus(guildId: unknown, status: unknown): Promise<Retainer[]> {
    const validatedGuildId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      guildId,
      'Guild ID'
    );
    const validatedStatus = ValidationHelpers.validateOrThrow(
      RetainerStatusSchema,
      status,
      'Retainer status'
    );
    return this.findByFilters({ guildId: validatedGuildId, status: validatedStatus as RetainerStatus });
  }

  public async findActiveRetainers(guildId: unknown): Promise<Retainer[]> {
    return this.findByGuildAndStatus(guildId, RetainerStatusEnum.SIGNED);
  }

  public async findPendingRetainers(guildId: unknown): Promise<Retainer[]> {
    return this.findByGuildAndStatus(guildId, RetainerStatusEnum.PENDING);
  }

  public async findByClientAndStatus(clientId: unknown, status: unknown): Promise<Retainer[]> {
    const validatedClientId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      clientId,
      'Client ID'
    );
    const validatedStatus = ValidationHelpers.validateOrThrow(
      RetainerStatusSchema,
      status,
      'Retainer status'
    );
    return this.findByFilters({ clientId: validatedClientId, status: validatedStatus as RetainerStatus });
  }

  public async hasActiveRetainer(clientId: unknown): Promise<boolean> {
    const activeRetainers = await this.findByClientAndStatus(clientId, RetainerStatusEnum.SIGNED);
    return activeRetainers.length > 0;
  }

  public async hasPendingRetainer(clientId: unknown): Promise<boolean> {
    const pendingRetainers = await this.findByClientAndStatus(clientId, RetainerStatusEnum.PENDING);
    return pendingRetainers.length > 0;
  }

  public async findClientRetainers(clientId: unknown, includeAll: unknown = false): Promise<Retainer[]> {
    const validatedIncludeAll = ValidationHelpers.validateOrThrow(
      z.boolean(),
      includeAll,
      'Include all flag'
    );
    if (validatedIncludeAll) {
      return this.findByClient(clientId);
    }
    // Only return active retainers by default
    return this.findByClientAndStatus(clientId, RetainerStatusEnum.SIGNED);
  }

  public async getRetainerStats(guildId: unknown): Promise<{
    total: number;
    active: number;
    pending: number;
    cancelled: number;
  }> {
    const allRetainers = await this.findByGuild(guildId);
    
    return {
      total: allRetainers.length,
      active: allRetainers.filter(r => r.status === RetainerStatusEnum.SIGNED).length,
      pending: allRetainers.filter(r => r.status === RetainerStatusEnum.PENDING).length,
      cancelled: allRetainers.filter(r => r.status === RetainerStatusEnum.CANCELLED).length
    };
  }

  public async cancelPendingRetainers(clientId: unknown): Promise<number> {
    const pendingRetainers = await this.findByClientAndStatus(clientId, RetainerStatusEnum.PENDING);
    let cancelledCount = 0;
    
    for (const retainer of pendingRetainers) {
      const updated = await this.update(retainer._id!.toString(), { status: RetainerStatusEnum.CANCELLED });
      if (updated) {
        cancelledCount++;
      }
    }
    
    return cancelledCount;
  }
}