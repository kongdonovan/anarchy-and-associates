import { UnifiedValidationService } from './unified-validation-service';
import { ValidationResult } from './types';
import { PermissionContext } from '../services/permission-service';
import { StaffRole } from '../../validation';
/**
 * Adapter to help migrate from old validation methods to unified validation
 * Provides backward-compatible interfaces
 */
export declare class ValidationMigrationAdapter {
    private validationService;
    constructor(validationService: UnifiedValidationService);
    /**
     * Validates role limit (backward compatible with BusinessRuleValidationService)
     */
    validateRoleLimit(context: PermissionContext, role: StaffRole): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
        bypassAvailable: boolean;
        bypassType?: 'guild-owner' | 'admin';
        currentCount: number;
        maxCount: number;
        roleName: StaffRole;
        metadata: Record<string, any>;
    }>;
    /**
     * Validates client case limit (backward compatible)
     */
    validateClientCaseLimit(context: PermissionContext, clientId: string): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
        bypassAvailable: boolean;
        currentCount: number;
        maxCount: number;
        metadata: Record<string, any>;
    }>;
    /**
     * Validates staff member (backward compatible)
     */
    validateStaffMember(context: PermissionContext, userId: string, checkActive?: boolean): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
        staffId?: string;
        role?: StaffRole;
        robloxUsername?: string;
        metadata: Record<string, any>;
    }>;
    /**
     * Validates permission (backward compatible)
     */
    validatePermission(context: PermissionContext, requiredAction: string, targetUserId?: string): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
        grantedBy?: string;
        metadata: Record<string, any>;
    }>;
    /**
     * Validates multiple rules (backward compatible)
     */
    validateMultiple(validations: Array<() => Promise<ValidationResult>>): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
        results: ValidationResult[];
    }>;
    /**
     * Command validation helper
     */
    validateCommand(commandName: string, context: PermissionContext, parameters: Record<string, any>): Promise<ValidationResult>;
    /**
     * Staff hiring validation
     */
    validateHiring(context: PermissionContext, data: {
        userId: string;
        robloxUsername: string;
        role: StaffRole;
    }): Promise<ValidationResult>;
    /**
     * Staff promotion validation
     */
    validatePromotion(context: PermissionContext, data: {
        userId: string;
        currentRole: StaffRole;
        newRole: StaffRole;
    }): Promise<ValidationResult>;
    /**
     * Case assignment validation
     */
    validateCaseAssignment(context: PermissionContext, data: {
        caseId?: string;
        assigneeId: string;
    }): Promise<ValidationResult>;
    /**
     * Cross-entity validation for staff removal
     */
    validateStaffRemoval(context: PermissionContext, userId: string): Promise<ValidationResult>;
    /**
     * Cross-entity validation for orphaned entities
     */
    checkOrphanedEntities(context: PermissionContext): Promise<ValidationResult>;
}
//# sourceMappingURL=migration-adapter.d.ts.map