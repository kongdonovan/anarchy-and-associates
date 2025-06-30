import { BaseMongoRepository } from './base-mongo-repository';
import { RulesChannel, Rule } from '../../validation';
export declare class RulesChannelRepository extends BaseMongoRepository<RulesChannel> {
    constructor();
    /**
     * Find rules configuration by channel ID
     */
    findByChannelId(guildId: string, channelId: string): Promise<RulesChannel | null>;
    /**
     * Find all rules channels for a guild
     */
    findByGuildId(guildId: string): Promise<RulesChannel[]>;
    /**
     * Upsert rules configuration for a channel
     */
    upsertByChannelId(guildId: string, channelId: string, data: Partial<RulesChannel>): Promise<RulesChannel>;
    /**
     * Add a rule to existing rules
     */
    addRule(guildId: string, channelId: string, rule: Omit<Rule, 'id' | 'order'>): Promise<RulesChannel | null>;
    /**
     * Remove a rule by ID
     */
    removeRule(guildId: string, channelId: string, ruleId: string): Promise<RulesChannel | null>;
    /**
     * Reorder rules
     */
    reorderRules(guildId: string, channelId: string, ruleIds: string[]): Promise<RulesChannel | null>;
}
//# sourceMappingURL=rules-channel-repository.d.ts.map