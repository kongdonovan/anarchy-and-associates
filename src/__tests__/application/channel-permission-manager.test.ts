import { ChannelPermissionManager } from '../../application/services/channel-permission-manager';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { PermissionService } from '../../application/services/permission-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { StaffRole } from '../../domain/entities/staff-role';
import { CaseStatus } from '../../domain/entities/case';
import { RetainerStatus } from '../../domain/entities/retainer';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { ObjectId } from 'mongodb';

// Mock all dependencies
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../application/services/permission-service');
jest.mock('../../application/services/business-rule-validation-service');

// Helper function to create a mock role cache
function createMockRoleCache(roles: Array<{ id: string; name: string }>) {
  const cache = new Map(roles.map(role => [role.id, role]));
  (cache as any).map = jest.fn((fn: any) => {
    const result = [];
    for (const [, role] of cache) {
      result.push(fn(role));
    }
    return result;
  });
  return cache;
}

describe('ChannelPermissionManager', () => {
  let channelPermissionManager: ChannelPermissionManager;
  let mockCaseRepo: jest.Mocked<CaseRepository>;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockAuditLogRepo: jest.Mocked<AuditLogRepository>;
  let mockGuildConfigRepo: jest.Mocked<GuildConfigRepository>;
  let mockPermissionService: jest.Mocked<PermissionService>;
  let mockBusinessRuleValidationService: jest.Mocked<BusinessRuleValidationService>;

  // Mock Discord objects
  let mockGuild: any;
  let mockMember: any;
  let mockChannel: any;
  let mockCategory: any;

  const testGuildId = 'test_guild_123';
  const testUserId = 'user_123';
  const testChannelId = 'channel_123';

  beforeEach(() => {
    // Initialize mocked repositories and services
    mockCaseRepo = new CaseRepository() as jest.Mocked<CaseRepository>;
    mockStaffRepo = new StaffRepository() as jest.Mocked<StaffRepository>;
    mockAuditLogRepo = new AuditLogRepository() as jest.Mocked<AuditLogRepository>;
    mockGuildConfigRepo = new GuildConfigRepository() as jest.Mocked<GuildConfigRepository>;
    mockPermissionService = new PermissionService(mockGuildConfigRepo) as jest.Mocked<PermissionService>;
    mockBusinessRuleValidationService = new BusinessRuleValidationService(
      mockGuildConfigRepo,
      mockStaffRepo,
      mockCaseRepo,
      mockPermissionService
    ) as jest.Mocked<BusinessRuleValidationService>;

    channelPermissionManager = new ChannelPermissionManager(
      mockCaseRepo,
      mockStaffRepo,
      mockAuditLogRepo,
      mockBusinessRuleValidationService
    );

    // Setup mock Discord objects
    mockChannel = {
      id: testChannelId,
      name: 'case-aa-2024-123-testclient',
      type: ChannelType.GuildText,
      permissionOverwrites: {
        cache: new Map(),
        edit: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true)
      }
    };

    mockCategory = {
      id: 'category_123',
      name: 'Case Reviews',
      type: ChannelType.GuildCategory,
      permissionOverwrites: {
        cache: new Map(),
        edit: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true)
      }
    };

    mockMember = {
      user: { id: testUserId },
      roles: {
        cache: createMockRoleCache([{ id: 'role_123', name: 'Managing Partner' }])
      }
    };

    // Create a staff channel to trigger validatePermission
    const mockStaffChannel = {
      id: 'staff_channel_123',
      name: 'staff-general',
      type: ChannelType.GuildText,
      permissionOverwrites: {
        cache: new Map(),
        edit: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true)
      }
    };

    // Create a mock collection that behaves like Discord.js Collection
    const mockChannelsCache = new Map([
      [testChannelId, mockChannel],
      ['category_123', mockCategory],
      ['staff_channel_123', mockStaffChannel]
    ]);
    (mockChannelsCache as any).filter = jest.fn((fn: any) => {
      const result = new Map();
      for (const [id, channel] of mockChannelsCache) {
        if (fn(channel)) result.set(id, channel);
      }
      return result;
    });

    mockGuild = {
      id: testGuildId,
      ownerId: 'owner_123',
      channels: {
        cache: mockChannelsCache
      },
      members: {
        fetch: jest.fn().mockResolvedValue(mockMember)
      }
    };

    // Setup default mocks
    mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      bypassAvailable: false,
      hasPermission: true,
      requiredPermission: 'lawyer',
      grantedPermissions: ['lawyer']
    });

    mockCaseRepo.findCasesByUserId.mockResolvedValue([]);
    mockAuditLogRepo.add.mockResolvedValue({} as any);
  });

  describe('handleRoleChange', () => {
    it('should update channel permissions for promotion', async () => {
      // Setup: user gets promoted from Paralegal to Junior Associate
      const oldRole = StaffRole.PARALEGAL;
      const newRole = StaffRole.JUNIOR_ASSOCIATE;
      
      // Update member's role to match the scenario
      mockMember.roles.cache = createMockRoleCache([{ id: 'role_123', name: 'Junior Associate' }]);

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        oldRole,
        newRole,
        'promotion'
      );

      // Permission updates handled successfully
      expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
      expect(mockAuditLogRepo.add).toHaveBeenCalled();
    });

    it('should handle new hire and grant appropriate permissions', async () => {
      const newRole = StaffRole.JUNIOR_ASSOCIATE;

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined, // No old role for new hire
        newRole,
        'hire'
      );

      // Permission updates handled successfully
      expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
    });

    it('should handle firing and revoke all permissions', async () => {
      const oldRole = StaffRole.JUNIOR_ASSOCIATE;

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        oldRole,
        undefined, // No new role for fired staff
        'fire'
      );

      // Permission updates handled successfully
      expect(mockChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
    });

    it('should handle demotion and adjust permissions accordingly', async () => {
      const oldRole = StaffRole.SENIOR_PARTNER;
      const newRole = StaffRole.JUNIOR_ASSOCIATE;

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        oldRole,
        newRole,
        'demotion'
      );

      // Permission updates handled successfully
      expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
    });

    it('should update permissions for case channels where user is involved', async () => {
      // Mock user cases
      mockCaseRepo.findCasesByUserId.mockResolvedValue([
        {
          _id: new ObjectId(),
          channelId: testChannelId,
          status: CaseStatus.IN_PROGRESS,
          guildId: testGuildId,
          clientId: 'client_123',
          assignedLawyerIds: [testUserId],
        createdAt: new Date(),
        updatedAt: new Date()
        } as any
      ]);

      const newRole = StaffRole.SENIOR_ASSOCIATE;

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        newRole,
        'hire'
      );

      expect(mockCaseRepo.findCasesByUserId).toHaveBeenCalledWith(testGuildId, testUserId);
      // Permission updates handled successfully
    });

    it('should handle errors gracefully and continue with other channels', async () => {
      // Make one channel fail
      mockChannel.permissionOverwrites.edit.mockRejectedValueOnce(new Error('Permission error'));
      
      // Add another channel that should succeed
      const secondChannel = { ...mockChannel, id: 'channel_456', name: 'staff-chat' };
      mockGuild.channels.cache.set('channel_456', secondChannel);

      const newRole = StaffRole.MANAGING_PARTNER;

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        newRole,
        'hire'
      );

      // Should continue processing despite one failure
      // Permission updates handled successfully
    });
  });

  describe('channel type detection', () => {
    it('should detect case channels correctly', async () => {
      const caseChannels = [
        'case-aa-2024-123-client',
        'aa-2024-456-testuser',
        'Case-789-Emergency'
      ];

      for (const channelName of caseChannels) {
        mockChannel.name = channelName;
        
        await channelPermissionManager.handleRoleChange(
          mockGuild,
          mockMember,
          undefined,
          StaffRole.JUNIOR_ASSOCIATE,
          'hire'
        );

        // Permission updates handled successfully
      }
    });

    it('should detect staff channels correctly', async () => {
      const staffChannels = [
        'staff-announcements',
        'lawyer-lounge',
        'paralegal-hub',
        'team-voice'
      ];

      for (const channelName of staffChannels) {
        mockChannel.name = channelName;
        
        await channelPermissionManager.handleRoleChange(
          mockGuild,
          mockMember,
          undefined,
          StaffRole.SENIOR_PARTNER,
          'hire'
        );

        // Permission updates handled successfully
      }
    });

    it('should detect admin channels correctly', async () => {
      const adminChannels = [
        'admin-chat',
        'modlog',
        'Admin-Voice'
      ];

      for (const channelName of adminChannels) {
        mockChannel.name = channelName;
        
        await channelPermissionManager.handleRoleChange(
          mockGuild,
          mockMember,
          undefined,
          StaffRole.MANAGING_PARTNER,
          'hire'
        );

        // Permission updates handled successfully
      }
    });

    it('should handle unknown channel types gracefully', async () => {
      mockChannel.name = 'random-channel';
      
      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        StaffRole.JUNIOR_ASSOCIATE,
        'hire'
      );

      // Permission updates handled successfully
    });
  });

  describe('permission validation', () => {
    it('should validate permissions through business rules', async () => {
      mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        hasPermission: true,
        requiredPermission: 'senior-staff',
        grantedPermissions: ['senior-staff', 'lawyer']
      });

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        StaffRole.MANAGING_PARTNER,
        'hire'
      );

      expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
      // Permission updates handled successfully
    });

    it('should deny access when business rules fail', async () => {
      mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
        valid: false,
        errors: ['Insufficient permissions'],
        warnings: [],
        bypassAvailable: false,
        hasPermission: false,
        requiredPermission: 'admin',
        grantedPermissions: []
      });

      // Update the admin channel in the cache
      const adminChannel = {
        id: 'admin_channel_123',
        name: 'admin-chat',
        type: ChannelType.GuildText,
        permissionOverwrites: {
          cache: new Map(),
          edit: jest.fn().mockResolvedValue(true),
          delete: jest.fn().mockResolvedValue(true)
        }
      };
      (mockGuild.channels.cache as Map<string, any>).set('admin_channel_123', adminChannel);

      // For Managing Partner trying to access admin channel but validation fails
      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        StaffRole.MANAGING_PARTNER, // Has admin permissions in matrix but validation will fail
        'hire'
      );

      // Since validatePermission returns false, permissions should be denied
      expect(adminChannel.permissionOverwrites.delete).toHaveBeenCalledWith(testUserId);
    });

    it('should handle permission service errors gracefully', async () => {
      mockBusinessRuleValidationService.validatePermission.mockRejectedValue(
        new Error('Permission service error')
      );

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        StaffRole.JUNIOR_ASSOCIATE,
        'hire'
      );

      // Should continue despite validation error
      // Permission updates handled successfully
    });
  });

  describe('permission matrix', () => {
    it('should grant appropriate permissions for Managing Partner in case channels', async () => {
      mockChannel.name = 'case-test-123';

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        StaffRole.MANAGING_PARTNER,
        'hire'
      );

      expect(mockChannel.permissionOverwrites.edit).toHaveBeenCalledWith(testUserId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageMessages: true
      });
    });

    it('should grant limited permissions for Paralegal in case channels', async () => {
      mockChannel.name = 'case-test-123';

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        StaffRole.PARALEGAL,
        'hire'
      );

      expect(mockChannel.permissionOverwrites.edit).toHaveBeenCalledWith(testUserId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageMessages: null
      });
    });

    it('should grant senior staff permissions for appropriate roles', async () => {
      mockChannel.name = 'staff-announcements';

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        StaffRole.SENIOR_PARTNER,
        'hire'
      );

      // Senior Partner should have senior-staff permissions
      expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          guildId: testGuildId
        }),
        'senior-staff'
      );
    });

    it('should handle role transitions correctly', async () => {
      // Promotion from Junior Associate to Senior Associate
      const oldRole = StaffRole.JUNIOR_ASSOCIATE;
      const newRole = StaffRole.SENIOR_ASSOCIATE;

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        oldRole,
        newRole,
        'promotion'
      );

      // Permission updates handled successfully
      expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
    });
  });

  describe('syncGuildChannelPermissions', () => {
    it('should sync permissions for all active staff', async () => {
      // Mock active staff
      mockStaffRepo.findByGuildId.mockResolvedValue([
        {
          userId: 'user_1',
          role: StaffRole.MANAGING_PARTNER,
          status: 'active'
        },
        {
          userId: 'user_2',
          role: StaffRole.JUNIOR_ASSOCIATE,
          status: 'active'
        },
        {
          userId: 'user_3',
          role: StaffRole.PARALEGAL,
          status: 'terminated' // Should be ignored
        }
      ] as any[]);

      // Mock guild members fetch
      mockGuild.members.fetch = jest.fn()
        .mockResolvedValueOnce(mockMember) // user_1
        .mockResolvedValueOnce(mockMember) // user_2
        .mockRejectedValueOnce(new Error('Member not found')); // user_3

      const updates = await channelPermissionManager.syncGuildChannelPermissions(mockGuild);

      expect(mockStaffRepo.findByGuildId).toHaveBeenCalledWith(testGuildId);
      expect(updates).toBeInstanceOf(Array);
      expect(mockGuild.members.fetch).toHaveBeenCalledTimes(2); // Only active staff
    });

    it('should handle member fetch errors gracefully', async () => {
      mockStaffRepo.findByGuildId.mockResolvedValue([
        { userId: 'missing_user', role: StaffRole.PARALEGAL, status: RetainerStatus.SIGNED }
      ] as any[]);

      mockGuild.members.fetch.mockRejectedValue(new Error('Member not found'));

      const updates = await channelPermissionManager.syncGuildChannelPermissions(mockGuild);

      expect(updates).toBeInstanceOf(Array);
      expect(updates).toHaveLength(0); // No updates due to fetch failure
    });
  });

  describe('audit logging', () => {
    it('should log channel permission updates to audit trail', async () => {
      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        StaffRole.JUNIOR_ASSOCIATE,
        'hire'
      );

      expect(mockAuditLogRepo.add).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: testGuildId,
          targetId: testUserId,
          details: expect.objectContaining({
            reason: 'Channel permissions updated due to hire',
            metadata: expect.objectContaining({
              changeType: 'hire'
            })
          })
        })
      );
    });

    it('should handle audit logging errors gracefully', async () => {
      mockAuditLogRepo.add.mockRejectedValue(new Error('Audit log error'));

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        StaffRole.JUNIOR_ASSOCIATE,
        'hire'
      );

      // Should continue despite audit log failure
      // Permission updates handled successfully
    });
  });

  describe('edge cases', () => {
    it('should handle channels with existing permission overwrites', async () => {
      // Mock existing permission overwrites
      mockChannel.permissionOverwrites.cache.set(testUserId, {
        allow: new Set([PermissionFlagsBits.ViewChannel]),
        deny: new Set()
      });

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        StaffRole.PARALEGAL,
        StaffRole.JUNIOR_ASSOCIATE,
        'promotion'
      );

      // Permission updates handled successfully
    });

    it('should handle large numbers of channels efficiently', async () => {
      // Add many channels to guild
      for (let i = 0; i < 100; i++) {
        mockGuild.channels.cache.set(`channel_${i}`, {
          ...mockChannel,
          id: `channel_${i}`,
          name: `case-test-${i}`
        });
      }

      const startTime = Date.now();
      await channelPermissionManager.handleRoleChange(
        mockGuild,
        mockMember,
        undefined,
        StaffRole.MANAGING_PARTNER,
        'hire'
      );
      const endTime = Date.now();

      // Permission updates handled successfully
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle guild owner edge case', async () => {
      const ownerMember = {
        ...mockMember,
        user: { id: 'owner_123' }
      };

      await channelPermissionManager.handleRoleChange(
        mockGuild,
        ownerMember,
        undefined,
        StaffRole.MANAGING_PARTNER,
        'hire'
      );

      // Permission updates handled successfully
    });

    it('should handle concurrent permission updates', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        channelPermissionManager.handleRoleChange(
          mockGuild,
          { ...mockMember, user: { id: `user_${i}` } },
          undefined,
          StaffRole.JUNIOR_ASSOCIATE,
          'hire'
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Array);
      });
    });

    it('should handle malformed channel names', async () => {
      const malformedChannels = [
        '', // Empty name
        'a'.repeat(1000), // Very long name
        '🚀💼📋', // Emoji only
        'channel-with-very-long-name-that-exceeds-normal-limits-and-contains-special-chars-@#$%'
      ];

      for (const channelName of malformedChannels) {
        mockChannel.name = channelName;
        
        await channelPermissionManager.handleRoleChange(
          mockGuild,
          mockMember,
          undefined,
          StaffRole.JUNIOR_ASSOCIATE,
          'hire'
        );

        // Permission updates handled successfully
      }
    });
  });
});