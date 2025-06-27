import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { Staff } from '../../domain/entities/staff';
import { StaffRole, RoleUtils } from '../../domain/entities/staff-role';
import { AuditAction } from '../../domain/entities/audit-log';
import { logger } from '../../infrastructure/logger';
import { PermissionService, PermissionContext } from './permission-service';
import { BusinessRuleValidationService } from './business-rule-validation-service';

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

/**
 * Service responsible for managing the complete lifecycle of staff members within the legal firm.
 * 
 * This service handles all staff-related operations including hiring, firing, promotions, and demotions.
 * It enforces the firm's role hierarchy, validates role limits, and ensures data integrity across
 * all staff management operations.
 * 
 * ## Key Responsibilities:
 * - Staff lifecycle management (hire, promote, demote, fire)
 * - Role hierarchy enforcement (6-level system from Paralegal to Managing Partner)
 * - Business rule validation (role limits, promotion restrictions)
 * - Roblox username validation and uniqueness checks
 * - Permission-based access control for all operations
 * - Comprehensive audit logging of all staff changes
 * 
 * ## Role Hierarchy:
 * 1. **Managing Partner** (Level 6) - Max: 1
 * 2. **Senior Partner** (Level 5) - Max: 3
 * 3. **Junior Partner** (Level 4) - Max: 5
 * 4. **Senior Associate** (Level 3) - Max: 10
 * 5. **Junior Associate** (Level 2) - Max: 10
 * 6. **Paralegal** (Level 1) - Max: 10
 * 
 * ## Dependencies:
 * - **StaffRepository**: Data persistence and retrieval
 * - **AuditLogRepository**: Audit trail for all staff actions
 * - **PermissionService**: Access control and authorization
 * - **BusinessRuleValidationService**: Role limits and business rule enforcement
 * 
 * ## Common Usage Patterns:
 * ```typescript
 * // Hiring a new staff member
 * const result = await staffService.hireStaff(context, {
 *   guildId: "123",
 *   userId: "456",
 *   robloxUsername: "JohnDoe123",
 *   role: StaffRole.PARALEGAL,
 *   hiredBy: "789",
 *   reason: "Passed bar exam"
 * });
 * 
 * // Promoting a staff member
 * const promotion = await staffService.promoteStaff(context, {
 *   guildId: "123",
 *   userId: "456",
 *   newRole: StaffRole.JUNIOR_ASSOCIATE,
 *   promotedBy: "789",
 *   reason: "Excellent performance"
 * });
 * ```
 * 
 * @see {@link RoleTrackingService} - Handles automatic Discord role synchronization
 * @see {@link DiscordRoleSyncService} - Manages bidirectional role updates
 */
export class StaffService {
  private staffRepository: StaffRepository;
  private auditLogRepository: AuditLogRepository;
  private permissionService: PermissionService;
  private businessRuleValidationService: BusinessRuleValidationService;

  constructor(
    staffRepository: StaffRepository,
    auditLogRepository: AuditLogRepository,
    permissionService: PermissionService,
    businessRuleValidationService: BusinessRuleValidationService
  ) {
    this.staffRepository = staffRepository;
    this.auditLogRepository = auditLogRepository;
    this.permissionService = permissionService;
    this.businessRuleValidationService = businessRuleValidationService;
  }

  /**
   * Validates a Roblox username according to Roblox's naming rules.
   * 
   * This method ensures that usernames meet Roblox's requirements:
   * - 3-20 characters in length
   * - Contains only letters, numbers, and underscores
   * - Does not start or end with an underscore
   * 
   * @param username - The Roblox username to validate
   * @returns Validation result with detailed error message if invalid
   * 
   * @example
   * ```typescript
   * const result = await staffService.validateRobloxUsername("JohnDoe123");
   * if (result.isValid) {
   *   console.log("Username is valid:", result.username);
   * } else {
   *   console.error("Invalid username:", result.error);
   * }
   * ```
   */
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
   * 
   * ## Business Rules:
   * - Users cannot be hired if they're already active staff
   * - Roblox usernames must be unique within the guild
   * - Role limits are enforced unless guild owner bypasses
   * - All hires are logged with full context
   * 
   * ## Side Effects:
   * - Creates new staff record in database
   * - Creates audit log entry
   * - May create role limit bypass log if guild owner bypasses limits
   * 
   * @param context - Permission context containing user and guild information
   * @param request - Staff hire request with user details and role
   * @returns Success status with created staff record or error message
   * 
   * @throws Error if database operations fail
   * 
   * @example
   * ```typescript
   * const result = await staffService.hireStaff(context, {
   *   guildId: "123456789",
   *   userId: "987654321",
   *   robloxUsername: "NewLawyer123",
   *   role: StaffRole.PARALEGAL,
   *   hiredBy: "111222333",
   *   reason: "Passed interview and background check"
   * });
   * 
   * if (result.success) {
   *   console.log("Staff hired:", result.staff);
   * } else {
   *   console.error("Failed to hire:", result.error);
   * }
   * ```
   * 
   * @see {@link BusinessRuleValidationService.validateRoleLimit} - Role limit validation
   * @see {@link AuditLogRepository.logAction} - Audit logging
   */
  public async hireStaff(context: PermissionContext, request: StaffHireRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check senior-staff permission (updated from HR permission)
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
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

      // Validate role limits using business rule validation service
      const roleLimitValidation = await this.businessRuleValidationService.validateRoleLimit(context, role);
      if (!roleLimitValidation.valid) {
        // Log business rule violation if guild owner is bypassing
        if (context.isGuildOwner && roleLimitValidation.bypassAvailable) {
          await this.auditLogRepository.logRoleLimitBypass(
            guildId,
            context.userId,
            userId,
            role,
            roleLimitValidation.currentCount,
            roleLimitValidation.maxCount,
            reason
          );
          logger.info('Guild owner bypassing role limit during hire', {
            guildId,
            role,
            currentCount: roleLimitValidation.currentCount,
            maxCount: roleLimitValidation.maxCount,
            bypassedBy: context.userId
          });
        } else {
          // Not guild owner or bypass not available
          return {
            success: false,
            error: roleLimitValidation.errors.join(', '),
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

  /**
   * Promotes a staff member to a higher role in the hierarchy.
   * 
   * This method enforces strict promotion rules:
   * - Validates permissions (requires senior-staff permission)
   * - Prevents self-promotion
   * - Ensures new role is higher than current role
   * - Validates role limits for the target role
   * - Updates promotion history
   * - Creates comprehensive audit trail
   * 
   * ## Business Rules:
   * - Staff cannot promote themselves
   * - New role must be higher in hierarchy than current role
   * - Role limits are enforced for target role
   * - Guild owners can bypass role limits with logging
   * 
   * ## Side Effects:
   * - Updates staff role in database
   * - Adds entry to promotion history
   * - Creates audit log entry
   * - May create role limit bypass log
   * 
   * @param context - Permission context for authorization
   * @param request - Promotion request with target role and reason
   * @returns Success status with updated staff record or error message
   * 
   * @throws Error if database operations fail
   * 
   * @example
   * ```typescript
   * const result = await staffService.promoteStaff(context, {
   *   guildId: "123456789",
   *   userId: "987654321",
   *   newRole: StaffRole.JUNIOR_ASSOCIATE,
   *   promotedBy: "111222333",
   *   reason: "Outstanding performance in Q4"
   * });
   * ```
   * 
   * @see {@link RoleUtils.getRoleLevel} - Role hierarchy comparison
   * @see {@link StaffRepository.updateStaffRole} - Database update operation
   */
  public async promoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check senior-staff permission (updated from HR permission)
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
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

      // Validate role limits using business rule validation service
      const roleLimitValidation = await this.businessRuleValidationService.validateRoleLimit(context, newRole);
      if (!roleLimitValidation.valid) {
        // Log business rule violation if guild owner is bypassing
        if (context.isGuildOwner && roleLimitValidation.bypassAvailable) {
          await this.auditLogRepository.logRoleLimitBypass(
            guildId,
            context.userId,
            userId,
            newRole,
            roleLimitValidation.currentCount,
            roleLimitValidation.maxCount,
            reason
          );
          logger.info('Guild owner bypassing role limit during promotion', {
            guildId,
            role: newRole,
            currentCount: roleLimitValidation.currentCount,
            maxCount: roleLimitValidation.maxCount,
            bypassedBy: context.userId
          });
        } else {
          // Not guild owner or bypass not available
          return {
            success: false,
            error: roleLimitValidation.errors.join(', '),
          };
        }
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

  /**
   * Demotes a staff member to a lower role in the hierarchy.
   * 
   * Similar to promotion but in reverse, this method:
   * - Validates permissions (requires senior-staff permission)
   * - Ensures new role is lower than current role
   * - Updates demotion history
   * - Creates audit trail
   * 
   * ## Business Rules:
   * - New role must be lower in hierarchy than current role
   * - No role limit validation needed (demotions always free up slots)
   * - All demotions are logged with reason
   * 
   * ## Side Effects:
   * - Updates staff role in database
   * - Adds entry to promotion history (marked as demotion)
   * - Creates audit log entry
   * 
   * @param context - Permission context for authorization
   * @param request - Demotion request with target role and reason
   * @returns Success status with updated staff record or error message
   * 
   * @throws Error if database operations fail
   * 
   * @example
   * ```typescript
   * const result = await staffService.demoteStaff(context, {
   *   guildId: "123456789",
   *   userId: "987654321",
   *   newRole: StaffRole.PARALEGAL,
   *   promotedBy: "111222333",
   *   reason: "Performance improvement needed"
   * });
   * ```
   */
  public async demoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check senior-staff permission (updated from HR permission)
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
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

  /**
   * Initiates the firing process for a staff member.
   * 
   * Important: This method does NOT directly update the database. It validates
   * the request and logs the action, but the actual database update is handled
   * by the RoleTrackingService when Discord roles are removed.
   * 
   * ## Workflow:
   * 1. This method validates and logs the firing intent
   * 2. Discord roles are removed via Discord commands
   * 3. RoleTrackingService detects role removal
   * 4. Database is updated automatically
   * 
   * ## Business Rules:
   * - Staff must be active to be fired
   * - Firing reason must be provided
   * - All firings are logged immediately
   * 
   * ## Side Effects:
   * - Creates audit log entry
   * - Does NOT modify database (handled by role tracking)
   * 
   * @param context - Permission context for authorization
   * @param request - Termination request with reason
   * @returns Success status with staff record or error message
   * 
   * @example
   * ```typescript
   * // Step 1: Initiate firing
   * const result = await staffService.fireStaff(context, {
   *   guildId: "123456789",
   *   userId: "987654321",
   *   terminatedBy: "111222333",
   *   reason: "Violation of company policy"
   * });
   * 
   * // Step 2: Remove Discord roles (handled separately)
   * // Step 3: RoleTrackingService updates database automatically
   * ```
   * 
   * @see {@link RoleTrackingService} - Handles automatic database updates
   */
  public async fireStaff(context: PermissionContext, request: StaffTerminationRequest): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    try {
      // Check senior-staff permission (updated from HR permission)
      const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
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

  /**
   * Retrieves detailed information about a specific staff member.
   * 
   * This method provides complete staff information including:
   * - Current role and status
   * - Roblox username
   * - Hire date and hired by
   * - Complete promotion/demotion history
   * - Termination details (if applicable)
   * 
   * ## Permission Requirements:
   * - Senior-staff permission OR
   * - Admin permission
   * 
   * ## Side Effects:
   * - Creates audit log entry for information access
   * 
   * @param context - Permission context for authorization
   * @param userId - Discord user ID of the staff member
   * @returns Staff record or null if not found
   * 
   * @throws Error if user lacks required permissions
   * 
   * @example
   * ```typescript
   * const staffInfo = await staffService.getStaffInfo(context, "987654321");
   * if (staffInfo) {
   *   console.log(`${staffInfo.robloxUsername} - ${staffInfo.role}`);
   *   console.log(`Hired on: ${staffInfo.hiredAt}`);
   * }
   * ```
   */
  public async getStaffInfo(context: PermissionContext, userId: string): Promise<Staff | null> {
    try {
      // Check if user can view staff info (senior-staff or admin permission)
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

  /**
   * Retrieves a paginated list of staff members with optional role filtering.
   * 
   * This method provides:
   * - Paginated results for performance
   * - Optional filtering by specific role
   * - Total count for pagination UI
   * - Active staff only (excludes terminated)
   * 
   * ## Permission Requirements:
   * - Senior-staff permission OR
   * - Admin permission
   * 
   * ## Side Effects:
   * - Creates audit log entry with query parameters
   * 
   * @param context - Permission context for authorization
   * @param roleFilter - Optional role to filter by
   * @param page - Page number (1-based, defaults to 1)
   * @param limit - Items per page (defaults to 10)
   * @returns Paginated staff list with total count
   * 
   * @throws Error if user lacks required permissions
   * 
   * @example
   * ```typescript
   * // Get all Junior Associates, page 1
   * const result = await staffService.getStaffList(
   *   context,
   *   StaffRole.JUNIOR_ASSOCIATE,
   *   1,
   *   10
   * );
   * 
   * console.log(`Found ${result.total} Junior Associates`);
   * console.log(`Showing page 1 of ${result.totalPages}`);
   * ```
   */
  public async getStaffList(
    context: PermissionContext,
    roleFilter?: StaffRole,
    page: number = 1,
    limit: number = 10
  ): Promise<{ staff: Staff[]; total: number; totalPages: number }> {
    try {
      // Check if user can view staff list (senior-staff or admin permission)
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

  /**
   * Retrieves the complete staff hierarchy sorted by role level.
   * 
   * Returns all active staff members organized by their position in the
   * firm hierarchy, from Managing Partner down to Paralegal. This is useful
   * for displaying organizational charts or understanding reporting structures.
   * 
   * ## Permission Requirements:
   * - Senior-staff permission OR
   * - Admin permission
   * 
   * @param context - Permission context for authorization
   * @returns Array of staff sorted by role hierarchy (highest to lowest)
   * 
   * @throws Error if user lacks required permissions
   * 
   * @example
   * ```typescript
   * const hierarchy = await staffService.getStaffHierarchy(context);
   * hierarchy.forEach(staff => {
   *   console.log(`${staff.role}: ${staff.robloxUsername}`);
   * });
   * ```
   */
  public async getStaffHierarchy(context: PermissionContext): Promise<Staff[]> {
    try {
      // Check if user can view staff hierarchy (senior-staff or admin permission)
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
   * 
   * This method provides a summary of staff distribution across all roles,
   * which is useful for:
   * - Checking available slots before hiring/promotion
   * - Understanding organizational structure
   * - Capacity planning
   * 
   * ## Permission Requirements:
   * - Senior-staff permission OR
   * - Admin permission
   * 
   * @param context - Permission context for authorization
   * @returns Record mapping each role to its active staff count
   * 
   * @throws Error if user lacks required permissions
   * 
   * @example
   * ```typescript
   * const counts = await staffService.getRoleCounts(context);
   * console.log(`Managing Partners: ${counts[StaffRole.MANAGING_PARTNER]}/1`);
   * console.log(`Senior Partners: ${counts[StaffRole.SENIOR_PARTNER]}/3`);
   * ```
   */
  public async getRoleCounts(context: PermissionContext): Promise<Record<StaffRole, number>> {
    try {
      // Check if user can view role counts (senior-staff or admin permission)
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
}