import {
  ValidationStrategy,
  ValidationContext,
  ValidationResult,
  ValidationResultHelper,
  ValidationSeverity
} from '../types';
import { StaffRepository } from '../../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../../infrastructure/repositories/guild-config-repository';
import { PermissionService } from '../../services/permission-service';
import { StaffRole, RoleUtils } from '../../../domain/entities/staff-role';
import { logger } from '../../../infrastructure/logger';

/**
 * Strategy for validating business rules
 */
export class BusinessRuleValidationStrategy implements ValidationStrategy {
  readonly name = 'BusinessRuleValidation';

  constructor(
    private staffRepository: StaffRepository,
    private caseRepository: CaseRepository,
    _guildConfigRepository: GuildConfigRepository, // May be used for future validations
    private permissionService: PermissionService
  ) {}

  canHandle(context: ValidationContext): boolean {
    // Handle staff and case related validations
    const supportedTypes = ['staff', 'case', 'role', 'permission'];
    const supportedOperations = [
      'hire', 'fire', 'promote', 'demote',
      'create', 'assign', 'reassign', 'close',
      'validateRoleLimit', 'validateClientLimit',
      'validatePermission', 'validateStaffMember'
    ];

    const canHandleType = supportedTypes.includes(context.entityType);
    const canHandleOperation = supportedOperations.includes(context.operation);
    const result = canHandleType && canHandleOperation;

    return result;
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    logger.debug(`BusinessRuleValidation: ${context.entityType}:${context.operation}`);

    switch (context.operation) {
      case 'validateRoleLimit':
        return this.validateRoleLimit(context);
      case 'validateClientLimit':
        return this.validateClientCaseLimit(context);
      case 'validatePermission':
        return this.validatePermission(context);
      case 'validateStaffMember':
        return this.validateStaffMember(context);
      case 'hire':
        return this.validateHiring(context);
      case 'promote':
        return this.validatePromotion(context);
      case 'demote':
        return this.validateDemotion(context);
      case 'assign':
      case 'reassign':
        return this.validateCaseAssignment(context);
      default:
        return ValidationResultHelper.success();
    }
  }

  /**
   * Validates role limit constraints
   */
  private async validateRoleLimit(context: ValidationContext): Promise<ValidationResult> {
    const { guildId } = context.permissionContext;
    const role = context.data.role as StaffRole;

    if (!role) {
      return ValidationResultHelper.error('MISSING_ROLE', 'Role is required');
    }

    try {
      const currentStaff = await this.staffRepository.findByRole(guildId, role);
      const currentCount = currentStaff.filter((s: any) => s.status === 'active').length;
      const maxCount = RoleUtils.getRoleMaxCount(role);

      const result: ValidationResult = {
        valid: currentCount < maxCount,
        issues: [],
        metadata: {
          currentCount,
          maxCount,
          roleName: role
        }
      };

      if (!result.valid) {
        result.issues.push({
          severity: ValidationSeverity.ERROR,
          code: 'ROLE_LIMIT_EXCEEDED',
          message: `Maximum limit of ${maxCount} reached`,
          field: 'role',
          context: { currentCount, maxCount }
        });

        // Check if bypass is available
        if (context.permissionContext.isGuildOwner || 
            await this.permissionService.isAdmin(context.permissionContext)) {
          result.bypassAvailable = true;
          result.bypassType = context.permissionContext.isGuildOwner ? 'guild-owner' : 'admin';
          result.issues.push({
            severity: ValidationSeverity.INFO,
            code: 'BYPASS_AVAILABLE',
            message: 'You can bypass this limit due to your permissions'
          });
        }
      }

      return result;
    } catch (error) {
      logger.error('Error validating role limit:', error);
      return ValidationResultHelper.error(
        'VALIDATION_ERROR',
        'Failed to validate role limit'
      );
    }
  }

  /**
   * Validates client case limit
   */
  private async validateClientCaseLimit(context: ValidationContext): Promise<ValidationResult> {
    const { guildId } = context.permissionContext;
    const clientId = context.data.clientId as string;

    if (!clientId) {
      return ValidationResultHelper.error('MISSING_CLIENT_ID', 'Client ID is required');
    }

    try {
      const allClientCases = await this.caseRepository.findByClient(clientId);
      const activeCases = allClientCases.filter((c: any) => c.status !== 'closed' && c.guildId === guildId);
      const maxCasesPerClient = 5; // Business rule: max 5 active cases per client

      const result: ValidationResult = {
        valid: activeCases.length < maxCasesPerClient,
        issues: [],
        metadata: {
          currentCount: activeCases.length,
          maxCount: maxCasesPerClient
        }
      };

      if (!result.valid) {
        result.issues.push({
          severity: ValidationSeverity.ERROR,
          code: 'CLIENT_CASE_LIMIT_EXCEEDED',
          message: `Client has reached maximum active case limit (${maxCasesPerClient})`,
          field: 'clientId',
          context: { activeCases: activeCases.map((c: any) => c.caseNumber) }
        });

        // Guild owners can bypass
        if (context.permissionContext.isGuildOwner) {
          result.bypassAvailable = true;
          result.bypassType = 'guild-owner';
        }
      }

      return result;
    } catch (error) {
      logger.error('Error validating client case limit:', error);
      return ValidationResultHelper.error(
        'VALIDATION_ERROR',
        'Failed to validate client case limit'
      );
    }
  }

  /**
   * Validates permissions for operations
   */
  private async validatePermission(context: ValidationContext): Promise<ValidationResult> {
    const requiredAction = context.data.requiredAction as string;
    const targetUserId = context.data.targetUserId as string;

    if (!requiredAction) {
      return ValidationResultHelper.error('MISSING_ACTION', 'Required action is missing');
    }

    try {
      // Check basic permission
      const validActions = ['admin', 'senior-staff', 'case', 'config', 'lawyer', 'lead-attorney', 'repair'];
      const hasPermission = validActions.includes(requiredAction) 
        ? await this.permissionService.hasActionPermission(
            context.permissionContext,
            requiredAction as any
          )
        : false;

      if (hasPermission) {
        return ValidationResultHelper.success();
      }

      // Check enhanced permissions (e.g., senior staff permissions)
      const enhancedCheck = await this.checkEnhancedPermission(
        context.permissionContext,
        requiredAction,
        targetUserId
      );

      if (enhancedCheck.allowed) {
        return ValidationResultHelper.success({
          grantedBy: enhancedCheck.reason
        });
      }

      return ValidationResultHelper.error(
        'INSUFFICIENT_PERMISSION',
        `You don't have permission to perform action: ${requiredAction}`
      );
    } catch (error) {
      logger.error('Error validating permission:', error);
      return ValidationResultHelper.error(
        'VALIDATION_ERROR',
        'Failed to validate permissions'
      );
    }
  }

  /**
   * Validates staff member status and existence
   */
  private async validateStaffMember(context: ValidationContext): Promise<ValidationResult> {
    const { guildId } = context.permissionContext;
    const userId = context.data.userId || context.data.staffId;

    if (!userId) {
      return ValidationResultHelper.error('MISSING_USER_ID', 'User ID is required');
    }

    try {
      const staff = await this.staffRepository.findByUserId(guildId, userId);

      if (!staff) {
        return ValidationResultHelper.error(
          'STAFF_NOT_FOUND',
          'Staff member not found'
        );
      }

      if (staff.status !== 'active') {
        return ValidationResultHelper.error(
          'STAFF_INACTIVE',
          'Staff member is not active'
        );
      }

      return ValidationResultHelper.success({
        staffId: staff._id?.toString(),
        role: staff.role,
        robloxUsername: staff.robloxUsername
      });
    } catch (error) {
      logger.error('Error validating staff member:', error);
      return ValidationResultHelper.error(
        'VALIDATION_ERROR',
        'Failed to validate staff member'
      );
    }
  }

  /**
   * Validates hiring constraints
   */
  private async validateHiring(context: ValidationContext): Promise<ValidationResult> {
    const results: ValidationResult[] = [];

    // Check role limit
    if (context.data.role) {
      const roleLimitResult = await this.validateRoleLimit(context);
      results.push(roleLimitResult);
    }

    // Check if user is already staff
    if (context.data.userId) {
      const existingStaff = await this.staffRepository.findByUserId(
        context.permissionContext.guildId,
        context.data.userId
      );

      if (existingStaff && existingStaff.status === 'active') {
        results.push(ValidationResultHelper.error(
          'ALREADY_STAFF',
          'User is already an active staff member'
        ));
      }
    }

    // Check Roblox username uniqueness
    if (context.data.robloxUsername) {
      const existingRoblox = await this.staffRepository.findStaffByRobloxUsername(
        context.permissionContext.guildId,
        context.data.robloxUsername
      );

      if (existingRoblox) {
        results.push(ValidationResultHelper.error(
          'ROBLOX_USERNAME_TAKEN',
          'Roblox username is already associated with another staff member'
        ));
      }
    }

    return ValidationResultHelper.merge(...results);
  }

  /**
   * Validates promotion constraints
   */
  private async validatePromotion(context: ValidationContext): Promise<ValidationResult> {
    const currentRole = context.data.currentRole as StaffRole;
    const newRole = context.data.newRole as StaffRole;

    if (!currentRole || !newRole) {
      return ValidationResultHelper.error(
        'MISSING_ROLES',
        'Current role and new role are required'
      );
    }

    const currentLevel = RoleUtils.getRoleLevel(currentRole);
    const newLevel = RoleUtils.getRoleLevel(newRole);

    if (newLevel <= currentLevel) {
      return ValidationResultHelper.error(
        'INVALID_PROMOTION',
        'New role must be higher than current role'
      );
    }

    // Check role limit for new role
    context.data.role = newRole;
    return this.validateRoleLimit(context);
  }

  /**
   * Validates demotion constraints
   */
  private async validateDemotion(context: ValidationContext): Promise<ValidationResult> {
    const currentRole = context.data.currentRole as StaffRole;
    const newRole = context.data.newRole as StaffRole;

    if (!currentRole || !newRole) {
      return ValidationResultHelper.error(
        'MISSING_ROLES',
        'Current role and new role are required'
      );
    }

    const currentLevel = RoleUtils.getRoleLevel(currentRole);
    const newLevel = RoleUtils.getRoleLevel(newRole);

    if (newLevel >= currentLevel) {
      return ValidationResultHelper.error(
        'INVALID_DEMOTION',
        'New role must be lower than current role'
      );
    }

    // Check if demoting from management role
    if (this.isManagementRole(currentRole)) {
      const allCases = await this.caseRepository.findByLawyer(context.data.userId);
      const activeCases = allCases.filter((c: any) => 
        c.guildId === context.permissionContext.guildId && c.status !== 'closed'
      );

      if (activeCases.length > 0) {
        return ValidationResultHelper.error(
          'HAS_ACTIVE_CASES',
          `Cannot demote from management role. Staff member has ${activeCases.length} active cases`,
          'cases'
        );
      }
    }

    return ValidationResultHelper.success();
  }

  /**
   * Validates case assignment constraints
   */
  private async validateCaseAssignment(context: ValidationContext): Promise<ValidationResult> {
    const assigneeId = context.data.assigneeId as string;

    if (!assigneeId) {
      return ValidationResultHelper.error('MISSING_ASSIGNEE', 'Assignee ID is required');
    }

    // Validate staff member
    context.data.userId = assigneeId;
    const staffResult = await this.validateStaffMember(context);
    
    if (!staffResult.valid) {
      return staffResult;
    }

    // Check case load for the assignee
    const allCases = await this.caseRepository.findByLawyer(assigneeId);
    const activeCases = allCases.filter((c: any) => 
      c.guildId === context.permissionContext.guildId && c.status !== 'closed'
    );

    const maxCasesPerStaff = 10; // Business rule

    if (activeCases.length >= maxCasesPerStaff) {
      return ValidationResultHelper.warning(
        'HIGH_CASE_LOAD',
        `Staff member already has ${activeCases.length} active cases`,
        'assigneeId'
      );
    }

    return ValidationResultHelper.success();
  }

  /**
   * Checks enhanced permissions (e.g., senior staff permissions)
   */
  private async checkEnhancedPermission(
    context: any,
    action: string,
    _targetUserId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Check if user has senior staff permission
      const hasSeniorPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(
        context
      );

      if (hasSeniorPermission) {
        return { allowed: true, reason: 'senior-staff-permission' };
      }

      // Check role-based permissions
      const grantedPermissions = await this.getGrantedPermissions(
        context.guildId,
        context.userId
      );

      if (grantedPermissions.includes(action)) {
        return { allowed: true, reason: 'role-based-permission' };
      }

      return { allowed: false };
    } catch (error) {
      logger.error('Error checking enhanced permission:', error);
      return { allowed: false };
    }
  }

  /**
   * Gets permissions granted by staff role
   */
  private async getGrantedPermissions(
    guildId: string,
    userId: string
  ): Promise<string[]> {
    try {
      const staff = await this.staffRepository.findByUserId(guildId, userId);
      if (!staff || staff.status !== 'active') {
        return [];
      }

      // Role-based permission mapping
      const rolePermissions: Record<StaffRole, string[]> = {
        [StaffRole.MANAGING_PARTNER]: ['admin', 'hr', 'case', 'config', 'retainer', 'repair'],
        [StaffRole.SENIOR_PARTNER]: ['hr', 'case', 'retainer'],
        [StaffRole.JUNIOR_PARTNER]: ['case', 'retainer'],
        [StaffRole.SENIOR_ASSOCIATE]: ['case'],
        [StaffRole.JUNIOR_ASSOCIATE]: ['case'],
        [StaffRole.PARALEGAL]: []
      };

      return rolePermissions[staff.role] || [];
    } catch (error) {
      logger.error('Error getting granted permissions:', error);
      return [];
    }
  }

  /**
   * Checks if a role is a management role
   */
  private isManagementRole(role: StaffRole): boolean {
    return [
      StaffRole.MANAGING_PARTNER,
      StaffRole.SENIOR_PARTNER,
      StaffRole.JUNIOR_PARTNER
    ].includes(role);
  }
}