"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const role_change_cascade_service_1 = require("../../../application/services/role-change-cascade-service");
const case_repository_1 = require("../../../infrastructure/repositories/case-repository");
const case_service_1 = require("../../../application/services/case-service");
const channel_permission_manager_1 = require("../../../application/services/channel-permission-manager");
const audit_log_repository_1 = require("../../../infrastructure/repositories/audit-log-repository");
const staff_repository_1 = require("../../../infrastructure/repositories/staff-repository");
const logger_1 = require("../../../infrastructure/logger");
const mongodb_1 = require("mongodb");
jest.mock('../../../infrastructure/repositories/case-repository');
jest.mock('../../../infrastructure/repositories/audit-log-repository');
jest.mock('../../../infrastructure/repositories/staff-repository');
jest.mock('../../../infrastructure/repositories/guild-config-repository');
jest.mock('../../../infrastructure/repositories/case-counter-repository');
jest.mock('../../../application/services/case-service');
jest.mock('../../../application/services/channel-permission-manager');
jest.mock('../../../application/services/permission-service');
jest.mock('../../../application/validation/unified-validation-service');
jest.mock('../../../infrastructure/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));
jest.mock('../../../infrastructure/utils/embed-utils', () => ({
    EmbedUtils: {
        createAALegalEmbed: jest.fn((options) => {
            const embed = {
                data: { ...options, fields: [] },
                addFields: jest.fn((...fields) => {
                    embed.data.fields.push(...fields);
                    return embed;
                }),
                setFooter: jest.fn(() => embed)
            };
            return embed;
        }),
        createSuccessEmbed: jest.fn((title, description) => ({
            data: { title, description, color: 'success' }
        })),
        createErrorEmbed: jest.fn((title, description) => ({
            data: { title, description, color: 'error' }
        }))
    }
}));
describe('RoleChangeCascadeService', () => {
    let service;
    let mockCaseRepository;
    let mockCaseService;
    let mockChannelPermissionManager;
    let mockAuditLogRepository;
    let mockStaffRepository;
    let mockClient;
    let mockGuildMember;
    let mockGuild;
    let mockTextChannel;
    let mockUser;
    const mockCaseId = new mongodb_1.ObjectId().toString();
    const mockCase = {
        _id: mockCaseId,
        guildId: '123456789012345678',
        caseNumber: 'AA-2024-0001-testuser',
        clientId: '123456789012345679',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: 'in-progress',
        priority: 'high',
        leadAttorneyId: '123456789012345680',
        assignedLawyerIds: ['123456789012345680', '123456789012345681'],
        channelId: '123456789012345682',
        documents: [],
        notes: [],
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const mockStaff = {
        _id: new mongodb_1.ObjectId().toString(),
        userId: '123456789012345683',
        guildId: '123456789012345678',
        robloxUsername: 'SeniorPartner',
        role: 'Senior Partner',
        hiredAt: new Date(),
        hiredBy: '123456789012345684',
        promotionHistory: [],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        // Create mock instances
        mockCaseRepository = {
            findByLawyer: jest.fn(),
            findByLeadAttorney: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            ...jest.requireMock('../../../infrastructure/repositories/case-repository').CaseRepository.prototype
        };
        mockAuditLogRepository = {
            add: jest.fn(),
            ...jest.requireMock('../../../infrastructure/repositories/audit-log-repository').AuditLogRepository.prototype
        };
        mockStaffRepository = {
            findByFilters: jest.fn(),
            ...jest.requireMock('../../../infrastructure/repositories/staff-repository').StaffRepository.prototype
        };
        mockCaseService = {
            unassignLawyer: jest.fn(),
            initializeArchiveService: jest.fn(),
            ...jest.requireMock('../../../application/services/case-service').CaseService.prototype
        };
        mockChannelPermissionManager = {
            handleRoleChange: jest.fn(),
            ...jest.requireMock('../../../application/services/channel-permission-manager').ChannelPermissionManager.prototype
        };
        // Mock Discord objects
        mockUser = {
            id: '123456789012345680',
            username: 'TestUser',
            send: jest.fn().mockResolvedValue(undefined)
        };
        mockTextChannel = {
            id: '123456789012345682',
            send: jest.fn().mockResolvedValue(undefined)
        };
        const mockChannels = {
            fetch: jest.fn().mockImplementation((id) => {
                if (id === '123456789012345682') {
                    return Promise.resolve(mockTextChannel);
                }
                return Promise.resolve(null);
            })
        };
        const mockMembers = {
            fetch: jest.fn().mockImplementation((id) => {
                if (id === '123456789012345683') {
                    return Promise.resolve({
                        user: { id: '123456789012345683' },
                        send: jest.fn().mockResolvedValue(undefined)
                    });
                }
                return Promise.resolve(null);
            })
        };
        mockGuild = {
            id: '123456789012345678',
            channels: mockChannels,
            members: mockMembers
        };
        mockGuildMember = {
            user: mockUser,
            guild: mockGuild,
            displayName: 'TestUser',
            send: jest.fn().mockResolvedValue(undefined)
        };
        mockClient = {
            guilds: {
                cache: {
                    get: jest.fn(),
                    has: jest.fn(),
                    set: jest.fn(),
                    delete: jest.fn()
                }
            }
        };
        // Override constructor mocks
        jest.mocked(case_repository_1.CaseRepository).mockImplementation(() => mockCaseRepository);
        jest.mocked(audit_log_repository_1.AuditLogRepository).mockImplementation(() => mockAuditLogRepository);
        jest.mocked(staff_repository_1.StaffRepository).mockImplementation(() => mockStaffRepository);
        jest.mocked(case_service_1.CaseService).mockImplementation(() => mockCaseService);
        jest.mocked(channel_permission_manager_1.ChannelPermissionManager).mockImplementation(() => mockChannelPermissionManager);
        // Mock the additional dependencies
        const { CaseCounterRepository } = require('../../../infrastructure/repositories/case-counter-repository');
        const { GuildConfigRepository } = require('../../../infrastructure/repositories/guild-config-repository');
        const { PermissionService } = require('../../../application/services/permission-service');
        const { UnifiedValidationService } = require('../../../application/validation/unified-validation-service');
        jest.mocked(CaseCounterRepository).mockImplementation(() => ({}));
        jest.mocked(GuildConfigRepository).mockImplementation(() => ({}));
        jest.mocked(PermissionService).mockImplementation(() => ({}));
        jest.mocked(UnifiedValidationService).mockImplementation(() => ({}));
        // Create service instance
        service = new role_change_cascade_service_1.RoleChangeCascadeService();
        // Spy on the private methods we want to test
        service.caseRepository = mockCaseRepository;
        service.caseService = mockCaseService;
        service.channelPermissionManager = mockChannelPermissionManager;
        service.auditLogRepository = mockAuditLogRepository;
        service.staffRepository = mockStaffRepository;
    });
    describe('initialize', () => {
        it('should initialize the service with Discord client', () => {
            service.initialize(mockClient);
            expect(logger_1.logger.info).toHaveBeenCalledWith('Role change cascade service initialized');
        });
    });
    describe('handleRoleChange', () => {
        beforeEach(() => {
            service.initialize(mockClient);
        });
        describe('when staff member is fired (loses all lawyer permissions)', () => {
            it('should unassign lawyer from all cases', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
                mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: ['123456789012345681'] });
                mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
                mockStaffRepository.findByFilters.mockResolvedValue([]);
                await service.handleRoleChange(event);
                expect(mockCaseRepository.findByLawyer).toHaveBeenCalledWith('123456789012345680');
                expect(mockCaseService.unassignLawyer).toHaveBeenCalledWith(expect.objectContaining({
                    guildId: '123456789012345678',
                    userId: 'system'
                }), mockCaseId.toString(), '123456789012345680');
            });
            it('should notify user via DM about case removal', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
                mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
                mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
                mockStaffRepository.findByFilters.mockResolvedValue([]);
                await service.handleRoleChange(event);
                expect(mockGuildMember.send).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: 'Case Assignment Update'
                            })
                        })
                    ])
                }));
            });
            it('should notify case channel about staffing changes', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
                mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
                mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
                mockStaffRepository.findByFilters.mockResolvedValue([]);
                await service.handleRoleChange(event);
                expect(mockTextChannel.send).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: 'Case Staffing Update'
                            })
                        })
                    ])
                }));
            });
            it('should notify senior staff when case has no lawyers left', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
                mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
                mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
                mockStaffRepository.findByFilters.mockResolvedValue([mockStaff]);
                await service.handleRoleChange(event);
                // Should send urgent notification to case channel with mentions
                expect(mockTextChannel.send).toHaveBeenCalledWith(expect.objectContaining({
                    content: expect.stringContaining('URGENT: This case has no lawyers assigned!'),
                    embeds: expect.any(Array)
                }));
            });
            it('should update channel permissions', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                mockCaseRepository.findByLawyer.mockResolvedValue([]);
                await service.handleRoleChange(event);
                expect(mockChannelPermissionManager.handleRoleChange).toHaveBeenCalledWith(mockGuild, mockGuildMember, 'Junior Associate', undefined, 'fire');
            });
            it('should log audit event', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
                mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
                mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
                mockStaffRepository.findByFilters.mockResolvedValue([]);
                await service.handleRoleChange(event);
                expect(mockAuditLogRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                    action: 'staff_fired',
                    actorId: 'system-cascade',
                    targetId: '123456789012345680',
                    details: expect.objectContaining({
                        metadata: expect.objectContaining({
                            casesAffected: 1,
                            changeType: 'termination'
                        })
                    })
                }));
            });
            it('should handle errors gracefully when DM fails', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
                mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
                mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
                mockStaffRepository.findByFilters.mockResolvedValue([]);
                mockGuildMember.send.mockRejectedValue(new Error('Cannot send DM'));
                await service.handleRoleChange(event);
                expect(logger_1.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to DM'), expect.any(Error));
            });
        });
        describe('when staff member is demoted below Junior Associate', () => {
            it('should unassign from all cases when demoted to paralegal', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Senior Associate',
                    newRole: 'Paralegal',
                    changeType: 'demotion'
                };
                mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
                mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
                mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
                mockStaffRepository.findByFilters.mockResolvedValue([]);
                await service.handleRoleChange(event);
                expect(mockCaseService.unassignLawyer).toHaveBeenCalled();
                expect(mockGuildMember.send).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                description: expect.stringContaining('demotion to a non-lawyer position')
                            })
                        })
                    ])
                }));
            });
        });
        describe('when staff member loses lead attorney permissions but keeps lawyer permissions', () => {
            it('should remove lead attorney status but keep as assigned lawyer', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Senior Associate',
                    newRole: 'Junior Associate',
                    changeType: 'demotion'
                };
                const leadCase = { ...mockCase, leadAttorneyId: '123456789012345680' };
                mockCaseRepository.findByLeadAttorney.mockResolvedValue([leadCase]);
                mockCaseRepository.update.mockResolvedValue({ ...leadCase, leadAttorneyId: undefined });
                await service.handleRoleChange(event);
                expect(mockCaseRepository.findByLeadAttorney).toHaveBeenCalledWith('123456789012345680');
                expect(mockCaseRepository.update).toHaveBeenCalledWith(mockCaseId.toString(), { leadAttorneyId: undefined });
                expect(mockCaseService.unassignLawyer).not.toHaveBeenCalled();
            });
            it('should notify user about lead attorney removal', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Senior Associate',
                    newRole: 'Junior Associate',
                    changeType: 'demotion'
                };
                const leadCase = { ...mockCase, leadAttorneyId: '123456789012345680' };
                mockCaseRepository.findByLeadAttorney.mockResolvedValue([leadCase]);
                mockCaseRepository.update.mockResolvedValue({ ...leadCase, leadAttorneyId: undefined });
                await service.handleRoleChange(event);
                expect(mockGuildMember.send).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: 'Lead Attorney Status Update',
                                description: expect.stringContaining('removed as lead attorney')
                            })
                        })
                    ])
                }));
            });
            it('should notify case channel about lead attorney removal', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Senior Associate',
                    newRole: 'Junior Associate',
                    changeType: 'demotion'
                };
                const leadCase = { ...mockCase, leadAttorneyId: '123456789012345680' };
                mockCaseRepository.findByLeadAttorney.mockResolvedValue([leadCase]);
                mockCaseRepository.update.mockResolvedValue({ ...leadCase, leadAttorneyId: undefined });
                await service.handleRoleChange(event);
                expect(mockTextChannel.send).toHaveBeenCalledWith(expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: 'Lead Attorney Update',
                                fields: expect.arrayContaining([
                                    expect.objectContaining({
                                        name: 'Action Required',
                                        value: expect.stringContaining('assign a new lead attorney')
                                    })
                                ])
                            })
                        })
                    ])
                }));
            });
            it('should log lead attorney removal audit event', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Senior Associate',
                    newRole: 'Junior Associate',
                    changeType: 'demotion'
                };
                const leadCase = { ...mockCase, leadAttorneyId: '123456789012345680' };
                mockCaseRepository.findByLeadAttorney.mockResolvedValue([leadCase]);
                mockCaseRepository.update.mockResolvedValue({ ...leadCase, leadAttorneyId: undefined });
                await service.handleRoleChange(event);
                expect(mockAuditLogRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                    action: 'staff_demoted',
                    actorId: 'system-cascade',
                    targetId: '123456789012345680',
                    details: expect.objectContaining({
                        metadata: expect.objectContaining({
                            leadCasesAffected: 1,
                            changeType: 'lead-attorney-removal'
                        })
                    })
                }));
            });
        });
        describe('when staff member is promoted', () => {
            it('should not trigger cascade effects for promotions', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: 'Senior Associate',
                    changeType: 'promotion'
                };
                await service.handleRoleChange(event);
                expect(mockCaseRepository.findByLawyer).not.toHaveBeenCalled();
                expect(mockCaseRepository.findByLeadAttorney).not.toHaveBeenCalled();
                expect(mockCaseService.unassignLawyer).not.toHaveBeenCalled();
                // Should still update channel permissions
                expect(mockChannelPermissionManager.handleRoleChange).toHaveBeenCalledWith(mockGuild, mockGuildMember, 'Junior Associate', 'Senior Associate', 'promotion');
            });
        });
        describe('when staff member is hired', () => {
            it('should not trigger cascade effects for new hires', async () => {
                const event = {
                    member: mockGuildMember,
                    oldRole: undefined,
                    newRole: 'Junior Associate',
                    changeType: 'hire'
                };
                await service.handleRoleChange(event);
                expect(mockCaseRepository.findByLawyer).not.toHaveBeenCalled();
                expect(mockCaseService.unassignLawyer).not.toHaveBeenCalled();
                // Should still update channel permissions
                expect(mockChannelPermissionManager.handleRoleChange).toHaveBeenCalledWith(mockGuild, mockGuildMember, undefined, 'Junior Associate', 'hire');
            });
        });
        describe('edge cases', () => {
            it('should handle missing case channels gracefully', async () => {
                const caseWithNoChannel = { ...mockCase, channelId: undefined };
                mockCaseRepository.findByLawyer.mockResolvedValue([caseWithNoChannel]);
                mockCaseRepository.findById.mockResolvedValue({ ...caseWithNoChannel, assignedLawyerIds: [] });
                mockCaseService.unassignLawyer.mockResolvedValue(caseWithNoChannel);
                mockStaffRepository.findByFilters.mockResolvedValue([]);
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                await service.handleRoleChange(event);
                expect(mockTextChannel.send).not.toHaveBeenCalled();
                expect(logger_1.logger.error).not.toHaveBeenCalled();
            });
            it('should handle channel fetch errors gracefully', async () => {
                mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
                mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
                mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
                mockStaffRepository.findByFilters.mockResolvedValue([]);
                // Override the mock to throw error
                mockGuild.channels.fetch.mockRejectedValue(new Error('Channel not found'));
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                await service.handleRoleChange(event);
                expect(logger_1.logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to notify case channel'), expect.any(Error));
            });
            it('should handle senior staff DM failures gracefully', async () => {
                mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
                mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
                mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
                mockStaffRepository.findByFilters.mockResolvedValue([mockStaff]);
                // Override the mock to throw error
                mockGuild.members.fetch.mockRejectedValue(new Error('Member not found'));
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                await service.handleRoleChange(event);
                expect(logger_1.logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to DM senior staff'), expect.any(Error));
            });
            it('should handle case processing errors without stopping other cases', async () => {
                const case1 = { ...mockCase, _id: new mongodb_1.ObjectId().toString() };
                const case2 = { ...mockCase, _id: new mongodb_1.ObjectId().toString(), caseNumber: 'AA-2024-0002-testuser' };
                mockCaseRepository.findByLawyer.mockResolvedValue([case1, case2]);
                mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
                mockCaseService.unassignLawyer
                    .mockRejectedValueOnce(new Error('Database error'))
                    .mockResolvedValueOnce(case2);
                mockStaffRepository.findByFilters.mockResolvedValue([]);
                const event = {
                    member: mockGuildMember,
                    oldRole: 'Junior Associate',
                    newRole: undefined,
                    changeType: 'fire'
                };
                await service.handleRoleChange(event);
                expect(mockCaseService.unassignLawyer).toHaveBeenCalledTimes(2);
                expect(logger_1.logger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing case'), expect.any(Error));
            });
        });
    });
});
//# sourceMappingURL=role-change-cascade-service.test.js.map