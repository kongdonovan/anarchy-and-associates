import { UnifiedValidationService } from './unified-validation-service';
import { ValidationResult, ValidationResultHelper } from './types';
import { PermissionContext } from '../services/permission-service';
import { StaffRole } from '../../validation';

/**
 * Adapter to help migrate from old validation methods to unified validation
 * Provides backward-compatible interfaces
 */
export class ValidationMigrationAdapter {
  constructor(private validationService: UnifiedValidationService) {}

  /**
   * Validates role limit (backward compatible with BusinessRuleValidationService)
   */
  async validateRoleLimit(
    context: PermissionContext,
    role: StaffRole
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    bypassAvailable: boolean;
    bypassType?: 'guild-owner' | 'admin';
    currentCount: number;
    maxCount: number;
    roleName: StaffRole;
    metadata: Record<string, any>;
  }> {
    const validationContext = UnifiedValidationService.createContext({
      permissionContext: context,
      entityType: 'role',
      operation: 'validateRoleLimit',
      data: { role }
    });

    const result = await this.validationService.validate(validationContext);
    
    // Convert to old format
    return {
      valid: result.valid,
      errors: ValidationResultHelper.getErrorMessages(result),
      warnings: ValidationResultHelper.getWarningMessages(result),
      bypassAvailable: result.bypassAvailable || false,
      bypassType: result.bypassType,
      currentCount: result.metadata?.currentCount || 0,
      maxCount: result.metadata?.maxCount || 0,
      roleName: role,
      metadata: result.metadata || {}
    };
  }

  /**
   * Validates client case limit (backward compatible)
   */
  async validateClientCaseLimit(
    context: PermissionContext,
    clientId: string
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    bypassAvailable: boolean;
    currentCount: number;
    maxCount: number;
    metadata: Record<string, any>;
  }> {
    const validationContext = UnifiedValidationService.createContext({
      permissionContext: context,
      entityType: 'case',
      operation: 'validateClientLimit',
      data: { clientId }
    });

    const result = await this.validationService.validate(validationContext);

    return {
      valid: result.valid,
      errors: ValidationResultHelper.getErrorMessages(result),
      warnings: ValidationResultHelper.getWarningMessages(result),
      bypassAvailable: result.bypassAvailable || false,
      currentCount: result.metadata?.currentCount || 0,
      maxCount: result.metadata?.maxCount || 0,
      metadata: result.metadata || {}
    };
  }

  /**
   * Validates staff member (backward compatible)
   */
  async validateStaffMember(
    context: PermissionContext,
    userId: string,
    checkActive: boolean = true
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    staffId?: string;
    role?: StaffRole;
    robloxUsername?: string;
    metadata: Record<string, any>;
  }> {
    const validationContext = UnifiedValidationService.createContext({
      permissionContext: context,
      entityType: 'staff',
      operation: 'validateStaffMember',
      data: { userId, checkActive }
    });

    const result = await this.validationService.validate(validationContext);

    return {
      valid: result.valid,
      errors: ValidationResultHelper.getErrorMessages(result),
      warnings: ValidationResultHelper.getWarningMessages(result),
      staffId: result.metadata?.staffId,
      role: result.metadata?.role,
      robloxUsername: result.metadata?.robloxUsername,
      metadata: result.metadata || {}
    };
  }

  /**
   * Validates permission (backward compatible)
   */
  async validatePermission(
    context: PermissionContext,
    requiredAction: string,
    targetUserId?: string
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    grantedBy?: string;
    metadata: Record<string, any>;
  }> {
    const validationContext = UnifiedValidationService.createContext({
      permissionContext: context,
      entityType: 'permission',
      operation: 'validatePermission',
      data: { requiredAction, targetUserId }
    });

    const result = await this.validationService.validate(validationContext);

    return {
      valid: result.valid,
      errors: ValidationResultHelper.getErrorMessages(result),
      warnings: ValidationResultHelper.getWarningMessages(result),
      grantedBy: result.metadata?.grantedBy,
      metadata: result.metadata || {}
    };
  }

  /**
   * Validates multiple rules (backward compatible)
   */
  async validateMultiple(
    validations: Array<() => Promise<ValidationResult>>
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    results: ValidationResult[];
  }> {
    const results = await Promise.all(validations.map(v => v()));
    const merged = ValidationResultHelper.merge(...results);

    return {
      valid: merged.valid,
      errors: ValidationResultHelper.getErrorMessages(merged),
      warnings: ValidationResultHelper.getWarningMessages(merged),
      results
    };
  }

  /**
   * Command validation helper
   */
  async validateCommand(
    commandName: string,
    context: PermissionContext,
    parameters: Record<string, any>
  ): Promise<ValidationResult> {
    const validationContext = UnifiedValidationService.createContext({
      permissionContext: context,
      entityType: 'command',
      operation: commandName,
      data: parameters
    });

    return this.validationService.validate(validationContext);
  }

  /**
   * Staff hiring validation
   */
  async validateHiring(
    context: PermissionContext,
    data: {
      userId: string;
      robloxUsername: string;
      role: StaffRole;
    }
  ): Promise<ValidationResult> {
    const validationContext = UnifiedValidationService.createContext({
      permissionContext: context,
      entityType: 'staff',
      operation: 'hire',
      data
    });

    return this.validationService.validate(validationContext);
  }

  /**
   * Staff promotion validation
   */
  async validatePromotion(
    context: PermissionContext,
    data: {
      userId: string;
      currentRole: StaffRole;
      newRole: StaffRole;
    }
  ): Promise<ValidationResult> {
    const validationContext = UnifiedValidationService.createContext({
      permissionContext: context,
      entityType: 'staff',
      operation: 'promote',
      data
    });

    return this.validationService.validate(validationContext);
  }

  /**
   * Case assignment validation
   */
  async validateCaseAssignment(
    context: PermissionContext,
    data: {
      caseId?: string;
      assigneeId: string;
    }
  ): Promise<ValidationResult> {
    const validationContext = UnifiedValidationService.createContext({
      permissionContext: context,
      entityType: 'case',
      operation: 'assign',
      data
    });

    return this.validationService.validate(validationContext);
  }

  /**
   * Cross-entity validation for staff removal
   */
  async validateStaffRemoval(
    context: PermissionContext,
    userId: string
  ): Promise<ValidationResult> {
    const validationContext = UnifiedValidationService.createContext({
      permissionContext: context,
      entityType: 'staff',
      operation: 'fire',
      data: { userId },
      metadata: { requiresCrossEntityValidation: true }
    });

    return this.validationService.validate(validationContext);
  }

  /**
   * Cross-entity validation for orphaned entities
   */
  async checkOrphanedEntities(
    context: PermissionContext
  ): Promise<ValidationResult> {
    const validationContext = UnifiedValidationService.createContext({
      permissionContext: context,
      entityType: 'system',
      operation: 'validateOrphanedEntities',
      data: {}
    });

    return this.validationService.validate(validationContext, {
      includeStrategies: ['CrossEntityValidation']
    });
  }
}