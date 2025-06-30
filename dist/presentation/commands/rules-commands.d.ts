import { CommandInteraction } from 'discord.js';
export declare class RulesCommands {
    private rulesChannelService;
    private permissionService;
    constructor();
    private getPermissionContext;
    private createErrorEmbed;
    private createSuccessEmbed;
    setRules(interaction: CommandInteraction): Promise<void>;
    private handleSetRules;
    addRule(interaction: CommandInteraction): Promise<void>;
    private handleAddRule;
    removeRule(interaction: CommandInteraction): Promise<void>;
    removeRules(interaction: CommandInteraction): Promise<void>;
    listRulesChannels(interaction: CommandInteraction): Promise<void>;
    syncRules(interaction: CommandInteraction): Promise<void>;
}
//# sourceMappingURL=rules-commands.d.ts.map