"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const staff_commands_1 = require("../../../presentation/commands/staff-commands");
const case_commands_1 = require("../../../presentation/commands/case-commands");
const job_commands_1 = require("../../../presentation/commands/job-commands");
const staff_role_1 = require("../../../domain/entities/staff-role");
const validation_decorators_1 = require("../../../presentation/decorators/validation-decorators");
const mongodb_1 = require("mongodb");
// Mock Discord.js ApplicationCommandOptionType
jest.mock('discord.js', () => ({
    ...jest.requireActual('discord.js'),
    ApplicationCommandOptionType: {
        User: 6,
        String: 3,
        Integer: 4,
        Boolean: 5,
    },
    ChannelType: {
        GuildText: 0,
    },
    PermissionFlagsBits: {
        Administrator: 8n,
        ManageRoles: 268435456n,
    },
    ButtonStyle: {
        Primary: 1,
        Secondary: 2,
        Success: 3,
        Danger: 4,
    },
}));
// Mock all dependencies
jest.mock('../../../infrastructure/repositories/staff-repository');
jest.mock('../../../infrastructure/repositories/case-repository');
jest.mock('../../../infrastructure/repositories/case-counter-repository');
jest.mock('../../../infrastructure/repositories/guild-config-repository');
jest.mock('../../../infrastructure/repositories/application-repository');
jest.mock('../../../infrastructure/repositories/job-repository');
jest.mock('../../../infrastructure/repositories/retainer-repository');
jest.mock('../../../infrastructure/repositories/feedback-repository');
jest.mock('../../../infrastructure/repositories/reminder-repository');
jest.mock('../../../infrastructure/repositories/audit-log-repository');
jest.mock('../../../application/services/staff-service');
jest.mock('../../../application/services/case-service');
jest.mock('../../../application/services/job-service');
jest.mock('../../../application/services/discord-role-sync-service');
jest.mock('../../../application/services/job-question-service');
jest.mock('../../../application/services/job-cleanup-service');
jest.mock('../../../application/services/application-service');
jest.mock('../../../infrastructure/external/roblox-service');
jest.mock('../../../infrastructure/logger');
describe('Command Validation Tests', () => {
    let mockInteraction;
    let mockGuild;
    let mockMember;
    let mockUser;
    beforeEach(() => {
        jest.clearAllMocks();
        (0, validation_decorators_1.clearValidationRules)();
        // Create mock user
        mockUser = {
            id: 'user123',
            displayName: 'Test User',
            username: 'testuser',
            tag: 'testuser#1234'
        };
        // Create mock member
        mockMember = {
            roles: {
                cache: new Map()
            },
            user: mockUser
        };
        // Create mock guild
        mockGuild = {
            id: 'guild123',
            ownerId: 'owner123',
            members: {
                cache: new Map([[mockUser.id, mockMember]])
            }
        };
        // Create mock interaction
        mockInteraction = {
            guildId: 'guild123',
            guild: mockGuild,
            user: mockUser,
            member: mockMember,
            commandName: 'staff',
            isCommand: jest.fn().mockReturnValue(true),
            replied: false,
            deferred: false,
            reply: jest.fn(),
            editReply: jest.fn(),
            deferReply: jest.fn(),
            showModal: jest.fn(),
            options: {
                getSubcommand: jest.fn(),
                getUser: jest.fn(),
                getString: jest.fn(),
                data: []
            },
            channelId: 'channel123'
        };
    });
    describe('StaffCommands Validation', () => {
        let staffCommands;
        let mockStaffRepo;
        let mockPermissionService;
        let mockBusinessRuleService;
        beforeEach(() => {
            staffCommands = new staff_commands_1.StaffCommands();
            // Access private services through any
            mockStaffRepo = staffCommands.staffRepository;
            mockPermissionService = staffCommands.permissionService;
            mockBusinessRuleService = staffCommands.businessRuleValidationService;
        });
        describe('promoteStaff validation', () => {
            beforeEach(() => {
                mockInteraction.options.getUser = jest.fn().mockReturnValue(mockUser);
                mockInteraction.options.getString = jest.fn()
                    .mockReturnValueOnce(staff_role_1.StaffRole.SENIOR_PARTNER)
                    .mockReturnValueOnce('Promotion reason');
            });
            it('should validate permissions before promoting', async () => {
                // Mock permission check failure
                mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(false);
                // Mock validation results
                mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
                    valid: false,
                    errors: ['You do not have permission to promote staff members.'],
                    warnings: [],
                    bypassAvailable: false
                });
                await staffCommands.promoteStaff(mockUser, staff_role_1.StaffRole.SENIOR_PARTNER, 'Promotion reason', mockInteraction);
                expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                description: expect.stringContaining('You do not have permission')
                            })
                        })
                    ]),
                    ephemeral: true
                }));
            });
            it('should validate staff member exists', async () => {
                // Mock permission check success
                mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(true);
                mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
                    valid: true,
                    errors: [],
                    warnings: [],
                    bypassAvailable: false
                });
                // Mock staff member validation
                mockBusinessRuleService.validateStaffMember = jest.fn().mockResolvedValue({
                    valid: false,
                    errors: ['User is not a staff member.'],
                    warnings: [],
                    bypassAvailable: false
                });
                // Mock staff not found
                mockStaffRepo.findByUserId = jest.fn().mockResolvedValue(null);
                await staffCommands.promoteStaff(mockUser, staff_role_1.StaffRole.SENIOR_PARTNER, 'Promotion reason', mockInteraction);
                expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                description: expect.stringContaining('User is not a staff member')
                            })
                        })
                    ]),
                    ephemeral: true
                }));
            });
            it('should validate role limit for promotion', async () => {
                // Mock permission check success
                mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(true);
                mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
                    valid: true,
                    errors: [],
                    warnings: [],
                    bypassAvailable: false
                });
                // Mock staff member exists
                mockStaffRepo.findByUserId = jest.fn().mockResolvedValue({
                    userId: mockUser.id,
                    role: staff_role_1.StaffRole.JUNIOR_PARTNER,
                    status: 'active'
                });
                mockBusinessRuleService.validateStaffMember = jest.fn().mockResolvedValue({
                    valid: true,
                    errors: [],
                    warnings: [],
                    bypassAvailable: false
                });
                // Mock role limit validation failure
                mockBusinessRuleService.validateRoleLimit = jest.fn().mockResolvedValue({
                    valid: false,
                    errors: ['Senior Partner role limit reached (3/3).'],
                    warnings: [],
                    bypassAvailable: true
                });
                await staffCommands.promoteStaff(mockUser, staff_role_1.StaffRole.SENIOR_PARTNER, 'Promotion reason', mockInteraction);
                expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                description: expect.stringContaining('role limit reached')
                            })
                        })
                    ]),
                    ephemeral: true
                }));
            });
        });
        describe('demoteStaff validation', () => {
            beforeEach(() => {
                mockInteraction.options.getUser = jest.fn().mockReturnValue(mockUser);
                mockInteraction.options.getString = jest.fn()
                    .mockReturnValueOnce(staff_role_1.StaffRole.JUNIOR_PARTNER)
                    .mockReturnValueOnce('Demotion reason');
            });
            it('should validate permissions before demoting', async () => {
                // Mock permission check failure
                mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(false);
                mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
                    valid: false,
                    errors: ['You do not have permission to demote staff members.'],
                    warnings: [],
                    bypassAvailable: false
                });
                await staffCommands.demoteStaff(mockUser, staff_role_1.StaffRole.JUNIOR_PARTNER, 'Demotion reason', mockInteraction);
                expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                description: expect.stringContaining('You do not have permission')
                            })
                        })
                    ]),
                    ephemeral: true
                }));
            });
            it('should validate entity before update', async () => {
                // Mock all validations as successful
                mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(true);
                mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
                    valid: true,
                    errors: [],
                    warnings: [],
                    bypassAvailable: false
                });
                mockStaffRepo.findByUserId = jest.fn().mockResolvedValue({
                    userId: mockUser.id,
                    role: staff_role_1.StaffRole.SENIOR_PARTNER,
                    status: 'active'
                });
                mockBusinessRuleService.validateStaffMember = jest.fn().mockResolvedValue({
                    valid: true,
                    errors: [],
                    warnings: [],
                    bypassAvailable: false
                });
                // Entity validation should occur
                const mockCrossEntityService = staffCommands.crossEntityValidationService;
                mockCrossEntityService.validateBeforeOperation = jest.fn().mockResolvedValue({
                    valid: true,
                    errors: [],
                    warnings: []
                });
                await staffCommands.demoteStaff(mockUser, staff_role_1.StaffRole.JUNIOR_PARTNER, 'Demotion reason', mockInteraction);
                // Verify entity validation was called
                expect(mockCrossEntityService.validateBeforeOperation).toHaveBeenCalledWith('staff', 'update', 'guild123', expect.any(Object));
            });
        });
    });
    describe('CaseCommands Validation', () => {
        let caseCommands;
        let mockPermissionService;
        beforeEach(() => {
            caseCommands = new case_commands_1.CaseCommands();
            // Access private services
            mockPermissionService = caseCommands.permissionService;
        });
        describe('closeCase validation', () => {
            beforeEach(() => {
                mockInteraction.options.getString = jest.fn()
                    .mockReturnValueOnce('settled')
                    .mockReturnValueOnce('Case settled out of court');
                // Mock case exists in channel
                caseCommands.getCaseFromChannel = jest.fn().mockResolvedValue({
                    _id: new mongodb_1.ObjectId(),
                    caseNumber: 'CASE-001',
                    clientId: 'client123',
                    leadAttorneyId: 'attorney123',
                    status: 'in_progress',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            });
            it('should validate case permissions before closing', async () => {
                // Mock permission check failure
                mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(false);
                const mockBusinessRuleService = caseCommands.businessRuleValidationService;
                mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
                    valid: false,
                    errors: ['You do not have permission to close cases.'],
                    warnings: [],
                    bypassAvailable: false
                });
                await caseCommands.closeCase('settled', 'Case settled out of court', mockInteraction);
                expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                description: expect.stringContaining('You do not have permission')
                            })
                        })
                    ]),
                    ephemeral: true
                }));
            });
            it('should validate entity before closing case', async () => {
                // Mock all validations as successful
                mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(true);
                const mockBusinessRuleService = caseCommands.businessRuleValidationService;
                mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
                    valid: true,
                    errors: [],
                    warnings: [],
                    bypassAvailable: false
                });
                // Mock case in channel
                caseCommands.getCaseFromChannel = jest.fn().mockResolvedValue({
                    _id: new mongodb_1.ObjectId(),
                    caseNumber: 'CASE-001',
                    clientId: mockUser.id, // User is the client
                    status: 'in_progress',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                // Mock cross-entity validation
                const mockCrossEntityService = caseCommands.crossEntityValidationService;
                mockCrossEntityService.validateBeforeOperation = jest.fn().mockResolvedValue({
                    valid: false,
                    errors: [{ message: 'Case has pending reminders that must be resolved first.' }],
                    warnings: []
                });
                await caseCommands.closeCase('settled', 'Case settled out of court', mockInteraction);
                expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                description: expect.stringContaining('pending reminders')
                            })
                        })
                    ]),
                    ephemeral: true
                }));
            });
        });
    });
    describe('JobsCommands Validation', () => {
        let jobsCommands;
        let mockPermissionService;
        let mockBusinessRuleService;
        beforeEach(() => {
            jobsCommands = new job_commands_1.JobsCommands();
            // Access private services
            mockPermissionService = jobsCommands.permissionService;
            mockBusinessRuleService = jobsCommands.businessRuleValidationService;
        });
        describe('add job validation', () => {
            beforeEach(() => {
                mockInteraction.options.getString = jest.fn()
                    .mockReturnValueOnce('Senior Associate')
                    .mockReturnValueOnce(staff_role_1.StaffRole.SENIOR_ASSOCIATE)
                    .mockReturnValueOnce('We are looking for a Senior Associate...')
                    .mockReturnValueOnce('requirements');
                mockInteraction.options.getInteger = jest.fn().mockReturnValue(2);
            });
            it('should validate HR permissions', async () => {
                // Mock permission check failure
                mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(false);
                mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
                    valid: false,
                    errors: ['You do not have HR permission to manage jobs.'],
                    warnings: [],
                    bypassAvailable: false
                });
                await jobsCommands.add('Senior Associate', 'We are looking for a Senior Associate...', staff_role_1.StaffRole.SENIOR_ASSOCIATE, 'discord-role-id', mockInteraction);
                expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                description: expect.stringContaining('HR permission')
                            })
                        })
                    ]),
                    ephemeral: true
                }));
            });
            it('should validate role limit for job creation', async () => {
                // Mock permission check success
                mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(true);
                mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
                    valid: true,
                    errors: [],
                    warnings: [],
                    bypassAvailable: false
                });
                // Mock role limit validation
                mockBusinessRuleService.validateRoleLimit = jest.fn().mockResolvedValue({
                    valid: false,
                    errors: ['Cannot create job: Senior Associate role limit is already at maximum (10/10).'],
                    warnings: [],
                    bypassAvailable: true
                });
                await jobsCommands.add('Senior Associate', 'We are looking for a Senior Associate...', staff_role_1.StaffRole.SENIOR_ASSOCIATE, 'discord-role-id', mockInteraction);
                expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                description: expect.stringContaining('role limit')
                            })
                        })
                    ]),
                    ephemeral: true
                }));
            });
        });
        describe('apply command validation', () => {
            it('should NOT have validation decorators', async () => {
                // The apply command should bypass validation
                // Mock no permission check - it should proceed without checking
                const mockJobRepo = jobsCommands.jobRepository;
                mockJobRepo.findByFilters = jest.fn().mockResolvedValue([]);
                await jobsCommands.apply(mockInteraction);
                // Should not check permissions
                expect(mockPermissionService.hasActionPermission).not.toHaveBeenCalled();
                // Should show no jobs available
                expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: 'No Open Positions'
                            })
                        })
                    ])
                }));
            });
        });
    });
    describe('Validation Bypass for Guild Owners', () => {
        let staffCommands;
        let mockBusinessRuleService;
        beforeEach(() => {
            staffCommands = new staff_commands_1.StaffCommands();
            mockBusinessRuleService = staffCommands.businessRuleValidationService;
            // Make interaction user the guild owner
            mockGuild.ownerId = mockUser.id;
        });
        it('should show bypass modal for guild owner when role limit reached', async () => {
            mockInteraction.options.getUser = jest.fn().mockReturnValue(mockUser);
            mockInteraction.options.getString = jest.fn()
                .mockReturnValueOnce(staff_role_1.StaffRole.MANAGING_PARTNER)
                .mockReturnValueOnce('testuser')
                .mockReturnValueOnce('Exceptional candidate');
            // Mock permission validation success
            mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
                bypassAvailable: false
            });
            // Mock role limit validation with bypass available
            mockBusinessRuleService.validateRoleLimit = jest.fn().mockResolvedValue({
                valid: false,
                errors: ['Managing Partner role limit reached (1/1).'],
                warnings: [],
                bypassAvailable: true,
                bypassType: 'role_limit'
            });
            const mockCommandValidationService = staffCommands.commandValidationService;
            mockCommandValidationService.validateCommand = jest.fn().mockResolvedValue({
                isValid: false,
                errors: ['Managing Partner role limit reached (1/1).'],
                warnings: [],
                requiresConfirmation: true,
                bypassRequests: [{
                        validationResult: {
                            valid: false,
                            errors: ['Managing Partner role limit reached (1/1).'],
                            warnings: [],
                            bypassAvailable: true
                        },
                        context: {}
                    }]
            });
            await staffCommands.hireStaff(mockUser, staff_role_1.StaffRole.MANAGING_PARTNER, 'testuser', 'Exceptional candidate', mockInteraction);
            // Should show modal for bypass
            expect(mockInteraction.showModal).toHaveBeenCalled();
        });
    });
    describe('Command Validation Integration', () => {
        it('should properly integrate validation services across commands', async () => {
            const staffCommands = new staff_commands_1.StaffCommands();
            const caseCommands = new case_commands_1.CaseCommands();
            const jobsCommands = new job_commands_1.JobsCommands();
            // Verify all commands have validation services initialized
            expect(staffCommands.commandValidationService).toBeDefined();
            expect(staffCommands.businessRuleValidationService).toBeDefined();
            expect(staffCommands.crossEntityValidationService).toBeDefined();
            expect(staffCommands.permissionService).toBeDefined();
            expect(caseCommands.commandValidationService).toBeDefined();
            expect(caseCommands.businessRuleValidationService).toBeDefined();
            expect(caseCommands.crossEntityValidationService).toBeDefined();
            expect(caseCommands.permissionService).toBeDefined();
            expect(jobsCommands.commandValidationService).toBeDefined();
            expect(jobsCommands.businessRuleValidationService).toBeDefined();
            expect(jobsCommands.crossEntityValidationService).toBeDefined();
            expect(jobsCommands.permissionService).toBeDefined();
        });
    });
});
//# sourceMappingURL=command-validation.test.js.map