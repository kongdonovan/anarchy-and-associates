import { Guild, ApplicationCommand, ApplicationCommandOptionType } from 'discord.js';
import { PermissionService, PermissionContext } from './permission-service';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { logger } from '../../infrastructure/logger';

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

export class HelpService {
  private permissionService: PermissionService;
  private guildConfigRepository: GuildConfigRepository;

  // Command permission mappings
  private static readonly COMMAND_PERMISSIONS: Record<string, string[]> = {
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

  private static readonly SUBCOMMAND_PERMISSIONS: Record<string, Record<string, string[]>> = {
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

  constructor() {
    this.guildConfigRepository = new GuildConfigRepository();
    this.permissionService = new PermissionService(this.guildConfigRepository);
  }

  async getHelpForCommand(
    guild: Guild, 
    commandName?: string, 
    context?: PermissionContext
  ): Promise<HelpResult> {
    try {
      logger.info(`Generating help for guild ${guild.id}, command: ${commandName || 'all'}`);

      // Fetch all application commands
      const commands = await guild.commands.fetch();
      
      if (commandName) {
        // Get help for specific command or command group
        const targetCommand = commands.find(cmd => 
          cmd.name === commandName || 
          cmd.name.startsWith(commandName)
        );

        if (targetCommand) {
          const commandInfo = await this.parseCommand(targetCommand, context);
          return {
            commands: commandInfo ? [commandInfo] : [],
            filteredByPermissions: context !== undefined,
            totalCommands: 1
          };
        } else {
          // Check if it's a command group
          const groupCommands = commands.filter(cmd => cmd.name.startsWith(commandName));
          if (groupCommands.size > 0) {
            const commandInfos = await Promise.all(
              Array.from(groupCommands.values()).map(cmd => this.parseCommand(cmd, context))
            );
            
            const validCommands = commandInfos.filter((info): info is CommandInfo => info !== null);
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
      } else {
        // Get help for all commands
        const commandInfos = await Promise.all(
          Array.from(commands.values()).map(cmd => this.parseCommand(cmd, context))
        );
        
        const validCommands = commandInfos.filter((info): info is CommandInfo => info !== null);
        
        return {
          commands: validCommands.sort((a, b) => a.name.localeCompare(b.name)),
          filteredByPermissions: context !== undefined,
          totalCommands: commands.size
        };
      }

    } catch (error) {
      logger.error('Error generating help:', error);
      throw error;
    }
  }

  private async parseCommand(command: ApplicationCommand, context?: PermissionContext): Promise<CommandInfo | null> {
    try {
      // Check if user has permission to see this command
      if (context) {
        const hasPermission = await this.checkCommandPermission(command.name, context);
        if (!hasPermission) {
          return null;
        }
      }

      const commandInfo: CommandInfo = {
        name: command.name,
        description: command.description,
        permissions: HelpService.COMMAND_PERMISSIONS[command.name] || [],
        usage: this.generateUsage(command)
      };

      // Parse subcommands and subcommand groups
      if (command.options && command.options.length > 0) {
        const subcommands = command.options.filter(option => 
          option.type === ApplicationCommandOptionType.Subcommand ||
          option.type === ApplicationCommandOptionType.SubcommandGroup
        );

        if (subcommands.length > 0) {
          const subcommandResults = await Promise.all(
            subcommands.map(async (sub) => {
              // Check subcommand permissions
              if (context) {
                const hasSubPermission = await this.checkSubcommandPermission(
                  command.name, 
                  sub.name, 
                  context
                );
                if (!hasSubPermission) {
                  return null;
                }
              }

              const subcommandInfo: SubcommandInfo = {
                name: sub.name,
                description: sub.description,
                permissions: HelpService.SUBCOMMAND_PERMISSIONS[command.name]?.[sub.name] || [],
                options: [] // Simplified - don't parse subcommand options for now
              };
              return subcommandInfo;
            })
          );
          
          commandInfo.subcommands = subcommandResults.filter((sub): sub is SubcommandInfo => sub !== null);
        } else {
          // Parse regular options - simplified
          commandInfo.options = [];
        }
      }

      return commandInfo;

    } catch (error) {
      logger.warn(`Error parsing command ${command.name}:`, error);
      return null;
    }
  }



  private generateUsage(command: ApplicationCommand): string {
    let usage = `/${command.name}`;

    if (command.options && command.options.length > 0) {
      // Simplified usage generation
      usage += ' [options]';
    }

    return usage;
  }

  private async checkCommandPermission(commandName: string, context: PermissionContext): Promise<boolean> {
    const requiredPermissions = HelpService.COMMAND_PERMISSIONS[commandName];
    
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // Public command
    }

    // Check if user has any of the required permissions
    for (const permission of requiredPermissions) {
      const hasPermission = await this.permissionService.hasActionPermission(context, permission as any);
      if (hasPermission) {
        return true;
      }
    }

    return false;
  }

  private async checkSubcommandPermission(
    commandName: string, 
    subcommandName: string, 
    context: PermissionContext
  ): Promise<boolean> {
    const subcommandPermissions = HelpService.SUBCOMMAND_PERMISSIONS[commandName]?.[subcommandName];
    
    if (!subcommandPermissions || subcommandPermissions.length === 0) {
      return true; // Public subcommand
    }

    // Check if user has any of the required permissions
    for (const permission of subcommandPermissions) {
      const hasPermission = await this.permissionService.hasActionPermission(context, permission as any);
      if (hasPermission) {
        return true;
      }
    }

    return false;
  }

  formatCommandHelp(commandInfo: CommandInfo): string {
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
    } else if (commandInfo.options && commandInfo.options.length > 0) {
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

  groupCommandsByCategory(commands: CommandInfo[]): Record<string, CommandInfo[]> {
    const categories: Record<string, CommandInfo[]> = {
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
        } else if (command.name === 'staff' || command.name === 'job' || command.name === 'apply') {
          categories['Staff Management']?.push(command);
        } else if (command.name === 'case' || command.name === 'retainer') {
          categories['Case Management']?.push(command);
        } else if (command.name === 'repair' || command.name === 'metrics' || command.name === 'stats') {
          categories['System']?.push(command);
        } else {
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