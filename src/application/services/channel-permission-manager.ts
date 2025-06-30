import { 
  Guild, 
  GuildMember, 
  ChannelType, 
  PermissionFlagsBits, 
  TextChannel, 
  CategoryChannel,
} from 'discord.js';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { UnifiedValidationService } from '../validation/unified-validation-service';
import { PermissionContext } from './permission-service';
import { RoleUtils, StaffRole } from '../../domain/entities/staff-role'; // Keep utility functions and enum
import { logger } from '../../infrastructure/logger';
import { CaseStatus } from '../../domain/entities/case';
import { AuditAction } from '../../domain/entities/audit-log';

export interface ChannelPermissionUpdate {
  channelId: string;
  channelName: string;
  updateType: 'role-change' | 'case-assignment' | 'permission-sync';
  affectedUserId: string;
  oldRole?: string;
  newRole?: string;
  permissionsGranted: string[];
  permissionsRevoked: string[];
  timestamp: Date;
}

export interface ChannelPermissionRule {
  channelType: 'case' | 'staff' | 'admin' | 'legal-team';
  requiredRole?: StaffRole;
  requiredPermission?: string;
  permissions: {
    view: boolean;
    send: boolean;
    manage: boolean;
    read_history: boolean;
  };
}

export class ChannelPermissionManager {
  private caseRepository: CaseRepository;
  private staffRepository: StaffRepository;
  private auditLogRepository: AuditLogRepository;
  private validationService: UnifiedValidationService;

  // Channel type patterns for automatic detection
  private readonly CHANNEL_PATTERNS = {
    case: /^case-|^aa-\d{4}-\d+-/i,
    staff: /^staff-|^lawyer-|^paralegal-|^team-/i,
    admin: /^admin-|^modlog/i,
    legalTeam: /^legal-team|^lawyer-lounge/i
  };

  // Permission matrix for different channel types and roles
  private readonly PERMISSION_MATRIX: Record<string, Record<string, ChannelPermissionRule>> = {
    case: {
      [StaffRole.MANAGING_PARTNER]: {
        channelType: 'case',
        requiredRole: StaffRole.MANAGING_PARTNER,
        permissions: { view: true, send: true, manage: true, read_history: true }
      },
      [StaffRole.SENIOR_PARTNER]: {
        channelType: 'case',
        requiredRole: StaffRole.SENIOR_PARTNER,
        permissions: { view: true, send: true, manage: true, read_history: true }
      },
      [StaffRole.JUNIOR_PARTNER]: {
        channelType: 'case',
        requiredRole: StaffRole.JUNIOR_PARTNER,
        permissions: { view: true, send: true, manage: false, read_history: true }
      },
      [StaffRole.SENIOR_ASSOCIATE]: {
        channelType: 'case',
        requiredRole: StaffRole.SENIOR_ASSOCIATE,
        permissions: { view: true, send: true, manage: false, read_history: true }
      },
      [StaffRole.JUNIOR_ASSOCIATE]: {
        channelType: 'case',
        requiredRole: StaffRole.JUNIOR_ASSOCIATE,
        permissions: { view: true, send: true, manage: false, read_history: true }
      },
      [StaffRole.PARALEGAL]: {
        channelType: 'case',
        requiredRole: StaffRole.PARALEGAL,
        permissions: { view: true, send: true, manage: false, read_history: true }
      }
    },
    staff: {
      [StaffRole.MANAGING_PARTNER]: {
        channelType: 'staff',
        requiredPermission: 'senior-staff',
        permissions: { view: true, send: true, manage: true, read_history: true }
      },
      [StaffRole.SENIOR_PARTNER]: {
        channelType: 'staff',
        requiredPermission: 'senior-staff',
        permissions: { view: true, send: true, manage: true, read_history: true }
      },
      [StaffRole.JUNIOR_PARTNER]: {
        channelType: 'staff',
        requiredPermission: 'lawyer',
        permissions: { view: true, send: true, manage: false, read_history: true }
      },
      [StaffRole.SENIOR_ASSOCIATE]: {
        channelType: 'staff',
        requiredPermission: 'lawyer',
        permissions: { view: true, send: true, manage: false, read_history: true }
      },
      [StaffRole.JUNIOR_ASSOCIATE]: {
        channelType: 'staff',
        requiredPermission: 'lawyer',
        permissions: { view: true, send: true, manage: false, read_history: true }
      },
      [StaffRole.PARALEGAL]: {
        channelType: 'staff',
        permissions: { view: true, send: true, manage: false, read_history: true }
      }
    },
    admin: {
      [StaffRole.MANAGING_PARTNER]: {
        channelType: 'admin',
        requiredPermission: 'admin',
        permissions: { view: true, send: true, manage: true, read_history: true }
      }
    },
    legalTeam: {
      [StaffRole.MANAGING_PARTNER]: {
        channelType: 'legal-team',
        requiredPermission: 'lawyer',
        permissions: { view: true, send: true, manage: true, read_history: true }
      },
      [StaffRole.SENIOR_PARTNER]: {
        channelType: 'legal-team',
        requiredPermission: 'lawyer',
        permissions: { view: true, send: true, manage: true, read_history: true }
      },
      [StaffRole.JUNIOR_PARTNER]: {
        channelType: 'legal-team',
        requiredPermission: 'lawyer',
        permissions: { view: true, send: true, manage: false, read_history: true }
      },
      [StaffRole.SENIOR_ASSOCIATE]: {
        channelType: 'legal-team',
        requiredPermission: 'lawyer',
        permissions: { view: true, send: true, manage: false, read_history: true }
      },
      [StaffRole.JUNIOR_ASSOCIATE]: {
        channelType: 'legal-team',
        requiredPermission: 'lawyer',
        permissions: { view: true, send: true, manage: false, read_history: true }
      }
    }
  };

  constructor(
    caseRepository: CaseRepository,
    staffRepository: StaffRepository,
    auditLogRepository: AuditLogRepository,
    validationService: UnifiedValidationService
  ) {
    this.caseRepository = caseRepository;
    this.staffRepository = staffRepository;
    this.auditLogRepository = auditLogRepository;
    this.validationService = validationService;
  }

  /**
   * Handle role change and update all relevant channel permissions
   */
  public async handleRoleChange(
    guild: Guild,
    member: GuildMember,
    oldRole?: string,
    newRole?: string,
    changeType: 'hire' | 'fire' | 'promotion' | 'demotion' = 'promotion'
  ): Promise<ChannelPermissionUpdate[]> {
    try {
      const updates: ChannelPermissionUpdate[] = [];

      logger.info('Processing channel permission updates for role change', {
        guildId: guild.id,
        userId: member.user.id,
        oldRole,
        newRole,
        changeType
      });

      // Get all channels that need permission updates
      const channelsToUpdate = await this.getChannelsForPermissionUpdate(guild, member.user.id);

      // Update permissions for each channel type
      for (const channel of channelsToUpdate) {
        try {
          const update = await this.updateChannelPermissions(
            guild,
            channel,
            member,
            oldRole,
            newRole,
            changeType
          );
          
          if (update) {
            updates.push(update);
          }
        } catch (error) {
          logger.error(`Failed to update permissions for channel ${channel.id}:`, error);
          // Continue with other channels even if one fails
        }
      }

      // Log aggregate audit trail
      await this.logChannelPermissionUpdates(guild.id, member.user.id, updates, changeType);

      logger.info('Completed channel permission updates for role change', {
        guildId: guild.id,
        userId: member.user.id,
        channelsUpdated: updates.length,
        changeType
      });

      return updates;
    } catch (error) {
      logger.error('Error handling role change channel permissions:', error);
      throw error;
    }
  }

  /**
   * Update permissions for a specific channel based on role change
   */
  private async updateChannelPermissions(
    guild: Guild,
    channel: TextChannel | CategoryChannel,
    member: GuildMember,
    oldRole?: string,
    newRole?: string,
    changeType: string = 'promotion'
  ): Promise<ChannelPermissionUpdate | null> {
    try {
      const channelType = this.detectChannelType(channel.name);
      const userId = member.user.id;

      // Calculate new permissions based on new role
      const newPermissions = newRole ? this.calculateChannelPermissions(channelType, newRole) : null;
      const oldPermissions = oldRole ? this.calculateChannelPermissions(channelType, oldRole) : null;

      // If no role change affects this channel type, skip
      if (!newPermissions && !oldPermissions) {
        return null;
      }

      const permissionsGranted: string[] = [];
      const permissionsRevoked: string[] = [];

      // Handle firing (remove all permissions)
      if (changeType === 'fire' || !newRole) {
        if (oldPermissions) {
          // Remove user from channel permissions
          await channel.permissionOverwrites.delete(userId);
          permissionsRevoked.push('all');
          
          logger.debug(`Removed all permissions for fired user ${userId} from channel ${channel.name}`);
        }
      } 
      // Handle hiring, promotion, or demotion
      else if (newPermissions) {
        // Validate new permissions with business rules
        const context: PermissionContext = {
          guildId: guild.id,
          userId,
          userRoles: member.roles.cache.map(r => r.id),
          isGuildOwner: guild.ownerId === userId
        };

        // Check if user should have access to this channel type
        const hasAccess = await this.validateChannelAccess(context, channelType, newRole);
        
        if (hasAccess) {
          // Calculate Discord permission flags
          const allowPermissions: bigint[] = [];
          const denyPermissions: bigint[] = [];

          if (newPermissions.view) {
            allowPermissions.push(PermissionFlagsBits.ViewChannel);
            permissionsGranted.push('view');
          } else {
            denyPermissions.push(PermissionFlagsBits.ViewChannel);
            permissionsRevoked.push('view');
          }

          if (newPermissions.send) {
            allowPermissions.push(PermissionFlagsBits.SendMessages);
            permissionsGranted.push('send');
          } else {
            denyPermissions.push(PermissionFlagsBits.SendMessages);
            permissionsRevoked.push('send');
          }

          if (newPermissions.read_history) {
            allowPermissions.push(PermissionFlagsBits.ReadMessageHistory);
            permissionsGranted.push('read_history');
          }

          if (newPermissions.manage) {
            allowPermissions.push(PermissionFlagsBits.ManageMessages);
            permissionsGranted.push('manage');
          }

          // Apply permission overwrites
          await channel.permissionOverwrites.edit(userId, {
            ViewChannel: newPermissions.view || null,
            SendMessages: newPermissions.send || null,
            ReadMessageHistory: newPermissions.read_history || null,
            ManageMessages: newPermissions.manage || null,
          });

          logger.debug(`Updated permissions for user ${userId} in channel ${channel.name}`, {
            channelType,
            newRole,
            permissions: newPermissions
          });
        } else {
          // User shouldn't have access, remove permissions
          await channel.permissionOverwrites.delete(userId);
          permissionsRevoked.push('all');
          
          logger.debug(`Removed access for user ${userId} from channel ${channel.name} (insufficient role)`);
        }
      }

      // Return update record if changes were made
      if (permissionsGranted.length > 0 || permissionsRevoked.length > 0) {
        return {
          channelId: channel.id,
          channelName: channel.name,
          updateType: 'role-change',
          affectedUserId: userId,
          oldRole: oldRole || undefined,
          newRole: newRole || undefined,
          permissionsGranted,
          permissionsRevoked,
          timestamp: new Date()
        };
      }

      return null;
    } catch (error) {
      logger.error(`Error updating channel permissions for ${channel.name}:`, error);
      throw error;
    }
  }

  /**
   * Get all channels that need permission updates for a user
   */
  private async getChannelsForPermissionUpdate(guild: Guild, userId: string): Promise<(TextChannel | CategoryChannel)[]> {
    const channels: (TextChannel | CategoryChannel)[] = [];

    // Get all text channels and categories
    const allChannels = guild.channels.cache.filter(
      channel => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildCategory
    );

    for (const [, channel] of allChannels) {
      const typedChannel = channel as TextChannel | CategoryChannel;
      
      // Check if channel has existing permissions for this user or if it's a relevant channel type
      const hasExistingPermissions = typedChannel.permissionOverwrites.cache.has(userId);
      const channelType = this.detectChannelType(typedChannel.name);
      const isRelevantChannel = channelType !== 'unknown';

      if (hasExistingPermissions || isRelevantChannel) {
        channels.push(typedChannel);
      }
    }

    // Also get case channels where user is involved
    const userCases = await this.caseRepository.findCasesByUserId(guild.id, userId);
    for (const userCase of userCases) {
      if (userCase.channelId && userCase.status !== CaseStatus.CLOSED) {
        const caseChannel = guild.channels.cache.get(userCase.channelId) as TextChannel;
        if (caseChannel && !channels.includes(caseChannel)) {
          channels.push(caseChannel);
        }
      }
    }

    return channels;
  }

  /**
   * Detect channel type based on naming patterns
   */
  private detectChannelType(channelName: string): 'case' | 'staff' | 'admin' | 'legal-team' | 'unknown' {
    if (this.CHANNEL_PATTERNS.case.test(channelName)) return 'case';
    if (this.CHANNEL_PATTERNS.staff.test(channelName)) return 'staff';
    if (this.CHANNEL_PATTERNS.admin.test(channelName)) return 'admin';
    if (this.CHANNEL_PATTERNS.legalTeam.test(channelName)) return 'legal-team';
    return 'unknown';
  }

  /**
   * Calculate permissions for a role in a specific channel type
   */
  private calculateChannelPermissions(
    channelType: string,
    role: string
  ): ChannelPermissionRule['permissions'] | null {
    const typeMatrix = this.PERMISSION_MATRIX[channelType];
    if (!typeMatrix) return null;

    const rolePermissions = typeMatrix[role];
    return rolePermissions?.permissions || null;
  }

  /**
   * Validate if user should have access to a channel type based on business rules
   */
  private async validateChannelAccess(
    context: PermissionContext,
    channelType: string,
    role: string
  ): Promise<boolean> {
    try {
      const typeMatrix = this.PERMISSION_MATRIX[channelType];
      if (!typeMatrix) return false;

      const rolePermissions = typeMatrix[role];
      if (!rolePermissions) return false;

      // If channel requires a specific permission, validate it
      if (rolePermissions.requiredPermission) {
        // Use validation service to check permission with correct format
        const validationResult = await this.validationService.validate({
          permissionContext: context,
          entityType: 'permission',
          operation: 'validate',
          data: {
            userId: context.userId,
            guildId: context.guildId
          },
          metadata: {
            requiredPermission: rolePermissions.requiredPermission
          }
        });
        return validationResult.valid;
      }

      // If channel requires a specific role, check role hierarchy
      if (rolePermissions.requiredRole) {
        const currentRoleLevel = RoleUtils.getRoleLevel(role as StaffRole);
        const requiredRoleLevel = RoleUtils.getRoleLevel(rolePermissions.requiredRole);
        return currentRoleLevel >= requiredRoleLevel;
      }

      // Default access for channel type
      return true;
    } catch (error) {
      logger.error('Error validating channel access:', error);
      return false;
    }
  }

  /**
   * Sync all channel permissions for a guild (maintenance operation)
   */
  public async syncGuildChannelPermissions(guild: Guild): Promise<ChannelPermissionUpdate[]> {
    try {
      logger.info(`Starting channel permission sync for guild ${guild.id}`);
      const updates: ChannelPermissionUpdate[] = [];

      // Get all active staff
      const activeStaff = await this.staffRepository.findByGuildId(guild.id);
      const staffMembers = activeStaff.filter(s => s.status === 'active');

      // Process each staff member
      for (const staff of staffMembers) {
        try {
          const member = await guild.members.fetch(staff.userId);
          if (member) {
            const memberUpdates = await this.handleRoleChange(
              guild,
              member,
              undefined, // No old role in sync
              staff.role,
              'promotion'
            );
            updates.push(...memberUpdates);
          }
        } catch (error) {
          logger.warn(`Failed to sync permissions for staff member ${staff.userId}:`, error);
        }
      }

      logger.info(`Completed channel permission sync for guild ${guild.id}`, {
        staffProcessed: staffMembers.length,
        totalUpdates: updates.length
      });

      return updates;
    } catch (error) {
      logger.error(`Error syncing channel permissions for guild ${guild.id}:`, error);
      throw error;
    }
  }

  /**
   * Log channel permission updates to audit trail
   */
  private async logChannelPermissionUpdates(
    guildId: string,
    userId: string,
    updates: ChannelPermissionUpdate[],
    changeType: string
  ): Promise<void> {
    try {
      if (updates.length === 0) return;

      await this.auditLogRepository.add({
        guildId,
        action: AuditAction.STAFF_PROMOTED, // Generic action for channel permission changes
        actorId: 'System',
        targetId: userId,
        details: {
          reason: `Channel permissions updated due to ${changeType}`,
          metadata: {
            changeType,
            channelsAffected: updates.length,
            channels: updates.map(u => ({
              channelId: u.channelId,
              channelName: u.channelName,
              permissionsGranted: u.permissionsGranted,
              permissionsRevoked: u.permissionsRevoked
            }))
          }
        },
        timestamp: new Date()
      });

      logger.debug('Logged channel permission updates to audit trail', {
        guildId,
        userId,
        updatesLogged: updates.length
      });
    } catch (error) {
      logger.error('Error logging channel permission updates:', error);
    }
  }
}