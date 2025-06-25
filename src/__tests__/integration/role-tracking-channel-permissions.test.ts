import { RoleTrackingService } from '../../application/services/role-tracking-service';
import { ChannelPermissionManager } from '../../application/services/channel-permission-manager';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { PermissionService } from '../../application/services/permission-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { StaffRole } from '../../domain/entities/staff-role';
import { CaseStatus } from '../../domain/entities/case';
import { ChannelType, PermissionFlagsBits, Events } from 'discord.js';

// Mock all repositories and external services
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../application/services/permission-service');
jest.mock('../../application/services/business-rule-validation-service');

describe('Role Tracking Channel Permissions Integration', () => {
  let roleTrackingService: RoleTrackingService;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockAuditLogRepo: jest.Mocked<AuditLogRepository>;
  let mockCaseRepo: jest.Mocked<CaseRepository>;
  let mockGuildConfigRepo: jest.Mocked<GuildConfigRepository>;
  let mockPermissionService: jest.Mocked<PermissionService>;
  let mockBusinessRuleValidationService: jest.Mocked<BusinessRuleValidationService>;

  // Mock Discord objects
  let mockClient: any;
  let mockGuild: any;
  let mockOldMember: any;
  let mockNewMember: any;
  let mockCaseChannel: any;
  let mockStaffChannel: any;
  let mockAdminChannel: any;

  const testGuildId = 'test_guild_123';
  const testUserId = 'user_123';

  beforeEach(() => {
    // Initialize mocked repositories
    mockStaffRepo = new StaffRepository() as jest.Mocked<StaffRepository>;
    mockAuditLogRepo = new AuditLogRepository() as jest.Mocked<AuditLogRepository>;
    mockCaseRepo = new CaseRepository() as jest.Mocked<CaseRepository>;
    mockGuildConfigRepo = new GuildConfigRepository() as jest.Mocked<GuildConfigRepository>;
    mockPermissionService = new PermissionService(mockGuildConfigRepo) as jest.Mocked<PermissionService>;
    mockBusinessRuleValidationService = new BusinessRuleValidationService(
      mockGuildConfigRepo,
      mockStaffRepo,
      mockCaseRepo,
      mockPermissionService
    ) as jest.Mocked<BusinessRuleValidationService>;

    roleTrackingService = new RoleTrackingService();

    // Setup mock channels
    mockCaseChannel = {
      id: 'case_channel_123',
      name: 'case-aa-2024-123-testclient',
      type: ChannelType.GuildText,
      permissionOverwrites: {
        cache: new Map(),
        edit: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true)
      }
    };

    mockStaffChannel = {
      id: 'staff_channel_123',
      name: 'staff-announcements',
      type: ChannelType.GuildText,
      permissionOverwrites: {
        cache: new Map(),
        edit: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true)
      }
    };

    mockAdminChannel = {
      id: 'admin_channel_123',
      name: 'admin-chat',
      type: ChannelType.GuildText,
      permissionOverwrites: {
        cache: new Map(),
        edit: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true)
      }
    };

    // Setup mock guild
    mockGuild = {
      id: testGuildId,
      ownerId: 'owner_123',
      channels: {
        cache: new Map([
          ['case_channel_123', mockCaseChannel],
          ['staff_channel_123', mockStaffChannel],
          ['admin_channel_123', mockAdminChannel]
        ])
      },
      roles: {
        cache: new Map([
          ['paralegal_role', { id: 'paralegal_role', name: 'Paralegal' }],
          ['associate_role', { id: 'associate_role', name: 'Associate' }],
          ['partner_role', { id: 'partner_role', name: 'Managing Partner' }]
        ])
      },
      members: {
        fetch: jest.fn().mockResolvedValue({
          user: { id: testUserId },
          roles: { cache: new Map() }
        })
      }
    };

    // Setup mock members (before and after role change)
    mockOldMember = {
      user: { id: testUserId },
      displayName: 'TestUser',
      guild: mockGuild,
      roles: {
        cache: new Map([['paralegal_role', { id: 'paralegal_role', name: 'Paralegal' }]])
      }
    };

    mockNewMember = {
      user: { id: testUserId },
      displayName: 'TestUser',
      guild: mockGuild,
      roles: {
        cache: new Map([['associate_role', { id: 'associate_role', name: 'Associate' }]])
      }
    };

    // Setup mock Discord client
    mockClient = {
      on: jest.fn(),
      guilds: {
        cache: new Map([[testGuildId, mockGuild]])
      }
    };

    // Setup default repository mocks
    mockStaffRepo.findByUserId.mockResolvedValue(null);
    mockStaffRepo.findStaffByRobloxUsername.mockResolvedValue(null);
    mockStaffRepo.add.mockResolvedValue({} as any);
    mockStaffRepo.update.mockResolvedValue({} as any);
    mockStaffRepo.delete.mockResolvedValue(true);
    mockStaffRepo.findByGuildId.mockResolvedValue([]);

    mockAuditLogRepo.add.mockResolvedValue({} as any);
    mockCaseRepo.findCasesByUserId.mockResolvedValue([]);

    mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      bypassAvailable: false,
      hasPermission: true,
      requiredPermission: 'lawyer',
      grantedPermissions: ['lawyer']
    });
  });

  describe('Role Change Integration', () => {
    it('should update channel permissions when staff is hired', async () => {
      // Setup: New member gets Paralegal role (hiring)
      const noRolesMember = {
        ...mockOldMember,
        roles: { cache: new Map() } // No roles initially
      };
      
      const newParalegalMember = {
        ...mockNewMember,
        roles: { cache: new Map([['paralegal_role', { id: 'paralegal_role', name: 'Paralegal' }]]) }
      };

      // Initialize role tracking
      roleTrackingService.initializeTracking(mockClient);

      // Get the registered event handler
      const eventHandler = mockClient.on.mock.calls.find(
        call => call[0] === Events.GuildMemberUpdate
      )[1];

      // Simulate guild member update event (hiring)
      await eventHandler(noRolesMember, newParalegalMember);

      // Verify staff repository interactions
      expect(mockStaffRepo.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          guildId: testGuildId,
          role: StaffRole.PARALEGAL,
          status: 'active'
        })
      );

      // Verify audit logging
      expect(mockAuditLogRepo.add).toHaveBeenCalled();

      // Verify channel permissions were updated (through mocked calls)
      expect(mockCaseChannel.permissionOverwrites.edit).toHaveBeenCalled();
      expect(mockStaffChannel.permissionOverwrites.edit).toHaveBeenCalled();
    });

    it('should update channel permissions when staff is promoted', async () => {
      // Setup: Existing staff member
      mockStaffRepo.findByUserId.mockResolvedValue({
        _id: 'staff_123',
        userId: testUserId,
        guildId: testGuildId,
        role: StaffRole.PARALEGAL,
        status: 'active',
        promotionHistory: []
      } as any);

      // Setup: Member promoted from Paralegal to Associate
      const oldParalegalMember = {
        ...mockOldMember,
        roles: { cache: new Map([['paralegal_role', { id: 'paralegal_role', name: 'Paralegal' }]]) }
      };
      
      const newAssociateMember = {
        ...mockNewMember,
        roles: { cache: new Map([['associate_role', { id: 'associate_role', name: 'Associate' }]]) }
      };

      // Initialize role tracking
      roleTrackingService.initializeTracking(mockClient);

      // Get the registered event handler
      const eventHandler = mockClient.on.mock.calls.find(
        call => call[0] === Events.GuildMemberUpdate
      )[1];

      // Simulate guild member update event (promotion)
      await eventHandler(oldParalegalMember, newAssociateMember);

      // Verify staff repository interactions (promotion)
      expect(mockStaffRepo.update).toHaveBeenCalledWith(
        'staff_123',
        expect.objectContaining({
          role: StaffRole.JUNIOR_ASSOCIATE, // Maps to Junior Associate
          promotionHistory: expect.arrayContaining([
            expect.objectContaining({
              fromRole: StaffRole.PARALEGAL,
              toRole: StaffRole.JUNIOR_ASSOCIATE,
              actionType: 'promotion'
            })
          ])
        })
      );

      // Verify channel permissions were updated
      expect(mockCaseChannel.permissionOverwrites.edit).toHaveBeenCalled();
      expect(mockStaffChannel.permissionOverwrites.edit).toHaveBeenCalled();
    });

    it('should update channel permissions when staff is fired', async () => {
      // Setup: Existing staff member
      mockStaffRepo.findByUserId.mockResolvedValue({
        _id: 'staff_123',
        userId: testUserId,
        guildId: testGuildId,
        role: StaffRole.PARALEGAL,
        status: 'active'
      } as any);

      // Setup: Member loses all staff roles (firing)
      const oldParalegalMember = {
        ...mockOldMember,
        roles: { cache: new Map([['paralegal_role', { id: 'paralegal_role', name: 'Paralegal' }]]) }
      };
      
      const firedMember = {
        ...mockNewMember,
        roles: { cache: new Map() } // No roles after firing
      };

      // Initialize role tracking
      roleTrackingService.initializeTracking(mockClient);

      // Get the registered event handler
      const eventHandler = mockClient.on.mock.calls.find(
        call => call[0] === Events.GuildMemberUpdate
      )[1];

      // Simulate guild member update event (firing)
      await eventHandler(oldParalegalMember, firedMember);

      // Verify staff repository interactions (deletion)
      expect(mockStaffRepo.delete).toHaveBeenCalledWith('staff_123');

      // Verify channel permissions were revoked
      expect(mockCaseChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
      expect(mockStaffChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
      expect(mockAdminChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
    });

    it('should update channel permissions when staff is demoted', async () => {
      // Setup: Existing staff member
      mockStaffRepo.findByUserId.mockResolvedValue({
        _id: 'staff_123',
        userId: testUserId,
        guildId: testGuildId,
        role: StaffRole.SENIOR_PARTNER,
        status: 'active',
        promotionHistory: []
      } as any);

      // Setup: Member demoted from Managing Partner to Associate
      const oldPartnerMember = {
        ...mockOldMember,
        roles: { cache: new Map([['partner_role', { id: 'partner_role', name: 'Managing Partner' }]]) }
      };
      
      const demotedMember = {
        ...mockNewMember,
        roles: { cache: new Map([['associate_role', { id: 'associate_role', name: 'Associate' }]]) }
      };

      // Initialize role tracking
      roleTrackingService.initializeTracking(mockClient);

      // Get the registered event handler
      const eventHandler = mockClient.on.mock.calls.find(
        call => call[0] === Events.GuildMemberUpdate
      )[1];

      // Simulate guild member update event (demotion)
      await eventHandler(oldPartnerMember, demotedMember);

      // Verify staff repository interactions (demotion)
      expect(mockStaffRepo.update).toHaveBeenCalledWith(
        'staff_123',
        expect.objectContaining({
          role: StaffRole.JUNIOR_ASSOCIATE,
          promotionHistory: expect.arrayContaining([
            expect.objectContaining({
              fromRole: StaffRole.MANAGING_PARTNER,
              toRole: StaffRole.JUNIOR_ASSOCIATE,
              actionType: 'demotion'
            })
          ])
        })
      );

      // Verify channel permissions were updated (reduced access)
      expect(mockCaseChannel.permissionOverwrites.edit).toHaveBeenCalled();
      expect(mockStaffChannel.permissionOverwrites.edit).toHaveBeenCalled();
      // Admin channel access should be revoked
      expect(mockAdminChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
    });
  });

  describe('Channel Permission Integration Scenarios', () => {
    it('should handle role changes affecting case channel access', async () => {
      // Setup: User involved in cases
      mockCaseRepo.findCasesByUserId.mockResolvedValue([
        {
          _id: 'case_1',
          channelId: 'case_channel_123',
          status: CaseStatus.IN_PROGRESS,
          guildId: testGuildId,
          clientId: 'client_123',
          assignedLawyerIds: [testUserId],
          leadAttorneyId: testUserId
        } as any
      ]);

      // Setup promotion that affects case access
      const oldMember = {
        ...mockOldMember,
        roles: { cache: new Map([['associate_role', { id: 'associate_role', name: 'Associate' }]]) }
      };
      
      const newMember = {
        ...mockNewMember,
        roles: { cache: new Map([['partner_role', { id: 'partner_role', name: 'Managing Partner' }]]) }
      };

      // Setup existing staff
      mockStaffRepo.findByUserId.mockResolvedValue({
        _id: 'staff_123',
        userId: testUserId,
        role: StaffRole.JUNIOR_ASSOCIATE,
        status: 'active',
        promotionHistory: []
      } as any);

      // Initialize role tracking
      roleTrackingService.initializeTracking(mockClient);
      const eventHandler = mockClient.on.mock.calls.find(
        call => call[0] === Events.GuildMemberUpdate
      )[1];

      // Simulate promotion
      await eventHandler(oldMember, newMember);

      // Verify case channels were specifically updated
      expect(mockCaseRepo.findCasesByUserId).toHaveBeenCalledWith(testGuildId, testUserId);
      expect(mockCaseChannel.permissionOverwrites.edit).toHaveBeenCalledWith(testUserId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageMessages: true // Managing Partner gets management rights
      });
    });

    it('should handle business rule violations in channel permission updates', async () => {
      // Setup: Business rule validation fails
      mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
        valid: false,
        errors: ['Insufficient permissions for admin channel'],
        warnings: [],
        bypassAvailable: false,
        hasPermission: false,
        requiredPermission: 'admin',
        grantedPermissions: []
      });

      const oldMember = {
        ...mockOldMember,
        roles: { cache: new Map() }
      };
      
      const newMember = {
        ...mockNewMember,
        roles: { cache: new Map([['paralegal_role', { id: 'paralegal_role', name: 'Paralegal' }]]) }
      };

      // Initialize role tracking
      roleTrackingService.initializeTracking(mockClient);
      const eventHandler = mockClient.on.mock.calls.find(
        call => call[0] === Events.GuildMemberUpdate
      )[1];

      // Simulate hiring
      await eventHandler(oldMember, newMember);

      // Should still process successfully despite validation failure
      expect(mockStaffRepo.add).toHaveBeenCalled();
      // Admin channel should be denied
      expect(mockAdminChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
    });

    it('should handle channel permission errors gracefully', async () => {
      // Setup: Channel permission update fails
      mockCaseChannel.permissionOverwrites.edit.mockRejectedValue(new Error('Permission API error'));

      const oldMember = {
        ...mockOldMember,
        roles: { cache: new Map() }
      };
      
      const newMember = {
        ...mockNewMember,
        roles: { cache: new Map([['paralegal_role', { id: 'paralegal_role', name: 'Paralegal' }]]) }
      };

      // Initialize role tracking
      roleTrackingService.initializeTracking(mockClient);
      const eventHandler = mockClient.on.mock.calls.find(
        call => call[0] === Events.GuildMemberUpdate
      )[1];

      // Should not throw error despite channel permission failure
      await expect(eventHandler(oldMember, newMember)).resolves.not.toThrow();

      // Staff should still be created
      expect(mockStaffRepo.add).toHaveBeenCalled();
      // Other channels should still be processed
      expect(mockStaffChannel.permissionOverwrites.edit).toHaveBeenCalled();
    });
  });

  describe('Guild Sync Integration', () => {
    it('should sync channel permissions during guild role sync', async () => {
      // Setup: Existing staff in database
      mockStaffRepo.findByGuildId.mockResolvedValue([
        {
          userId: 'user_1',
          role: StaffRole.MANAGING_PARTNER,
          status: 'active'
        },
        {
          userId: 'user_2',
          role: StaffRole.PARALEGAL,
          status: 'active'
        }
      ] as any[]);

      // Setup: Mock guild members
      const members = new Map();
      members.set('user_1', {
        user: { id: 'user_1' },
        roles: { cache: new Map([['partner_role', { name: 'Managing Partner' }]]) }
      });
      members.set('user_2', {
        user: { id: 'user_2' },
        roles: { cache: new Map([['paralegal_role', { name: 'Paralegal' }]]) }
      });

      mockGuild.members.fetch.mockResolvedValue(members);

      // Perform guild sync
      await roleTrackingService.syncGuildRoles(mockGuild);

      // Verify channel permissions were updated for all active staff
      expect(mockCaseChannel.permissionOverwrites.edit).toHaveBeenCalled();
      expect(mockStaffChannel.permissionOverwrites.edit).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle role tracking errors without breaking channel permissions', async () => {
      // Setup: Staff repository throws error
      mockStaffRepo.findByUserId.mockRejectedValue(new Error('Database connection error'));

      const oldMember = {
        ...mockOldMember,
        roles: { cache: new Map() }
      };
      
      const newMember = {
        ...mockNewMember,
        roles: { cache: new Map([['paralegal_role', { id: 'paralegal_role', name: 'Paralegal' }]]) }
      };

      // Initialize role tracking
      roleTrackingService.initializeTracking(mockClient);
      const eventHandler = mockClient.on.mock.calls.find(
        call => call[0] === Events.GuildMemberUpdate
      )[1];

      // Should handle error gracefully
      await expect(eventHandler(oldMember, newMember)).resolves.not.toThrow();
    });

    it('should handle missing guild/channel references', async () => {
      // Setup: Guild without channels
      const emptyGuild = {
        ...mockGuild,
        channels: { cache: new Map() }
      };

      const memberWithEmptyGuild = {
        ...mockNewMember,
        guild: emptyGuild
      };

      const oldMember = {
        ...mockOldMember,
        roles: { cache: new Map() }
      };

      // Initialize role tracking
      roleTrackingService.initializeTracking(mockClient);
      const eventHandler = mockClient.on.mock.calls.find(
        call => call[0] === Events.GuildMemberUpdate
      )[1];

      // Should handle missing channels gracefully
      await expect(eventHandler(oldMember, memberWithEmptyGuild)).resolves.not.toThrow();
    });

    it('should handle rapid role changes correctly', async () => {
      const baseMembers = Array.from({ length: 3 }, (_, i) => ({
        user: { id: `user_${i}` },
        guild: mockGuild,
        roles: { cache: new Map() }
      }));

      const promotedMembers = baseMembers.map((member, i) => ({
        ...member,
        roles: { cache: new Map([[`role_${i}`, { name: 'Paralegal' }]]) }
      }));

      // Initialize role tracking
      roleTrackingService.initializeTracking(mockClient);
      const eventHandler = mockClient.on.mock.calls.find(
        call => call[0] === Events.GuildMemberUpdate
      )[1];

      // Simulate rapid consecutive role changes
      const promises = baseMembers.map((oldMember, i) =>
        eventHandler(oldMember, promotedMembers[i])
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Verify all role changes were processed
      expect(mockStaffRepo.add).toHaveBeenCalledTimes(3);
    });
  });
});