import { CommandInteraction } from 'discord.js';
import { CommandValidationService, CommandValidationRule, CommandValidationOptions } from '../../application/services/command-validation-service';
import { logger } from '../../infrastructure/logger';

// Store validation rules for methods
const validationRulesMap = new Map<string, CommandValidationRule[]>();
const validationOptionsMap = new Map<string, CommandValidationOptions>();

/**
 * Decorator to enable general command validation
 * @param options Validation options
 */
export function ValidateCommand(options?: CommandValidationOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const methodKey = `${target.constructor.name}.${propertyKey}`;

    // Store options for this method
    if (options) {
      validationOptionsMap.set(methodKey, options);
    }

    descriptor.value = async function (...args: any[]) {
      const interaction = args[0] as CommandInteraction;
      
      if (!interaction || !interaction.isCommand()) {
        return originalMethod.apply(this, args);
      }

      try {
        // Get validation service instance
        const validationService = (this as any).commandValidationService as CommandValidationService;
        if (!validationService) {
          logger.warn('CommandValidationService not found in command class', { methodKey });
          return originalMethod.apply(this, args);
        }

        // Extract permission context
        const permissionContext = await (this as any).getPermissionContext(interaction);
        if (!permissionContext) {
          logger.error('Failed to get permission context for validation', { methodKey });
          return originalMethod.apply(this, args);
        }

        // Extract validation context
        const validationContext = await validationService.extractValidationContext(interaction, permissionContext);

        // Get stored custom rules for this method
        const customRules = validationRulesMap.get(methodKey) || [];
        const storedOptions = validationOptionsMap.get(methodKey) || {};

        // Merge options
        const finalOptions: CommandValidationOptions = {
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
          const errorEmbed = (this as any).createErrorEmbed(
            'Validation Failed',
            validationResult.errors.join('\n')
          );

          await interaction.reply({
            embeds: [errorEmbed],
            ephemeral: true
          });
          return;
        }

        // Show warnings if any
        if (validationResult.warnings.length > 0) {
          const warningEmbed = (this as any).createInfoEmbed(
            'Validation Warnings',
            validationResult.warnings.join('\n')
          );

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
      } catch (error) {
        logger.error('Error in validation decorator:', error);
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
export function ValidatePermissions(requiredPermission: string, bypassable: boolean = true) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const methodKey = `${target.constructor.name}.${propertyKey}`;

    // Add permission validation rule
    const rule: CommandValidationRule = {
      name: `permission_${requiredPermission}`,
      priority: 0,
      bypassable,
      validate: async (context) => {
        const businessRuleService = (target as any).businessRuleValidationService;
        if (!businessRuleService) {
          throw new Error('BusinessRuleValidationService not found');
        }
        return await businessRuleService.validatePermission(
          context.permissionContext,
          requiredPermission
        );
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
export function ValidateEntity(entityType: string, operation: 'create' | 'update' | 'delete') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const methodKey = `${target.constructor.name}.${propertyKey}`;

    // Add entity validation rule
    const rule: CommandValidationRule = {
      name: `entity_${entityType}_${operation}`,
      priority: 2,
      bypassable: false,
      validate: async (context) => {
        const crossEntityService = (target as any).crossEntityValidationService;
        if (!crossEntityService) {
          throw new Error('CrossEntityValidationService not found');
        }
        
        const result = await crossEntityService.validateBeforeOperation(
          entityType,
          operation,
          context.permissionContext.guildId,
          context.options
        );
        
        return {
          valid: result.valid,
          errors: result.errors.map((e: any) => e.message),
          warnings: result.warnings.map((w: any) => w.message),
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
export function ValidateBusinessRules(...rules: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const methodKey = `${target.constructor.name}.${propertyKey}`;

    // Add business rule validations
    const businessRules: CommandValidationRule[] = rules.map((ruleName) => ({
      name: `business_rule_${ruleName}`,
      priority: 1,
      bypassable: true,
      validate: async (context) => {
        const businessRuleService = (target as any).businessRuleValidationService;
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
            logger.warn(`Unknown business rule: ${ruleName}`);
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
export function addCustomValidationRule(target: any, methodName: string, rule: CommandValidationRule): void {
  const methodKey = `${target.constructor.name}.${methodName}`;
  const existingRules = validationRulesMap.get(methodKey) || [];
  validationRulesMap.set(methodKey, [...existingRules, rule]);
}

/**
 * Helper to clear validation rules for testing
 */
export function clearValidationRules(): void {
  validationRulesMap.clear();
  validationOptionsMap.clear();
}