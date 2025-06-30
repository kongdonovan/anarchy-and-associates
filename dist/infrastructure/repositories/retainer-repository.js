"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetainerRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const validation_1 = require("../../validation");
const retainer_1 = require("../../domain/entities/retainer");
class RetainerRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('retainers');
    }
    async findByClient(clientId) {
        const validatedClientId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, clientId, 'Client ID');
        return this.findByFilters({ clientId: validatedClientId });
    }
    async findByLawyer(lawyerId) {
        const validatedLawyerId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, lawyerId, 'Lawyer ID');
        return this.findByFilters({ lawyerId: validatedLawyerId });
    }
    async findByStatus(status) {
        const validatedStatus = validation_1.ValidationHelpers.validateOrThrow(validation_1.RetainerStatusSchema, status, 'Retainer status');
        return this.findByFilters({ status: validatedStatus });
    }
    async findByGuild(guildId) {
        const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
        return this.findByFilters({ guildId: validatedGuildId });
    }
    async findByGuildAndStatus(guildId, status) {
        const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
        const validatedStatus = validation_1.ValidationHelpers.validateOrThrow(validation_1.RetainerStatusSchema, status, 'Retainer status');
        return this.findByFilters({ guildId: validatedGuildId, status: validatedStatus });
    }
    async findActiveRetainers(guildId) {
        return this.findByGuildAndStatus(guildId, retainer_1.RetainerStatus.SIGNED);
    }
    async findPendingRetainers(guildId) {
        return this.findByGuildAndStatus(guildId, retainer_1.RetainerStatus.PENDING);
    }
    async findByClientAndStatus(clientId, status) {
        const validatedClientId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, clientId, 'Client ID');
        const validatedStatus = validation_1.ValidationHelpers.validateOrThrow(validation_1.RetainerStatusSchema, status, 'Retainer status');
        return this.findByFilters({ clientId: validatedClientId, status: validatedStatus });
    }
    async hasActiveRetainer(clientId) {
        const activeRetainers = await this.findByClientAndStatus(clientId, retainer_1.RetainerStatus.SIGNED);
        return activeRetainers.length > 0;
    }
    async hasPendingRetainer(clientId) {
        const pendingRetainers = await this.findByClientAndStatus(clientId, retainer_1.RetainerStatus.PENDING);
        return pendingRetainers.length > 0;
    }
    async findClientRetainers(clientId, includeAll = false) {
        const validatedIncludeAll = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.boolean(), includeAll, 'Include all flag');
        if (validatedIncludeAll) {
            return this.findByClient(clientId);
        }
        // Only return active retainers by default
        return this.findByClientAndStatus(clientId, retainer_1.RetainerStatus.SIGNED);
    }
    async getRetainerStats(guildId) {
        const allRetainers = await this.findByGuild(guildId);
        return {
            total: allRetainers.length,
            active: allRetainers.filter(r => r.status === retainer_1.RetainerStatus.SIGNED).length,
            pending: allRetainers.filter(r => r.status === retainer_1.RetainerStatus.PENDING).length,
            cancelled: allRetainers.filter(r => r.status === retainer_1.RetainerStatus.CANCELLED).length
        };
    }
    async cancelPendingRetainers(clientId) {
        const pendingRetainers = await this.findByClientAndStatus(clientId, retainer_1.RetainerStatus.PENDING);
        let cancelledCount = 0;
        for (const retainer of pendingRetainers) {
            const updated = await this.update(retainer._id.toString(), { status: retainer_1.RetainerStatus.CANCELLED });
            if (updated) {
                cancelledCount++;
            }
        }
        return cancelledCount;
    }
}
exports.RetainerRepository = RetainerRepository;
//# sourceMappingURL=retainer-repository.js.map