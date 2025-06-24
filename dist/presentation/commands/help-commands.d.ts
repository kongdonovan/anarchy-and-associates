import { CommandInteraction } from 'discord.js';
export declare class HelpCommands {
    private helpService;
    constructor();
    private getPermissionContext;
    private createHelpOverviewEmbed;
    private createCommandHelpEmbed;
    private createCommandGroupEmbed;
    help(commandName: string | undefined, interaction: CommandInteraction): Promise<void>;
}
//# sourceMappingURL=help-commands.d.ts.map