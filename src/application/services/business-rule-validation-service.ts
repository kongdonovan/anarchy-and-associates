import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { RoleUtils } from '../../domain/entities/staff-role'; // Keep utility functions
import { logger } from '../../infrastructure/logger';
import { StaffRole } from '../../validation';
import { StaffRole as StaffRoleEnum } from '../../domain/entities/staff-role';
import { CaseStatus as CaseStatusEnum } from '../../domain/entities/case';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  bypassAvailable: boolean;
  bypassType?: 'guild-owner' | 'admin';
  metadata?: Record<string, any>;
}

export interface RoleLimitValidationResult extends ValidationResult {
  currentCount: number;
  maxCount: number;
  roleName: string;
}

export interface CaseLimitValidationResult extends ValidationResult {
  currentCases: number;
  maxCases: number;
  clientId: string;
}

export interface StaffValidationResult extends ValidationResult {
  isActiveStaff: boolean;
  currentRole?: StaffRole;
  hasRequiredPermissions: boolean;
}

export interface PermissionValidationResult extends ValidationResult {
  hasPermission: boolean;
  requiredPermission: string;
  grantedPermissions: string[];
}

export class BusinessRuleValidationService {
  private _guildConfigRepository: GuildConfigRepository;
  private staffRepository: StaffRepository;
  private caseRepository: CaseRepository;
  private permissionService: PermissionService;

  constructor(
    guildConfigRepository: GuildConfigRepository,
    staffRepository: StaffRepository,
    caseRepository: CaseRepository,
    permissionService: PermissionService
  ) {
    this._guildConfigRepository = guildConfigRepository;
    this.staffRepository = staffRepository;
    this.caseRepository = caseRepository;
    this.permissionService = permissionService;
    
    // Suppress unused variable warning - reserved for future validation features
    void this._guildConfigRepository;
  }

  /**
   * Validate if a role can be hired within limits
   */
  public async validateRoleLimit(
    context: PermissionContext,
    role: StaffRole
  ): Promise<RoleLimitValidationResult> {
    try {
      const currentCount = await this.staffRepository.getStaffCountByRole(context.guildId, role);
      const maxCount = RoleUtils.getRoleMaxCount(role as StaffRoleEnum);
      const canHire = currentCount < maxCount;

      const result: RoleLimitValidationResult = {
        valid: canHire,
        errors: canHire ? [] : [`Cannot hire ${role}. Maximum limit of ${maxCount} reached (current: ${currentCount})`],
        warnings: [],
        bypassAvailable: Boolean(context.isGuildOwner),
        bypassType: context.isGuildOwner ? 'guild-owner' : undefined,
        currentCount,
        maxCount,
        roleName: role,
        metadata: {
          ruleType: 'role-limit',
          role,
          currentCount,
          maxCount
        }
      };

      logger.debug('Role limit validation result', {
        guildId: context.guildId,
        role,
        currentCount,
        maxCount,
        valid: result.valid,
        bypassAvailable: result.bypassAvailable
      });

      return result;
    } catch (error) {
      logger.error('Error validating role limit:', error);
      return {
        valid: false,
        errors: ['Failed to validate role limits'],
        warnings: [],
        bypassAvailable: false,
        currentCount: 0,
        maxCount: 0,
        roleName: role
      };
    }
  }

  /**
   * Validate client case limits (5 active cases max)
   */
  public async validateClientCaseLimit(
    clientId: string,
    guildId: string
  ): Promise<CaseLimitValidationResult> {
    try {
      const activeCases = await this.caseRepository.findByClient(clientId);
      const activeCount = activeCases.filter(c => 
        c.guildId === guildId && 
        (c.status === CaseStatusEnum.PENDING || c.status === CaseStatusEnum.IN_PROGRESS)
      ).length;
      
      const maxCases = 5;
      const canCreateCase = activeCount < maxCases;

      const result: CaseLimitValidationResult = {
        valid: canCreateCase,
        errors: canCreateCase ? [] : [`Client has reached maximum active case limit (${maxCases}). Current active cases: ${activeCount}`],
        warnings: activeCount >= 3 ? [`Client has ${activeCount} active cases (limit: ${maxCases})`] : [],
        bypassAvailable: false, // No bypass for case limits
        currentCases: activeCount,
        maxCases,
        clientId,
        metadata: {
          ruleType: 'case-limit',
          clientId,
          currentCases: activeCount,
          maxCases
        }
      };

      logger.debug('Client case limit validation result', {
        guildId,
        clientId,
        activeCount,
        maxCases,
        valid: result.valid
      });

      return result;
    } catch (error) {
      logger.error('Error validating client case limit:', error);
      return {
        valid: false,
        errors: ['Failed to validate client case limits'],
        warnings: [],
        bypassAvailable: false,
        currentCases: 0,
        maxCases: 5,
        clientId
      };
    }
  }

  /**
   * Validate staff member status and permissions
   */
  public async validateStaffMember(
    context: PermissionContext,
    userId: string,
    requiredPermissions: string[] = []
  ): Promise<StaffValidationResult> {
    try {
      const staff = await this.staffRepository.findByUserId(context.guildId, userId);
      const isActiveStaff = staff !== null && staff.status === 'active';
      
      let hasRequiredPermissions = true;
      const grantedPermissions: string[] = [];

      // Check each required permission
      for (const permission of requiredPermissions) {
        const hasPermission = await this.hasPermissionBasedOnStaffRole(
          context.guildId, 
          userId, 
          staff?.role, 
          permission
        );
        if (hasPermission) {
          grantedPermissions.push(permission);
        } else {
          hasRequiredPermissions = false;
        }
      }

      const result: StaffValidationResult = {
        valid: isActiveStaff && hasRequiredPermissions,
        errors: [],
        warnings: [],
        bypassAvailable: Boolean(context.isGuildOwner),
        bypassType: context.isGuildOwner ? 'guild-owner' : undefined,
        isActiveStaff,
        currentRole: staff?.role,
        hasRequiredPermissions,
        metadata: {
          ruleType: 'staff-validation',
          userId,
          isActiveStaff,
          currentRole: staff?.role,
          requiredPermissions,
          grantedPermissions
        }
      };

      if (!isActiveStaff) {
        result.errors.push('User is not an active staff member');
      }
      if (!hasRequiredPermissions) {
        const missingPermissions = requiredPermissions.filter(p => !grantedPermissions.includes(p));
        result.errors.push(`User lacks required permissions: ${missingPermissions.join(', ')}`);
      }

      logger.debug('Staff validation result', {
        guildId: context.guildId,
        userId,
        isActiveStaff,
        currentRole: staff?.role,
        requiredPermissions,
        hasRequiredPermissions,
        valid: result.valid
      });

      return result;
    } catch (error) {
      logger.error('Error validating staff member:', error);
      return {
        valid: false,
        errors: ['Failed to validate staff member'],
        warnings: [],
        bypassAvailable: false,
        isActiveStaff: false,
        hasRequiredPermissions: false
      };
    }
  }

  /**
   * Validate permissions based on new permission system
   */
  public async validatePermission(
    context: PermissionContext,
    requiredPermission: string
  ): Promise<PermissionValidationResult> {
    try {
      // Check if guild owner (always bypass)
      if (Boolean(context.isGuildOwner)) {
        return {
          valid: true,
          errors: [],
          warnings: [],
          bypassAvailable: true,
          bypassType: 'guild-owner',
          hasPermission: true,
          requiredPermission,
          grantedPermissions: [requiredPermission],
          metadata: {
            ruleType: 'permission-validation',
            requiredPermission,
            bypassReason: 'guild-owner'
          }
        };
      }

      // Check permission through existing service
      const hasPermission = await this.checkEnhancedPermission(context, requiredPermission);
      const grantedPermissions = await this.getGrantedPermissions(context);

      const result: PermissionValidationResult = {
        valid: hasPermission,
        errors: hasPermission ? [] : [`Missing required permission: ${requiredPermission}`],
        warnings: [],
        bypassAvailable: Boolean(context.isGuildOwner),
        bypassType: context.isGuildOwner ? 'guild-owner' : undefined,
        hasPermission,
        requiredPermission,
        grantedPermissions,
        metadata: {
          ruleType: 'permission-validation',
          requiredPermission,
          grantedPermissions
        }
      };

      logger.debug('Permission validation result', {
        guildId: context.guildId,
        userId: context.userId,
        requiredPermission,
        hasPermission,
        valid: result.valid
      });

      return result;
    } catch (error) {
      logger.error('Error validating permission:', error);
      return {
        valid: false,
        errors: ['Failed to validate permissions'],
        warnings: [],
        bypassAvailable: false,
        hasPermission: false,
        requiredPermission,
        grantedPermissions: []
      };
    }
  }

  /**
   * Validate multiple business rules together
   */
  public async validateMultiple(
    validations: Promise<ValidationResult>[]
  ): Promise<ValidationResult> {
    try {
      const results = await Promise.all(validations);
      
      const allValid = results.every(r => r.valid);
      const allErrors = results.flatMap(r => r.errors);
      const allWarnings = results.flatMap(r => r.warnings);
      const bypassAvailable = results.some(r => r.bypassAvailable);

      return {
        valid: allValid,
        errors: allErrors,
        warnings: allWarnings,
        bypassAvailable,
        bypassType: bypassAvailable ? 'guild-owner' : undefined,
        metadata: {
          ruleType: 'multiple-validation',
          validationCount: results.length,
          validResults: results.filter(r => r.valid).length,
          invalidResults: results.filter(r => !r.valid).length
        }
      };
    } catch (error) {
      logger.error('Error validating multiple rules:', error);
      return {
        valid: false,
        errors: ['Failed to validate multiple business rules'],
        warnings: [],
        bypassAvailable: false
      };
    }
  }

  /**
   * Check enhanced permissions based on new permission system
   */
  private async checkEnhancedPermission(
    context: PermissionContext,
    permission: string
  ): Promise<boolean> {
    try {
      switch (permission) {
        case 'senior-staff':
          return await this.permissionService.hasSeniorStaffPermissionWithContext(context);
        case 'lawyer':
          return await this.permissionService.hasLawyerPermissionWithContext(context);
        case 'lead-attorney':
          return await this.permissionService.hasLeadAttorneyPermissionWithContext(context);
        default:
          // Existing permissions
          return await this.permissionService.hasActionPermission(context, permission as any);
      }
    } catch (error) {
      logger.error('Error checking enhanced permission:', error);
      return false;
    }
  }


  /**
   * Get all granted permissions for a user
   */
  private async getGrantedPermissions(context: PermissionContext): Promise<string[]> {
    const permissions: string[] = [];
    
    try {
      const summary = await this.permissionService.getPermissionSummary(context);
      
      if (summary && summary.permissions) {
        for (const [permission, hasPermission] of Object.entries(summary.permissions)) {
          if (hasPermission) {
            permissions.push(permission);
          }
        }
      }
    } catch (error) {
      logger.error('Error getting granted permissions:', error);
    }

    return permissions;
  }

  /**
   * Check permission based on staff role (for staff validation)
   * This checks if a staff role automatically grants certain permissions
   */
  private async hasPermissionBasedOnStaffRole(
    _guildId: string,
    _userId: string,
    staffRole?: StaffRole,
    permission?: string
  ): Promise<boolean> {
    if (!staffRole || !permission) return false;

    const roleLevel = RoleUtils.getRoleLevel(staffRole as StaffRoleEnum);
    
    switch (permission) {
      case 'senior-staff':
        return roleLevel >= 5; // Senior Partner and above
      case 'lawyer':
        return roleLevel >= 2; // Junior Associate and above (auto-granted)
      case 'lead-attorney':
        return roleLevel >= 3; // Senior Associate and above (auto-granted)
      case 'case':
        return roleLevel >= 2; // Junior Associate and above can handle cases
      case 'admin':
        return roleLevel >= 6; // Managing Partner has admin by default
      default:
        return false;
    }
  }
}