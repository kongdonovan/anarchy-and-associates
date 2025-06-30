import { Client, GuildMember, Guild, TextChannel } from 'discord.js';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { CaseService } from './case-service';
import { ChannelPermissionManager } from './channel-permission-manager';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { logger } from '../../infrastructure/logger';
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { Case, StaffRole } from '../../validation';
import { AuditAction } from '../../domain/entities/audit-log';
import { PermissionService, PermissionContext } from './permission-service';
import { ValidationServiceFactory } from '../validation/validation-service-factory';

export type RoleChangeType = 'hire' | 'fire' | 'promotion' | 'demotion';

export interface RoleChangeEvent {
  member: GuildMember;
  oldRole?: StaffRole;
  newRole?: StaffRole;
  changeType: RoleChangeType;
}

export class RoleChangeCascadeService {
  private caseRepository: CaseRepository;
  private caseService: CaseService;
  private channelPermissionManager: ChannelPermissionManager;
  private auditLogRepository: AuditLogRepository;
  private staffRepository: StaffRepository;

  // Define which roles have lawyer permissions (can be assigned to cases)
  private readonly LAWYER_ROLES: StaffRole[] = [
    'Managing Partner',
    'Senior Partner',
    'Junior Partner',
    'Senior Associate',
    'Junior Associate'
  ];

  // Define which roles have lead attorney permissions
  private readonly LEAD_ATTORNEY_ROLES: StaffRole[] = [
    'Managing Partner',
    'Senior Partner',
    'Junior Partner',
    'Senior Associate'
  ];

  constructor() {
    this.caseRepository = new CaseRepository();
    this.auditLogRepository = new AuditLogRepository();
    this.staffRepository = new StaffRepository();
    
    // Initialize dependencies for services
    const caseCounterRepository = new CaseCounterRepository();
    const guildConfigRepository = new GuildConfigRepository();
    const permissionService = new PermissionService(guildConfigRepository);
    const jobRepository = new JobRepository();
    const applicationRepository = new ApplicationRepository();
    
    // Create unified validation service
    const validationService = ValidationServiceFactory.createValidationService(
      {
        staffRepository: this.staffRepository,
        caseRepository: this.caseRepository,
        guildConfigRepository,
        jobRepository,
        applicationRepository
      },
      {
        permissionService
      }
    );
    
    this.channelPermissionManager = new ChannelPermissionManager(
      this.caseRepository,
      this.staffRepository,
      this.auditLogRepository,
      validationService
    );

    this.caseService = new CaseService(
      this.caseRepository,
      caseCounterRepository,
      guildConfigRepository,
      permissionService,
      validationService
    );
  }

  /**
   * Initialize the cascade service with Discord client
   */
  public initialize(_client: Client): void { // eslint-disable-line @typescript-eslint/no-unused-vars, no-unused-vars
    logger.info('Role change cascade service initialized');
  }

  /**
   * Handle cascading effects of role changes
   */
  public async handleRoleChange(event: RoleChangeEvent): Promise<void> {
    const { member, oldRole, newRole, changeType } = event;
    
    try {
      logger.info(`Handling cascading effects for ${changeType} of ${member.displayName}`, {
        userId: member.user.id,
        guildId: member.guild.id,
        oldRole,
        newRole,
        changeType
      });

      // Determine if permissions were lost
      const hadLawyerPermissions = oldRole ? this.hasLawyerPermissions(oldRole) : false;
      const hasLawyerPermissions = newRole ? this.hasLawyerPermissions(newRole) : false;
      const hadLeadAttorneyPermissions = oldRole ? this.hasLeadAttorneyPermissions(oldRole) : false;
      const hasLeadAttorneyPermissions = newRole ? this.hasLeadAttorneyPermissions(newRole) : false;

      // Handle loss of lawyer permissions (fired or demoted below Junior Associate)
      if (hadLawyerPermissions && !hasLawyerPermissions) {
        await this.handleLossOfLawyerPermissions(member, oldRole!, newRole);
      }
      // Handle loss of lead attorney permissions (demoted below Senior Associate)
      else if (hadLeadAttorneyPermissions && !hasLeadAttorneyPermissions && hasLawyerPermissions) {
        await this.handleLossOfLeadAttorneyPermissions(member, oldRole!, newRole!);
      }

      // Update channel permissions through existing channel permission manager
      if (oldRole || newRole) {
        await this.channelPermissionManager.handleRoleChange(
          member.guild,
          member,
          oldRole,
          newRole,
          changeType
        );
      }

    } catch (error) {
      logger.error(`Error handling cascading effects for ${changeType}:`, error);
    }
  }

  /**
   * Handle when a staff member loses all lawyer permissions
   */
  private async handleLossOfLawyerPermissions(
    member: GuildMember,
    oldRole: StaffRole,
    newRole?: StaffRole
  ): Promise<void> {
    const userId = member.user.id;
    const guildId = member.guild.id;
    const changeType = newRole ? 'demotion' : 'termination';

    logger.info(`Staff member ${member.displayName} lost lawyer permissions`, {
      userId,
      guildId,
      oldRole,
      newRole,
      changeType
    });

    // Find all cases where this user is assigned
    const assignedCases = await this.caseRepository.findByLawyer(userId);
    const leadCases = assignedCases.filter(c => c.leadAttorneyId === userId);
    const regularCases = assignedCases.filter(c => c.leadAttorneyId !== userId);

    if (assignedCases.length === 0) {
      logger.info(`No cases to unassign for ${member.displayName}`);
      return;
    }

    logger.info(`Unassigning ${member.displayName} from ${assignedCases.length} cases`, {
      leadCases: leadCases.length,
      regularCases: regularCases.length
    });

    // Notify the user about case removal
    await this.notifyUserOfCaseRemoval(member, assignedCases, changeType);

    // Process each case
    for (const caseData of assignedCases) {
      try {
        await this.processCase(caseData, member, changeType);
      } catch (error) {
        logger.error(`Error processing case ${caseData.caseNumber}:`, error);
      }
    }

    // Log audit event
    await this.logCascadeAuditEvent(member, oldRole, newRole, assignedCases.length, changeType);
  }

  /**
   * Handle when a staff member loses lead attorney permissions but retains lawyer permissions
   */
  private async handleLossOfLeadAttorneyPermissions(
    member: GuildMember,
    oldRole: StaffRole,
    newRole: StaffRole
  ): Promise<void> {
    const userId = member.user.id;
    const guildId = member.guild.id;

    logger.info(`Staff member ${member.displayName} lost lead attorney permissions`, {
      userId,
      guildId,
      oldRole,
      newRole
    });

    // Find cases where this user is lead attorney
    const leadCases = await this.caseRepository.findByLeadAttorney(userId);

    if (leadCases.length === 0) {
      logger.info(`No lead attorney cases to update for ${member.displayName}`);
      return;
    }

    logger.info(`Removing lead attorney status from ${leadCases.length} cases for ${member.displayName}`);

    // Notify user about lead attorney removal
    await this.notifyUserOfLeadAttorneyRemoval(member, leadCases);

    // Remove lead attorney status from each case
    for (const caseData of leadCases) {
      try {
        await this.removeLeadAttorneyStatus(caseData, member);
      } catch (error) {
        logger.error(`Error removing lead attorney status from case ${caseData.caseNumber}:`, error);
      }
    }

    // Log audit event
    await this.logLeadAttorneyRemovalAuditEvent(member, oldRole, newRole, leadCases.length);
  }

  /**
   * Process a single case for unassignment
   */
  private async processCase(caseData: Case, member: GuildMember, changeType: string): Promise<void> {
    const systemContext: PermissionContext = {
      guildId: member.guild.id,
      userId: 'system',
      userRoles: [],
      isGuildOwner: false
    };

    // Unassign the lawyer from the case
    await this.caseService.unassignLawyer(systemContext, caseData._id!.toString(), member.user.id);

    // Update case channel to notify about the change
    await this.notifyCaseChannel(caseData, member, changeType);

    // Check if case has no lawyers left
    const updatedCase = await this.caseRepository.findById(caseData._id!.toString());
    if (updatedCase && updatedCase.assignedLawyerIds.length === 0) {
      await this.handleCaseWithNoLawyers(updatedCase, member.guild);
    }
  }

  /**
   * Remove lead attorney status from a case
   */
  private async removeLeadAttorneyStatus(caseData: Case, member: GuildMember): Promise<void> {
    // Update the case to remove lead attorney
    await this.caseRepository.update(caseData._id!.toString(), {
      leadAttorneyId: undefined
    });

    // Notify case channel about lead attorney removal
    await this.notifyCaseChannelLeadAttorneyRemoval(caseData, member);
  }

  /**
   * Handle cases that have no lawyers assigned
   */
  private async handleCaseWithNoLawyers(caseData: Case, guild: Guild): Promise<void> {
    logger.warn(`Case ${caseData.caseNumber} has no lawyers assigned!`, {
      caseId: caseData._id,
      guildId: guild.id
    });

    // Find senior staff to notify
    const managingPartners = await this.staffRepository.findByFilters({
      guildId: guild.id,
      role: 'Managing Partner',
      status: 'active'
    });
    const seniorPartners = await this.staffRepository.findByFilters({
      guildId: guild.id,
      role: 'Senior Partner',
      status: 'active'
    });
    const seniorStaff = [...managingPartners, ...seniorPartners];

    // Create urgent notification embed
    const embed = EmbedUtils.createAALegalEmbed({
      title: '⚠️ Urgent: Case Requires Lawyer Assignment',
      description: `Case **${caseData.caseNumber}** currently has no lawyers assigned and requires immediate attention.`,
      color: 'error' as const
    })
      .addFields(
        { name: 'Case Title', value: caseData.title, inline: false },
        { name: 'Client', value: `<@${caseData.clientId}>`, inline: true },
        { name: 'Status', value: caseData.status, inline: true },
        { name: 'Priority', value: caseData.priority, inline: true }
      )
      .setFooter({ text: 'Please assign a lawyer to this case immediately' });

    // Notify in case channel with pings
    if (caseData.channelId) {
      try {
        const channel = await guild.channels.fetch(caseData.channelId) as TextChannel;
        if (channel) {
          const mentions = seniorStaff.map(staff => `<@${staff.userId}>`).join(' ');
          await channel.send({
            content: `${mentions} **URGENT: This case has no lawyers assigned!**`,
            embeds: [embed]
          });
        }
      } catch (error) {
        logger.error(`Failed to notify case channel ${caseData.channelId}:`, error);
      }
    }

    // DM senior staff
    for (const staff of seniorStaff) {
      try {
        const member = await guild.members.fetch(staff.userId);
        await member.send({ embeds: [embed] });
      } catch (error) {
        logger.error(`Failed to DM senior staff ${staff.userId}:`, error);
      }
    }
  }

  /**
   * Notify user via DM about case removal
   */
  private async notifyUserOfCaseRemoval(
    member: GuildMember,
    cases: Case[],
    changeType: string
  ): Promise<void> {
    const reason = changeType === 'termination' 
      ? 'your termination from the firm' 
      : 'your demotion to a non-lawyer position';

    const embed = EmbedUtils.createAALegalEmbed({
      title: 'Case Assignment Update',
      description: `Due to ${reason}, you have been unassigned from the following cases:`,
      color: 'warning' as const
    });

    // Add case list
    const caseList = cases.map(c => 
      `• **${c.caseNumber}** - ${c.title} ${c.leadAttorneyId === member.user.id ? '*(Lead Attorney)*' : ''}`
    ).join('\n');

    embed.addFields({
      name: 'Affected Cases',
      value: caseList.substring(0, 1024) // Discord field limit
    });

    if (changeType === 'demotion') {
      embed.addFields({
        name: 'Next Steps',
        value: 'Please coordinate with your supervisor for case handover procedures.'
      });
    }

    embed.setFooter({ text: 'Anarchy & Associates Legal Firm' });

    try {
      await member.send({ embeds: [embed] });
      logger.info(`Notified ${member.displayName} about case removal via DM`);
    } catch (error) {
      logger.warn(`Failed to DM ${member.displayName} about case removal:`, error);
    }
  }

  /**
   * Notify user via DM about lead attorney removal
   */
  private async notifyUserOfLeadAttorneyRemoval(
    member: GuildMember,
    cases: Case[]
  ): Promise<void> {
    const embed = EmbedUtils.createAALegalEmbed({
      title: 'Lead Attorney Status Update',
      description: 'Due to your role change, you have been removed as lead attorney from the following cases:',
      color: 'warning' as const
    });

    const caseList = cases.map(c => `• **${c.caseNumber}** - ${c.title}`).join('\n');

    embed.addFields(
      {
        name: 'Affected Cases',
        value: caseList.substring(0, 1024)
      },
      {
        name: 'Note',
        value: 'You remain assigned to these cases as a regular attorney.'
      }
    );

    embed.setFooter({ text: 'Anarchy & Associates Legal Firm' });

    try {
      await member.send({ embeds: [embed] });
      logger.info(`Notified ${member.displayName} about lead attorney removal via DM`);
    } catch (error) {
      logger.warn(`Failed to DM ${member.displayName} about lead attorney removal:`, error);
    }
  }

  /**
   * Notify case channel about staffing changes
   */
  private async notifyCaseChannel(
    caseData: Case,
    member: GuildMember,
    changeType: string
  ): Promise<void> {
    if (!caseData.channelId) return;

    try {
      const channel = await member.guild.channels.fetch(caseData.channelId) as TextChannel;
      if (!channel) return;

      const reason = changeType === 'termination' ? 'termination' : 'role change';
      const wasLead = caseData.leadAttorneyId === member.user.id;

      const embed = EmbedUtils.createAALegalEmbed({
        title: 'Case Staffing Update',
        description: `${member.displayName} has been unassigned from this case due to ${reason}.`,
        color: 'warning' as const
      });

      if (wasLead) {
        embed.addFields({
          name: 'Lead Attorney Status',
          value: 'This case no longer has a lead attorney. Please assign a new lead attorney.'
        });
      }

      const remainingLawyers = caseData.assignedLawyerIds
        .filter(id => id !== member.user.id)
        .length;

      embed.addFields({
        name: 'Remaining Lawyers',
        value: remainingLawyers > 0 
          ? `${remainingLawyers} lawyer(s) remain assigned to this case.`
          : '⚠️ **No lawyers are currently assigned to this case!**'
      });

      embed.setFooter({ text: `Case ${caseData.caseNumber}` });

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Failed to notify case channel ${caseData.channelId}:`, error);
    }
  }

  /**
   * Notify case channel about lead attorney removal
   */
  private async notifyCaseChannelLeadAttorneyRemoval(
    caseData: Case,
    member: GuildMember
  ): Promise<void> {
    if (!caseData.channelId) return;

    try {
      const channel = await member.guild.channels.fetch(caseData.channelId) as TextChannel;
      if (!channel) return;

      const embed = EmbedUtils.createAALegalEmbed({
        title: 'Lead Attorney Update',
        description: `${member.displayName} is no longer the lead attorney for this case due to role change.`,
        color: 'warning' as const
      })
        .addFields(
          {
            name: 'Status',
            value: `${member.displayName} remains assigned to this case as a regular attorney.`
          },
          {
            name: 'Action Required',
            value: 'Please assign a new lead attorney to this case.'
          }
        )
        .setFooter({ text: `Case ${caseData.caseNumber}` });

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Failed to notify case channel ${caseData.channelId} about lead attorney removal:`, error);
    }
  }

  /**
   * Check if a role has lawyer permissions
   */
  private hasLawyerPermissions(role: StaffRole): boolean {
    return this.LAWYER_ROLES.includes(role);
  }

  /**
   * Check if a role has lead attorney permissions
   */
  private hasLeadAttorneyPermissions(role: StaffRole): boolean {
    return this.LEAD_ATTORNEY_ROLES.includes(role);
  }

  /**
   * Log audit event for cascading changes
   */
  private async logCascadeAuditEvent(
    member: GuildMember,
    oldRole: StaffRole,
    newRole: StaffRole | undefined,
    casesAffected: number,
    changeType: string
  ): Promise<void> {
    try {
      const action = changeType === 'termination' 
        ? AuditAction.STAFF_FIRED 
        : AuditAction.STAFF_DEMOTED;

      await this.auditLogRepository.add({
        guildId: member.guild.id,
        action,
        actorId: 'system-cascade',
        targetId: member.user.id,
        details: {
          before: { role: oldRole },
          after: newRole ? { role: newRole } : undefined,
          reason: `Cascading effects: Unassigned from ${casesAffected} cases due to ${changeType}`,
          metadata: {
            source: 'role-change-cascade-service',
            casesAffected,
            changeType
          }
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error logging cascade audit event:', error);
    }
  }

  /**
   * Log audit event for lead attorney removal
   */
  private async logLeadAttorneyRemovalAuditEvent(
    member: GuildMember,
    oldRole: StaffRole,
    newRole: StaffRole,
    casesAffected: number
  ): Promise<void> {
    try {
      await this.auditLogRepository.add({
        guildId: member.guild.id,
        action: AuditAction.STAFF_DEMOTED,
        actorId: 'system-cascade',
        targetId: member.user.id,
        details: {
          before: { role: oldRole, leadAttorney: true },
          after: { role: newRole, leadAttorney: false },
          reason: `Cascading effects: Removed as lead attorney from ${casesAffected} cases due to demotion`,
          metadata: {
            source: 'role-change-cascade-service',
            leadCasesAffected: casesAffected,
            changeType: 'lead-attorney-removal'
          }
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error logging lead attorney removal audit event:', error);
    }
  }
}