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
const validation_decorators_1 = require("../../presentation/decorators/validation-decorators");
const staff_role_1 = require("../../domain/entities/staff-role");
// Mock logger
jest.mock('../../infrastructure/logger');
describe('Validation Decorators', () => {
    let mockCommandValidationService;
    let mockBusinessRuleValidationService;
    let mockCrossEntityValidationService;
    let mockInteraction;
    let testInstance;
    beforeEach(() => {
        (0, validation_decorators_1.clearValidationRules)();
        // Create mock services
        mockCommandValidationService = {
            validateCommand: jest.fn(),
            extractValidationContext: jest.fn(),
            createBypassModal: jest.fn(),
        };
        mockBusinessRuleValidationService = {
            validatePermission: jest.fn(),
            validateRoleLimit: jest.fn(),
            validateClientCaseLimit: jest.fn(),
            validateStaffMember: jest.fn(),
        };
        mockCrossEntityValidationService = {
            validateBeforeOperation: jest.fn(),
        };
        // Create mock interaction
        mockInteraction = {
            commandName: 'test',
            isCommand: jest.fn().mockReturnValue(true),
            reply: jest.fn(),
            showModal: jest.fn(),
            options: {
                getSubcommand: jest.fn().mockReturnValue(null),
                data: [],
            },
        };
        // Create test class instance
        testInstance = {
            commandValidationService: mockCommandValidationService,
            businessRuleValidationService: mockBusinessRuleValidationService,
            crossEntityValidationService: mockCrossEntityValidationService,
            getPermissionContext: jest.fn().mockResolvedValue({
                guildId: 'guild123',
                userId: 'user123',
                userRoles: ['role1'],
                isGuildOwner: false,
            }),
            createErrorEmbed: jest.fn().mockReturnValue({ title: 'Error' }),
            createInfoEmbed: jest.fn().mockReturnValue({ title: 'Info' }),
        };
    });
    describe('@ValidateCommand', () => {
        it('should perform validation before executing method', async () => {
            // Mock successful validation
            mockCommandValidationService.validateCommand.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: [],
            });
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: testInstance.getPermissionContext(),
                commandName: 'test',
                options: {},
            });
            class TestCommand {
                constructor() {
                    this.commandValidationService = mockCommandValidationService;
                    this.getPermissionContext = testInstance.getPermissionContext;
                }
                async testMethod(interaction) {
                    return 'success';
                }
            }
            __decorate([
                (0, validation_decorators_1.ValidateCommand)(),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
                __metadata("design:returntype", Promise)
            ], TestCommand.prototype, "testMethod", null);
            const instance = new TestCommand();
            const result = await instance.testMethod(mockInteraction);
            expect(mockCommandValidationService.validateCommand).toHaveBeenCalled();
            expect(result).toBe('success');
        });
        it('should block execution when validation fails', async () => {
            // Mock failed validation
            mockCommandValidationService.validateCommand.mockResolvedValue({
                isValid: false,
                errors: ['Validation failed'],
                warnings: [],
            });
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: testInstance.getPermissionContext(),
                commandName: 'test',
                options: {},
            });
            class TestCommand {
                constructor() {
                    this.commandValidationService = mockCommandValidationService;
                    this.getPermissionContext = testInstance.getPermissionContext;
                    this.createErrorEmbed = testInstance.createErrorEmbed;
                }
                async testMethod(interaction) {
                    return 'should not reach here';
                }
            }
            __decorate([
                (0, validation_decorators_1.ValidateCommand)(),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
                __metadata("design:returntype", Promise)
            ], TestCommand.prototype, "testMethod", null);
            const instance = new TestCommand();
            const result = await instance.testMethod(mockInteraction);
            expect(mockCommandValidationService.validateCommand).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [{ title: 'Error' }],
                ephemeral: true,
            });
            expect(result).toBeUndefined();
        });
        it('should show bypass modal for guild owner when available', async () => {
            const permissionContext = {
                guildId: 'guild123',
                userId: 'user123',
                userRoles: ['role1'],
                isGuildOwner: true,
            };
            testInstance.getPermissionContext.mockResolvedValue(permissionContext);
            // Mock validation with bypass available
            mockCommandValidationService.validateCommand.mockResolvedValue({
                isValid: false,
                errors: ['Role limit exceeded'],
                warnings: [],
                requiresConfirmation: true,
                bypassRequests: [{}],
            });
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext,
                commandName: 'test',
                options: {},
            });
            const mockModal = { setCustomId: jest.fn() };
            mockCommandValidationService.createBypassModal.mockReturnValue(mockModal);
            class TestCommand {
                constructor() {
                    this.commandValidationService = mockCommandValidationService;
                    this.getPermissionContext = testInstance.getPermissionContext;
                }
                async testMethod(interaction) {
                    return 'should not reach here';
                }
            }
            __decorate([
                (0, validation_decorators_1.ValidateCommand)(),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
                __metadata("design:returntype", Promise)
            ], TestCommand.prototype, "testMethod", null);
            const instance = new TestCommand();
            await instance.testMethod(mockInteraction);
            expect(mockInteraction.showModal).toHaveBeenCalledWith(mockModal);
        });
    });
    describe('@ValidatePermissions', () => {
        it('should add permission validation rule', async () => {
            mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
                // Check that custom rules include permission validation
                expect(options?.customRules).toBeDefined();
                expect(options?.customRules?.length).toBeGreaterThan(0);
                const permissionRule = options?.customRules?.find(r => r.name.startsWith('permission_'));
                expect(permissionRule).toBeDefined();
                // Execute the permission validation
                if (permissionRule) {
                    await permissionRule.validate(context);
                }
                return { isValid: true, errors: [], warnings: [] };
            });
            mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
                bypassAvailable: false,
                hasPermission: true,
                requiredPermission: 'admin',
                grantedPermissions: ['admin'],
            });
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: testInstance.getPermissionContext(),
                commandName: 'test',
                options: {},
            });
            class TestCommand {
                constructor() {
                    this.commandValidationService = mockCommandValidationService;
                    this.businessRuleValidationService = mockBusinessRuleValidationService;
                    this.getPermissionContext = testInstance.getPermissionContext;
                }
                async testMethod(interaction) {
                    return 'success';
                }
            }
            __decorate([
                (0, validation_decorators_1.ValidatePermissions)('admin'),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
                __metadata("design:returntype", Promise)
            ], TestCommand.prototype, "testMethod", null);
            const instance = new TestCommand();
            await instance.testMethod(mockInteraction);
            expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
        });
    });
    describe('@ValidateEntity', () => {
        it('should add entity validation rule', async () => {
            mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
                // Check that custom rules include entity validation
                const entityRule = options?.customRules?.find(r => r.name.startsWith('entity_'));
                expect(entityRule).toBeDefined();
                // Execute the entity validation
                if (entityRule) {
                    await entityRule.validate(context);
                }
                return { isValid: true, errors: [], warnings: [] };
            });
            mockCrossEntityValidationService.validateBeforeOperation.mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
            });
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: testInstance.getPermissionContext(),
                commandName: 'test',
                options: { userId: 'user123' },
            });
            class TestCommand {
                constructor() {
                    this.commandValidationService = mockCommandValidationService;
                    this.crossEntityValidationService = mockCrossEntityValidationService;
                    this.getPermissionContext = testInstance.getPermissionContext;
                }
                async testMethod(interaction) {
                    return 'success';
                }
            }
            __decorate([
                (0, validation_decorators_1.ValidateEntity)('staff', 'delete'),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
                __metadata("design:returntype", Promise)
            ], TestCommand.prototype, "testMethod", null);
            const instance = new TestCommand();
            await instance.testMethod(mockInteraction);
            expect(mockCrossEntityValidationService.validateBeforeOperation).toHaveBeenCalledWith('staff', 'delete', 'guild123', { userId: 'user123' });
        });
    });
    describe('@ValidateBusinessRules', () => {
        it('should validate role limits', async () => {
            mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
                // Check that custom rules include business rule validation
                const businessRule = options?.customRules?.find(r => r.name.includes('role_limit'));
                expect(businessRule).toBeDefined();
                // Execute the business rule validation
                if (businessRule) {
                    await businessRule.validate(context);
                }
                return { isValid: true, errors: [], warnings: [] };
            });
            mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
                bypassAvailable: false,
                currentCount: 5,
                maxCount: 10,
                roleName: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            });
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: testInstance.getPermissionContext(),
                commandName: 'staff',
                subcommandName: 'hire',
                options: { role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE },
            });
            class TestCommand {
                constructor() {
                    this.commandValidationService = mockCommandValidationService;
                    this.businessRuleValidationService = mockBusinessRuleValidationService;
                    this.getPermissionContext = testInstance.getPermissionContext;
                }
                async testMethod(interaction) {
                    return 'success';
                }
            }
            __decorate([
                (0, validation_decorators_1.ValidateBusinessRules)('role_limit'),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
                __metadata("design:returntype", Promise)
            ], TestCommand.prototype, "testMethod", null);
            const instance = new TestCommand();
            await instance.testMethod(mockInteraction);
            expect(mockBusinessRuleValidationService.validateRoleLimit).toHaveBeenCalled();
        });
        it('should validate client case limits', async () => {
            mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
                const businessRule = options?.customRules?.find(r => r.name.includes('client_case_limit'));
                if (businessRule) {
                    await businessRule.validate(context);
                }
                return { isValid: true, errors: [], warnings: [] };
            });
            mockBusinessRuleValidationService.validateClientCaseLimit.mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
                bypassAvailable: false,
                currentCases: 3,
                maxCases: 5,
                clientId: 'client123',
            });
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: testInstance.getPermissionContext(),
                commandName: 'case',
                subcommandName: 'create',
                options: { client: 'client123' },
            });
            class TestCommand {
                constructor() {
                    this.commandValidationService = mockCommandValidationService;
                    this.businessRuleValidationService = mockBusinessRuleValidationService;
                    this.getPermissionContext = testInstance.getPermissionContext;
                }
                async testMethod(interaction) {
                    return 'success';
                }
            }
            __decorate([
                (0, validation_decorators_1.ValidateBusinessRules)('client_case_limit'),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
                __metadata("design:returntype", Promise)
            ], TestCommand.prototype, "testMethod", null);
            const instance = new TestCommand();
            await instance.testMethod(mockInteraction);
            expect(mockBusinessRuleValidationService.validateClientCaseLimit).toHaveBeenCalledWith('client123', 'guild123');
        });
    });
    describe('Multiple decorators', () => {
        it('should apply multiple validation decorators in order', async () => {
            const executionOrder = [];
            mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
                // Track execution of rules
                options?.customRules?.forEach(rule => {
                    executionOrder.push(rule.name);
                });
                return { isValid: true, errors: [], warnings: [] };
            });
            mockCommandValidationService.extractValidationContext.mockResolvedValue({
                interaction: mockInteraction,
                permissionContext: testInstance.getPermissionContext(),
                commandName: 'staff',
                subcommandName: 'fire',
                options: { user: 'user123' },
            });
            class TestCommand {
                constructor() {
                    this.commandValidationService = mockCommandValidationService;
                    this.businessRuleValidationService = mockBusinessRuleValidationService;
                    this.crossEntityValidationService = mockCrossEntityValidationService;
                    this.getPermissionContext = testInstance.getPermissionContext;
                }
                async testMethod(interaction) {
                    return 'success';
                }
            }
            __decorate([
                (0, validation_decorators_1.ValidatePermissions)('senior-staff'),
                (0, validation_decorators_1.ValidateBusinessRules)('staff_member'),
                (0, validation_decorators_1.ValidateEntity)('staff', 'delete'),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [discord_js_1.CommandInteraction]),
                __metadata("design:returntype", Promise)
            ], TestCommand.prototype, "testMethod", null);
            const instance = new TestCommand();
            await instance.testMethod(mockInteraction);
            // Verify all decorators were applied
            expect(executionOrder).toContain('permission_hr');
            expect(executionOrder).toContain('business_rule_staff_member');
            expect(executionOrder).toContain('entity_staff_delete');
        });
    });
});
//# sourceMappingURL=validation-decorators.test.js.map