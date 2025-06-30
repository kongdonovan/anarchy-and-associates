import { ValidationStrategy, ValidationContext, ValidationResult } from '../types';
import { StaffRepository } from '../../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../../infrastructure/repositories/guild-config-repository';
import { PermissionService } from '../../services/permission-service';
/**
 * Strategy for validating business rules
 */
export declare class BusinessRuleValidationStrategy implements ValidationStrategy {
    private staffRepository;
    private caseRepository;
    private permissionService;
    readonly name = "BusinessRuleValidation";
    constructor(staffRepository: StaffRepository, caseRepository: CaseRepository, _guildConfigRepository: GuildConfigRepository, // May be used for future validations
    permissionService: PermissionService);
    canHandle(context: ValidationContext): boolean;
    validate(context: ValidationContext): Promise<ValidationResult>;
    /**
     * Validates role limit constraints
     */
    private validateRoleLimit;
    /**
     * Validates client case limit
     */
    private validateClientCaseLimit;
    /**
     * Validates permissions for operations
     */
    private validatePermission;
    /**
     * Validates staff member status and existence
     */
    private validateStaffMember;
    /**
     * Validates hiring constraints
     */
    private validateHiring;
    /**
     * Validates promotion constraints
     */
    private validatePromotion;
    /**
     * Validates demotion constraints
     */
    private validateDemotion;
    /**
     * Validates case assignment constraints
     */
    private validateCaseAssignment;
    /**
     * Checks enhanced permissions (e.g., senior staff permissions)
     */
    private checkEnhancedPermission;
    /**
     * Gets permissions granted by staff role
     */
    private getGrantedPermissions;
    /**
     * Checks if a role is a management role
     */
    private isManagementRole;
}
//# sourceMappingURL=business-rule-validation-strategy.d.ts.map