import { Client } from 'discordx';
export declare class Bot {
    private client;
    private mongoClient;
    private reminderService;
    private roleTrackingService;
    constructor();
    private setupEventHandlers;
    private initializeCommands;
    start(): Promise<void>;
    clearAllCommands(): Promise<void>;
    private initializeServices;
    stop(): Promise<void>;
    forceResetCommands(): Promise<void>;
    getClient(): Client;
}
//# sourceMappingURL=bot.d.ts.map