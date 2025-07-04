import { RoleChangeCascadeService, RoleChangeEvent } from '../../../application/services/role-change-cascade-service';
import { CaseRepository } from '../../../infrastructure/repositories/case-repository';
import { CaseService } from '../../../application/services/case-service';
import { ChannelPermissionManager } from '../../../application/services/channel-permission-manager';
import { AuditLogRepository } from '../../../infrastructure/repositories/audit-log-repository';
import { StaffRepository } from '../../../infrastructure/repositories/staff-repository';
import { 
  Case, 
  CaseStatus, 
  CasePriority,
  Staff,
  StaffRole,
  AuditAction 
} from '../../../validation';
import { Client, GuildMember, Guild, TextChannel, User } from 'discord.js';
import { logger } from '../../../infrastructure/logger';
import { ObjectId } from 'mongodb';


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
    createAALegalEmbed: jest.fn((options): any => {
      const embed: any = {
        data: { ...options, fields: [] },
        addFields: jest.fn((...fields): any => {
          embed.data.fields.push(...fields);
          return embed;
        }),
        setFooter: jest.fn((): any => embed)
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
  let service: RoleChangeCascadeService;
  let mockCaseRepository: jest.Mocked<CaseRepository>;
  let mockCaseService: jest.Mocked<CaseService>;
  let mockChannelPermissionManager: jest.Mocked<ChannelPermissionManager>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
  let mockClient: jest.Mocked<Client>;
  let mockGuildMember: jest.Mocked<GuildMember>;
  let mockGuild: jest.Mocked<Guild>;
  let mockTextChannel: jest.Mocked<TextChannel>;
  let mockUser: jest.Mocked<User>;

  const mockCaseId = new ObjectId().toString();
  const mockCase: Case = {
    _id: mockCaseId,
    guildId: '123456789012345678',
    caseNumber: 'AA-2024-0001-testuser',
    clientId: '123456789012345679',
    clientUsername: 'testclient',
    title: 'Test Case',
    description: 'Test case description',
    status: 'in-progress' as CaseStatus,
    priority: 'high' as CasePriority,
    leadAttorneyId: '123456789012345680',
    assignedLawyerIds: ['123456789012345680', '123456789012345681'],
    channelId: '123456789012345682',
    documents: [],
    notes: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockStaff: Staff = {
    _id: new ObjectId().toString(),
    userId: '123456789012345683',
    guildId: '123456789012345678',
    robloxUsername: 'SeniorPartner',
    role: 'Senior Partner' as StaffRole,
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
    } as any;

    mockAuditLogRepository = {
      add: jest.fn(),
      ...jest.requireMock('../../../infrastructure/repositories/audit-log-repository').AuditLogRepository.prototype
    } as any;

    mockStaffRepository = {
      findByFilters: jest.fn(),
      ...jest.requireMock('../../../infrastructure/repositories/staff-repository').StaffRepository.prototype
    } as any;

    mockCaseService = {
      unassignLawyer: jest.fn(),
      initializeArchiveService: jest.fn(),
      ...jest.requireMock('../../../application/services/case-service').CaseService.prototype
    } as any;

    mockChannelPermissionManager = {
      handleRoleChange: jest.fn(),
      ...jest.requireMock('../../../application/services/channel-permission-manager').ChannelPermissionManager.prototype
    } as any;

    // Mock Discord objects
    mockUser = {
      id: '123456789012345680',
      username: 'TestUser',
      send: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockTextChannel = {
      id: '123456789012345682',
      send: jest.fn().mockResolvedValue(undefined)
    } as any;

    const mockChannels = {
      fetch: jest.fn().mockImplementation((id: string) => {
        if (id === '123456789012345682') {
          return Promise.resolve(mockTextChannel);
        }
        return Promise.resolve(null);
      })
    };

    const mockMembers = {
      fetch: jest.fn().mockImplementation((id: string) => {
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
    } as any;

    mockGuildMember = {
      user: mockUser,
      guild: mockGuild,
      displayName: 'TestUser',
      send: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockClient = {
      guilds: {
        cache: {
          get: jest.fn(),
          has: jest.fn(),
          set: jest.fn(),
          delete: jest.fn()
        }
      }
    } as any;

    // Override constructor mocks
    jest.mocked(CaseRepository).mockImplementation(() => mockCaseRepository);
    jest.mocked(AuditLogRepository).mockImplementation(() => mockAuditLogRepository);
    jest.mocked(StaffRepository).mockImplementation(() => mockStaffRepository);
    jest.mocked(CaseService).mockImplementation(() => mockCaseService);
    jest.mocked(ChannelPermissionManager).mockImplementation(() => mockChannelPermissionManager);
    
    // Mock the additional dependencies
    const { CaseCounterRepository } = require('../../../infrastructure/repositories/case-counter-repository');
    const { GuildConfigRepository } = require('../../../infrastructure/repositories/guild-config-repository');
    const { PermissionService } = require('../../../application/services/permission-service');
    const { UnifiedValidationService } = require('../../../application/validation/unified-validation-service');
    
    jest.mocked(CaseCounterRepository).mockImplementation(() => ({} as any));
    jest.mocked(GuildConfigRepository).mockImplementation(() => ({} as any));
    jest.mocked(PermissionService).mockImplementation(() => ({} as any));
    jest.mocked(UnifiedValidationService).mockImplementation(() => ({} as any));

    // Create service instance
    service = new RoleChangeCascadeService();
    
    // Spy on the private methods we want to test
    (service as any).caseRepository = mockCaseRepository;
    (service as any).caseService = mockCaseService;
    (service as any).channelPermissionManager = mockChannelPermissionManager;
    (service as any).auditLogRepository = mockAuditLogRepository;
    (service as any).staffRepository = mockStaffRepository;
  });

  describe('initialize', () => {
    it('should initialize the service with Discord client', () => {
      service.initialize(mockClient);
      expect(logger.info).toHaveBeenCalledWith('Role change cascade service initialized');
    });
  });

  describe('handleRoleChange', () => {
    beforeEach(() => {
      service.initialize(mockClient);
    });

    describe('when staff member is fired (loses all lawyer permissions)', () => {
      it('should unassign lawyer from all cases', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };
        mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
        mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: ['123456789012345681'] });
        mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
        mockStaffRepository.findByFilters.mockResolvedValue([]);

        await service.handleRoleChange(event);
        
        expect(mockCaseRepository.findByLawyer).toHaveBeenCalledWith('123456789012345680');
        expect(mockCaseService.unassignLawyer).toHaveBeenCalledWith(
          expect.objectContaining({
            guildId: '123456789012345678',
            userId: 'system'
          }),
          mockCaseId.toString(),
          '123456789012345680'
        );
      });

      it('should notify user via DM about case removal', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };
        mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
        mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
        mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
        mockStaffRepository.findByFilters.mockResolvedValue([]);

        await service.handleRoleChange(event);

        expect(mockGuildMember.send).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  title: 'Case Assignment Update'
                })
              })
            ])
          })
        );
      });

      it('should notify case channel about staffing changes', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };
        mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
        mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
        mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
        mockStaffRepository.findByFilters.mockResolvedValue([]);

        await service.handleRoleChange(event);

        expect(mockTextChannel.send).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  title: 'Case Staffing Update'
                })
              })
            ])
          })
        );
      });

      it('should notify senior staff when case has no lawyers left', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };
        mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
        mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
        mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
        mockStaffRepository.findByFilters.mockResolvedValue([mockStaff]);

        await service.handleRoleChange(event);

        // Should send urgent notification to case channel with mentions
        expect(mockTextChannel.send).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('URGENT: This case has no lawyers assigned!'),
            embeds: expect.any(Array)
          })
        );
      });

      it('should update channel permissions', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };
        mockCaseRepository.findByLawyer.mockResolvedValue([]);

        await service.handleRoleChange(event);

        expect(mockChannelPermissionManager.handleRoleChange).toHaveBeenCalledWith(
          mockGuild,
          mockGuildMember,
          'Junior Associate' as StaffRole,
          undefined,
          'fire'
        );
      });

      it('should log audit event', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };
        mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
        mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
        mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
        mockStaffRepository.findByFilters.mockResolvedValue([]);

        await service.handleRoleChange(event);

        expect(mockAuditLogRepository.add).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'staff_fired' as AuditAction,
            actorId: 'system-cascade',
            targetId: '123456789012345680',
            details: expect.objectContaining({
              metadata: expect.objectContaining({
                casesAffected: 1,
                changeType: 'termination'
              })
            })
          })
        );
      });

      it('should handle errors gracefully when DM fails', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };
        mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
        mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
        mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
        mockStaffRepository.findByFilters.mockResolvedValue([]);
        mockGuildMember.send.mockRejectedValue(new Error('Cannot send DM'));

        await service.handleRoleChange(event);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to DM'),
          expect.any(Error)
        );
      });
    });

    describe('when staff member is demoted below Junior Associate', () => {
      it('should unassign from all cases when demoted to paralegal', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Senior Associate' as StaffRole,
          newRole: 'Paralegal' as StaffRole,
          changeType: 'demotion'
        };
        mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
        mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
        mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
        mockStaffRepository.findByFilters.mockResolvedValue([]);

        await service.handleRoleChange(event);

        expect(mockCaseService.unassignLawyer).toHaveBeenCalled();
        expect(mockGuildMember.send).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  description: expect.stringContaining('demotion to a non-lawyer position')
                })
              })
            ])
          })
        );
      });
    });

    describe('when staff member loses lead attorney permissions but keeps lawyer permissions', () => {
      it('should remove lead attorney status but keep as assigned lawyer', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Senior Associate' as StaffRole,
          newRole: 'Junior Associate' as StaffRole,
          changeType: 'demotion'
        };
        const leadCase = { ...mockCase, leadAttorneyId: '123456789012345680' };
        mockCaseRepository.findByLeadAttorney.mockResolvedValue([leadCase]);
        mockCaseRepository.update.mockResolvedValue({ ...leadCase, leadAttorneyId: undefined });

        await service.handleRoleChange(event);

        expect(mockCaseRepository.findByLeadAttorney).toHaveBeenCalledWith('123456789012345680');
        expect(mockCaseRepository.update).toHaveBeenCalledWith(
          mockCaseId.toString(),
          { leadAttorneyId: undefined }
        );
        expect(mockCaseService.unassignLawyer).not.toHaveBeenCalled();
      });

      it('should notify user about lead attorney removal', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Senior Associate' as StaffRole,
          newRole: 'Junior Associate' as StaffRole,
          changeType: 'demotion'
        };
        const leadCase = { ...mockCase, leadAttorneyId: '123456789012345680' };
        mockCaseRepository.findByLeadAttorney.mockResolvedValue([leadCase]);
        mockCaseRepository.update.mockResolvedValue({ ...leadCase, leadAttorneyId: undefined });

        await service.handleRoleChange(event);

        expect(mockGuildMember.send).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  title: 'Lead Attorney Status Update',
                  description: expect.stringContaining('removed as lead attorney')
                })
              })
            ])
          })
        );
      });

      it('should notify case channel about lead attorney removal', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Senior Associate' as StaffRole,
          newRole: 'Junior Associate' as StaffRole,
          changeType: 'demotion'
        };
        const leadCase = { ...mockCase, leadAttorneyId: '123456789012345680' };
        mockCaseRepository.findByLeadAttorney.mockResolvedValue([leadCase]);
        mockCaseRepository.update.mockResolvedValue({ ...leadCase, leadAttorneyId: undefined });

        await service.handleRoleChange(event);

        expect(mockTextChannel.send).toHaveBeenCalledWith(
          expect.objectContaining({
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
          })
        );
      });

      it('should log lead attorney removal audit event', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Senior Associate' as StaffRole,
          newRole: 'Junior Associate' as StaffRole,
          changeType: 'demotion'
        };
        const leadCase = { ...mockCase, leadAttorneyId: '123456789012345680' };
        mockCaseRepository.findByLeadAttorney.mockResolvedValue([leadCase]);
        mockCaseRepository.update.mockResolvedValue({ ...leadCase, leadAttorneyId: undefined });

        await service.handleRoleChange(event);

        expect(mockAuditLogRepository.add).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'staff_demoted' as AuditAction,
            actorId: 'system-cascade',
            targetId: '123456789012345680',
            details: expect.objectContaining({
              metadata: expect.objectContaining({
                leadCasesAffected: 1,
                changeType: 'lead-attorney-removal'
              })
            })
          })
        );
      });
    });

    describe('when staff member is promoted', () => {
      it('should not trigger cascade effects for promotions', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: 'Senior Associate' as StaffRole,
          changeType: 'promotion'
        };
        await service.handleRoleChange(event);

        expect(mockCaseRepository.findByLawyer).not.toHaveBeenCalled();
        expect(mockCaseRepository.findByLeadAttorney).not.toHaveBeenCalled();
        expect(mockCaseService.unassignLawyer).not.toHaveBeenCalled();
        
        // Should still update channel permissions
        expect(mockChannelPermissionManager.handleRoleChange).toHaveBeenCalledWith(
          mockGuild,
          mockGuildMember,
          'Junior Associate' as StaffRole,
          'Senior Associate' as StaffRole,
          'promotion'
        );
      });
    });

    describe('when staff member is hired', () => {
      it('should not trigger cascade effects for new hires', async () => {
        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: undefined,
          newRole: 'Junior Associate' as StaffRole,
          changeType: 'hire'
        };
        await service.handleRoleChange(event);

        expect(mockCaseRepository.findByLawyer).not.toHaveBeenCalled();
        expect(mockCaseService.unassignLawyer).not.toHaveBeenCalled();
        
        // Should still update channel permissions
        expect(mockChannelPermissionManager.handleRoleChange).toHaveBeenCalledWith(
          mockGuild,
          mockGuildMember,
          undefined,
          'Junior Associate' as StaffRole,
          'hire'
        );
      });
    });

    describe('edge cases', () => {
      it('should handle missing case channels gracefully', async () => {
        const caseWithNoChannel = { ...mockCase, channelId: undefined };
        mockCaseRepository.findByLawyer.mockResolvedValue([caseWithNoChannel]);
        mockCaseRepository.findById.mockResolvedValue({ ...caseWithNoChannel, assignedLawyerIds: [] });
        mockCaseService.unassignLawyer.mockResolvedValue(caseWithNoChannel);
        mockStaffRepository.findByFilters.mockResolvedValue([]);

        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };

        await service.handleRoleChange(event);

        expect(mockTextChannel.send).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('should handle channel fetch errors gracefully', async () => {
        mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
        mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
        mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
        mockStaffRepository.findByFilters.mockResolvedValue([]);
        // Override the mock to throw error
        (mockGuild.channels.fetch as jest.Mock).mockRejectedValue(new Error('Channel not found'));

        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };

        await service.handleRoleChange(event);

        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to notify case channel'),
          expect.any(Error)
        );
      });

      it('should handle senior staff DM failures gracefully', async () => {
        mockCaseRepository.findByLawyer.mockResolvedValue([mockCase]);
        mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
        mockCaseService.unassignLawyer.mockResolvedValue(mockCase);
        mockStaffRepository.findByFilters.mockResolvedValue([mockStaff]);
        // Override the mock to throw error
        (mockGuild.members.fetch as jest.Mock).mockRejectedValue(new Error('Member not found'));

        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };

        await service.handleRoleChange(event);

        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to DM senior staff'),
          expect.any(Error)
        );
      });

      it('should handle case processing errors without stopping other cases', async () => {
        const case1 = { ...mockCase, _id: new ObjectId().toString() };
        const case2 = { ...mockCase, _id: new ObjectId().toString(), caseNumber: 'AA-2024-0002-testuser' };
        
        mockCaseRepository.findByLawyer.mockResolvedValue([case1, case2]);
        mockCaseRepository.findById.mockResolvedValue({ ...mockCase, assignedLawyerIds: [] });
        mockCaseService.unassignLawyer
          .mockRejectedValueOnce(new Error('Database error'))
          .mockResolvedValueOnce(case2);
        mockStaffRepository.findByFilters.mockResolvedValue([]);

        const event: RoleChangeEvent = {
          member: mockGuildMember,
          oldRole: 'Junior Associate' as StaffRole,
          newRole: undefined,
          changeType: 'fire'
        };

        await service.handleRoleChange(event);

        expect(mockCaseService.unassignLawyer).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error processing case'),
          expect.any(Error)
        );
      });
    });
  });
});