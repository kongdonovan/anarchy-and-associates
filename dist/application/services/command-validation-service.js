"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandValidationService = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../infrastructure/logger");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
class CommandValidationService {
    constructor(businessRuleValidationService, crossEntityValidationService) {
        this.businessRuleValidationService = businessRuleValidationService;
        this.crossEntityValidationService = crossEntityValidationService;
        this.validationCache = new Map();
        this.pendingBypasses = new Map();
    }
    /**
     * Main validation entry point for commands
     */
    async validateCommand(context, options = {}) {
        try {
            // Check cache first
            const cacheKey = this.getCacheKey(context);
            const cached = this.getFromCache(cacheKey);
            if (cached && !options.bypassConfirmationRequired) {
                logger_1.logger.debug('Using cached validation result', { commandName: context.commandName, cacheKey });
                return cached;
            }
            const result = {
                isValid: true,
                errors: [],
                warnings: [],
                bypassRequests: []
            };
            // Run all validation rules
            const validationPromises = [];
            // Permission validation
            if (!options.skipPermissionCheck) {
                const permissionRule = this.createPermissionValidationRule(context);
                if (permissionRule) {
                    validationPromises.push(permissionRule.validate(context));
                }
            }
            // Business rule validation
            if (!options.skipBusinessRules) {
                const businessRules = await this.getBusinessRulesForCommand(context);
                validationPromises.push(...businessRules.map(rule => rule.validate(context)));
            }
            // Entity validation
            if (!options.skipEntityValidation) {
                const entityRules = await this.getEntityValidationRules(context);
                validationPromises.push(...entityRules.map(rule => rule.validate(context)));
            }
            // Custom rules
            if (options.customRules) {
                const sortedCustomRules = options.customRules.sort((a, b) => (a.priority || 0) - (b.priority || 0));
                validationPromises.push(...sortedCustomRules.map(rule => rule.validate(context)));
            }
            // Execute all validations in parallel
            const validationResults = await Promise.all(validationPromises);
            // Process results
            for (const validationResult of validationResults) {
                if (!validationResult.valid) {
                    result.isValid = false;
                    result.errors.push(...validationResult.errors);
                }
                result.warnings.push(...validationResult.warnings);
                // Check for bypass options
                if (validationResult.bypassAvailable && !validationResult.valid) {
                    result.bypassRequests?.push({
                        validationResult,
                        context
                    });
                }
            }
            // If validation failed but bypasses are available for guild owner
            if (!result.isValid && result.bypassRequests && result.bypassRequests.length > 0 && context.permissionContext.isGuildOwner) {
                result.requiresConfirmation = true;
                this.storePendingBypasses(context.interaction.user.id, result.bypassRequests);
            }
            // Cache the result
            this.cacheResult(cacheKey, result);
            logger_1.logger.info('Command validation completed', {
                commandName: context.commandName,
                isValid: result.isValid,
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
                bypassAvailable: result.requiresConfirmation
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error during command validation:', error);
            return {
                isValid: false,
                errors: ['An error occurred during validation. Please try again.'],
                warnings: []
            };
        }
    }
    /**
     * Handle bypass confirmation workflow
     */
    async handleBypassConfirmation(interaction, userId) {
        try {
            const pendingBypasses = this.pendingBypasses.get(userId);
            if (!pendingBypasses || pendingBypasses.length === 0) {
                await interaction.reply({
                    embeds: [embed_utils_1.EmbedUtils.createErrorEmbed('No Pending Bypass', 'No validation bypass is pending for your action.')],
                    ephemeral: true
                });
                return false;
            }
            // Clear pending bypasses
            this.pendingBypasses.delete(userId);
            // Log bypass action
            for (const bypass of pendingBypasses) {
                logger_1.logger.warn('Validation bypass confirmed', {
                    userId,
                    commandName: bypass.context.commandName,
                    validationErrors: bypass.validationResult.errors,
                    bypassReason: bypass.bypassReason || 'Guild owner override'
                });
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error handling bypass confirmation:', error);
            return false;
        }
    }
    /**
     * Create validation bypass modal
     */
    createBypassModal(_bypassRequests) {
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`validation_bypass_${Date.now()}`)
            .setTitle('⚠️ Validation Override Required');
        const reasonInput = new discord_js_1.TextInputBuilder()
            .setCustomId('bypass_reason')
            .setLabel('Reason for Override (Required)')
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Explain why this validation should be bypassed...')
            .setMinLength(10)
            .setMaxLength(500);
        const confirmationInput = new discord_js_1.TextInputBuilder()
            .setCustomId('confirmation')
            .setLabel('Type "OVERRIDE" to confirm')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('OVERRIDE')
            .setMaxLength(10);
        modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(reasonInput), new discord_js_1.ActionRowBuilder().addComponents(confirmationInput));
        return modal;
    }
    /**
     * Create validation bypass buttons
     */
    createBypassButtons() {
        return new discord_js_1.ActionRowBuilder()
            .addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('validation_bypass_confirm')
            .setLabel('Override Validation')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setEmoji('⚠️'), new discord_js_1.ButtonBuilder()
            .setCustomId('validation_bypass_cancel')
            .setLabel('Cancel')
            .setStyle(discord_js_1.ButtonStyle.Secondary));
    }
    /**
     * Extract validation context from interaction
     */
    async extractValidationContext(interaction, permissionContext) {
        const commandName = interaction.commandName;
        let subcommandName = undefined;
        const options = {};
        // Check if interaction has options (ChatInputCommandInteraction)
        if (interaction.isChatInputCommand()) {
            subcommandName = interaction.options.getSubcommand(false) || undefined;
            // Extract all options
            interaction.options.data.forEach(option => {
                if (option.value !== undefined) {
                    options[option.name] = option.value;
                }
            });
        }
        return {
            interaction,
            permissionContext,
            commandName,
            subcommandName,
            options,
            metadata: {
                guildId: interaction.guildId,
                userId: interaction.user.id,
                channelId: interaction.channelId,
                timestamp: Date.now()
            }
        };
    }
    /**
     * Clear validation cache for a specific context
     */
    clearValidationCache(context) {
        if (context) {
            const cacheKey = this.getCacheKey(context);
            this.validationCache.delete(cacheKey);
        }
        else {
            this.validationCache.clear();
        }
    }
    /**
     * Get pending bypass requests for a user
     */
    getPendingBypasses(userId) {
        return this.pendingBypasses.get(userId);
    }
    /**
     * Create permission validation rule for command
     */
    createPermissionValidationRule(context) {
        // Map command names to required permissions
        const permissionMap = {
            'staff': 'senior-staff',
            'case': 'case',
            'admin': 'admin',
            'retainer': 'retainer',
            'job': 'senior-staff',
            'role': 'admin',
            'repair': 'admin',
            'metrics': 'admin'
        };
        const requiredPermission = permissionMap[context.commandName];
        if (!requiredPermission) {
            return null;
        }
        return {
            name: 'permission_check',
            priority: 0,
            bypassable: true,
            validate: async (ctx) => {
                return await this.businessRuleValidationService.validatePermission(ctx.permissionContext, requiredPermission);
            }
        };
    }
    /**
     * Get business rules for specific command
     */
    async getBusinessRulesForCommand(context) {
        const rules = [];
        // Staff hire command - check role limits
        if (context.commandName === 'staff' && context.subcommandName === 'hire') {
            const role = context.options.role;
            if (role) {
                rules.push({
                    name: 'role_limit_check',
                    priority: 1,
                    bypassable: true,
                    validate: async (ctx) => {
                        return await this.businessRuleValidationService.validateRoleLimit(ctx.permissionContext, role);
                    }
                });
            }
        }
        // Case creation - check client case limits
        if (context.commandName === 'case' && context.subcommandName === 'create') {
            const clientId = context.options.client;
            if (clientId) {
                rules.push({
                    name: 'client_case_limit',
                    priority: 1,
                    bypassable: false,
                    validate: async (ctx) => {
                        return await this.businessRuleValidationService.validateClientCaseLimit(clientId, ctx.permissionContext.guildId);
                    }
                });
            }
        }
        // Staff operations - validate target is staff member
        if (['fire', 'promote', 'demote'].includes(context.subcommandName || '') && context.commandName === 'staff') {
            const targetUserId = context.options.user || context.options.member;
            if (targetUserId) {
                rules.push({
                    name: 'staff_member_validation',
                    priority: 1,
                    bypassable: false,
                    validate: async (ctx) => {
                        return await this.businessRuleValidationService.validateStaffMember(ctx.permissionContext, targetUserId);
                    }
                });
            }
        }
        return rules;
    }
    /**
     * Get entity validation rules for command
     */
    async getEntityValidationRules(context) {
        const rules = [];
        // Define entity types for commands
        const entityValidationMap = {
            'staff.fire': { entityType: 'staff', operation: 'delete' },
            'staff.promote': { entityType: 'staff', operation: 'update' },
            'staff.demote': { entityType: 'staff', operation: 'update' },
            'case.close': { entityType: 'case', operation: 'update' },
            'case.assign': { entityType: 'case', operation: 'update' },
            'job.close': { entityType: 'job', operation: 'update' },
            'retainer.cancel': { entityType: 'retainer', operation: 'update' }
        };
        const commandKey = context.subcommandName ? `${context.commandName}.${context.subcommandName}` : context.commandName;
        const entityValidation = entityValidationMap[commandKey];
        if (entityValidation) {
            rules.push({
                name: 'entity_validation',
                priority: 2,
                bypassable: false,
                validate: async (ctx) => {
                    const entity = ctx.options || {};
                    entity.guildId = ctx.permissionContext.guildId;
                    const validationIssues = await this.crossEntityValidationService.validateBeforeOperation(entity, entityValidation.entityType, entityValidation.operation, { guildId: ctx.permissionContext.guildId });
                    return {
                        valid: validationIssues.length === 0,
                        errors: validationIssues.filter(i => i.severity === 'critical').map(i => i.message),
                        warnings: validationIssues.filter(i => i.severity === 'warning').map(i => i.message),
                        bypassAvailable: false
                    };
                }
            });
        }
        return rules;
    }
    /**
     * Generate cache key for validation context
     */
    getCacheKey(context) {
        const optionsHash = Object.entries(context.options)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join('|');
        return `${context.commandName}:${context.subcommandName || 'none'}:${context.permissionContext.userId}:${optionsHash}`;
    }
    /**
     * Get cached validation result
     */
    getFromCache(key) {
        const cached = this.validationCache.get(key);
        if (!cached)
            return null;
        const age = Date.now() - cached.timestamp;
        if (age > CommandValidationService.VALIDATION_CACHE_TTL) {
            this.validationCache.delete(key);
            return null;
        }
        return cached.result;
    }
    /**
     * Cache validation result
     */
    cacheResult(key, result) {
        this.validationCache.set(key, {
            result,
            timestamp: Date.now()
        });
        // Clean up old cache entries
        if (this.validationCache.size > 100) {
            const sortedEntries = Array.from(this.validationCache.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp);
            // Remove oldest 20 entries
            for (let i = 0; i < 20 && i < sortedEntries.length; i++) {
                const entry = sortedEntries[i];
                if (entry) {
                    this.validationCache.delete(entry[0]);
                }
            }
        }
    }
    /**
     * Store pending bypasses for user
     */
    storePendingBypasses(userId, bypasses) {
        this.pendingBypasses.set(userId, bypasses);
        // Auto-clear after 5 minutes
        setTimeout(() => {
            this.pendingBypasses.delete(userId);
        }, 5 * 60 * 1000);
    }
}
exports.CommandValidationService = CommandValidationService;
CommandValidationService.VALIDATION_CACHE_TTL = 5000; // 5 seconds
//# sourceMappingURL=command-validation-service.js.map