import { Client } from 'discord.js';
import { InformationChannel } from '../../validation';
import { InformationChannelRepository } from '../../infrastructure/repositories/information-channel-repository';
export interface UpdateInformationChannelRequest {
    guildId: string;
    channelId: string;
    title: string;
    content: string;
    color?: number;
    thumbnailUrl?: string;
    imageUrl?: string;
    footer?: string;
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    updatedBy: string;
}
export declare class InformationChannelService {
    private readonly informationChannelRepository;
    private readonly discordClient;
    constructor(informationChannelRepository: InformationChannelRepository, discordClient: Client);
    /**
     * Generates a default information message template
     */
    static generateDefaultTemplate(guildName: string, context?: 'welcome' | 'general'): Partial<UpdateInformationChannelRequest>;
    updateInformationChannel(request: UpdateInformationChannelRequest): Promise<InformationChannel>;
    getInformationChannel(guildId: string, channelId: string): Promise<InformationChannel | null>;
    listInformationChannels(guildId: string): Promise<InformationChannel[]>;
    deleteInformationChannel(guildId: string, channelId: string): Promise<boolean>;
    syncInformationMessage(guildId: string, channelId: string): Promise<boolean>;
    private createInformationEmbed;
    private createNewInformationMessage;
}
//# sourceMappingURL=information-channel-service.d.ts.map