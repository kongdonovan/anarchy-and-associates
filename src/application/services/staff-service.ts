import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { Staff } from '../../domain/entities/staff';
import { StaffRole, RoleUtils } from '../../domain/entities/staff-role';
import { AuditAction } from '../../domain/entities/audit-log';
import { logger } from '../../infrastructure/logger';
import { PermissionService, PermissionContext } from './permission-service';

export interface RobloxValidationResult {
  isValid: boolean;
  username: string;
  error?: string;
}

export interface StaffHireRequest {
  guildId: string;
  userId: string;
  robloxUsername: string;
  role: StaffRole;
  hiredBy: string;
  reason?: string;
  isGuildOwner?: boolean; // Indicates if the person hiring is the guild owner
}

export interface StaffPromotionRequest {
  guildId: string;
  userId: string;
  newRole: StaffRole;
  promotedBy: string;
  reason?: string;
}

export interface StaffTerminationRequest {
  guildId: string;
  userId: string;
  terminatedBy: string;
  reason?: string;
}

export class StaffService {
  private staffRepository: StaffRepository;
  private auditLogRepository: AuditLogRepository;
  private permissionService: PermissionService;

  constructor(
    staffRepository: StaffRepository,
    auditLogRepository: AuditLogRepository,
    permissionService: PermissionService
  ) {
    this.staffRepository = staffRepository;
    this.auditLogRepository = auditLogRepository;
    this.permissionService = permissionService;
  }

  public async validateRobloxUsername(username: string): Promise<RobloxValidationResult> {
    try {
      // Basic regex validation for Roblox usernames
      // Roblox usernames are 3-20 characters, alphanumeric and underscores only
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

  public async hireStaff(context: PermissionContext, request: StaffHireRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check HR permission
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to hire staff members',
        };
      }

      const { guildId, userId, robloxUsername, role, hiredBy, reason } = request;

      // Validate Discord IDs (must be valid snowflakes or test IDs)
      // Real Discord IDs: 18-19 digit numbers, Test IDs: alphanumeric with hyphens/underscores
      const validIdPattern = /^(\d{18,19}|[a-zA-Z0-9_-]+)$/;
      if (!validIdPattern.test(guildId) || guildId.includes('\'') || guildId.includes(';') || guildId.includes('DROP')) {
        return {
          success: false,
          error: 'Invalid guild ID format',
        };
      }
      if (!validIdPattern.test(userId) || userId.includes('\'') || userId.includes(';') || userId.includes('DROP')) {
        return {
          success: false,
          error: 'Invalid user ID format',
        };
      }
      if (!validIdPattern.test(hiredBy) || hiredBy.includes('\'') || hiredBy.includes(';') || hiredBy.includes('DROP')) {
        return {
          success: false,
          error: 'Invalid hiredBy user ID format',
        };
      }

      // Validate Roblox username
      const robloxValidation = await this.validateRobloxUsername(robloxUsername);
      if (!robloxValidation.isValid) {
        return {
          success: false,
          error: robloxValidation.error,
        };
      }

      // Check if user is already staff
      const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
      if (existingStaff && existingStaff.status === 'active') {
        return {
          success: false,
          error: 'User is already an active staff member',
        };
      }

      // Check if Roblox username is already used
      const existingRobloxStaff = await this.staffRepository.findStaffByRobloxUsername(guildId, robloxUsername);
      if (existingRobloxStaff) {
        return {
          success: false,
          error: 'Roblox username is already associated with another staff member',
        };
      }

      // Check role limits (guild owners can bypass limits)
      if (!request.isGuildOwner) {
        const canHire = await this.staffRepository.canHireRole(guildId, role);
        if (!canHire) {
          const maxCount = RoleUtils.getRoleMaxCount(role);
          return {
            success: false,
            error: `Cannot hire ${role}. Maximum limit of ${maxCount} reached`,
          };
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
          after: {
            role,
            status: 'active',
          },
          reason,
          metadata: {
            robloxUsername: robloxValidation.username,
          },
        },
        timestamp: new Date(),
      });

      logger.info(`Staff hired: ${userId} as ${role} in guild ${guildId}`);

      return {
        success: true,
        staff,
      };
    } catch (error) {
      logger.error('Error hiring staff:', error);
      return {
        success: false,
        error: 'Failed to hire staff member',
      };
    }
  }

  public async promoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check HR permission
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to promote staff members',
        };
      }

      const { guildId, userId, newRole, promotedBy, reason } = request;

      // Prevent self-promotion
      if (userId === promotedBy) {
        return {
          success: false,
          error: 'Staff members cannot promote themselves',
        };
      }

      // Find the staff member
      const staff = await this.staffRepository.findByUserId(guildId, userId);
      if (!staff || staff.status !== 'active') {
        return {
          success: false,
          error: 'Staff member not found or inactive',
        };
      }

      const currentRole = staff.role;

      // Check if it's actually a promotion
      if (RoleUtils.getRoleLevel(newRole) <= RoleUtils.getRoleLevel(currentRole)) {
        return {
          success: false,
          error: 'New role must be higher than current role for promotion',
        };
      }

      // Check role limits for new role
      const canHire = await this.staffRepository.canHireRole(guildId, newRole);
      if (!canHire) {
        const maxCount = RoleUtils.getRoleMaxCount(newRole);
        return {
          success: false,
          error: `Cannot promote to ${newRole}. Maximum limit of ${maxCount} reached`,
        };
      }

      // Update staff role
      const updatedStaff = await this.staffRepository.updateStaffRole(
        guildId,
        userId,
        newRole,
        promotedBy,
        reason
      );

      if (!updatedStaff) {
        return {
          success: false,
          error: 'Failed to update staff role',
        };
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

      return {
        success: true,
        staff: updatedStaff,
      };
    } catch (error) {
      logger.error('Error promoting staff:', error);
      return {
        success: false,
        error: 'Failed to promote staff member',
      };
    }
  }

  public async demoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check HR permission
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to demote staff members',
        };
      }

      const { guildId, userId, newRole, promotedBy, reason } = request;

      // Find the staff member
      const staff = await this.staffRepository.findByUserId(guildId, userId);
      if (!staff || staff.status !== 'active') {
        return {
          success: false,
          error: 'Staff member not found or inactive',
        };
      }

      const currentRole = staff.role;

      // Check if it's actually a demotion
      if (RoleUtils.getRoleLevel(newRole) >= RoleUtils.getRoleLevel(currentRole)) {
        return {
          success: false,
          error: 'New role must be lower than current role for demotion',
        };
      }

      // Update staff role
      const updatedStaff = await this.staffRepository.updateStaffRole(
        guildId,
        userId,
        newRole,
        promotedBy,
        reason
      );

      if (!updatedStaff) {
        return {
          success: false,
          error: 'Failed to update staff role',
        };
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

      return {
        success: true,
        staff: updatedStaff,
      };
    } catch (error) {
      logger.error('Error demoting staff:', error);
      return {
        success: false,
        error: 'Failed to demote staff member',
      };
    }
  }

  public async fireStaff(context: PermissionContext, request: StaffTerminationRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check HR permission
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context);
      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to fire staff members',
        };
      }

      const { guildId, userId, terminatedBy, reason } = request;

      // Find the staff member
      const staff = await this.staffRepository.findByUserId(guildId, userId);
      if (!staff || staff.status !== 'active') {
        return {
          success: false,
          error: 'Staff member not found or inactive',
        };
      }

      // Note: We don't modify the database here - the role tracking service
      // will handle database changes when Discord roles are removed

      // Log the action
      await this.auditLogRepository.logAction({
        guildId,
        action: AuditAction.STAFF_FIRED,
        actorId: terminatedBy,
        targetId: userId,
        details: {
          before: { 
            role: staff.role,
            status: 'active',
          },
          reason,
          metadata: {
            robloxUsername: staff.robloxUsername,
            firedBy: terminatedBy,
          },
        },
        timestamp: new Date(),
      });

      logger.info(`Staff firing initiated: ${userId} (${staff.role}) by ${terminatedBy} in guild ${guildId}`);

      return {
        success: true,
        staff,
      };
    } catch (error) {
      logger.error('Error firing staff:', error);
      return {
        success: false,
        error: 'Failed to fire staff member',
      };
    }
  }

  public async getStaffInfo(context: PermissionContext, userId: string): Promise<Staff | null> {
    try {
      // Check if user can view staff info (HR or admin permission)
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context) || 
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
        details: {
          metadata: {
            found: !!staff,
          },
        },
        timestamp: new Date(),
      });

      return staff;
    } catch (error) {
      logger.error('Error getting staff info:', error);
      throw error;
    }
  }

  public async getStaffList(
    context: PermissionContext,
    roleFilter?: StaffRole,
    page: number = 1,
    limit: number = 10
  ): Promise<{ staff: Staff[]; total: number; totalPages: number }> {
    try {
      // Check if user can view staff list (HR or admin permission)
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context) || 
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
          metadata: {
            roleFilter,
            page,
            limit,
            resultCount: result.staff.length,
          },
        },
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      logger.error('Error getting staff list:', error);
      throw error;
    }
  }

  public async getStaffHierarchy(context: PermissionContext): Promise<Staff[]> {
    try {
      // Check if user can view staff hierarchy (HR or admin permission)
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context) || 
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

  public async getRoleCounts(context: PermissionContext): Promise<Record<StaffRole, number>> {
    try {
      // Check if user can view role counts (HR or admin permission)
      const hasPermission = await this.permissionService.hasHRPermissionWithContext(context) || 
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
}