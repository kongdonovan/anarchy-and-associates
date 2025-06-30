import { CommandInteraction } from 'discord.js';
export declare class InformationCommands {
    private informationChannelService;
    private permissionService;
    constructor();
    private getPermissionContext;
    private createErrorEmbed;
    private createSuccessEmbed;
    setInformation(interaction: CommandInteraction): Promise<void>;
    private handleSetInformation;
    addField(interaction: CommandInteraction): Promise<void>;
    private handleAddField;
    removeInformation(interaction: CommandInteraction): Promise<void>;
    listInformationChannels(interaction: CommandInteraction): Promise<void>;
    syncInformation(interaction: CommandInteraction): Promise<void>;
}
//# sourceMappingURL=information-commands.d.ts.map