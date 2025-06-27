import { CommandInteraction, EmbedBuilder, ButtonInteraction, ModalSubmitInteraction, GuildMember } from 'discord.js';
import { PermissionContext, PermissionService } from '../../application/services/permission-service';
import { CommandValidationService, CommandValidationOptions, CommandValidationResult } from '../../application/services/command-validation-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { CrossEntityValidationService } from '../../application/services/cross-entity-validation-service';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { logger } from '../../infrastructure/logger';

export abstract class BaseCommand {
  protected commandValidationService?: CommandValidationService;
  protected businessRuleValidationService?: BusinessRuleValidationService;
  protected crossEntityValidationService?: CrossEntityValidationService;
  protected permissionService?: PermissionService;

  /**
   * Initialize validation services
   * Should be called in the constructor of derived classes
   */
  protected initializeValidationServices(
    commandValidationService: CommandValidationService,
    businessRuleValidationService: BusinessRuleValidationService,
    crossEntityValidationService: CrossEntityValidationService,
    permissionService: PermissionService
  ): void {
    this.commandValidationService = commandValidationService;
    this.businessRuleValidationService = businessRuleValidationService;
    this.crossEntityValidationService = crossEntityValidationService;
    this.permissionService = permissionService;
  }

  /**
   * Get permission context from interaction
   */
  protected async getPermissionContext(interaction: CommandInteraction): Promise<PermissionContext> {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      throw new Error('Member not found in guild');
    }

    return {
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      userRoles: member.roles.cache.map(role => role.id),
      isGuildOwner: interaction.guild?.ownerId === interaction.user.id,
    };
  }

  /**
   * Validate command with options
   */
  protected async validateCommand(
    interaction: CommandInteraction,
    options?: CommandValidationOptions
  ): Promise<CommandValidationResult> {
    if (!this.commandValidationService) {
      logger.warn('CommandValidationService not initialized, skipping validation');
      return { isValid: true, errors: [], warnings: [] };
    }

    const permissionContext = await this.getPermissionContext(interaction);
    const validationContext = await this.commandValidationService.extractValidationContext(
      interaction,
      permissionContext
    );

    return await this.commandValidationService.validateCommand(validationContext, options);
  }

  /**
   * Handle validation result and show appropriate UI
   */
  protected async handleValidationResult(
    interaction: CommandInteraction,
    validationResult: CommandValidationResult
  ): Promise<boolean> {
    if (validationResult.isValid) {
      // Show warnings if any
      if (validationResult.warnings.length > 0) {
        const warningEmbed = this.createWarningEmbed(
          'Validation Warnings',
          validationResult.warnings.join('\n')
        );
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
        const modal = this.commandValidationService.createBypassModal(
          validationResult.bypassRequests || []
        );
        await interaction.showModal(modal);
        return false;
      }
    }

    // Show validation errors
    const errorEmbed = this.createErrorEmbed(
      'Validation Failed',
      validationResult.errors.join('\n')
    );
    
    await interaction.reply({
      embeds: [errorEmbed],
      ephemeral: true
    });
    
    return false;
  }

  /**
   * Handle validation bypass confirmation
   */
  protected async handleValidationBypass(
    interaction: ButtonInteraction | ModalSubmitInteraction
  ): Promise<boolean> {
    if (!this.commandValidationService) {
      await interaction.reply({
        embeds: [this.createErrorEmbed('Error', 'Validation service not available')],
        ephemeral: true
      });
      return false;
    }

    const success = await this.commandValidationService.handleBypassConfirmation(
      interaction,
      interaction.user.id
    );

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
  protected async hasPermission(
    interaction: CommandInteraction,
    requiredPermission: string
  ): Promise<boolean> {
    if (!this.permissionService) {
      logger.warn('PermissionService not initialized');
      return false;
    }

    const context = await this.getPermissionContext(interaction);
    return await this.permissionService.hasActionPermission(context, requiredPermission as any);
  }

  /**
   * Create error embed with consistent styling
   */
  protected createErrorEmbed(title: string, description: string): EmbedBuilder {
    return EmbedUtils.createErrorEmbed(title, description);
  }

  /**
   * Create success embed with consistent styling
   */
  protected createSuccessEmbed(title: string, description: string): EmbedBuilder {
    return EmbedUtils.createSuccessEmbed(title, description);
  }

  /**
   * Create warning embed with consistent styling
   */
  protected createWarningEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`⚠️ ${title}`)
      .setDescription(description)
      .setColor(0xFFCC00)
      .setTimestamp();
  }

  /**
   * Create info embed with consistent styling
   */
  protected createInfoEmbed(title: string, description: string, fields?: { name: string; value: string; inline?: boolean }[]): EmbedBuilder {
    const embed = new EmbedBuilder()
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
  protected logCommandExecution(
    interaction: CommandInteraction,
    action: string,
    details?: Record<string, any>
  ): void {
    logger.info(`Command executed: ${action}`, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      userName: interaction.user.tag,
      commandName: interaction.commandName,
      subcommand: interaction.isChatInputCommand() ? interaction.options.getSubcommand(false) || undefined : undefined,
      channelId: interaction.channelId,
      ...details
    });
  }

  /**
   * Log command error with context
   */
  protected logCommandError(
    interaction: CommandInteraction,
    action: string,
    error: any,
    details?: Record<string, any>
  ): void {
    logger.error(`Command error: ${action}`, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      userName: interaction.user.tag,
      commandName: interaction.commandName,
      subcommand: interaction.isChatInputCommand() ? interaction.options.getSubcommand(false) || undefined : undefined,
      channelId: interaction.channelId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...details
    });
  }

  /**
   * Extract member from user option
   */
  protected async getMemberFromOption(
    interaction: CommandInteraction,
    optionName: string
  ): Promise<GuildMember | null> {
    if (!interaction.isChatInputCommand()) return null;
    const user = interaction.options.getUser(optionName);
    if (!user || !interaction.guild) return null;

    try {
      return await interaction.guild.members.fetch(user.id);
    } catch (error) {
      logger.warn(`Failed to fetch member ${user.id}:`, error);
      return null;
    }
  }

  /**
   * Defer reply with thinking state
   */
  protected async deferReply(interaction: CommandInteraction, ephemeral: boolean = false): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral });
    }
  }

  /**
   * Safe reply that handles deferred state
   */
  protected async safeReply(
    interaction: CommandInteraction,
    options: { embeds?: EmbedBuilder[]; content?: string; ephemeral?: boolean }
  ): Promise<void> {
    if (interaction.deferred) {
      await interaction.editReply(options);
    } else if (!interaction.replied) {
      await interaction.reply(options);
    } else {
      await interaction.followUp({ ...options, ephemeral: true });
    }
  }
}