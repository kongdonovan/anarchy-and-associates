"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RulesChannelRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
class RulesChannelRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        // BaseMongoRepository handles database connection internally
        super('rulesChannels');
    }
    /**
     * Find rules configuration by channel ID
     */
    async findByChannelId(guildId, channelId) {
        return this.findOne({ guildId, channelId });
    }
    /**
     * Find all rules channels for a guild
     */
    async findByGuildId(guildId) {
        return this.findMany({ guildId });
    }
    /**
     * Upsert rules configuration for a channel
     */
    async upsertByChannelId(guildId, channelId, data) {
        const existingRules = await this.findByChannelId(guildId, channelId);
        if (existingRules && existingRules._id) {
            // Update existing
            const updated = await this.update(existingRules._id.toString(), {
                ...data,
                lastUpdatedAt: new Date()
            });
            if (!updated) {
                throw new Error('Failed to update rules channel');
            }
            return updated;
        }
        else {
            // Create new
            const newRules = {
                guildId,
                channelId,
                ...data,
                lastUpdatedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            return this.add(newRules);
        }
    }
    /**
     * Add a rule to existing rules
     */
    async addRule(guildId, channelId, rule) {
        const rulesChannel = await this.findByChannelId(guildId, channelId);
        if (!rulesChannel || !rulesChannel._id) {
            return null;
        }
        const rules = rulesChannel.rules || [];
        const newRule = {
            ...rule,
            id: `rule_${Date.now()}`,
            order: rules.length + 1
        };
        return this.update(rulesChannel._id.toString(), {
            rules: [...rules, newRule],
            lastUpdatedAt: new Date()
        });
    }
    /**
     * Remove a rule by ID
     */
    async removeRule(guildId, channelId, ruleId) {
        const rulesChannel = await this.findByChannelId(guildId, channelId);
        if (!rulesChannel || !rulesChannel._id) {
            return null;
        }
        const filteredRules = (rulesChannel.rules || [])
            .filter(r => r.id !== ruleId)
            .map((rule, index) => ({ ...rule, order: index + 1 })); // Reorder
        return this.update(rulesChannel._id.toString(), {
            rules: filteredRules,
            lastUpdatedAt: new Date()
        });
    }
    /**
     * Reorder rules
     */
    async reorderRules(guildId, channelId, ruleIds) {
        const rulesChannel = await this.findByChannelId(guildId, channelId);
        if (!rulesChannel || !rulesChannel._id) {
            return null;
        }
        const rulesMap = new Map((rulesChannel.rules || []).map(r => [r.id, r]));
        const reorderedRules = ruleIds
            .map((id, index) => {
            const rule = rulesMap.get(id);
            return rule ? { ...rule, order: index + 1 } : null;
        })
            .filter((r) => r !== null);
        return this.update(rulesChannel._id.toString(), {
            rules: reorderedRules,
            lastUpdatedAt: new Date()
        });
    }
}
exports.RulesChannelRepository = RulesChannelRepository;
//# sourceMappingURL=rules-channel-repository.js.map