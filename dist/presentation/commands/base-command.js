"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCommand = void 0;
const discord_js_1 = require("discord.js");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const logger_1 = require("../../infrastructure/logger");
class BaseCommand {
    /**
     * Initialize validation services
     * Should be called in the constructor of derived classes
     */
    initializeValidationServices(commandValidationService, businessRuleValidationService, crossEntityValidationService, permissionService) {
        this.commandValidationService = commandValidationService;
        this.businessRuleValidationService = businessRuleValidationService;
        this.crossEntityValidationService = crossEntityValidationService;
        this.permissionService = permissionService;
    }
    /**
     * Get permission context from interaction
     */
    async getPermissionContext(interaction) {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        if (!member) {
            throw new Error('Member not found in guild');
        }
        return {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            userRoles: member.roles.cache.map(role => role.id),
            isGuildOwner: interaction.guild?.ownerId === interaction.user.id,
        };
    }
    /**
     * Validate command with options
     */
    async validateCommand(interaction, options) {
        if (!this.commandValidationService) {
            logger_1.logger.warn('CommandValidationService not initialized, skipping validation');
            return { isValid: true, errors: [], warnings: [] };
        }
        const permissionContext = await this.getPermissionContext(interaction);
        const validationContext = await this.commandValidationService.extractValidationContext(interaction, permissionContext);
        return await this.commandValidationService.validateCommand(validationContext, options);
    }
    /**
     * Handle validation result and show appropriate UI
     */
    async handleValidationResult(interaction, validationResult) {
        if (validationResult.isValid) {
            // Show warnings if any
            if (validationResult.warnings.length > 0) {
                const warningEmbed = this.createWarningEmbed('Validation Warnings', validationResult.warnings.join('\n'));
                await interaction.reply({
                    embeds: [warningEmbed],
                    ephemeral: true
                });
            }
            return true;
        }
        // Check if bypass is available
        if (validationResult.requiresConfirmation && this.commandValidationService) {
            const permissionContext = await this.getPermissionContext(interaction);
            if (permissionContext.isGuildOwner) {
                // Show bypass modal
                const modal = this.commandValidationService.createBypassModal(validationResult.bypassRequests || []);
                await interaction.showModal(modal);
                return false;
            }
        }
        // Show validation errors
        const errorEmbed = this.createErrorEmbed('Validation Failed', validationResult.errors.join('\n'));
        await interaction.reply({
            embeds: [errorEmbed],
            ephemeral: true
        });
        return false;
    }
    /**
     * Handle validation bypass confirmation
     */
    async handleValidationBypass(interaction) {
        if (!this.commandValidationService) {
            await interaction.reply({
                embeds: [this.createErrorEmbed('Error', 'Validation service not available')],
                ephemeral: true
            });
            return false;
        }
        const success = await this.commandValidationService.handleBypassConfirmation(interaction, interaction.user.id);
        if (success) {
            await interaction.reply({
                embeds: [this.createSuccessEmbed('Validation Bypassed', 'Proceeding with the command despite validation warnings.')],
                ephemeral: true
            });
        }
        return success;
    }
    /**
     * Check if user has required permission
     */
    async hasPermission(interaction, requiredPermission) {
        if (!this.permissionService) {
            logger_1.logger.warn('PermissionService not initialized');
            return false;
        }
        const context = await this.getPermissionContext(interaction);
        return await this.permissionService.hasActionPermission(context, requiredPermission);
    }
    /**
     * Create error embed with consistent styling
     */
    createErrorEmbed(title, description) {
        return embed_utils_1.EmbedUtils.createErrorEmbed(title, description);
    }
    /**
     * Create success embed with consistent styling
     */
    createSuccessEmbed(title, description) {
        return embed_utils_1.EmbedUtils.createSuccessEmbed(title, description);
    }
    /**
     * Create warning embed with consistent styling
     */
    createWarningEmbed(title, description) {
        return new discord_js_1.EmbedBuilder()
            .setTitle(`⚠️ ${title}`)
            .setDescription(description)
            .setColor(0xFFCC00)
            .setTimestamp();
    }
    /**
     * Create info embed with consistent styling
     */
    createInfoEmbed(title, description, fields) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`ℹ️ ${title}`)
            .setDescription(description)
            .setColor(0x3498db)
            .setTimestamp();
        if (fields) {
            embed.addFields(fields);
        }
        return embed;
    }
    /**
     * Log command execution with context
     */
    logCommandExecution(interaction, action, details) {
        logger_1.logger.info(`Command executed: ${action}`, {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            userName: interaction.user.tag,
            commandName: interaction.commandName,
            subcommand: interaction.options.getSubcommand(false) || undefined,
            channelId: interaction.channelId,
            ...details
        });
    }
    /**
     * Log command error with context
     */
    logCommandError(interaction, action, error, details) {
        logger_1.logger.error(`Command error: ${action}`, {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            userName: interaction.user.tag,
            commandName: interaction.commandName,
            subcommand: interaction.options.getSubcommand(false) || undefined,
            channelId: interaction.channelId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            ...details
        });
    }
    /**
     * Extract member from user option
     */
    async getMemberFromOption(interaction, optionName) {
        const user = interaction.options.getUser(optionName);
        if (!user || !interaction.guild)
            return null;
        try {
            return await interaction.guild.members.fetch(user.id);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to fetch member ${user.id}:`, error);
            return null;
        }
    }
    /**
     * Defer reply with thinking state
     */
    async deferReply(interaction, ephemeral = false) {
        const context = await this.getPermissionContext(interaction);
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral });
        }
    }
    /**
     * Safe reply that handles deferred state
     */
    async safeReply(interaction, options) {
        if (interaction.deferred) {
            await interaction.editReply(options);
        }
        else if (!interaction.replied) {
            await interaction.reply(options);
        }
        else {
            await interaction.followUp({ ...options, ephemeral: true });
        }
    }
}
exports.BaseCommand = BaseCommand;
//# sourceMappingURL=base-command.js.map