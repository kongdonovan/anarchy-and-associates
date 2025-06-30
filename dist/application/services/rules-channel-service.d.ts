import { Client } from 'discord.js';
import { RulesChannel, Rule } from '../../validation';
import { RulesChannelRepository } from '../../infrastructure/repositories/rules-channel-repository';
export interface UpdateRulesChannelRequest {
    guildId: string;
    channelId: string;
    title: string;
    content: string;
    rules?: Rule[];
    color?: number;
    thumbnailUrl?: string;
    imageUrl?: string;
    footer?: string;
    showNumbers?: boolean;
    additionalFields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    updatedBy: string;
}
export declare class RulesChannelService {
    private readonly rulesChannelRepository;
    private readonly discordClient;
    constructor(rulesChannelRepository: RulesChannelRepository, discordClient: Client);
    /**
     * Generates default rules template for different contexts
     */
    static generateDefaultRules(context?: 'anarchy' | 'general'): Partial<UpdateRulesChannelRequest>;
    updateRulesChannel(request: UpdateRulesChannelRequest): Promise<RulesChannel>;
    getRulesChannel(guildId: string, channelId: string): Promise<RulesChannel | null>;
    listRulesChannels(guildId: string): Promise<RulesChannel[]>;
    deleteRulesChannel(guildId: string, channelId: string): Promise<boolean>;
    syncRulesMessage(guildId: string, channelId: string): Promise<boolean>;
    addRule(guildId: string, channelId: string, rule: Omit<Rule, 'id' | 'order'>, updatedBy: string): Promise<RulesChannel | null>;
    removeRule(guildId: string, channelId: string, ruleId: string, updatedBy: string): Promise<RulesChannel | null>;
    private createRulesEmbed;
    private createNewRulesMessage;
}
//# sourceMappingURL=rules-channel-service.d.ts.map