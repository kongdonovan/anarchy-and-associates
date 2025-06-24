import { CommandInteraction, User } from 'discord.js';
export declare class MetricsCommands {
    private metricsService;
    constructor();
    private createMetricsEmbed;
    private createSingleLawyerStatsEmbed;
    private createAllLawyerStatsEmbed;
    metrics(interaction: CommandInteraction): Promise<void>;
    stats(user: User | undefined, interaction: CommandInteraction): Promise<void>;
}
//# sourceMappingURL=metrics-commands.d.ts.map