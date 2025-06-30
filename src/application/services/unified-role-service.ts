import { Guild, GuildMember, Events, Client, TextChannel } from 'discord.js';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { ChannelPermissionManager } from './channel-permission-manager';
import { PermissionService, PermissionContext } from './permission-service';
import { RoleUtils, StaffRole as StaffRoleEnum } from '../../domain/entities/staff-role'; // Keep utility functions
import { EmbedUtils } from '../../infrastructure/utils/embed-utils';
import { logger } from '../../infrastructure/logger';
import { Staff, PromotionRecord, StaffRole as StaffRoleType, Case } from '../../validation';
import { AuditAction } from '../../domain/entities/audit-log';

// Request interfaces for staff operations
export interface StaffHireRequest {
  guildId: string;
  userId: string;
  robloxUsername: string;
  role: StaffRoleType;
  hiredBy: string;
  reason: string;
}

export interface StaffTerminationRequest {
  guildId: string;
  userId: string;
  terminatedBy: string;
  reason: string;
}

export interface StaffPromotionRequest {
  guildId: string;
  userId: string;
  newRole: StaffRoleType;
  promotedBy: string;
  reason: string;
}

// Role management interfaces
export interface RoleMapping {
  staffRole: StaffRoleType;
  discordRoleId: string;
  discordRoleName: string;
}

export interface RoleChangeEvent {
  member: GuildMember;
  oldRole?: StaffRoleType;
  newRole?: StaffRoleType;
  changeType: 'hire' | 'fire' | 'promotion' | 'demotion';
}

export interface RoleConflict {
  userId: string;
  username: string;
  guildId: string;
  conflictingRoles: Array<{
    roleName: string;
    roleId: string;
    staffRole: StaffRoleType;
    level: number;
  }>;
  highestRole: {
    roleName: string;
    roleId: string;
    staffRole: StaffRoleType;
    level: number;
  };
  severity: ConflictSeverity;
  detectedAt: Date;
}

export interface ConflictResolutionResult {
  userId: string;
  resolved: boolean;
  removedRoles: string[];
  keptRole: string;
  error?: string;
}

export interface RoleValidationResult {
  isValid: boolean;
  conflicts?: string[];
  preventionReason?: string;
}

export interface RoleSyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Validation result interface  
export interface RobloxValidationResult {
  isValid: boolean;
  username: string;
  error?: string;
}

/**
 * Unified Role Management Service
 * 
 * Consolidates all role-related functionality into a single, comprehensive service:
 * - Staff lifecycle management (hire/fire/promote/demote)
 * - Discord role change tracking and event handling
 * - Bidirectional role synchronization between Discord and database
 * - Role conflict detection and resolution
 * - Cascading effects management (case assignments, permissions)
 * 
 * This service implements the strategy pattern for different role operations
 * and provides a unified interface for all role management needs.
 */
export class UnifiedRoleService {
  private staffRepository: StaffRepository;
  private auditLogRepository: AuditLogRepository;
  private caseRepository: CaseRepository;
  private channelPermissionManager: ChannelPermissionManager;
  private permissionService: PermissionService;
  
  // Discord role mappings per guild
  private roleMappings: Map<string, RoleMapping[]> = new Map();
  
  // Conflict history tracking
  private conflictHistory: Map<string, ConflictResolutionResult[]> = new Map();
  
  // Map Discord role names to staff roles
  private readonly STAFF_ROLE_MAPPING: Record<string, StaffRoleType> = {
    'Managing Partner': 'Managing Partner',
    'Senior Partner': 'Senior Partner',
    'Partner': 'Senior Partner', // Map to Senior Partner for compatibility
    'Senior Associate': 'Senior Associate',
    'Associate': 'Junior Associate', // Map to Junior Associate
    'Paralegal': 'Paralegal',
  };

  // Staff roles in hierarchy order (highest first)
  private readonly STAFF_ROLES_HIERARCHY = [
    'Managing Partner',
    'Senior Partner',
    'Partner',
    'Senior Associate',
    'Associate',
    'Paralegal'
  ];

  // Roles with lawyer permissions (can be assigned to cases)
  private readonly LAWYER_ROLES: StaffRoleType[] = [
    'Managing Partner',
    'Senior Partner',
    'Junior Partner',
    'Senior Associate',
    'Junior Associate'
  ];

  // Roles with lead attorney permissions
  private readonly LEAD_ATTORNEY_ROLES: StaffRoleType[] = [
    'Managing Partner',
    'Senior Partner',
    'Junior Partner',
    'Senior Associate'
  ];

  constructor(
    staffRepository: StaffRepository,
    auditLogRepository: AuditLogRepository,
    caseRepository: CaseRepository,
    channelPermissionManager: ChannelPermissionManager,
    permissionService: PermissionService
  ) {
    this.staffRepository = staffRepository;
    this.auditLogRepository = auditLogRepository;
    this.caseRepository = caseRepository;
    this.channelPermissionManager = channelPermissionManager;
    this.permissionService = permissionService;
  }

  // =============================================================================
  // DISCORD INTEGRATION & EVENT HANDLING
  // =============================================================================

  /**
   * Initialize role tracking for a Discord client
   */
  public initializeDiscordTracking(client: Client): void {
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
      try {
        if (oldMember.partial || newMember.partial) return;
        await this.handleDiscordRoleChange(oldMember as GuildMember, newMember);
      } catch (error) {
        logger.error('Error handling Discord role change:', error);
      }
    });

    logger.info('Unified role service Discord tracking initialized');
  }

  /**
   * Handle Discord role changes for a guild member
   */
  public async handleDiscordRoleChange(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    const oldStaffRoles = this.getStaffRolesFromMemberNames(oldMember.roles.cache.map(r => r.name));
    const newStaffRoles = this.getStaffRolesFromMemberNames(newMember.roles.cache.map(r => r.name));
    
    // If no staff roles involved, ignore
    if (oldStaffRoles.length === 0 && newStaffRoles.length === 0) {
      return;
    }

    const guildId = newMember.guild.id;
    const userId = newMember.user.id;

    // Check for role conflicts before processing
    const conflictCheck = await this.checkRoleChangeForConflicts(
      newMember,
      oldMember.roles.cache.map(r => r.name),
      newMember.roles.cache.map(r => r.name)
    );

    if (conflictCheck.shouldPrevent) {
      logger.warn(`Preventing role change for ${newMember.displayName}: ${conflictCheck.preventionReason}`);
      return;
    }

    // If there's a conflict but it shouldn't be prevented, handle it
    if (conflictCheck.hasConflict && conflictCheck.conflict) {
      logger.info(`Role conflict detected for ${newMember.displayName}, auto-resolving...`);
      await this.resolveRoleConflict(newMember, conflictCheck.conflict, true);
      // After resolution, re-evaluate the roles
      const updatedMember = await newMember.guild.members.fetch(userId);
      const updatedStaffRoles = this.getStaffRolesFromMemberNames(updatedMember.roles.cache.map(r => r.name));
      newStaffRoles.length = 0;
      newStaffRoles.push(...updatedStaffRoles);
    }
    
    // Determine the highest role (most senior) in each state
    const oldHighestRole = this.getHighestStaffRole(oldStaffRoles);
    const newHighestRole = this.getHighestStaffRole(newStaffRoles);

    // Log role change for debugging
    logger.info(`Role change detected for ${newMember.displayName} in guild ${guildId}:`, {
      oldRoles: oldStaffRoles,
      newRoles: newStaffRoles,
      oldHighest: oldHighestRole,
      newHighest: newHighestRole
    });

    // Determine action type and handle accordingly
    if (!oldHighestRole && newHighestRole) {
      // HIRING: No staff role -> Staff role
      await this.handleAutomaticHiring(userId, guildId, newHighestRole, newMember);
    } else if (oldHighestRole && !newHighestRole) {
      // FIRING: Staff role -> No staff role
      await this.handleAutomaticFiring(userId, guildId, oldHighestRole, newMember);
    } else if (oldHighestRole && newHighestRole) {
      // PROMOTION/DEMOTION: Staff role -> Different staff role
      const oldLevel = this.getRoleLevel(oldHighestRole);
      const newLevel = this.getRoleLevel(newHighestRole);
      
      if (newLevel > oldLevel) {
        // PROMOTION: Higher level role
        await this.handleAutomaticPromotion(userId, guildId, oldHighestRole, newHighestRole, newMember);
      } else if (newLevel < oldLevel) {
        // DEMOTION: Lower level role
        await this.handleAutomaticDemotion(userId, guildId, oldHighestRole, newHighestRole, newMember);
      }
      // If same level, could be lateral move - log but don't process
      else if (oldHighestRole !== newHighestRole) {
        logger.info(`Lateral role change for ${userId}: ${oldHighestRole} -> ${newHighestRole}`);
      }
    }
  }

  // =============================================================================
  // STAFF LIFECYCLE MANAGEMENT
  // =============================================================================

  /**
   * Validates a Roblox username according to Roblox's naming rules.
   * 
   * This method ensures that usernames meet Roblox's requirements:
   * - 3-20 characters in length
   * - Contains only letters, numbers, and underscores
   * - Does not start or end with an underscore
   */
  public async validateRobloxUsername(username: string): Promise<RobloxValidationResult> {
    try {
      // Basic regex validation for Roblox usernames
      const robloxUsernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      
      if (!robloxUsernameRegex.test(username)) {
        return {
          isValid: false,
          username,
          error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
        };
      }

      // Check if username doesn't start or end with underscore
      if (username.startsWith('_') || username.endsWith('_')) {
        return {
          isValid: false,
          username,
          error: 'Username cannot start or end with an underscore',
        };
      }

      return {
        isValid: true,
        username,
      };
    } catch (error) {
      logger.error('Error validating Roblox username:', error);
      return {
        isValid: false,
        username,
        error: 'Failed to validate username',
      };
    }
  }

  /**
   * Hires a new staff member into the firm.
   * 
   * This method performs comprehensive validation before creating a new staff record:
   * - Validates permissions (requires senior-staff permission)
   * - Validates Discord IDs for security
   * - Validates and ensures Roblox username uniqueness
   * - Checks if user is already an active staff member
   * - Validates role limits (with guild owner bypass option)
   * - Creates initial promotion history entry
   * - Logs the action to audit trail
   */
  public async hireStaff(context: PermissionContext, request: StaffHireRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check senior-staff permission
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to hire staff members',
        };
      }

      const { guildId, userId, robloxUsername, role, hiredBy, reason } = request;

      // Validate Discord IDs
      const validIdPattern = /^(\d{18,19}|[a-zA-Z0-9_-]+)$/;
      if (!validIdPattern.test(guildId) || guildId.includes('\'') || guildId.includes(';') || guildId.includes('DROP')) {
        return { success: false, error: 'Invalid guild ID format' };
      }
      if (!validIdPattern.test(userId) || userId.includes('\'') || userId.includes(';') || userId.includes('DROP')) {
        return { success: false, error: 'Invalid user ID format' };
      }
      if (!validIdPattern.test(hiredBy) || hiredBy.includes('\'') || hiredBy.includes(';') || hiredBy.includes('DROP')) {
        return { success: false, error: 'Invalid hiredBy user ID format' };
      }

      // Validate Roblox username
      const robloxValidation = await this.validateRobloxUsername(robloxUsername);
      if (!robloxValidation.isValid) {
        return { success: false, error: robloxValidation.error };
      }

      // Check if user is already staff
      const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
      if (existingStaff && existingStaff.status === 'active') {
        return { success: false, error: 'User is already an active staff member' };
      }

      // Check if Roblox username is already used
      const existingRobloxStaff = await this.staffRepository.findStaffByRobloxUsername(guildId, robloxUsername);
      if (existingRobloxStaff) {
        return { success: false, error: 'Roblox username is already associated with another staff member' };
      }

      // Check role limits manually
      const currentCount = await this.staffRepository.getStaffCountByRole(guildId, role);
      const maxCount = RoleUtils.getRoleMaxCount(role as StaffRoleEnum);
      
      if (currentCount >= maxCount) {
        // Allow guild owner to bypass role limits
        if (context.isGuildOwner) {
          await this.auditLogRepository.add({
            guildId,
            actorId: context.userId,
            action: AuditAction.ROLE_LIMIT_BYPASSED,
            targetId: userId,
            details: {
              reason,
              bypassInfo: {
                bypassType: 'guild-owner' as const,
                businessRuleViolated: 'role_limit_exceeded',
                originalValidationErrors: [`Role limit exceeded: ${currentCount}/${maxCount} ${role} positions filled`],
                bypassReason: reason,
                currentCount,
                maxCount
              }
            },
            timestamp: new Date()
          });
          logger.info('Guild owner bypassing role limit during hire', {
            guildId,
            role,
            currentCount,
            maxCount,
            bypassedBy: context.userId
          });
        } else {
          return { success: false, error: `Role limit exceeded: ${currentCount}/${maxCount} ${role} positions filled` };
        }
      }

      // Create staff record
      const staffData: Omit<Staff, '_id' | 'createdAt' | 'updatedAt'> = {
        userId,
        guildId,
        robloxUsername: robloxValidation.username,
        role,
        hiredAt: new Date(),
        hiredBy,
        promotionHistory: [
          {
            fromRole: role, // First hire, from and to are the same
            toRole: role,
            promotedBy: hiredBy,
            promotedAt: new Date(),
            reason,
            actionType: 'hire',
          },
        ],
        status: 'active',
      };

      const staff = await this.staffRepository.add(staffData);

      // Log the action
      await this.auditLogRepository.logAction({
        guildId,
        action: AuditAction.STAFF_HIRED,
        actorId: hiredBy,
        targetId: userId,
        details: {
          after: { role, status: 'active' },
          reason,
          metadata: { robloxUsername: robloxValidation.username },
        },
        timestamp: new Date(),
      });

      logger.info(`Staff hired: ${userId} as ${role} in guild ${guildId}`);

      return { success: true, staff };
    } catch (error) {
      logger.error('Error hiring staff:', error);
      return { success: false, error: 'Failed to hire staff member' };
    }
  }

  /**
   * Promotes a staff member to a higher role in the hierarchy.
   */
  public async promoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check senior-staff permission
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
      if (!hasPermission) {
        return { success: false, error: 'You do not have permission to promote staff members' };
      }

      const { guildId, userId, newRole, promotedBy, reason } = request;

      // Prevent self-promotion
      if (userId === promotedBy) {
        return { success: false, error: 'Staff members cannot promote themselves' };
      }

      // Find the staff member
      const staff = await this.staffRepository.findByUserId(guildId, userId);
      if (!staff || staff.status !== 'active') {
        return { success: false, error: 'Staff member not found or inactive' };
      }

      const currentRole = staff.role;

      // Check if it's actually a promotion
      if (RoleUtils.getRoleLevel(newRole as StaffRoleEnum) <= RoleUtils.getRoleLevel(currentRole as StaffRoleEnum)) {
        return { success: false, error: 'New role must be higher than current role for promotion' };
      }

      // Check role limits manually
      const currentCount = await this.staffRepository.getStaffCountByRole(guildId, newRole);
      const maxCount = RoleUtils.getRoleMaxCount(newRole as StaffRoleEnum);
      
      if (currentCount >= maxCount) {
        // Allow guild owner to bypass role limits
        if (context.isGuildOwner) {
          await this.auditLogRepository.add({
            guildId,
            actorId: context.userId,
            action: AuditAction.ROLE_LIMIT_BYPASSED,
            targetId: userId,
            details: {
              reason,
              bypassInfo: {
                bypassType: 'guild-owner' as const,
                businessRuleViolated: 'role_limit_exceeded',
                originalValidationErrors: [`Role limit exceeded: ${currentCount}/${maxCount} ${newRole} positions filled`],
                bypassReason: reason,
                currentCount,
                maxCount
              }
            },
            timestamp: new Date()
          });
          logger.info('Guild owner bypassing role limit during promotion', {
            guildId, role: newRole, currentCount,
            maxCount, bypassedBy: context.userId
          });
        } else {
          return { success: false, error: `Role limit exceeded: ${currentCount}/${maxCount} ${newRole} positions filled` };
        }
      }

      // Update staff role
      const updatedStaff = await this.staffRepository.updateStaffRole(guildId, userId, newRole, promotedBy, reason);
      if (!updatedStaff) {
        return { success: false, error: 'Failed to update staff role' };
      }

      // Log the action
      await this.auditLogRepository.logAction({
        guildId,
        action: AuditAction.STAFF_PROMOTED,
        actorId: promotedBy,
        targetId: userId,
        details: {
          before: { role: currentRole },
          after: { role: newRole },
          reason,
        },
        timestamp: new Date(),
      });

      logger.info(`Staff promoted: ${userId} from ${currentRole} to ${newRole} in guild ${guildId}`);

      return { success: true, staff: updatedStaff };
    } catch (error) {
      logger.error('Error promoting staff:', error);
      return { success: false, error: 'Failed to promote staff member' };
    }
  }

  /**
   * Demotes a staff member to a lower role in the hierarchy.
   */
  public async demoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check senior-staff permission
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
      if (!hasPermission) {
        return { success: false, error: 'You do not have permission to demote staff members' };
      }

      const { guildId, userId, newRole, promotedBy, reason } = request;

      // Find the staff member
      const staff = await this.staffRepository.findByUserId(guildId, userId);
      if (!staff || staff.status !== 'active') {
        return { success: false, error: 'Staff member not found or inactive' };
      }

      const currentRole = staff.role;

      // Check if it's actually a demotion
      if (RoleUtils.getRoleLevel(newRole as StaffRoleEnum) >= RoleUtils.getRoleLevel(currentRole as StaffRoleEnum)) {
        return { success: false, error: 'New role must be lower than current role for demotion' };
      }

      // Handle cascading effects before demotion
      const guild = await (await import('discord.js')).Client.prototype.guilds.cache.get(guildId);
      if (guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          await this.handleCascadingEffects({
            member,
            oldRole: currentRole,
            newRole: newRole,
            changeType: 'demotion'
          });
        }
      }

      // Update staff role
      const updatedStaff = await this.staffRepository.updateStaffRole(guildId, userId, newRole, promotedBy, reason);
      if (!updatedStaff) {
        return { success: false, error: 'Failed to update staff role' };
      }

      // Log the action
      await this.auditLogRepository.logAction({
        guildId,
        action: AuditAction.STAFF_DEMOTED,
        actorId: promotedBy,
        targetId: userId,
        details: {
          before: { role: currentRole },
          after: { role: newRole },
          reason,
        },
        timestamp: new Date(),
      });

      logger.info(`Staff demoted: ${userId} from ${currentRole} to ${newRole} in guild ${guildId}`);

      return { success: true, staff: updatedStaff };
    } catch (error) {
      logger.error('Error demoting staff:', error);
      return { success: false, error: 'Failed to demote staff member' };
    }
  }

  /**
   * Initiates the firing process for a staff member.
   * 
   * Important: This method validates and logs the action, but the actual
   * database update is handled when Discord roles are removed.
   */
  public async fireStaff(context: PermissionContext, request: StaffTerminationRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check senior-staff permission
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
      if (!hasPermission) {
        return { success: false, error: 'You do not have permission to fire staff members' };
      }

      const { guildId, userId, terminatedBy, reason } = request;

      // Find the staff member
      const staff = await this.staffRepository.findByUserId(guildId, userId);
      if (!staff || staff.status !== 'active') {
        return { success: false, error: 'Staff member not found or inactive' };
      }

      // Log the action
      await this.auditLogRepository.logAction({
        guildId,
        action: AuditAction.STAFF_FIRED,
        actorId: terminatedBy,
        targetId: userId,
        details: {
          before: { role: staff.role, status: 'active' },
          reason,
          metadata: { robloxUsername: staff.robloxUsername, firedBy: terminatedBy },
        },
        timestamp: new Date(),
      });

      logger.info(`Staff firing initiated: ${userId} (${staff.role}) by ${terminatedBy} in guild ${guildId}`);

      return { success: true, staff };
    } catch (error) {
      logger.error('Error firing staff:', error);
      return { success: false, error: 'Failed to fire staff member' };
    }
  }

  // =============================================================================
  // STAFF INFORMATION RETRIEVAL
  // =============================================================================

  /**
   * Retrieves detailed information about a specific staff member.
   */
  public async getStaffInfo(context: PermissionContext, userId: string): Promise<Staff | null> {
    try {
      // Check if user can view staff info
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context) || 
                           await this.permissionService.isAdmin(context);
      if (!hasPermission) {
        throw new Error('You do not have permission to view staff information');
      }

      const staff = await this.staffRepository.findByUserId(context.guildId, userId);
      
      // Log the info access
      await this.auditLogRepository.logAction({
        guildId: context.guildId,
        action: AuditAction.STAFF_INFO_VIEWED,
        actorId: context.userId,
        targetId: userId,
        details: { metadata: { found: !!staff } },
        timestamp: new Date(),
      });

      return staff;
    } catch (error) {
      logger.error('Error getting staff info:', error);
      throw error;
    }
  }

  /**
   * Retrieves a paginated list of staff members with optional role filtering.
   */
  public async getStaffList(
    context: PermissionContext,
    roleFilter?: StaffRoleType,
    page: number = 1,
    limit: number = 10
  ): Promise<{ staff: Staff[]; total: number; totalPages: number }> {
    try {
      // Check if user can view staff list
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context) || 
                           await this.permissionService.isAdmin(context);
      if (!hasPermission) {
        throw new Error('You do not have permission to view staff list');
      }

      const result = await this.staffRepository.findStaffWithPagination(context.guildId, page, limit, roleFilter);

      // Log the list access
      await this.auditLogRepository.logAction({
        guildId: context.guildId,
        action: AuditAction.STAFF_LIST_VIEWED,
        actorId: context.userId,
        details: {
          metadata: { roleFilter, page, limit, resultCount: result.staff.length },
        },
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      logger.error('Error getting staff list:', error);
      throw error;
    }
  }

  /**
   * Retrieves the complete staff hierarchy sorted by role level.
   */
  public async getStaffHierarchy(context: PermissionContext): Promise<Staff[]> {
    try {
      // Check if user can view staff hierarchy
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context) || 
                           await this.permissionService.isAdmin(context);
      if (!hasPermission) {
        throw new Error('You do not have permission to view staff hierarchy');
      }

      return await this.staffRepository.findStaffHierarchy(context.guildId);
    } catch (error) {
      logger.error('Error getting staff hierarchy:', error);
      throw error;
    }
  }

  /**
   * Retrieves the count of active staff members for each role.
   */
  public async getRoleCounts(context: PermissionContext): Promise<Record<StaffRoleType, number>> {
    try {
      // Check if user can view role counts
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context) || 
                           await this.permissionService.isAdmin(context);
      if (!hasPermission) {
        throw new Error('You do not have permission to view role counts');
      }

      return await this.staffRepository.getAllStaffCountsByRole(context.guildId);
    } catch (error) {
      logger.error('Error getting role counts:', error);
      throw error;
    }
  }

  // =============================================================================
  // DISCORD ROLE SYNCHRONIZATION
  // =============================================================================

  /**
   * Initialize guild role mappings for Discord role synchronization
   */
  public async initializeGuildRoleMappings(guild: Guild): Promise<void> {
    try {
      const guildId = guild.id;
      const mappings: RoleMapping[] = [];

      // Find Discord roles that match our staff roles
      for (const roleName of this.STAFF_ROLES_HIERARCHY) {
        const staffRole = this.STAFF_ROLE_MAPPING[roleName];
        if (!staffRole) continue;
        
        const discordRole = guild.roles.cache.find(
          role => role.name.toLowerCase() === staffRole.toLowerCase() ||
          role.name.toLowerCase().replace(/\s+/g, '_') === staffRole.toLowerCase().replace(/\s+/g, '_')
        );

        if (discordRole) {
          mappings.push({
            staffRole,
            discordRoleId: discordRole.id,
            discordRoleName: discordRole.name,
          });
        } else {
          logger.warn(`Discord role not found for staff role: ${staffRole} in guild ${guildId}`);
        }
      }

      this.roleMappings.set(guildId, mappings);
      logger.info(`Initialized role mappings for guild ${guildId}: ${mappings.length} roles mapped`);
    } catch (error) {
      logger.error(`Error initializing role mappings for guild ${guild.id}:`, error);
      throw error;
    }
  }

  /**
   * Synchronize a staff member's Discord role with their database role
   */
  public async syncStaffRole(
    guild: Guild,
    staff: Staff,
    actorId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const member = await guild.members.fetch(staff.userId).catch(() => null);
      if (!member) {
        return { success: false, error: 'Member not found in Discord server' };
      }

      const mappings = this.roleMappings.get(guild.id) || [];
      const targetMapping = mappings.find(m => m.staffRole === staff.role);

      if (!targetMapping) {
        return { success: false, error: `Discord role mapping not found for ${staff.role}` };
      }

      const targetRole = guild.roles.cache.get(targetMapping.discordRoleId);
      if (!targetRole) {
        return { success: false, error: `Discord role ${targetMapping.discordRoleName} not found` };
      }

      // Remove all other staff roles from the member
      const staffRoleIds = mappings.map(m => m.discordRoleId);
      const rolesToRemove = member.roles.cache.filter(role => 
        staffRoleIds.includes(role.id) && role.id !== targetRole.id
      );

      for (const roleToRemove of rolesToRemove.values()) {
        await member.roles.remove(roleToRemove, `Staff role sync by ${actorId}`);
      }

      // Add the correct staff role
      if (!member.roles.cache.has(targetRole.id)) {
        await member.roles.add(targetRole, `Staff role sync by ${actorId}`);
      }

      // Log the sync action
      await this.auditLogRepository.logAction({
        guildId: guild.id,
        action: AuditAction.ROLE_SYNC_PERFORMED,
        actorId,
        targetId: staff.userId,
        details: {
          metadata: {
            staffRole: staff.role,
            discordRoleId: targetRole.id,
            discordRoleName: targetRole.name,
            rolesRemoved: rolesToRemove.map(r => ({ id: r.id, name: r.name })),
          },
        },
        timestamp: new Date(),
      });

      logger.info(`Role synced for ${staff.userId}: ${staff.role} -> ${targetRole.name} in guild ${guild.id}`);

      return { success: true };
    } catch (error) {
      logger.error(`Error syncing staff role for ${staff.userId}:`, error);
      return { success: false, error: 'Failed to sync Discord role' };
    }
  }

  /**
   * Synchronize all staff roles in a guild
   */
  public async syncAllStaffRoles(
    guild: Guild,
    actorId: string
  ): Promise<RoleSyncResult> {
    try {
      const allStaff = await this.staffRepository.findByGuildId(guild.id);
      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const staff of allStaff) {
        const result = await this.syncStaffRole(guild, staff, actorId);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`${staff.userId}: ${result.error}`);
        }
      }

      logger.info(`Bulk role sync completed for guild ${guild.id}: ${synced} synced, ${failed} failed`);

      return { synced, failed, errors };
    } catch (error) {
      logger.error(`Error during bulk role sync for guild ${guild.id}:`, error);
      throw error;
    }
  }

  // =============================================================================
  // ROLE CONFLICT DETECTION & RESOLUTION
  // =============================================================================

  /**
   * Detect role conflicts for a specific guild member
   */
  public async detectMemberConflicts(member: GuildMember): Promise<RoleConflict | null> {
    try {
      const staffRoles = this.getStaffRolesFromMember(member);
      
      if (staffRoles.length <= 1) {
        return null; // No conflict if 0 or 1 staff roles
      }

      // Sort roles by hierarchy level (highest first)
      const sortedRoles = staffRoles.sort((a, b) => b.level - a.level);
      const highestRole = sortedRoles[0]!;

      // Determine severity based on role difference
      const severity = this.calculateConflictSeverity(sortedRoles);

      const conflict: RoleConflict = {
        userId: member.user.id,
        username: member.user.tag,
        guildId: member.guild.id,
        conflictingRoles: sortedRoles,
        highestRole,
        severity,
        detectedAt: new Date()
      };

      logger.warn(`Role conflict detected for ${member.user.tag}:`, {
        roles: sortedRoles.map(r => r.roleName),
        severity
      });

      return conflict;
    } catch (error) {
      logger.error('Error detecting member conflicts:', error);
      return null;
    }
  }

  /**
   * Resolve a role conflict by removing lower-precedence roles
   */
  public async resolveRoleConflict(
    member: GuildMember, 
    conflict: RoleConflict, 
    notify: boolean = true
  ): Promise<ConflictResolutionResult> {
    const result: ConflictResolutionResult = {
      userId: member.user.id,
      resolved: false,
      removedRoles: [],
      keptRole: conflict.highestRole.roleName
    };

    try {
      // Remove all roles except the highest one
      const rolesToRemove = conflict.conflictingRoles
        .filter(r => r.roleId !== conflict.highestRole.roleId)
        .map(r => r.roleId);

      for (const roleId of rolesToRemove) {
        try {
          await member.roles.remove(roleId, 'Resolving role conflict - keeping highest role only');
          const removedRole = conflict.conflictingRoles.find(r => r.roleId === roleId);
          if (removedRole) {
            result.removedRoles.push(removedRole.roleName);
          }
        } catch (error) {
          logger.error(`Failed to remove role ${roleId} from ${member.user.tag}:`, error);
          result.error = `Failed to remove some roles: ${error}`;
        }
      }

      result.resolved = result.removedRoles.length === rolesToRemove.length;

      // Create audit log entry
      await this.createConflictResolutionAuditLog(member, conflict, result);

      // Send DM notification if requested
      if (notify && result.resolved) {
        await this.sendConflictResolutionNotification(member, result);
      }

      // Track in history
      this.addToConflictHistory(member.guild.id, result);

      logger.info(`Resolved conflict for ${member.user.tag}: removed ${result.removedRoles.join(', ')}, kept ${result.keptRole}`);

      return result;
    } catch (error) {
      logger.error('Error resolving conflict:', error);
      result.error = `Error resolving conflict: ${error}`;
      return result;
    }
  }

  /**
   * Check for conflicts when a role change occurs
   */
  public async checkRoleChangeForConflicts(
    member: GuildMember,
    oldRoles: string[],
    newRoles: string[]
  ): Promise<{
    hasConflict: boolean;
    conflict?: RoleConflict;
    shouldPrevent: boolean;
    preventionReason?: string;
  }> {
    try {
      // Get staff roles from old and new states
      const oldStaffRoles = oldRoles.filter(role => this.STAFF_ROLES_HIERARCHY.includes(role));
      const newStaffRoles = newRoles.filter(role => this.STAFF_ROLES_HIERARCHY.includes(role));

      // Check if adding a new staff role
      const addedRoles = newStaffRoles.filter(role => !oldStaffRoles.includes(role));
      
      if (addedRoles.length > 0 && oldStaffRoles.length > 0) {
        // Trying to add a staff role when user already has one
        const conflict = await this.detectMemberConflicts(member);
        
        return {
          hasConflict: true,
          conflict: conflict || undefined,
          shouldPrevent: true,
          preventionReason: `Cannot assign multiple staff roles. User already has: ${oldStaffRoles.join(', ')}`
        };
      }

      // Check for existing conflicts
      const conflict = await this.detectMemberConflicts(member);
      
      return {
        hasConflict: conflict !== null,
        conflict: conflict || undefined,
        shouldPrevent: false
      };
    } catch (error) {
      logger.error('Error checking role change for conflicts:', error);
      return {
        hasConflict: false,
        shouldPrevent: false
      };
    }
  }

  // =============================================================================
  // CASCADING EFFECTS MANAGEMENT
  // =============================================================================

  /**
   * Handle cascading effects of role changes
   */
  public async handleCascadingEffects(event: RoleChangeEvent): Promise<void> {
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

      // Update channel permissions
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

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Handle automatic hiring when Discord role is added
   */
  private async handleAutomaticHiring(userId: string, guildId: string, role: string, member: GuildMember): Promise<void> {
    try {
      // Check if staff record already exists (might be rehiring)
      const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
      
      const staffRole = this.mapDiscordRoleToStaffRole(role);
      if (!staffRole) {
        logger.warn(`Could not map Discord role ${role} to staff role`);
        return;
      }

      if (existingStaff) {
        // Reactivate existing staff member
        await this.staffRepository.update(existingStaff._id!.toString(), {
          status: 'active',
          role: staffRole,
          hiredAt: new Date() // Update hire date for rehiring
        });
        
        logger.info(`Reactivated staff member ${userId} as ${role} in guild ${guildId}`);
      } else {
        // Create new staff record
        const newStaff: Partial<Staff> = {
          userId,
          guildId,
          robloxUsername: member.displayName, // Use Discord display name as placeholder
          role: staffRole,
          hiredAt: new Date(),
          hiredBy: 'System', // Could be enhanced to track who added the role
          promotionHistory: [{
            fromRole: null as any, // Initial hire has no "from" role
            toRole: staffRole,
            promotedBy: 'System',
            promotedAt: new Date(),
            reason: 'Initial hiring via Discord role assignment',
            actionType: 'hire'
          }],
          status: 'active',
        };

        await this.staffRepository.add(newStaff as Staff);
        logger.info(`Hired new staff member ${userId} as ${role} in guild ${guildId}`);
      }

      // Handle cascading effects
      await this.handleCascadingEffects({
        member,
        oldRole: undefined,
        newRole: staffRole,
        changeType: 'hire'
      });

      // Log audit event
      await this.logRoleChangeAuditEvent('hire', userId, guildId, undefined, role);

    } catch (error) {
      logger.error(`Error handling automatic hiring for user ${userId}:`, error);
    }
  }

  /**
   * Handle automatic firing when Discord role is removed
   */
  private async handleAutomaticFiring(userId: string, guildId: string, oldRole: string, member: GuildMember): Promise<void> {
    try {
      const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
      
      if (existingStaff) {
        // Delete the staff record from the database
        const deleted = await this.staffRepository.delete(existingStaff._id!.toString());
        
        if (deleted) {
          logger.info(`Fired and deleted staff member ${userId} from ${oldRole} in guild ${guildId}`);
        } else {
          logger.warn(`Failed to delete staff record for user ${userId} in guild ${guildId}`);
        }
      }

      // Handle cascading effects
      const oldStaffRole = this.mapDiscordRoleToStaffRole(oldRole);
      if (oldStaffRole) {
        await this.handleCascadingEffects({
          member,
          oldRole: oldStaffRole,
          newRole: undefined,
          changeType: 'fire'
        });
      }

      // Log audit event
      await this.logRoleChangeAuditEvent('fire', userId, guildId, oldRole, undefined);

    } catch (error) {
      logger.error(`Error handling automatic firing for user ${userId}:`, error);
    }
  }

  /**
   * Handle automatic promotion when Discord role is upgraded
   */
  private async handleAutomaticPromotion(
    userId: string, 
    guildId: string, 
    oldRole: string, 
    newRole: string, 
    member: GuildMember
  ): Promise<void> {
    try {
      const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
      
      if (existingStaff) {
        const oldStaffRole = this.mapDiscordRoleToStaffRole(oldRole);
        const newStaffRole = this.mapDiscordRoleToStaffRole(newRole);
        
        if (oldStaffRole && newStaffRole) {
          const promotionRecord: PromotionRecord = {
            fromRole: oldStaffRole,
            toRole: newStaffRole,
            promotedBy: 'System',
            promotedAt: new Date(),
            reason: 'Promoted via Discord role change',
            actionType: 'promotion'
          };

          await this.staffRepository.update(existingStaff._id!.toString(), {
            role: newStaffRole,
            promotionHistory: [...existingStaff.promotionHistory, promotionRecord],
          });
        }

        logger.info(`Promoted staff member ${userId} from ${oldRole} to ${newRole} in guild ${guildId}`);
      }

      // Handle cascading effects
      const oldStaffRole = this.mapDiscordRoleToStaffRole(oldRole);
      const newStaffRole = this.mapDiscordRoleToStaffRole(newRole);
      if (oldStaffRole && newStaffRole) {
        await this.handleCascadingEffects({
          member,
          oldRole: oldStaffRole,
          newRole: newStaffRole,
          changeType: 'promotion'
        });
      }

      // Log audit event
      await this.logRoleChangeAuditEvent('promotion', userId, guildId, oldRole, newRole);

    } catch (error) {
      logger.error(`Error handling automatic promotion for user ${userId}:`, error);
    }
  }

  /**
   * Handle automatic demotion when Discord role is downgraded
   */
  private async handleAutomaticDemotion(
    userId: string, 
    guildId: string, 
    oldRole: string, 
    newRole: string, 
    member: GuildMember
  ): Promise<void> {
    try {
      const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
      
      if (existingStaff) {
        const oldStaffRole = this.mapDiscordRoleToStaffRole(oldRole);
        const newStaffRole = this.mapDiscordRoleToStaffRole(newRole);
        
        if (oldStaffRole && newStaffRole) {
          const demotionRecord: PromotionRecord = {
            fromRole: oldStaffRole,
            toRole: newStaffRole,
            promotedBy: 'System',
            promotedAt: new Date(),
            reason: 'Demoted via Discord role change',
            actionType: 'demotion'
          };

          await this.staffRepository.update(existingStaff._id!.toString(), {
            role: newStaffRole,
            promotionHistory: [...existingStaff.promotionHistory, demotionRecord],
          });
        }

        logger.info(`Demoted staff member ${userId} from ${oldRole} to ${newRole} in guild ${guildId}`);
      }

      // Handle cascading effects
      const oldStaffRole = this.mapDiscordRoleToStaffRole(oldRole);
      const newStaffRole = this.mapDiscordRoleToStaffRole(newRole);
      if (oldStaffRole && newStaffRole) {
        await this.handleCascadingEffects({
          member,
          oldRole: oldStaffRole,
          newRole: newStaffRole,
          changeType: 'demotion'
        });
      }

      // Log audit event
      await this.logRoleChangeAuditEvent('demotion', userId, guildId, oldRole, newRole);

    } catch (error) {
      logger.error(`Error handling automatic demotion for user ${userId}:`, error);
    }
  }

  /**
   * Handle when a staff member loses all lawyer permissions
   */
  private async handleLossOfLawyerPermissions(
    member: GuildMember,
    oldRole: StaffRoleType,
    newRole?: StaffRoleType
  ): Promise<void> {
    const userId = member.user.id;
    const guildId = member.guild.id;
    const changeType = newRole ? 'demotion' : 'termination';

    logger.info(`Staff member ${member.displayName} lost lawyer permissions`, {
      userId, guildId, oldRole, newRole, changeType
    });

    // Find all cases where this user is assigned
    const assignedCases = await this.caseRepository.findByLawyer(userId);

    if (assignedCases.length === 0) {
      logger.info(`No cases to unassign for ${member.displayName}`);
      return;
    }

    logger.info(`Unassigning ${member.displayName} from ${assignedCases.length} cases`);

    // Notify the user about case removal
    await this.notifyUserOfCaseRemoval(member, assignedCases, changeType);

    // Process each case
    for (const caseData of assignedCases) {
      try {
        // Unassign the lawyer from the case
        await this.caseRepository.update(caseData._id!.toString(), {
          assignedLawyerIds: caseData.assignedLawyerIds.filter(id => id !== userId),
          leadAttorneyId: caseData.leadAttorneyId === userId ? undefined : caseData.leadAttorneyId
        });

        // Update case channel to notify about the change
        await this.notifyCaseChannel(caseData, member, changeType);

        // Check if case has no lawyers left
        const updatedCase = await this.caseRepository.findById(caseData._id!.toString());
        if (updatedCase && updatedCase.assignedLawyerIds.length === 0) {
          await this.handleCaseWithNoLawyers(updatedCase, member.guild);
        }
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
    oldRole: StaffRoleType,
    newRole: StaffRoleType
  ): Promise<void> {
    const userId = member.user.id;

    logger.info(`Staff member ${member.displayName} lost lead attorney permissions`, {
      userId, guildId: member.guild.id, oldRole, newRole
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
        await this.caseRepository.update(caseData._id!.toString(), {
          leadAttorneyId: undefined
        });

        await this.notifyCaseChannelLeadAttorneyRemoval(caseData, member);
      } catch (error) {
        logger.error(`Error removing lead attorney status from case ${caseData.caseNumber}:`, error);
      }
    }

    // Log audit event
    await this.logLeadAttorneyRemovalAuditEvent(member, oldRole, newRole, leadCases.length);
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
   * Get staff roles from a list of role names
   */
  private getStaffRolesFromMemberNames(roleNames: string[]): string[] {
    return roleNames.filter(roleName => this.STAFF_ROLES_HIERARCHY.includes(roleName));
  }

  /**
   * Get staff roles from a guild member with detailed information
   */
  private getStaffRolesFromMember(member: GuildMember): Array<{
    roleName: string;
    roleId: string;
    staffRole: StaffRoleType;
    level: number;
  }> {
    const staffRoles: Array<{
      roleName: string;
      roleId: string;
      staffRole: StaffRoleType;
      level: number;
    }> = [];

    for (const [roleId, role] of member.roles.cache) {
      if (this.STAFF_ROLES_HIERARCHY.includes(role.name)) {
        const staffRole = this.STAFF_ROLE_MAPPING[role.name];
        if (staffRole) {
          staffRoles.push({
            roleName: role.name,
            roleId,
            staffRole,
            level: RoleUtils.getRoleLevel(staffRole as StaffRoleEnum)
          });
        }
      }
    }

    return staffRoles;
  }

  /**
   * Get the highest (most senior) staff role from a list
   */
  private getHighestStaffRole(staffRoles: string[]): string | null {
    for (const role of this.STAFF_ROLES_HIERARCHY) {
      if (staffRoles.includes(role)) {
        return role;
      }
    }
    return null;
  }

  /**
   * Get the hierarchy level of a Discord role (higher = more senior)
   */
  private getRoleLevel(roleName: string): number {
    const index = this.STAFF_ROLES_HIERARCHY.indexOf(roleName);
    return index === -1 ? 0 : this.STAFF_ROLES_HIERARCHY.length - index;
  }

  /**
   * Map Discord role name to StaffRole enum
   */
  private mapDiscordRoleToStaffRole(discordRoleName: string): StaffRoleType | null {
    return this.STAFF_ROLE_MAPPING[discordRoleName] || null;
  }

  /**
   * Check if a role has lawyer permissions
   */
  private hasLawyerPermissions(role: StaffRoleType): boolean {
    return this.LAWYER_ROLES.includes(role);
  }

  /**
   * Check if a role has lead attorney permissions
   */
  private hasLeadAttorneyPermissions(role: StaffRoleType): boolean {
    return this.LEAD_ATTORNEY_ROLES.includes(role);
  }

  /**
   * Calculate conflict severity based on role differences
   */
  private calculateConflictSeverity(roles: Array<{ level: number }>): ConflictSeverity {
    if (roles.length === 0) return ConflictSeverity.LOW;

    const highestLevel = roles[0]?.level ?? 0;
    const lowestLevel = roles[roles.length - 1]?.level ?? 0;
    const levelDifference = highestLevel - lowestLevel;

    // Multiple high-level roles is critical
    const highLevelRoles = roles.filter(r => r.level >= 5).length;
    if (highLevelRoles > 1) {
      return ConflictSeverity.CRITICAL;
    }

    // Large level differences are high severity
    if (levelDifference >= 3) {
      return ConflictSeverity.HIGH;
    }

    // Medium level differences
    if (levelDifference >= 2) {
      return ConflictSeverity.MEDIUM;
    }

    return ConflictSeverity.LOW;
  }

  /**
   * Add to conflict resolution history
   */
  private addToConflictHistory(guildId: string, result: ConflictResolutionResult): void {
    const history = this.conflictHistory.get(guildId) || [];
    history.push(result);
    
    // Keep only last 100 resolutions per guild
    if (history.length > 100) {
      history.shift();
    }
    
    this.conflictHistory.set(guildId, history);
  }

  /**
   * Create audit log entry for conflict resolution
   */
  private async createConflictResolutionAuditLog(
    member: GuildMember,
    conflict: RoleConflict,
    result: ConflictResolutionResult
  ): Promise<void> {
    try {
      await this.auditLogRepository.add({
        guildId: member.guild.id,
        action: AuditAction.ROLE_SYNC_PERFORMED,
        actorId: 'System-RoleSync',
        targetId: member.user.id,
        details: {
          before: {
            roles: conflict.conflictingRoles.map(r => r.roleName)
          },
          after: {
            role: conflict.highestRole.staffRole
          },
          reason: 'Automatic role conflict resolution',
          metadata: {
            conflictSeverity: conflict.severity,
            removedRoles: result.removedRoles,
            resolved: result.resolved,
            error: result.error
          }
        },
        timestamp: new Date(),
        severity: conflict.severity as any
      });
    } catch (error) {
      logger.error('Error creating conflict resolution audit log:', error);
    }
  }

  /**
   * Send DM notification about conflict resolution
   */
  private async sendConflictResolutionNotification(
    member: GuildMember,
    result: ConflictResolutionResult
  ): Promise<void> {
    try {
      const embed = EmbedUtils.createAALegalEmbed({
        title: '⚠️ Staff Role Conflict Resolved',
        description: 'Multiple staff roles were detected on your account. The system has automatically resolved this conflict.'
      });

      embed.addFields(
        {
          name: 'Roles Removed',
          value: result.removedRoles.join('\n') || 'None',
          inline: true
        },
        {
          name: 'Role Kept',
          value: result.keptRole,
          inline: true
        },
        {
          name: 'Why did this happen?',
          value: 'Staff members can only hold one role at a time. The system keeps your highest-ranking role automatically.',
          inline: false
        }
      );

      embed.setFooter({
        text: 'If you believe this was an error, please contact an administrator.'
      });

      await member.send({ embeds: [embed] });
    } catch (error) {
      // User might have DMs disabled
      logger.warn(`Could not send DM to ${member.user.tag}:`, error);
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
   * Log audit event for role changes
   */
  private async logRoleChangeAuditEvent(
    type: 'hire' | 'fire' | 'promotion' | 'demotion',
    userId: string,
    guildId: string,
    oldRole?: string,
    newRole?: string
  ): Promise<void> {
    try {
      const actionMap = {
        hire: AuditAction.STAFF_HIRED,
        fire: AuditAction.STAFF_FIRED,
        promotion: AuditAction.STAFF_PROMOTED,
        demotion: AuditAction.STAFF_DEMOTED
      };

      const oldStaffRole = oldRole ? this.mapDiscordRoleToStaffRole(oldRole) : null;
      const newStaffRole = newRole ? this.mapDiscordRoleToStaffRole(newRole) : null;

      const auditLog = {
        guildId,
        action: actionMap[type],
        actorId: 'System',
        targetId: userId,
        details: {
          before: oldStaffRole ? { role: oldStaffRole } : undefined,
          after: newStaffRole ? { role: newStaffRole } : undefined,
          reason: `Role change via Discord: ${type}`,
          metadata: { source: 'unified-role-service', discordRole: newRole || oldRole }
        },
        timestamp: new Date()
      };

      await this.auditLogRepository.add(auditLog);
    } catch (error) {
      logger.error('Error logging role change audit event:', error);
    }
  }

  /**
   * Log audit event for cascading changes
   */
  private async logCascadeAuditEvent(
    member: GuildMember,
    oldRole: StaffRoleType,
    newRole: StaffRoleType | undefined,
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
            source: 'unified-role-service',
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
    oldRole: StaffRoleType,
    newRole: StaffRoleType,
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
            source: 'unified-role-service',
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