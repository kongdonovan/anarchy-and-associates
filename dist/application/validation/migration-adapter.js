"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationMigrationAdapter = void 0;
const unified_validation_service_1 = require("./unified-validation-service");
const types_1 = require("./types");
/**
 * Adapter to help migrate from old validation methods to unified validation
 * Provides backward-compatible interfaces
 */
class ValidationMigrationAdapter {
    constructor(validationService) {
        this.validationService = validationService;
    }
    /**
     * Validates role limit (backward compatible with BusinessRuleValidationService)
     */
    async validateRoleLimit(context, role) {
        const validationContext = unified_validation_service_1.UnifiedValidationService.createContext({
            permissionContext: context,
            entityType: 'role',
            operation: 'validateRoleLimit',
            data: { role }
        });
        const result = await this.validationService.validate(validationContext);
        // Convert to old format
        return {
            valid: result.valid,
            errors: types_1.ValidationResultHelper.getErrorMessages(result),
            warnings: types_1.ValidationResultHelper.getWarningMessages(result),
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
    async validateClientCaseLimit(context, clientId) {
        const validationContext = unified_validation_service_1.UnifiedValidationService.createContext({
            permissionContext: context,
            entityType: 'case',
            operation: 'validateClientLimit',
            data: { clientId }
        });
        const result = await this.validationService.validate(validationContext);
        return {
            valid: result.valid,
            errors: types_1.ValidationResultHelper.getErrorMessages(result),
            warnings: types_1.ValidationResultHelper.getWarningMessages(result),
            bypassAvailable: result.bypassAvailable || false,
            currentCount: result.metadata?.currentCount || 0,
            maxCount: result.metadata?.maxCount || 0,
            metadata: result.metadata || {}
        };
    }
    /**
     * Validates staff member (backward compatible)
     */
    async validateStaffMember(context, userId, checkActive = true) {
        const validationContext = unified_validation_service_1.UnifiedValidationService.createContext({
            permissionContext: context,
            entityType: 'staff',
            operation: 'validateStaffMember',
            data: { userId, checkActive }
        });
        const result = await this.validationService.validate(validationContext);
        return {
            valid: result.valid,
            errors: types_1.ValidationResultHelper.getErrorMessages(result),
            warnings: types_1.ValidationResultHelper.getWarningMessages(result),
            staffId: result.metadata?.staffId,
            role: result.metadata?.role,
            robloxUsername: result.metadata?.robloxUsername,
            metadata: result.metadata || {}
        };
    }
    /**
     * Validates permission (backward compatible)
     */
    async validatePermission(context, requiredAction, targetUserId) {
        const validationContext = unified_validation_service_1.UnifiedValidationService.createContext({
            permissionContext: context,
            entityType: 'permission',
            operation: 'validatePermission',
            data: { requiredAction, targetUserId }
        });
        const result = await this.validationService.validate(validationContext);
        return {
            valid: result.valid,
            errors: types_1.ValidationResultHelper.getErrorMessages(result),
            warnings: types_1.ValidationResultHelper.getWarningMessages(result),
            grantedBy: result.metadata?.grantedBy,
            metadata: result.metadata || {}
        };
    }
    /**
     * Validates multiple rules (backward compatible)
     */
    async validateMultiple(validations) {
        const results = await Promise.all(validations.map(v => v()));
        const merged = types_1.ValidationResultHelper.merge(...results);
        return {
            valid: merged.valid,
            errors: types_1.ValidationResultHelper.getErrorMessages(merged),
            warnings: types_1.ValidationResultHelper.getWarningMessages(merged),
            results
        };
    }
    /**
     * Command validation helper
     */
    async validateCommand(commandName, context, parameters) {
        const validationContext = unified_validation_service_1.UnifiedValidationService.createContext({
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
    async validateHiring(context, data) {
        const validationContext = unified_validation_service_1.UnifiedValidationService.createContext({
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
    async validatePromotion(context, data) {
        const validationContext = unified_validation_service_1.UnifiedValidationService.createContext({
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
    async validateCaseAssignment(context, data) {
        const validationContext = unified_validation_service_1.UnifiedValidationService.createContext({
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
    async validateStaffRemoval(context, userId) {
        const validationContext = unified_validation_service_1.UnifiedValidationService.createContext({
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
    async checkOrphanedEntities(context) {
        const validationContext = unified_validation_service_1.UnifiedValidationService.createContext({
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
exports.ValidationMigrationAdapter = ValidationMigrationAdapter;
//# sourceMappingURL=migration-adapter.js.map