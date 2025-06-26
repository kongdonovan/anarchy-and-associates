import {
  Discord,
  Slash,
  SlashOption,
  SlashGroup,
  ModalComponent,
} from 'discordx';
import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  User,
  CommandInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { StaffService } from '../../application/services/staff-service';
import { DiscordRoleSyncService } from '../../application/services/discord-role-sync-service';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { CommandValidationService } from '../../application/services/command-validation-service';
import { CrossEntityValidationService } from '../../application/services/cross-entity-validation-service';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { StaffRole, RoleUtils } from '../../domain/entities/staff-role';
import { GuildOwnerUtils } from '../../infrastructure/utils/guild-owner-utils';
import { logger } from '../../infrastructure/logger';
import { BaseCommand } from './base-command';
import { ValidateCommand, ValidatePermissions, ValidateBusinessRules } from '../decorators/validation-decorators';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { ReminderRepository } from '../../infrastructure/repositories/reminder-repository';

@Discord()
@SlashGroup({ name: 'staff', description: 'Staff management commands' })
@SlashGroup('staff')
export class StaffCommands extends BaseCommand {
  private staffRepository: StaffRepository;
  private auditLogRepository: AuditLogRepository;
  private caseRepository: CaseRepository;
  private guildConfigRepository: GuildConfigRepository;
  private staffService: StaffService;
  private roleSyncService: DiscordRoleSyncService;
  private permissionService: PermissionService;
  private businessRuleValidationService: BusinessRuleValidationService;

  constructor() {
    super();
    this.staffRepository = new StaffRepository();
    this.auditLogRepository = new AuditLogRepository();
    this.caseRepository = new CaseRepository();
    this.guildConfigRepository = new GuildConfigRepository();
    
    // Initialize repositories for cross-entity validation
    const applicationRepository = new ApplicationRepository();
    const jobRepository = new JobRepository();
    const retainerRepository = new RetainerRepository();
    const feedbackRepository = new FeedbackRepository();
    const reminderRepository = new ReminderRepository();
    
    // Initialize services
    this.permissionService = new PermissionService(this.guildConfigRepository);
    this.businessRuleValidationService = new BusinessRuleValidationService(
      this.guildConfigRepository,
      this.staffRepository,
      this.caseRepository,
      this.permissionService
    );
    this.crossEntityValidationService = new CrossEntityValidationService(
      this.staffRepository,
      this.caseRepository,
      applicationRepository,
      jobRepository,
      retainerRepository,
      feedbackRepository,
      reminderRepository,
      this.auditLogRepository,
      this.businessRuleValidationService
    );
    this.commandValidationService = new CommandValidationService(
      this.businessRuleValidationService,
      this.crossEntityValidationService
    );
    
    // Initialize validation services in base class
    this.initializeValidationServices(
      this.commandValidationService,
      this.businessRuleValidationService,
      this.crossEntityValidationService,
      this.permissionService
    );
    
    this.staffService = new StaffService(
      this.staffRepository,
      this.auditLogRepository,
      this.permissionService,
      this.businessRuleValidationService
    );
    this.roleSyncService = new DiscordRoleSyncService(
      this.staffRepository,
      this.auditLogRepository
    );
  }

  // Add reference to cross-entity validation service
  private crossEntityValidationService: CrossEntityValidationService;

  @Slash({ name: 'hire', description: 'Hire a new staff member' })
  @ValidatePermissions('senior-staff')
  @ValidateBusinessRules('role_limit')
  async hireStaff(
    @SlashOption({
      name: 'user',
      description: 'User to hire',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    @SlashOption({
      name: 'role',
      description: 'Role to assign',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    role: string,
    @SlashOption({
      name: 'roblox_username',
      description: 'Roblox username',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    robloxUsername: string,
    @SlashOption({
      name: 'reason',
      description: 'Reason for hiring',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    reason: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      // Validate role
      if (!RoleUtils.isValidRole(role)) {
        const validRoles = RoleUtils.getAllRoles().join(', ');
        await interaction.reply({
          embeds: [this.createErrorEmbed(`Invalid role. Valid roles are: ${validRoles}`)],
          ephemeral: true,
        });
        return;
      }

      const context = await this.getPermissionContext(interaction);

      // Check if user performing the action can hire this role
      const actorStaff = await this.staffRepository.findByUserId(interaction.guildId, interaction.user.id);
      if (actorStaff && !context.isGuildOwner) {
        const canHire = RoleUtils.canPromote(actorStaff.role, role as StaffRole);
        if (!canHire) {
          await interaction.reply({
            embeds: [this.createErrorEmbed('You can only hire staff at lower levels than your own role.')],
            ephemeral: true,
          });
          return;
        }
      }

      // Validation decorators have already run, so we can proceed with hiring
      await this.performStaffHiring(interaction, user, role as StaffRole, robloxUsername, reason, context);
    } catch (error) {
      logger.error('Error in hire staff command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  /**
   * Perform the actual staff hiring (separated for reuse in bypass flow)
   */
  private async performStaffHiring(
    interaction: CommandInteraction,
    user: User,
    role: StaffRole,
    robloxUsername: string,
    reason: string,
    context: PermissionContext,
    bypassReason?: string
  ): Promise<void> {
    try {
      const result = await this.staffService.hireStaff(context, {
        guildId: interaction.guildId!,
        userId: user.id,
        robloxUsername,
        role,
        hiredBy: interaction.user.id,
        reason,
        isGuildOwner: context.isGuildOwner
      });

      if (!result.success) {
        const replyMethod = interaction.replied ? 'editReply' : 'reply';
        await interaction[replyMethod]({
          embeds: [this.createErrorEmbed(result.error || 'Failed to hire staff member.')],
        });
        return;
      }

      // Sync Discord role
      if (result.staff) {
        await this.roleSyncService.syncStaffRole(interaction.guild, result.staff, interaction.user.id);
      }

      // Create success message
      let successMessage = `Successfully hired ${user.displayName} as ${role}.\nRoblox Username: ${robloxUsername}`;
      if (bypassReason) {
        successMessage += `\n\n**Guild Owner Bypass Applied**\nReason: ${bypassReason}`;
      }

      const replyMethod = interaction.replied ? 'editReply' : 'reply';
      await interaction[replyMethod]({
        embeds: [bypassReason ? 
          GuildOwnerUtils.createBypassSuccessEmbed(role, result.staff?.role ? RoleUtils.getRoleLevel(result.staff.role) : 1, bypassReason) :
          this.createSuccessEmbed(successMessage)
        ],
      });

      logger.info(`Staff hired: ${user.id} as ${role} by ${interaction.user.id} in guild ${interaction.guildId}`, {
        bypassUsed: !!bypassReason,
        bypassReason
      });
    } catch (error) {
      logger.error('Error in performStaffHiring:', error);
      const replyMethod = interaction.replied ? 'editReply' : 'reply';
      await interaction[replyMethod]({
        embeds: [this.createErrorEmbed('An error occurred while processing the hiring.')],
      });
    }
  }

  /**
   * Handle guild owner bypass modal submission
   */
  @ModalComponent({ id: /role_limit_bypass_.*/ })
  async handleRoleLimitBypass(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      // Verify this is a valid bypass attempt
      if (!GuildOwnerUtils.isEligibleForBypass(interaction)) {
        await interaction.reply({
          embeds: [GuildOwnerUtils.createBypassErrorEmbed('You are not authorized to perform bypass operations.')],
          ephemeral: true
        });
        return;
      }

      // Check if bypass is expired
      if (GuildOwnerUtils.isBypassExpired(interaction.customId)) {
        await interaction.reply({
          embeds: [GuildOwnerUtils.createBypassErrorEmbed('Bypass confirmation has expired. Please retry the original command.')],
          ephemeral: true
        });
        return;
      }

      // Validate bypass confirmation
      const confirmation = GuildOwnerUtils.validateBypassConfirmation(interaction);
      if (!confirmation.confirmed) {
        await interaction.reply({
          embeds: [GuildOwnerUtils.createBypassErrorEmbed(confirmation.error || 'Bypass confirmation failed.')],
          ephemeral: true
        });
        return;
      }

      // Parse bypass information from custom ID
      const bypassInfo = GuildOwnerUtils.parseBypassId(interaction.customId);
      if (!bypassInfo) {
        await interaction.reply({
          embeds: [GuildOwnerUtils.createBypassErrorEmbed('Invalid bypass request. Please retry the original command.')],
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        embeds: [this.createInfoEmbed(
          'Bypass Confirmed',
          'Guild owner bypass has been confirmed. The original operation will now proceed with elevated privileges.\n\n' +
          '**Note:** You will need to re-run the original hire command as this confirmation does not automatically execute it.'
        )],
        ephemeral: true
      });

      logger.info('Guild owner bypass confirmed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        bypassType: bypassInfo.bypassType,
        reason: confirmation.reason
      });

    } catch (error) {
      logger.error('Error handling role limit bypass:', error);
      await interaction.reply({
        embeds: [GuildOwnerUtils.createBypassErrorEmbed('An error occurred while processing the bypass confirmation.')],
        ephemeral: true
      });
    }
  }

  @Slash({ name: 'fire', description: 'Fire a staff member' })
  @ValidatePermissions('senior-staff')
  @ValidateBusinessRules('staff_member')
  @ValidateEntity('staff', 'delete')
  async fireStaff(
    @SlashOption({
      name: 'user',
      description: 'User to fire',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    @SlashOption({
      name: 'reason',
      description: 'Reason for firing',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    reason: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const context = await this.getPermissionContext(interaction);

      // Check if target exists and get their role
      const targetStaff = await this.staffRepository.findByUserId(interaction.guildId, user.id);
      if (!targetStaff) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('User is not a staff member.')],
          ephemeral: true,
        });
        return;
      }

      // Check if user performing the action can fire this staff member
      const actorStaff = await this.staffRepository.findByUserId(interaction.guildId, interaction.user.id);
      if (actorStaff && !context.isGuildOwner) {
        const canFire = RoleUtils.canDemote(actorStaff.role, targetStaff.role);
        if (!canFire) {
          await interaction.reply({
            embeds: [this.createErrorEmbed('You can only fire staff members at lower levels than your own role.')],
            ephemeral: true,
          });
          return;
        }
      }

      // Prevent self-firing unless guild owner
      if (user.id === interaction.user.id && !context.isGuildOwner) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('You cannot fire yourself.')],
          ephemeral: true,
        });
        return;
      }

      const result = await this.staffService.fireStaff(context, {
        guildId: interaction.guildId,
        userId: user.id,
        terminatedBy: interaction.user.id,
        reason,
      });

      if (!result.success) {
        await interaction.reply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to fire staff member.')],
          ephemeral: true,
        });
        return;
      }

      // Remove Discord roles
      await this.roleSyncService.removeStaffRoles(interaction.guild, user.id, interaction.user.id);

      await interaction.reply({
        embeds: [this.createSuccessEmbed(
          `Successfully fired ${user.displayName} (${targetStaff.role}).`
        )],
      });

      logger.info(`Staff fired: ${user.id} (${targetStaff.role}) by ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Error in fire staff command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'promote', description: 'Promote a staff member' })
  @ValidatePermissions('senior-staff')
  @ValidateBusinessRules('staff_member', 'role_limit')
  @ValidateEntity('staff', 'update')
  async promoteStaff(
    @SlashOption({
      name: 'user',
      description: 'User to promote',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    @SlashOption({
      name: 'role',
      description: 'New role to assign',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    role: string,
    @SlashOption({
      name: 'reason',
      description: 'Reason for promotion',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    reason: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const context = await this.getPermissionContext(interaction);

      // Validate role
      if (!RoleUtils.isValidRole(role)) {
        const validRoles = RoleUtils.getAllRoles().join(', ');
        await interaction.reply({
          embeds: [this.createErrorEmbed(`Invalid role. Valid roles are: ${validRoles}`)],
          ephemeral: true,
        });
        return;
      }

      // Check if target exists and get their current role
      const targetStaff = await this.staffRepository.findByUserId(interaction.guildId, user.id);
      if (!targetStaff) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('User is not a staff member.')],
          ephemeral: true,
        });
        return;
      }

      // Check if user performing the action can promote to this role
      const actorStaff = await this.staffRepository.findByUserId(interaction.guildId, interaction.user.id);
      if (actorStaff && !context.isGuildOwner) {
        const canPromote = RoleUtils.canPromote(actorStaff.role, role as StaffRole);
        if (!canPromote) {
          await interaction.reply({
            embeds: [this.createErrorEmbed('You can only promote staff to roles lower than your own.')],
            ephemeral: true,
          });
          return;
        }
      }

      const result = await this.staffService.promoteStaff(context, {
        guildId: interaction.guildId,
        userId: user.id,
        newRole: role as StaffRole,
        promotedBy: interaction.user.id,
        reason,
      });

      if (!result.success) {
        await interaction.reply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to promote staff member.')],
          ephemeral: true,
        });
        return;
      }

      // Sync Discord role
      if (result.staff) {
        await this.roleSyncService.syncStaffRole(interaction.guild, result.staff, interaction.user.id);
      }

      await interaction.reply({
        embeds: [this.createSuccessEmbed(
          `Successfully promoted ${user.displayName} from ${targetStaff.role} to ${role}.`
        )],
      });

      logger.info(`Staff promoted: ${user.id} from ${targetStaff.role} to ${role} by ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Error in promote staff command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'demote', description: 'Demote a staff member' })
  @ValidatePermissions('senior-staff')
  @ValidateBusinessRules('staff_member')
  @ValidateEntity('staff', 'update')
  async demoteStaff(
    @SlashOption({
      name: 'user',
      description: 'User to demote',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    @SlashOption({
      name: 'role',
      description: 'New role to assign',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    role: string,
    @SlashOption({
      name: 'reason',
      description: 'Reason for demotion',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    reason: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const context = await this.getPermissionContext(interaction);

      // Validate role
      if (!RoleUtils.isValidRole(role)) {
        const validRoles = RoleUtils.getAllRoles().join(', ');
        await interaction.reply({
          embeds: [this.createErrorEmbed(`Invalid role. Valid roles are: ${validRoles}`)],
          ephemeral: true,
        });
        return;
      }

      // Check if target exists and get their current role
      const targetStaff = await this.staffRepository.findByUserId(interaction.guildId, user.id);
      if (!targetStaff) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('User is not a staff member.')],
          ephemeral: true,
        });
        return;
      }

      // Check if user performing the action can demote this staff member
      const actorStaff = await this.staffRepository.findByUserId(interaction.guildId, interaction.user.id);
      if (actorStaff && !context.isGuildOwner) {
        const canDemote = RoleUtils.canDemote(actorStaff.role, targetStaff.role);
        if (!canDemote) {
          await interaction.reply({
            embeds: [this.createErrorEmbed('You can only demote staff members at lower levels than your own role.')],
            ephemeral: true,
          });
          return;
        }
      }

      const result = await this.staffService.demoteStaff(context, {
        guildId: interaction.guildId,
        userId: user.id,
        newRole: role as StaffRole,
        promotedBy: interaction.user.id,
        reason,
      });

      if (!result.success) {
        await interaction.reply({
          embeds: [this.createErrorEmbed(result.error || 'Failed to demote staff member.')],
          ephemeral: true,
        });
        return;
      }

      // Sync Discord role
      if (result.staff) {
        await this.roleSyncService.syncStaffRole(interaction.guild, result.staff, interaction.user.id);
      }

      await interaction.reply({
        embeds: [this.createSuccessEmbed(
          `Successfully demoted ${user.displayName} from ${targetStaff.role} to ${role}.`
        )],
      });

      logger.info(`Staff demoted: ${user.id} from ${targetStaff.role} to ${role} by ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Error in demote staff command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'list', description: 'List all staff members' })
  async listStaff(
    @SlashOption({
      name: 'role',
      description: 'Filter by role',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    roleFilter: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guildId) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      // Validate role filter if provided
      if (roleFilter && !RoleUtils.isValidRole(roleFilter)) {
        const validRoles = RoleUtils.getAllRoles().join(', ');
        await interaction.reply({
          embeds: [this.createErrorEmbed(`Invalid role filter. Valid roles are: ${validRoles}`)],
          ephemeral: true,
        });
        return;
      }

      const result = await this.staffService.getStaffList(
        interaction.guildId,
        interaction.user.id,
        roleFilter as StaffRole,
        1,
        15
      );

      if (result.staff.length === 0) {
        const message = roleFilter 
          ? `No staff members found with role: ${roleFilter}`
          : 'No staff members found.';
        
        await interaction.reply({
          embeds: [this.createInfoEmbed('👥 Staff List', message)],
        });
        return;
      }

      const embed = this.createInfoEmbed('👥 Staff List');
      
      // Group staff by role for better organization
      const staffByRole = new Map<StaffRole, typeof result.staff>();
      result.staff.forEach(staff => {
        if (!staffByRole.has(staff.role)) {
          staffByRole.set(staff.role, []);
        }
        staffByRole.get(staff.role)!.push(staff);
      });

      // Sort roles by hierarchy level (highest first)
      const sortedRoles = Array.from(staffByRole.keys()).sort(
        (a, b) => RoleUtils.getRoleLevel(b) - RoleUtils.getRoleLevel(a)
      );

      for (const role of sortedRoles) {
        const staffList = staffByRole.get(role)!;
        const staffNames = staffList.map(staff => 
          `<@${staff.userId}> (${staff.robloxUsername})`
        ).join('\n');
        
        embed.addFields({
          name: `${role} (${staffList.length})`,
          value: staffNames,
          inline: false,
        });
      }

      embed.addFields({
        name: 'Summary',
        value: `Total: ${result.total} staff members`,
        inline: false,
      });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in list staff command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }

  @Slash({ name: 'info', description: 'View detailed staff member information' })
  async staffInfo(
    @SlashOption({
      name: 'user',
      description: 'User to view information for',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      if (!interaction.guildId) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('This command can only be used in a server.')],
          ephemeral: true,
        });
        return;
      }

      const staff = await this.staffService.getStaffInfo(context, 
        interaction.guildId,
        user.id,
        interaction.user.id
      );

      if (!staff) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('User is not a staff member.')],
          ephemeral: true,
        });
        return;
      }

      const embed = this.createInfoEmbed(`👤 Staff Information: ${user.displayName}`);
      
      embed.addFields(
        { name: 'Role', value: staff.role, inline: true },
        { name: 'Status', value: staff.status, inline: true },
        { name: 'Roblox Username', value: staff.robloxUsername, inline: true },
        { name: 'Hired Date', value: `<t:${Math.floor(staff.hiredAt.getTime() / 1000)}:F>`, inline: true },
        { name: 'Hired By', value: `<@${staff.hiredBy}>`, inline: true },
        { name: 'Role Level', value: RoleUtils.getRoleLevel(staff.role).toString(), inline: true }
      );

      // Add promotion history if available
      if (staff.promotionHistory.length > 0) {
        const recentHistory = staff.promotionHistory
          .slice(-5) // Last 5 records
          .map(record => 
            `**${record.actionType}**: ${record.fromRole} → ${record.toRole} by <@${record.promotedBy}> ` +
            `(<t:${Math.floor(record.promotedAt.getTime() / 1000)}:R>)`
          )
          .join('\n');

        embed.addFields({
          name: 'Recent History',
          value: recentHistory,
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in staff info command:', error);
      await interaction.reply({
        embeds: [this.createErrorEmbed('An error occurred while processing the command.')],
        ephemeral: true,
      });
    }
  }
}