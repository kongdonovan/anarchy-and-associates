"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandValidationStrategy = void 0;
const types_1 = require("../types");
const staff_role_1 = require("../../../domain/entities/staff-role");
const case_1 = require("../../../domain/entities/case");
const logger_1 = require("../../../infrastructure/logger");
/**
 * Strategy for validating Discord command parameters and constraints
 */
class CommandValidationStrategy {
    constructor() {
        this.name = 'CommandValidation';
        this.commandConfigs = new Map();
        this.initializeCommandConfigs();
    }
    canHandle(context) {
        return context.entityType === 'command' ||
            this.commandConfigs.has(`${context.entityType}:${context.operation}`);
    }
    async validate(context) {
        const commandKey = context.entityType === 'command'
            ? context.operation
            : `${context.entityType}:${context.operation}`;
        logger_1.logger.debug(`CommandValidation: ${commandKey}`);
        const config = this.commandConfigs.get(commandKey);
        if (!config) {
            return types_1.ValidationResultHelper.success();
        }
        const results = [];
        // Validate parameters
        if (config.parameters) {
            const paramResult = this.validateParameters(context.data, config.parameters, context);
            results.push(paramResult);
        }
        // Run custom validation if defined
        if (config.customValidation) {
            const customResult = await config.customValidation(context);
            if (customResult) {
                results.push(customResult);
            }
        }
        return types_1.ValidationResultHelper.merge(...results);
    }
    /**
     * Validates command parameters against rules
     */
    validateParameters(data, rules, context) {
        const issues = [];
        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            // Check required
            if (rule.required && (value === undefined || value === null || value === '')) {
                issues.push({
                    severity: types_1.ValidationSeverity.ERROR,
                    code: 'REQUIRED_FIELD',
                    message: `${field} is required`,
                    field
                });
                continue;
            }
            // Skip validation if value is not provided and not required
            if (value === undefined || value === null) {
                continue;
            }
            // Type validation
            if (rule.type) {
                const typeResult = this.validateType(value, rule.type, field);
                if (typeResult) {
                    issues.push(typeResult);
                    continue;
                }
            }
            // String length validation
            if (typeof value === 'string') {
                if (rule.minLength && value.length < rule.minLength) {
                    issues.push({
                        severity: types_1.ValidationSeverity.ERROR,
                        code: 'MIN_LENGTH',
                        message: `${field} must be at least ${rule.minLength} characters`,
                        field
                    });
                }
                if (rule.maxLength && value.length > rule.maxLength) {
                    issues.push({
                        severity: types_1.ValidationSeverity.ERROR,
                        code: 'MAX_LENGTH',
                        message: `${field} must not exceed ${rule.maxLength} characters`,
                        field
                    });
                }
            }
            // Number range validation
            if (typeof value === 'number') {
                if (rule.min !== undefined && value < rule.min) {
                    issues.push({
                        severity: types_1.ValidationSeverity.ERROR,
                        code: 'MIN_VALUE',
                        message: `${field} must be at least ${rule.min}`,
                        field
                    });
                }
                if (rule.max !== undefined && value > rule.max) {
                    issues.push({
                        severity: types_1.ValidationSeverity.ERROR,
                        code: 'MAX_VALUE',
                        message: `${field} must not exceed ${rule.max}`,
                        field
                    });
                }
            }
            // Pattern validation
            if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
                issues.push({
                    severity: types_1.ValidationSeverity.ERROR,
                    code: 'INVALID_FORMAT',
                    message: `${field} has invalid format`,
                    field
                });
            }
            // Enum validation
            if (rule.enumValues && !rule.enumValues.includes(value)) {
                issues.push({
                    severity: types_1.ValidationSeverity.ERROR,
                    code: 'INVALID_ENUM',
                    message: `${field} must be one of: ${rule.enumValues.join(', ')}`,
                    field
                });
            }
            // Custom validation
            if (rule.custom) {
                const customResult = rule.custom(value, context);
                if (customResult && !customResult.valid) {
                    issues.push(...customResult.issues);
                }
            }
        }
        return {
            valid: issues.filter(i => i.severity === types_1.ValidationSeverity.ERROR).length === 0,
            issues
        };
    }
    /**
     * Validates value type
     */
    validateType(value, expectedType, field) {
        switch (expectedType) {
            case 'string':
                if (typeof value !== 'string') {
                    return {
                        severity: types_1.ValidationSeverity.ERROR,
                        code: 'INVALID_TYPE',
                        message: `${field} must be a string`,
                        field
                    };
                }
                break;
            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    return {
                        severity: types_1.ValidationSeverity.ERROR,
                        code: 'INVALID_TYPE',
                        message: `${field} must be a number`,
                        field
                    };
                }
                break;
            case 'boolean':
                if (typeof value !== 'boolean') {
                    return {
                        severity: types_1.ValidationSeverity.ERROR,
                        code: 'INVALID_TYPE',
                        message: `${field} must be a boolean`,
                        field
                    };
                }
                break;
            case 'snowflake':
                if (typeof value !== 'string' || !/^\d{17,19}$/.test(value)) {
                    return {
                        severity: types_1.ValidationSeverity.ERROR,
                        code: 'INVALID_SNOWFLAKE',
                        message: `${field} must be a valid Discord ID`,
                        field
                    };
                }
                break;
            case 'date':
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    return {
                        severity: types_1.ValidationSeverity.ERROR,
                        code: 'INVALID_DATE',
                        message: `${field} must be a valid date`,
                        field
                    };
                }
                break;
        }
        return null;
    }
    /**
     * Initializes command validation configurations
     */
    initializeCommandConfigs() {
        // Staff commands
        this.commandConfigs.set('staff:hire', {
            parameters: {
                userId: { required: true, type: 'snowflake' },
                robloxUsername: {
                    required: true,
                    type: 'string',
                    minLength: 3,
                    maxLength: 20,
                    pattern: /^[a-zA-Z0-9_]+$/,
                    custom: (value) => {
                        if (value.startsWith('_') || value.endsWith('_')) {
                            return types_1.ValidationResultHelper.error('INVALID_USERNAME', 'Roblox username cannot start or end with underscore');
                        }
                        return null;
                    }
                },
                role: {
                    required: true,
                    type: 'enum',
                    enumValues: Object.values(staff_role_1.StaffRole)
                },
                reason: { type: 'string', maxLength: 500 }
            }
        });
        this.commandConfigs.set('staff:promote', {
            parameters: {
                userId: { required: true, type: 'snowflake' },
                newRole: {
                    required: true,
                    type: 'enum',
                    enumValues: Object.values(staff_role_1.StaffRole)
                },
                reason: { type: 'string', maxLength: 500 }
            }
        });
        // Case commands
        this.commandConfigs.set('case:create', {
            parameters: {
                clientId: { required: true, type: 'snowflake' },
                title: {
                    required: true,
                    type: 'string',
                    minLength: 5,
                    maxLength: 100
                },
                description: {
                    required: true,
                    type: 'string',
                    minLength: 10,
                    maxLength: 1000
                },
                priority: {
                    type: 'enum',
                    enumValues: Object.values(case_1.CasePriority)
                },
                categoryId: { type: 'snowflake' }
            }
        });
        this.commandConfigs.set('case:assign', {
            parameters: {
                caseNumber: {
                    required: true,
                    type: 'string',
                    pattern: /^\d{4}-\d{4}-[A-Z]{2}$/
                },
                assigneeId: { required: true, type: 'snowflake' }
            }
        });
        // Job commands
        this.commandConfigs.set('job:post', {
            parameters: {
                title: {
                    required: true,
                    type: 'string',
                    minLength: 5,
                    maxLength: 100
                },
                description: {
                    required: true,
                    type: 'string',
                    minLength: 20,
                    maxLength: 2000
                },
                role: {
                    required: true,
                    type: 'enum',
                    enumValues: Object.values(staff_role_1.StaffRole)
                },
                requirements: {
                    type: 'string',
                    maxLength: 1000
                }
            }
        });
        // Application commands
        this.commandConfigs.set('application:submit', {
            parameters: {
                jobId: { required: true, type: 'string' },
                answers: {
                    required: true,
                    custom: (value, _context) => {
                        if (!Array.isArray(value)) {
                            return types_1.ValidationResultHelper.error('INVALID_TYPE', 'Answers must be an array');
                        }
                        // Validate each answer
                        for (let i = 0; i < value.length; i++) {
                            const answer = value[i];
                            if (!answer.questionId || !answer.answer) {
                                return types_1.ValidationResultHelper.error('INVALID_ANSWER', `Answer ${i + 1} is missing required fields`);
                            }
                            if (answer.answer.length > 500) {
                                return types_1.ValidationResultHelper.error('ANSWER_TOO_LONG', `Answer ${i + 1} exceeds maximum length of 500 characters`);
                            }
                        }
                        return null;
                    }
                }
            }
        });
        // Reminder commands
        this.commandConfigs.set('reminder:create', {
            parameters: {
                time: {
                    required: true,
                    type: 'string',
                    custom: (value) => {
                        // Validate time format (e.g., "5m", "2h", "1d", or ISO date)
                        const relativePattern = /^\d+[mhd]$/;
                        const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
                        if (!relativePattern.test(value) && !isoPattern.test(value)) {
                            return types_1.ValidationResultHelper.error('INVALID_TIME_FORMAT', 'Time must be in format like "5m", "2h", "1d" or ISO date');
                        }
                        return null;
                    }
                },
                message: {
                    required: true,
                    type: 'string',
                    minLength: 1,
                    maxLength: 1000
                },
                channelId: { type: 'snowflake' },
                recurring: { type: 'boolean' }
            }
        });
        // Feedback commands
        this.commandConfigs.set('feedback:submit', {
            parameters: {
                caseNumber: {
                    required: true,
                    type: 'string',
                    pattern: /^\d{4}-\d{4}-[A-Z]{2}$/
                },
                rating: {
                    required: true,
                    type: 'number',
                    min: 1,
                    max: 5
                },
                comment: {
                    type: 'string',
                    maxLength: 1000
                }
            }
        });
        // Permission commands
        this.commandConfigs.set('config:permission', {
            parameters: {
                action: {
                    required: true,
                    type: 'enum',
                    enumValues: ['add', 'remove', 'list']
                },
                targetType: {
                    type: 'enum',
                    enumValues: ['user', 'role']
                },
                targetId: { type: 'snowflake' },
                permission: {
                    type: 'enum',
                    enumValues: ['admin', 'hr', 'case', 'config', 'retainer', 'repair']
                }
            },
            customValidation: async (context) => {
                // Ensure required params for add/remove actions
                if (context.data.action !== 'list') {
                    if (!context.data.targetType || !context.data.targetId || !context.data.permission) {
                        return types_1.ValidationResultHelper.error('MISSING_PARAMETERS', 'Target type, ID, and permission are required for add/remove actions');
                    }
                }
                return null;
            }
        });
    }
    /**
     * Adds or updates a command configuration
     */
    addCommandConfig(commandKey, config) {
        this.commandConfigs.set(commandKey, config);
        logger_1.logger.info(`Added command configuration for: ${commandKey}`);
    }
    /**
     * Removes a command configuration
     */
    removeCommandConfig(commandKey) {
        const result = this.commandConfigs.delete(commandKey);
        if (result) {
            logger_1.logger.info(`Removed command configuration for: ${commandKey}`);
        }
        return result;
    }
}
exports.CommandValidationStrategy = CommandValidationStrategy;
//# sourceMappingURL=command-validation-strategy.js.map