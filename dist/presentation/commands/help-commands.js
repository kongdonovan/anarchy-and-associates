"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelpCommands = void 0;
const discordx_1 = require("discordx");
const discord_js_1 = require("discord.js");
const help_service_1 = require("../../application/services/help-service");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const logger_1 = require("../../infrastructure/logger");
let HelpCommands = class HelpCommands {
    constructor() {
        this.helpService = new help_service_1.HelpService();
    }
    async getPermissionContext(interaction) {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const userRoles = member?.roles.cache.map(role => role.id) || [];
        const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;
        return {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            userRoles,
            isGuildOwner,
        };
    }
    createHelpOverviewEmbed(helpResult) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: '❓ Anarchy & Associates - Command Help',
            description: `Available commands for this server${helpResult.filteredByPermissions ? ' (filtered by your permissions)' : ''}`
        });
        // Group commands by category
        const categories = this.helpService.groupCommandsByCategory(helpResult.commands);
        for (const [categoryName, commands] of Object.entries(categories)) {
            if (commands.length === 0)
                continue;
            const commandsList = commands.map(cmd => {
                const permissions = cmd.permissions && cmd.permissions.length > 0
                    ? ` *(${cmd.permissions.join(', ')})*`
                    : '';
                return `**${cmd.usage}** - ${cmd.description}${permissions}`;
            }).join('\n');
            // Split long categories into multiple fields if necessary
            if (commandsList.length > 1024) {
                const midpoint = Math.ceil(commands.length / 2);
                const firstHalf = commands.slice(0, midpoint);
                const secondHalf = commands.slice(midpoint);
                const firstList = firstHalf.map(cmd => {
                    const permissions = cmd.permissions && cmd.permissions.length > 0
                        ? ` *(${cmd.permissions.join(', ')})*`
                        : '';
                    return `**${cmd.usage}** - ${cmd.description}${permissions}`;
                }).join('\n');
                const secondList = secondHalf.map(cmd => {
                    const permissions = cmd.permissions && cmd.permissions.length > 0
                        ? ` *(${cmd.permissions.join(', ')})*`
                        : '';
                    return `**${cmd.usage}** - ${cmd.description}${permissions}`;
                }).join('\n');
                embed.addFields({ name: `📂 ${categoryName} (1/2)`, value: firstList, inline: false }, { name: `📂 ${categoryName} (2/2)`, value: secondList, inline: false });
            }
            else {
                embed_utils_1.EmbedUtils.addFieldSafe(embed, `📂 ${categoryName}`, commandsList, false);
            }
        }
        // Add footer with additional help info
        embed.addFields({
            name: '💡 Need More Help?',
            value: 'Use `/help <command>` for detailed information about a specific command or command group.\n\n*Permissions shown in parentheses indicate required access levels.*',
            inline: false
        });
        // Show stats
        const statsText = helpResult.filteredByPermissions
            ? `Showing ${helpResult.commands.length} of ${helpResult.totalCommands} commands based on your permissions.`
            : `Showing all ${helpResult.totalCommands} available commands.`;
        embed.setFooter({
            text: `${embed.data.footer?.text} • ${statsText}`,
            iconURL: embed.data.footer?.icon_url
        });
        return embed;
    }
    createCommandHelpEmbed(command) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: `❓ Help: ${command.name}`,
            description: command.description
        });
        // Usage
        embed.addFields({
            name: '📝 Usage',
            value: `\`${command.usage}\``,
            inline: false
        });
        // Permissions
        if (command.permissions && command.permissions.length > 0) {
            embed.addFields({
                name: '🔒 Required Permissions',
                value: command.permissions.join(', '),
                inline: false
            });
        }
        else {
            embed.addFields({
                name: '🔓 Permissions',
                value: 'Public command - no special permissions required',
                inline: false
            });
        }
        // Subcommands
        if (command.subcommands && command.subcommands.length > 0) {
            const subcommandsList = command.subcommands.map(sub => {
                const permissions = sub.permissions && sub.permissions.length > 0
                    ? ` *(${sub.permissions.join(', ')})*`
                    : '';
                return `**${sub.name}** - ${sub.description}${permissions}`;
            }).join('\n');
            embed_utils_1.EmbedUtils.addFieldSafe(embed, '🔸 Subcommands', subcommandsList, false);
        }
        // Parameters/Options
        if (command.options && command.options.length > 0) {
            const optionsList = command.options.map(opt => {
                const required = opt.required ? '*(Required)*' : '*(Optional)*';
                let optionText = `**${opt.name}** (${opt.type}) - ${opt.description} ${required}`;
                if (opt.choices && opt.choices.length > 0) {
                    optionText += `\n  Choices: ${opt.choices.join(', ')}`;
                }
                return optionText;
            }).join('\n\n');
            embed_utils_1.EmbedUtils.addFieldSafe(embed, '⚙️ Parameters', optionsList, false);
        }
        return embed;
    }
    createCommandGroupEmbed(commands, groupName) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: `❓ Help: ${groupName} Commands`,
            description: `All commands in the ${groupName} group`
        });
        const commandsList = commands.map(cmd => {
            const permissions = cmd.permissions && cmd.permissions.length > 0
                ? ` *(${cmd.permissions.join(', ')})*`
                : '';
            return `**${cmd.usage}** - ${cmd.description}${permissions}`;
        }).join('\n');
        embed_utils_1.EmbedUtils.addFieldSafe(embed, `📂 ${groupName} Commands`, commandsList, false);
        embed.addFields({
            name: '💡 Detailed Help',
            value: `Use \`/help <specific-command>\` for detailed information about any specific command.`,
            inline: false
        });
        return embed;
    }
    async help(commandName, interaction) {
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('Error', 'This command can only be used in a server.')],
                    ephemeral: true,
                });
                return;
            }
            await interaction.deferReply();
            // Get permission context for filtering
            const context = await this.getPermissionContext(interaction);
            // Get help information
            const helpResult = await this.helpService.getHelpForCommand(interaction.guild, commandName, context);
            let embed;
            if (helpResult.commands.length === 0) {
                // No commands found
                embed = embed_utils_1.EmbedUtils.createErrorEmbed('Command Not Found', commandName
                    ? `No command or command group named "${commandName}" was found, or you don't have permission to view it.`
                    : 'No commands available for your permission level.');
            }
            else if (helpResult.commands.length === 1 && commandName) {
                // Single command help
                const command = helpResult.commands[0];
                if (command) {
                    embed = this.createCommandHelpEmbed(command);
                }
                else {
                    embed = embed_utils_1.EmbedUtils.createErrorEmbed('Command Not Found', 'Command information is not available.');
                }
            }
            else if (commandName && helpResult.commands.length > 1) {
                // Command group help
                embed = this.createCommandGroupEmbed(helpResult.commands, commandName);
            }
            else {
                // General help overview
                embed = this.createHelpOverviewEmbed(helpResult);
            }
            await interaction.editReply({
                embeds: [embed],
            });
        }
        catch (error) {
            logger_1.logger.error('Error in help command:', error);
            const errorEmbed = embed_utils_1.EmbedUtils.createErrorEmbed('Help System Error', 'Failed to retrieve help information. Please try again later.');
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
            else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};
exports.HelpCommands = HelpCommands;
__decorate([
    (0, discordx_1.Slash)({ name: 'commands', description: 'Get help with bot commands' }),
    __param(0, (0, discordx_1.SlashOption)({
        name: 'command',
        description: 'Specific command or command group to get help for',
        type: discord_js_1.ApplicationCommandOptionType.String,
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, discord_js_1.CommandInteraction]),
    __metadata("design:returntype", Promise)
], HelpCommands.prototype, "help", null);
exports.HelpCommands = HelpCommands = __decorate([
    (0, discordx_1.Discord)(),
    (0, discordx_1.SlashGroup)({ name: 'help', description: 'Help and documentation commands' }),
    (0, discordx_1.SlashGroup)('help'),
    __metadata("design:paramtypes", [])
], HelpCommands);
//# sourceMappingURL=help-commands.js.map