import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { StaffRole } from '../../validation';
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
export declare class BusinessRuleValidationService {
    private _guildConfigRepository;
    private staffRepository;
    private caseRepository;
    private permissionService;
    constructor(guildConfigRepository: GuildConfigRepository, staffRepository: StaffRepository, caseRepository: CaseRepository, permissionService: PermissionService);
    /**
     * Validate if a role can be hired within limits
     */
    validateRoleLimit(context: PermissionContext, role: StaffRole): Promise<RoleLimitValidationResult>;
    /**
     * Validate client case limits (5 active cases max)
     */
    validateClientCaseLimit(clientId: string, guildId: string): Promise<CaseLimitValidationResult>;
    /**
     * Validate staff member status and permissions
     */
    validateStaffMember(context: PermissionContext, userId: string, requiredPermissions?: string[]): Promise<StaffValidationResult>;
    /**
     * Validate permissions based on new permission system
     */
    validatePermission(context: PermissionContext, requiredPermission: string): Promise<PermissionValidationResult>;
    /**
     * Validate multiple business rules together
     */
    validateMultiple(validations: Promise<ValidationResult>[]): Promise<ValidationResult>;
    /**
     * Check enhanced permissions based on new permission system
     */
    private checkEnhancedPermission;
    /**
     * Get all granted permissions for a user
     */
    private getGrantedPermissions;
    /**
     * Check permission based on staff role (for staff validation)
     * This checks if a staff role automatically grants certain permissions
     */
    private hasPermissionBasedOnStaffRole;
}
//# sourceMappingURL=business-rule-validation-service.d.ts.map