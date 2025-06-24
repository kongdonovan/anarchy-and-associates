import { Guild } from 'discord.js';
import { PermissionContext } from './permission-service';
export interface CommandInfo {
    name: string;
    description: string;
    group?: string;
    subcommands?: SubcommandInfo[];
    options?: OptionInfo[];
    permissions?: string[];
    usage?: string;
}
export interface SubcommandInfo {
    name: string;
    description: string;
    options?: OptionInfo[];
    permissions?: string[];
}
export interface OptionInfo {
    name: string;
    description: string;
    type: string;
    required: boolean;
    choices?: string[];
}
export interface HelpResult {
    commands: CommandInfo[];
    filteredByPermissions: boolean;
    totalCommands: number;
}
export declare class HelpService {
    private permissionService;
    private guildConfigRepository;
    private static readonly COMMAND_PERMISSIONS;
    private static readonly SUBCOMMAND_PERMISSIONS;
    constructor();
    getHelpForCommand(guild: Guild, commandName?: string, context?: PermissionContext): Promise<HelpResult>;
    private parseCommand;
    private generateUsage;
    private checkCommandPermission;
    private checkSubcommandPermission;
    formatCommandHelp(commandInfo: CommandInfo): string;
    groupCommandsByCategory(commands: CommandInfo[]): Record<string, CommandInfo[]>;
}
//# sourceMappingURL=help-service.d.ts.map