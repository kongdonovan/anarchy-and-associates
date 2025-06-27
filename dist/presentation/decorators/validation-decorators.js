"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidateCommand = ValidateCommand;
exports.ValidatePermissions = ValidatePermissions;
exports.ValidateEntity = ValidateEntity;
exports.ValidateBusinessRules = ValidateBusinessRules;
exports.addCustomValidationRule = addCustomValidationRule;
exports.clearValidationRules = clearValidationRules;
const logger_1 = require("../../infrastructure/logger");
// Store validation rules for methods
const validationRulesMap = new Map();
const validationOptionsMap = new Map();
/**
 * Decorator to enable general command validation
 * @param options Validation options
 */
function ValidateCommand(options) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const methodKey = `${target.constructor.name}.${propertyKey}`;
        // Store options for this method
        if (options) {
            validationOptionsMap.set(methodKey, options);
        }
        descriptor.value = async function (...args) {
            const interaction = args[0];
            if (!interaction || !interaction.isCommand()) {
                return originalMethod.apply(this, args);
            }
            try {
                // Get validation service instance
                const validationService = this.commandValidationService;
                if (!validationService) {
                    logger_1.logger.warn('CommandValidationService not found in command class', { methodKey });
                    return originalMethod.apply(this, args);
                }
                // Extract permission context
                const permissionContext = await this.getPermissionContext(interaction);
                if (!permissionContext) {
                    logger_1.logger.error('Failed to get permission context for validation', { methodKey });
                    return originalMethod.apply(this, args);
                }
                // Extract validation context
                const validationContext = await validationService.extractValidationContext(interaction, permissionContext);
                // Get stored custom rules for this method
                const customRules = validationRulesMap.get(methodKey) || [];
                const storedOptions = validationOptionsMap.get(methodKey) || {};
                // Merge options
                const finalOptions = {
                    ...storedOptions,
                    ...options,
                    customRules: [...(storedOptions.customRules || []), ...customRules]
                };
                // Perform validation
                const validationResult = await validationService.validateCommand(validationContext, finalOptions);
                if (!validationResult.isValid) {
                    // Check if bypass is available
                    if (validationResult.requiresConfirmation && permissionContext.isGuildOwner) {
                        const modal = validationService.createBypassModal(validationResult.bypassRequests || []);
                        await interaction.showModal(modal);
                        return;
                    }
                    // Validation failed without bypass option
                    const errorEmbed = this.createErrorEmbed('Validation Failed', validationResult.errors.join('\n'));
                    await interaction.reply({
                        embeds: [errorEmbed],
                        ephemeral: true
                    });
                    return;
                }
                // Show warnings if any
                if (validationResult.warnings.length > 0) {
                    const warningEmbed = this.createInfoEmbed('Validation Warnings', validationResult.warnings.join('\n'));
                    await interaction.reply({
                        embeds: [warningEmbed],
                        ephemeral: true
                    });
                    // Continue after showing warnings
                    setTimeout(() => {
                        originalMethod.apply(this, args);
                    }, 100);
                    return;
                }
                // Validation passed, execute original method
                return originalMethod.apply(this, args);
            }
            catch (error) {
                logger_1.logger.error('Error in validation decorator:', error);
                // Fall back to original method on error
                return originalMethod.apply(this, args);
            }
        };
        return descriptor;
    };
}
/**
 * Decorator to validate permissions with business rules
 * @param requiredPermission The permission required
 * @param bypassable Whether guild owners can bypass
 */
function ValidatePermissions(requiredPermission, bypassable = true) {
    return function (target, propertyKey, descriptor) {
        const methodKey = `${target.constructor.name}.${propertyKey}`;
        // Add permission validation rule
        const rule = {
            name: `permission_${requiredPermission}`,
            priority: 0,
            bypassable,
            validate: async (context) => {
                const businessRuleService = target.businessRuleValidationService;
                if (!businessRuleService) {
                    throw new Error('BusinessRuleValidationService not found');
                }
                return await businessRuleService.validatePermission(context.permissionContext, requiredPermission);
            }
        };
        // Store rule for this method
        const existingRules = validationRulesMap.get(methodKey) || [];
        validationRulesMap.set(methodKey, [...existingRules, rule]);
        // Apply ValidateCommand decorator if not already applied
        return ValidateCommand()(target, propertyKey, descriptor);
    };
}
/**
 * Decorator to validate entity before operations
 * @param entityType Type of entity to validate
 * @param operation Operation being performed
 */
function ValidateEntity(entityType, operation) {
    return function (target, propertyKey, descriptor) {
        const methodKey = `${target.constructor.name}.${propertyKey}`;
        // Add entity validation rule
        const rule = {
            name: `entity_${entityType}_${operation}`,
            priority: 2,
            bypassable: false,
            validate: async (context) => {
                const crossEntityService = target.crossEntityValidationService;
                if (!crossEntityService) {
                    throw new Error('CrossEntityValidationService not found');
                }
                const result = await crossEntityService.validateBeforeOperation(entityType, operation, context.permissionContext.guildId, context.options);
                return {
                    valid: result.valid,
                    errors: result.errors.map((e) => e.message),
                    warnings: result.warnings.map((w) => w.message),
                    bypassAvailable: false
                };
            }
        };
        // Store rule for this method
        const existingRules = validationRulesMap.get(methodKey) || [];
        validationRulesMap.set(methodKey, [...existingRules, rule]);
        // Apply ValidateCommand decorator if not already applied
        return ValidateCommand()(target, propertyKey, descriptor);
    };
}
/**
 * Decorator to validate business rules
 * @param rules Array of business rule names to validate
 */
function ValidateBusinessRules(...rules) {
    return function (target, propertyKey, descriptor) {
        const methodKey = `${target.constructor.name}.${propertyKey}`;
        // Add business rule validations
        const businessRules = rules.map((ruleName) => ({
            name: `business_rule_${ruleName}`,
            priority: 1,
            bypassable: true,
            validate: async (context) => {
                const businessRuleService = target.businessRuleValidationService;
                if (!businessRuleService) {
                    throw new Error('BusinessRuleValidationService not found');
                }
                // Handle specific business rules
                switch (ruleName) {
                    case 'role_limit':
                        const role = context.options.role;
                        if (!role) {
                            return { valid: true, errors: [], warnings: [], bypassAvailable: false };
                        }
                        return await businessRuleService.validateRoleLimit(context.permissionContext, role);
                    case 'client_case_limit':
                        const clientId = context.options.client;
                        if (!clientId) {
                            return { valid: true, errors: [], warnings: [], bypassAvailable: false };
                        }
                        return await businessRuleService.validateClientCaseLimit(clientId, context.permissionContext.guildId);
                    case 'staff_member':
                        const userId = context.options.user || context.options.member;
                        if (!userId) {
                            return { valid: true, errors: [], warnings: [], bypassAvailable: false };
                        }
                        return await businessRuleService.validateStaffMember(context.permissionContext, userId);
                    default:
                        logger_1.logger.warn(`Unknown business rule: ${ruleName}`);
                        return { valid: true, errors: [], warnings: [], bypassAvailable: false };
                }
            }
        }));
        // Store rules for this method
        const existingRules = validationRulesMap.get(methodKey) || [];
        validationRulesMap.set(methodKey, [...existingRules, ...businessRules]);
        // Apply ValidateCommand decorator if not already applied
        return ValidateCommand()(target, propertyKey, descriptor);
    };
}
/**
 * Helper function to add custom validation rule to a method
 * @param target Class instance
 * @param methodName Method name
 * @param rule Custom validation rule
 */
function addCustomValidationRule(target, methodName, rule) {
    const methodKey = `${target.constructor.name}.${methodName}`;
    const existingRules = validationRulesMap.get(methodKey) || [];
    validationRulesMap.set(methodKey, [...existingRules, rule]);
}
/**
 * Helper to clear validation rules for testing
 */
function clearValidationRules() {
    validationRulesMap.clear();
    validationOptionsMap.clear();
}
//# sourceMappingURL=validation-decorators.js.map