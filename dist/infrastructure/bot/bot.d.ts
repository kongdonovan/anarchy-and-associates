import { Client } from 'discordx';
import { InformationChannelService } from '../../application/services/information-channel-service';
import { RulesChannelService } from '../../application/services/rules-channel-service';
export declare class Bot {
    private client;
    private mongoClient;
    private reminderService;
    private roleTrackingService;
    private static informationChannelService;
    private static rulesChannelService;
    constructor();
    private setupEventHandlers;
    private initializeCommands;
    start(): Promise<void>;
    clearAllCommands(): Promise<void>;
    private initializeServices;
    static getInformationChannelService(): InformationChannelService;
    static getRulesChannelService(): RulesChannelService;
    stop(): Promise<void>;
    forceResetCommands(): Promise<void>;
    getClient(): Client;
}
//# sourceMappingURL=bot.d.ts.map