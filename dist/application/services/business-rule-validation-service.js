"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessRuleValidationService = void 0;
const staff_role_1 = require("../../domain/entities/staff-role");
const case_1 = require("../../domain/entities/case");
const logger_1 = require("../../infrastructure/logger");
class BusinessRuleValidationService {
    constructor(guildConfigRepository, staffRepository, caseRepository, permissionService) {
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
    async validateRoleLimit(context, role) {
        try {
            const currentCount = await this.staffRepository.getStaffCountByRole(context.guildId, role);
            const maxCount = staff_role_1.RoleUtils.getRoleMaxCount(role);
            const canHire = currentCount < maxCount;
            const result = {
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
            logger_1.logger.debug('Role limit validation result', {
                guildId: context.guildId,
                role,
                currentCount,
                maxCount,
                valid: result.valid,
                bypassAvailable: result.bypassAvailable
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error validating role limit:', error);
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
    async validateClientCaseLimit(clientId, guildId) {
        try {
            const activeCases = await this.caseRepository.findByClient(clientId);
            const activeCount = activeCases.filter(c => c.guildId === guildId &&
                (c.status === case_1.CaseStatus.PENDING || c.status === case_1.CaseStatus.IN_PROGRESS)).length;
            const maxCases = 5;
            const canCreateCase = activeCount < maxCases;
            const result = {
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
            logger_1.logger.debug('Client case limit validation result', {
                guildId,
                clientId,
                activeCount,
                maxCases,
                valid: result.valid
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error validating client case limit:', error);
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
    async validateStaffMember(context, userId, requiredPermissions = []) {
        try {
            const staff = await this.staffRepository.findByUserId(context.guildId, userId);
            const isActiveStaff = staff !== null && staff.status === 'active';
            let hasRequiredPermissions = true;
            const grantedPermissions = [];
            // Check each required permission
            for (const permission of requiredPermissions) {
                const hasPermission = await this.hasPermissionBasedOnStaffRole(context.guildId, userId, staff?.role, permission);
                if (hasPermission) {
                    grantedPermissions.push(permission);
                }
                else {
                    hasRequiredPermissions = false;
                }
            }
            const result = {
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
            logger_1.logger.debug('Staff validation result', {
                guildId: context.guildId,
                userId,
                isActiveStaff,
                currentRole: staff?.role,
                requiredPermissions,
                hasRequiredPermissions,
                valid: result.valid
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error validating staff member:', error);
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
    async validatePermission(context, requiredPermission) {
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
            const result = {
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
            logger_1.logger.debug('Permission validation result', {
                guildId: context.guildId,
                userId: context.userId,
                requiredPermission,
                hasPermission,
                valid: result.valid
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error validating permission:', error);
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
    async validateMultiple(validations) {
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
        }
        catch (error) {
            logger_1.logger.error('Error validating multiple rules:', error);
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
    async checkEnhancedPermission(context, permission) {
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
                    return await this.permissionService.hasActionPermission(context, permission);
            }
        }
        catch (error) {
            logger_1.logger.error('Error checking enhanced permission:', error);
            return false;
        }
    }
    /**
     * Get all granted permissions for a user
     */
    async getGrantedPermissions(context) {
        const permissions = [];
        try {
            const summary = await this.permissionService.getPermissionSummary(context);
            if (summary && summary.permissions) {
                for (const [permission, hasPermission] of Object.entries(summary.permissions)) {
                    if (hasPermission) {
                        permissions.push(permission);
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error getting granted permissions:', error);
        }
        return permissions;
    }
    /**
     * Check permission based on staff role (for staff validation)
     * This checks if a staff role automatically grants certain permissions
     */
    async hasPermissionBasedOnStaffRole(_guildId, _userId, staffRole, permission) {
        if (!staffRole || !permission)
            return false;
        const roleLevel = staff_role_1.RoleUtils.getRoleLevel(staffRole);
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
exports.BusinessRuleValidationService = BusinessRuleValidationService;
//# sourceMappingURL=business-rule-validation-service.js.map