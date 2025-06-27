"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const validation_decorators_1 = require("../../../presentation/decorators/validation-decorators");
const logger_1 = require("../../../infrastructure/logger");
// Mock logger
jest.mock('../../../infrastructure/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));
describe('Validation Decorators', () => {
    let mockInteraction;
    let mockCommandValidationService;
    let mockBusinessRuleValidationService;
    let mockCrossEntityValidationService;
    let TestClass;
    let testInstance;
    beforeEach(() => {
        jest.clearAllMocks();
        (0, validation_decorators_1.clearValidationRules)();
        // Create mock interaction
        mockInteraction = {
            isCommand: jest.fn().mockReturnValue(true),
            guildId: 'guild123',
            user: { id: 'user123' },
            guild: { ownerId: 'owner123' },
            reply: jest.fn(),
            showModal: jest.fn(),
            deferred: false,
            replied: false,
            options: {
                getSubcommand: jest.fn().mockReturnValue(null),
                data: []
            }
        };
        // Create mock services
        mockCommandValidationService = {
            validateCommand: jest.fn(),
            extractValidationContext: jest.fn(),
            createBypassModal: jest.fn()
        };
        mockBusinessRuleValidationService = {
            validatePermission: jest.fn(),
            validateRoleLimit: jest.fn(),
            validateClientCaseLimit: jest.fn(),
            validateStaffMember: jest.fn()
        };
        mockCrossEntityValidationService = {
            validateBeforeOperation: jest.fn()
        };
        // Create test class
        class TestCommandClass {
            constructor() {
                this.commandValidationService = mockCommandValidationService;
                this.businessRuleValidationService = mockBusinessRuleValidationService;
                this.crossEntityValidationService = mockCrossEntityValidationService;
            }
            async getPermissionContext(interaction) {
                return {
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    userRoles: [],
                    isGuildOwner: interaction.guild?.ownerId === interaction.user.id
                };
            }
            createErrorEmbed(title, message) {
                return { title, message };
            }
            createInfoEmbed(title, message) {
                return { title, message };
            }
            async testMethod(_interaction) {
                return 'success';
            }
            async testPermissionMethod(_interaction) {
                return 'success';
            }
            async testEntityMethod(_interaction) {
                return 'success';
            }
            async testBusinessRuleMethod(_interaction) {
                return 'success';
            }
            async testCombinedMethod(_interaction) {
                return 'success';
            }
        }
        __decorate([
            (0, validation_decorators_1.ValidateCommand)(),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
            __metadata("design:returntype", Promise)
        ], TestCommandClass.prototype, "testMethod", null);
        __decorate([
            (0, validation_decorators_1.ValidatePermissions)('admin'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
            __metadata("design:returntype", Promise)
        ], TestCommandClass.prototype, "testPermissionMethod", null);
        __decorate([
            (0, validation_decorators_1.ValidateEntity)('staff', 'update'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
            __metadata("design:returntype", Promise)
        ], TestCommandClass.prototype, "testEntityMethod", null);
        __decorate([
            (0, validation_decorators_1.ValidateBusinessRules)('role_limit'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
            __metadata("design:returntype", Promise)
        ], TestCommandClass.prototype, "testBusinessRuleMethod", null);
        __decorate([
            (0, validation_decorators_1.ValidatePermissions)('senior-staff'),
            (0, validation_decorators_1.ValidateBusinessRules)('role_limit', 'staff_member'),
            (0, validation_decorators_1.ValidateEntity)('staff', 'create'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
            __metadata("design:returntype", Promise)
        ], TestCommandClass.prototype, "testCombinedMethod", null);
        TestClass = TestCommandClass;
        testInstance = new TestClass();
    });
    describe('@ValidateCommand', () => {
        it('should execute method when validation passes', async () => {
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
                commandName: 'test',
                options: {}
            });
            mockCommandValidationService.validateCommand.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });
            const result = await testInstance.testMethod(mockInteraction);
            expect(result).toBe('success');
            expect(mockCommandValidationService.validateCommand).toHaveBeenCalled();
            expect(mockInteraction.reply).not.toHaveBeenCalled();
        });
        it('should block method execution when validation fails', async () => {
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
                commandName: 'test',
                options: {}
            });
            mockCommandValidationService.validateCommand.mockResolvedValue({
                isValid: false,
                errors: ['Validation failed'],
                warnings: []
            });
            const result = await testInstance.testMethod(mockInteraction);
            expect(result).toBeUndefined();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [{ title: 'Validation Failed', message: 'Validation failed' }],
                ephemeral: true
            });
        });
        it('should show warnings but continue execution', async () => {
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
                commandName: 'test',
                options: {}
            });
            mockCommandValidationService.validateCommand.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: ['This is a warning']
            });
            const result = await new Promise((resolve) => {
                testInstance.testMethod(mockInteraction).then(resolve);
                // Wait for the timeout
                setTimeout(() => { }, 150);
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [{ title: 'Validation Warnings', message: 'This is a warning' }],
                ephemeral: true
            });
            // Method should still execute after warning
            expect(result).toBe('success');
        });
        it('should show bypass modal for guild owner', async () => {
            mockInteraction.guild.ownerId = mockInteraction.user.id; // Make user guild owner
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: true },
                commandName: 'test',
                options: {}
            });
            mockCommandValidationService.validateCommand.mockResolvedValue({
                isValid: false,
                errors: ['Role limit reached'],
                warnings: [],
                requiresConfirmation: true,
                bypassRequests: [{
                        validationResult: { valid: false, errors: ['Role limit reached'], warnings: [], bypassAvailable: true },
                        context: {}
                    }]
            });
            const modal = { customId: 'bypass_modal' };
            mockCommandValidationService.createBypassModal.mockReturnValue(modal);
            await testInstance.testMethod(mockInteraction);
            expect(mockInteraction.showModal).toHaveBeenCalledWith(modal);
            expect(mockInteraction.reply).not.toHaveBeenCalled();
        });
    });
    describe('@ValidatePermissions', () => {
        it('should validate permissions correctly', async () => {
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
                commandName: 'test',
                options: {}
            });
            mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
                valid: false,
                errors: ['You do not have admin permission'],
                warnings: [],
                bypassAvailable: false,
                hasPermission: false,
                requiredPermission: 'admin',
                grantedPermissions: []
            });
            mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
                // Execute the custom rules that were added by the decorator
                const customRules = options?.customRules || [];
                for (const rule of customRules) {
                    const result = await rule.validate(context);
                    if (!result.valid) {
                        return {
                            isValid: false,
                            errors: result.errors,
                            warnings: result.warnings
                        };
                    }
                }
                return { isValid: true, errors: [], warnings: [] };
            });
            await testInstance.testPermissionMethod(mockInteraction);
            expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalledWith(expect.objectContaining({ guildId: 'guild123', userId: 'user123' }), 'admin');
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [{ title: 'Validation Failed', message: 'You do not have admin permission' }],
                ephemeral: true
            });
        });
    });
    describe('@ValidateEntity', () => {
        it('should validate entity operations correctly', async () => {
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
                commandName: 'test',
                options: { user: 'user456' }
            });
            mockCrossEntityValidationService.validateBeforeOperation.mockResolvedValue([
                {
                    severity: 'critical',
                    entityType: 'staff',
                    entityId: 'user456',
                    message: 'Staff member has active cases',
                    canAutoRepair: false
                }
            ]);
            mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
                const customRules = options?.customRules || [];
                for (const rule of customRules) {
                    const result = await rule.validate(context);
                    if (!result.valid) {
                        return {
                            isValid: false,
                            errors: result.errors,
                            warnings: result.warnings
                        };
                    }
                }
                return { isValid: true, errors: [], warnings: [] };
            });
            await testInstance.testEntityMethod(mockInteraction);
            expect(mockCrossEntityValidationService.validateBeforeOperation).toHaveBeenCalledWith('staff', 'update', 'guild123', { user: 'user456' });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [{ title: 'Validation Failed', message: 'Staff member has active cases' }],
                ephemeral: true
            });
        });
    });
    describe('@ValidateBusinessRules', () => {
        it('should validate role limit rule', async () => {
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
                commandName: 'test',
                options: { role: 'Managing Partner' }
            });
            mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
                valid: false,
                errors: ['Managing Partner role limit reached (1/1)'],
                warnings: [],
                bypassAvailable: true,
                currentCount: 1,
                maxCount: 1,
                roleName: 'Managing Partner'
            });
            mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
                const customRules = options?.customRules || [];
                for (const rule of customRules) {
                    const result = await rule.validate(context);
                    if (!result.valid) {
                        return {
                            isValid: false,
                            errors: result.errors,
                            warnings: result.warnings,
                            requiresConfirmation: result.bypassAvailable,
                            bypassRequests: result.bypassAvailable ? [{ validationResult: result, context }] : []
                        };
                    }
                }
                return { isValid: true, errors: [], warnings: [] };
            });
            await testInstance.testBusinessRuleMethod(mockInteraction);
            expect(mockBusinessRuleValidationService.validateRoleLimit).toHaveBeenCalledWith(expect.objectContaining({ guildId: 'guild123' }), 'Managing Partner');
        });
        it('should validate multiple business rules', async () => {
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
                commandName: 'test',
                options: { role: 'Senior Partner', user: 'user456' }
            });
            // All validations pass
            mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
                bypassAvailable: false,
                hasPermission: true,
                requiredPermission: 'admin',
                grantedPermissions: ['admin']
            });
            mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
                bypassAvailable: false,
                currentCount: 0,
                maxCount: 10,
                roleName: 'Junior Associate'
            });
            mockBusinessRuleValidationService.validateStaffMember.mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
                bypassAvailable: false,
                isActiveStaff: true,
                hasRequiredPermissions: true
            });
            mockCrossEntityValidationService.validateBeforeOperation.mockResolvedValue([]);
            mockCommandValidationService.validateCommand.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });
            const result = await testInstance.testCombinedMethod(mockInteraction);
            expect(result).toBe('success');
            expect(mockInteraction.reply).not.toHaveBeenCalled();
        });
    });
    describe('addCustomValidationRule', () => {
        it('should allow adding custom validation rules', async () => {
            const customRule = {
                name: 'custom_rule',
                priority: 5,
                bypassable: false,
                validate: jest.fn().mockResolvedValue({
                    valid: false,
                    errors: ['Custom validation failed'],
                    warnings: [],
                    bypassAvailable: false
                })
            };
            (0, validation_decorators_1.addCustomValidationRule)(testInstance, 'testMethod', customRule);
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
                commandName: 'test',
                options: {}
            });
            mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
                const customRules = options?.customRules || [];
                for (const rule of customRules) {
                    const result = await rule.validate(context);
                    if (!result.valid) {
                        return {
                            isValid: false,
                            errors: result.errors,
                            warnings: result.warnings
                        };
                    }
                }
                return { isValid: true, errors: [], warnings: [] };
            });
            await testInstance.testMethod(mockInteraction);
            expect(customRule.validate).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [{ title: 'Validation Failed', message: 'Custom validation failed' }],
                ephemeral: true
            });
        });
    });
    describe('Error Handling', () => {
        it('should handle missing validation service gracefully', async () => {
            testInstance.commandValidationService = undefined;
            const result = await testInstance.testMethod(mockInteraction);
            expect(result).toBe('success');
            expect(logger_1.logger.warn).toHaveBeenCalledWith('CommandValidationService not found in command class', expect.any(Object));
        });
        it('should handle validation errors gracefully', async () => {
            mockCommandValidationService.extractValidationContext.mockRejectedValue(new Error('Context extraction failed'));
            const result = await testInstance.testMethod(mockInteraction);
            expect(result).toBe('success');
            expect(logger_1.logger.error).toHaveBeenCalledWith('Error in validation decorator:', expect.any(Error));
        });
        it('should handle non-command interactions', async () => {
            mockInteraction.isCommand.mockReturnValue(false);
            const result = await testInstance.testMethod(mockInteraction);
            expect(result).toBe('success');
            expect(mockCommandValidationService.validateCommand).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=validation-decorators.test.js.map