"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetainerRepository = void 0;
const retainer_1 = require("../../domain/entities/retainer");
const base_mongo_repository_1 = require("./base-mongo-repository");
class RetainerRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('retainers');
    }
    async findByClient(clientId) {
        return this.findByFilters({ clientId });
    }
    async findByLawyer(lawyerId) {
        return this.findByFilters({ lawyerId });
    }
    async findByStatus(status) {
        return this.findByFilters({ status });
    }
    async findByGuild(guildId) {
        return this.findByFilters({ guildId });
    }
    async findByGuildAndStatus(guildId, status) {
        return this.findByFilters({ guildId, status });
    }
    async findActiveRetainers(guildId) {
        return this.findByGuildAndStatus(guildId, retainer_1.RetainerStatus.SIGNED);
    }
    async findPendingRetainers(guildId) {
        return this.findByGuildAndStatus(guildId, retainer_1.RetainerStatus.PENDING);
    }
    async findByClientAndStatus(clientId, status) {
        return this.findByFilters({ clientId, status });
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
        if (includeAll) {
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