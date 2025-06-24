"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelpService = void 0;
const discord_js_1 = require("discord.js");
const permission_service_1 = require("./permission-service");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const logger_1 = require("../../infrastructure/logger");
class HelpService {
    constructor() {
        this.guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        this.permissionService = new permission_service_1.PermissionService(this.guildConfigRepository);
    }
    async getHelpForCommand(guild, commandName, context) {
        try {
            logger_1.logger.info(`Generating help for guild ${guild.id}, command: ${commandName || 'all'}`);
            // Fetch all application commands
            const commands = await guild.commands.fetch();
            if (commandName) {
                // Get help for specific command or command group
                const targetCommand = commands.find(cmd => cmd.name === commandName ||
                    cmd.name.startsWith(commandName));
                if (targetCommand) {
                    const commandInfo = await this.parseCommand(targetCommand, context);
                    return {
                        commands: commandInfo ? [commandInfo] : [],
                        filteredByPermissions: context !== undefined,
                        totalCommands: 1
                    };
                }
                else {
                    // Check if it's a command group
                    const groupCommands = commands.filter(cmd => cmd.name.startsWith(commandName));
                    if (groupCommands.size > 0) {
                        const commandInfos = await Promise.all(Array.from(groupCommands.values()).map(cmd => this.parseCommand(cmd, context)));
                        const validCommands = commandInfos.filter((info) => info !== null);
                        return {
                            commands: validCommands,
                            filteredByPermissions: context !== undefined,
                            totalCommands: groupCommands.size
                        };
                    }
                }
                return {
                    commands: [],
                    filteredByPermissions: false,
                    totalCommands: 0
                };
            }
            else {
                // Get help for all commands
                const commandInfos = await Promise.all(Array.from(commands.values()).map(cmd => this.parseCommand(cmd, context)));
                const validCommands = commandInfos.filter((info) => info !== null);
                return {
                    commands: validCommands.sort((a, b) => a.name.localeCompare(b.name)),
                    filteredByPermissions: context !== undefined,
                    totalCommands: commands.size
                };
            }
        }
        catch (error) {
            logger_1.logger.error('Error generating help:', error);
            throw error;
        }
    }
    async parseCommand(command, context) {
        try {
            // Check if user has permission to see this command
            if (context) {
                const hasPermission = await this.checkCommandPermission(command.name, context);
                if (!hasPermission) {
                    return null;
                }
            }
            const commandInfo = {
                name: command.name,
                description: command.description,
                permissions: HelpService.COMMAND_PERMISSIONS[command.name] || [],
                usage: this.generateUsage(command)
            };
            // Parse subcommands and subcommand groups
            if (command.options && command.options.length > 0) {
                const subcommands = command.options.filter(option => option.type === discord_js_1.ApplicationCommandOptionType.Subcommand ||
                    option.type === discord_js_1.ApplicationCommandOptionType.SubcommandGroup);
                if (subcommands.length > 0) {
                    const subcommandResults = await Promise.all(subcommands.map(async (sub) => {
                        // Check subcommand permissions
                        if (context) {
                            const hasSubPermission = await this.checkSubcommandPermission(command.name, sub.name, context);
                            if (!hasSubPermission) {
                                return null;
                            }
                        }
                        const subcommandInfo = {
                            name: sub.name,
                            description: sub.description,
                            permissions: HelpService.SUBCOMMAND_PERMISSIONS[command.name]?.[sub.name] || [],
                            options: [] // Simplified - don't parse subcommand options for now
                        };
                        return subcommandInfo;
                    }));
                    commandInfo.subcommands = subcommandResults.filter((sub) => sub !== null);
                }
                else {
                    // Parse regular options - simplified
                    commandInfo.options = [];
                }
            }
            return commandInfo;
        }
        catch (error) {
            logger_1.logger.warn(`Error parsing command ${command.name}:`, error);
            return null;
        }
    }
    generateUsage(command) {
        let usage = `/${command.name}`;
        if (command.options && command.options.length > 0) {
            // Simplified usage generation
            usage += ' [options]';
        }
        return usage;
    }
    async checkCommandPermission(commandName, context) {
        const requiredPermissions = HelpService.COMMAND_PERMISSIONS[commandName];
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true; // Public command
        }
        // Check if user has any of the required permissions
        for (const permission of requiredPermissions) {
            const hasPermission = await this.permissionService.hasActionPermission(context, permission);
            if (hasPermission) {
                return true;
            }
        }
        return false;
    }
    async checkSubcommandPermission(commandName, subcommandName, context) {
        const subcommandPermissions = HelpService.SUBCOMMAND_PERMISSIONS[commandName]?.[subcommandName];
        if (!subcommandPermissions || subcommandPermissions.length === 0) {
            return true; // Public subcommand
        }
        // Check if user has any of the required permissions
        for (const permission of subcommandPermissions) {
            const hasPermission = await this.permissionService.hasActionPermission(context, permission);
            if (hasPermission) {
                return true;
            }
        }
        return false;
    }
    formatCommandHelp(commandInfo) {
        let help = `**${commandInfo.usage}**\n${commandInfo.description}`;
        if (commandInfo.permissions && commandInfo.permissions.length > 0) {
            help += `\n*Required permissions: ${commandInfo.permissions.join(', ')}*`;
        }
        if (commandInfo.subcommands && commandInfo.subcommands.length > 0) {
            help += '\n\n**Subcommands:**';
            for (const sub of commandInfo.subcommands) {
                help += `\n• **${sub.name}** - ${sub.description}`;
                if (sub.permissions && sub.permissions.length > 0) {
                    help += ` *(${sub.permissions.join(', ')})*`;
                }
            }
        }
        else if (commandInfo.options && commandInfo.options.length > 0) {
            help += '\n\n**Parameters:**';
            for (const option of commandInfo.options) {
                const required = option.required ? 'Required' : 'Optional';
                help += `\n• **${option.name}** (${option.type}) - ${option.description} *(${required})*`;
                if (option.choices && option.choices.length > 0) {
                    help += `\n  Choices: ${option.choices.join(', ')}`;
                }
            }
        }
        return help;
    }
    groupCommandsByCategory(commands) {
        const categories = {
            'Administration': [],
            'Staff Management': [],
            'Case Management': [],
            'System': [],
            'Public': []
        };
        for (const command of commands) {
            if (command?.name) {
                if (command.name.startsWith('admin') || command.name === 'config') {
                    categories['Administration']?.push(command);
                }
                else if (command.name === 'staff' || command.name === 'job' || command.name === 'apply') {
                    categories['Staff Management']?.push(command);
                }
                else if (command.name === 'case' || command.name === 'retainer') {
                    categories['Case Management']?.push(command);
                }
                else if (command.name === 'repair' || command.name === 'metrics' || command.name === 'stats') {
                    categories['System']?.push(command);
                }
                else {
                    categories['Public']?.push(command);
                }
            }
        }
        // Remove empty categories
        Object.keys(categories).forEach(key => {
            if (categories[key]?.length === 0) {
                delete categories[key];
            }
        });
        return categories;
    }
}
exports.HelpService = HelpService;
// Command permission mappings
HelpService.COMMAND_PERMISSIONS = {
    'admin': ['admin'],
    'config': ['config'],
    'staff': ['hr'],
    'job': ['hr'],
    'case': ['case'],
    'retainer': ['retainer'],
    'repair': ['admin'],
    'metrics': [], // Public
    'stats': [], // Public
    'help': [], // Public
    'apply': [], // Public
    'feedback': [], // Public
    'reminder': [], // Public (but creates for others requires permissions)
};
HelpService.SUBCOMMAND_PERMISSIONS = {
    'admin': {
        'add': ['admin'],
        'remove': ['admin'],
        'grantrole': ['admin'],
        'revokerole': ['admin'],
        'list': ['admin'],
        'debug_collection': ['admin'],
        'debug_wipe_collections': ['admin'],
        'setupserver': ['admin'],
        'setpermissionrole': ['admin']
    },
    'staff': {
        'list': [], // Public
        'hire': ['hr'],
        'fire': ['hr'],
        'promote': ['hr'],
        'demote': ['hr'],
        'info': [] // Public
    },
    'job': {
        'list': [], // Public
        'add': ['hr'],
        'edit': ['hr']
    },
    'case': {
        'review': [], // Public (clients can request)
        'assign': ['case'],
        'reassign': ['case'],
        'unassign': ['case'],
        'close': ['case'],
        'list': [], // Public
        'info': [] // Public
    },
    'repair': {
        'staff-roles': ['admin'],
        'job-roles': ['admin'],
        'channels': ['admin'],
        'config': ['admin'],
        'orphaned': ['admin'],
        'db-indexes': ['admin'],
        'all': ['admin'],
        'health': ['admin']
    },
    'retainer': {
        'sign': ['retainer'],
        'list': [], // Public (own retainers)
        'listall': ['retainer']
    },
    'config': {
        'set': ['config'],
        'view': ['config'],
        'setclientrole': ['config']
    }
};
//# sourceMappingURL=help-service.js.map