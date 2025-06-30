"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessRuleValidationStrategy = void 0;
const types_1 = require("../types");
const staff_role_1 = require("../../../domain/entities/staff-role");
const logger_1 = require("../../../infrastructure/logger");
/**
 * Strategy for validating business rules
 */
class BusinessRuleValidationStrategy {
    constructor(staffRepository, caseRepository, _guildConfigRepository, // May be used for future validations
    permissionService) {
        this.staffRepository = staffRepository;
        this.caseRepository = caseRepository;
        this.permissionService = permissionService;
        this.name = 'BusinessRuleValidation';
    }
    canHandle(context) {
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
    async validate(context) {
        logger_1.logger.debug(`BusinessRuleValidation: ${context.entityType}:${context.operation}`);
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
                return types_1.ValidationResultHelper.success();
        }
    }
    /**
     * Validates role limit constraints
     */
    async validateRoleLimit(context) {
        const { guildId } = context.permissionContext;
        const role = context.data.role;
        if (!role) {
            return types_1.ValidationResultHelper.error('MISSING_ROLE', 'Role is required');
        }
        try {
            const currentStaff = await this.staffRepository.findByRole(guildId, role);
            const currentCount = currentStaff.filter((s) => s.status === 'active').length;
            const maxCount = staff_role_1.RoleUtils.getRoleMaxCount(role);
            const result = {
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
                    severity: types_1.ValidationSeverity.ERROR,
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
                        severity: types_1.ValidationSeverity.INFO,
                        code: 'BYPASS_AVAILABLE',
                        message: 'You can bypass this limit due to your permissions'
                    });
                }
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error validating role limit:', error);
            return types_1.ValidationResultHelper.error('VALIDATION_ERROR', 'Failed to validate role limit');
        }
    }
    /**
     * Validates client case limit
     */
    async validateClientCaseLimit(context) {
        const { guildId } = context.permissionContext;
        const clientId = context.data.clientId;
        if (!clientId) {
            return types_1.ValidationResultHelper.error('MISSING_CLIENT_ID', 'Client ID is required');
        }
        try {
            const allClientCases = await this.caseRepository.findByClient(clientId);
            const activeCases = allClientCases.filter((c) => c.status !== 'closed' && c.guildId === guildId);
            const maxCasesPerClient = 5; // Business rule: max 5 active cases per client
            const result = {
                valid: activeCases.length < maxCasesPerClient,
                issues: [],
                metadata: {
                    currentCount: activeCases.length,
                    maxCount: maxCasesPerClient
                }
            };
            if (!result.valid) {
                result.issues.push({
                    severity: types_1.ValidationSeverity.ERROR,
                    code: 'CLIENT_CASE_LIMIT_EXCEEDED',
                    message: `Client has reached maximum active case limit (${maxCasesPerClient})`,
                    field: 'clientId',
                    context: { activeCases: activeCases.map((c) => c.caseNumber) }
                });
                // Guild owners can bypass
                if (context.permissionContext.isGuildOwner) {
                    result.bypassAvailable = true;
                    result.bypassType = 'guild-owner';
                }
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error validating client case limit:', error);
            return types_1.ValidationResultHelper.error('VALIDATION_ERROR', 'Failed to validate client case limit');
        }
    }
    /**
     * Validates permissions for operations
     */
    async validatePermission(context) {
        const requiredAction = context.data.requiredAction;
        const targetUserId = context.data.targetUserId;
        if (!requiredAction) {
            return types_1.ValidationResultHelper.error('MISSING_ACTION', 'Required action is missing');
        }
        try {
            // Check basic permission
            const validActions = ['admin', 'senior-staff', 'case', 'config', 'lawyer', 'lead-attorney', 'repair'];
            const hasPermission = validActions.includes(requiredAction)
                ? await this.permissionService.hasActionPermission(context.permissionContext, requiredAction)
                : false;
            if (hasPermission) {
                return types_1.ValidationResultHelper.success();
            }
            // Check enhanced permissions (e.g., senior staff permissions)
            const enhancedCheck = await this.checkEnhancedPermission(context.permissionContext, requiredAction, targetUserId);
            if (enhancedCheck.allowed) {
                return types_1.ValidationResultHelper.success({
                    grantedBy: enhancedCheck.reason
                });
            }
            return types_1.ValidationResultHelper.error('INSUFFICIENT_PERMISSION', `You don't have permission to perform action: ${requiredAction}`);
        }
        catch (error) {
            logger_1.logger.error('Error validating permission:', error);
            return types_1.ValidationResultHelper.error('VALIDATION_ERROR', 'Failed to validate permissions');
        }
    }
    /**
     * Validates staff member status and existence
     */
    async validateStaffMember(context) {
        const { guildId } = context.permissionContext;
        const userId = context.data.userId || context.data.staffId;
        if (!userId) {
            return types_1.ValidationResultHelper.error('MISSING_USER_ID', 'User ID is required');
        }
        try {
            const staff = await this.staffRepository.findByUserId(guildId, userId);
            if (!staff) {
                return types_1.ValidationResultHelper.error('STAFF_NOT_FOUND', 'Staff member not found');
            }
            if (staff.status !== 'active') {
                return types_1.ValidationResultHelper.error('STAFF_INACTIVE', 'Staff member is not active');
            }
            return types_1.ValidationResultHelper.success({
                staffId: staff._id?.toString(),
                role: staff.role,
                robloxUsername: staff.robloxUsername
            });
        }
        catch (error) {
            logger_1.logger.error('Error validating staff member:', error);
            return types_1.ValidationResultHelper.error('VALIDATION_ERROR', 'Failed to validate staff member');
        }
    }
    /**
     * Validates hiring constraints
     */
    async validateHiring(context) {
        const results = [];
        // Check role limit
        if (context.data.role) {
            const roleLimitResult = await this.validateRoleLimit(context);
            results.push(roleLimitResult);
        }
        // Check if user is already staff
        if (context.data.userId) {
            const existingStaff = await this.staffRepository.findByUserId(context.permissionContext.guildId, context.data.userId);
            if (existingStaff && existingStaff.status === 'active') {
                results.push(types_1.ValidationResultHelper.error('ALREADY_STAFF', 'User is already an active staff member'));
            }
        }
        // Check Roblox username uniqueness
        if (context.data.robloxUsername) {
            const existingRoblox = await this.staffRepository.findStaffByRobloxUsername(context.permissionContext.guildId, context.data.robloxUsername);
            if (existingRoblox) {
                results.push(types_1.ValidationResultHelper.error('ROBLOX_USERNAME_TAKEN', 'Roblox username is already associated with another staff member'));
            }
        }
        return types_1.ValidationResultHelper.merge(...results);
    }
    /**
     * Validates promotion constraints
     */
    async validatePromotion(context) {
        const currentRole = context.data.currentRole;
        const newRole = context.data.newRole;
        if (!currentRole || !newRole) {
            return types_1.ValidationResultHelper.error('MISSING_ROLES', 'Current role and new role are required');
        }
        const currentLevel = staff_role_1.RoleUtils.getRoleLevel(currentRole);
        const newLevel = staff_role_1.RoleUtils.getRoleLevel(newRole);
        if (newLevel <= currentLevel) {
            return types_1.ValidationResultHelper.error('INVALID_PROMOTION', 'New role must be higher than current role');
        }
        // Check role limit for new role
        context.data.role = newRole;
        return this.validateRoleLimit(context);
    }
    /**
     * Validates demotion constraints
     */
    async validateDemotion(context) {
        const currentRole = context.data.currentRole;
        const newRole = context.data.newRole;
        if (!currentRole || !newRole) {
            return types_1.ValidationResultHelper.error('MISSING_ROLES', 'Current role and new role are required');
        }
        const currentLevel = staff_role_1.RoleUtils.getRoleLevel(currentRole);
        const newLevel = staff_role_1.RoleUtils.getRoleLevel(newRole);
        if (newLevel >= currentLevel) {
            return types_1.ValidationResultHelper.error('INVALID_DEMOTION', 'New role must be lower than current role');
        }
        // Check if demoting from management role
        if (this.isManagementRole(currentRole)) {
            const allCases = await this.caseRepository.findByLawyer(context.data.userId);
            const activeCases = allCases.filter((c) => c.guildId === context.permissionContext.guildId && c.status !== 'closed');
            if (activeCases.length > 0) {
                return types_1.ValidationResultHelper.error('HAS_ACTIVE_CASES', `Cannot demote from management role. Staff member has ${activeCases.length} active cases`, 'cases');
            }
        }
        return types_1.ValidationResultHelper.success();
    }
    /**
     * Validates case assignment constraints
     */
    async validateCaseAssignment(context) {
        const assigneeId = context.data.assigneeId;
        if (!assigneeId) {
            return types_1.ValidationResultHelper.error('MISSING_ASSIGNEE', 'Assignee ID is required');
        }
        // Validate staff member
        context.data.userId = assigneeId;
        const staffResult = await this.validateStaffMember(context);
        if (!staffResult.valid) {
            return staffResult;
        }
        // Check case load for the assignee
        const allCases = await this.caseRepository.findByLawyer(assigneeId);
        const activeCases = allCases.filter((c) => c.guildId === context.permissionContext.guildId && c.status !== 'closed');
        const maxCasesPerStaff = 10; // Business rule
        if (activeCases.length >= maxCasesPerStaff) {
            return types_1.ValidationResultHelper.warning('HIGH_CASE_LOAD', `Staff member already has ${activeCases.length} active cases`, 'assigneeId');
        }
        return types_1.ValidationResultHelper.success();
    }
    /**
     * Checks enhanced permissions (e.g., senior staff permissions)
     */
    async checkEnhancedPermission(context, action, _targetUserId) {
        try {
            // Check if user has senior staff permission
            const hasSeniorPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
            if (hasSeniorPermission) {
                return { allowed: true, reason: 'senior-staff-permission' };
            }
            // Check role-based permissions
            const grantedPermissions = await this.getGrantedPermissions(context.guildId, context.userId);
            if (grantedPermissions.includes(action)) {
                return { allowed: true, reason: 'role-based-permission' };
            }
            return { allowed: false };
        }
        catch (error) {
            logger_1.logger.error('Error checking enhanced permission:', error);
            return { allowed: false };
        }
    }
    /**
     * Gets permissions granted by staff role
     */
    async getGrantedPermissions(guildId, userId) {
        try {
            const staff = await this.staffRepository.findByUserId(guildId, userId);
            if (!staff || staff.status !== 'active') {
                return [];
            }
            // Role-based permission mapping
            const rolePermissions = {
                [staff_role_1.StaffRole.MANAGING_PARTNER]: ['admin', 'hr', 'case', 'config', 'retainer', 'repair'],
                [staff_role_1.StaffRole.SENIOR_PARTNER]: ['hr', 'case', 'retainer'],
                [staff_role_1.StaffRole.JUNIOR_PARTNER]: ['case', 'retainer'],
                [staff_role_1.StaffRole.SENIOR_ASSOCIATE]: ['case'],
                [staff_role_1.StaffRole.JUNIOR_ASSOCIATE]: ['case'],
                [staff_role_1.StaffRole.PARALEGAL]: []
            };
            return rolePermissions[staff.role] || [];
        }
        catch (error) {
            logger_1.logger.error('Error getting granted permissions:', error);
            return [];
        }
    }
    /**
     * Checks if a role is a management role
     */
    isManagementRole(role) {
        return [
            staff_role_1.StaffRole.MANAGING_PARTNER,
            staff_role_1.StaffRole.SENIOR_PARTNER,
            staff_role_1.StaffRole.JUNIOR_PARTNER
        ].includes(role);
    }
}
exports.BusinessRuleValidationStrategy = BusinessRuleValidationStrategy;
//# sourceMappingURL=business-rule-validation-strategy.js.map