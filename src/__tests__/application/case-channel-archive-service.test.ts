import { CaseChannelArchiveService, OrphanedChannelInfo } from '../../application/services/case-channel-archive-service';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { Case, CaseStatus, CasePriority } from '../../domain/entities/case';
import { ChannelType } from 'discord.js';
import { ObjectId } from 'mongodb';


// Mock all dependencies
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../application/services/permission-service');
jest.mock('../../application/services/business-rule-validation-service');

describe('CaseChannelArchiveService', () => {
  let archiveService: CaseChannelArchiveService;
  let mockCaseRepo: jest.Mocked<CaseRepository>;
  let mockGuildConfigRepo: jest.Mocked<GuildConfigRepository>;
  let mockAuditLogRepo: jest.Mocked<AuditLogRepository>;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockPermissionService: jest.Mocked<PermissionService>;
  let mockBusinessRuleValidationService: jest.Mocked<BusinessRuleValidationService>;

  // Mock Discord objects
  let mockGuild: any;
  let mockChannel: any;
  let mockArchiveCategory: any;
  let mockContext: PermissionContext;

  const testGuildId = 'test_guild_123';
  const testChannelId = 'channel_123';
  const testUserId = 'user_123';

  beforeEach(() => {
    // Initialize mocked dependencies
    mockCaseRepo = new CaseRepository() as jest.Mocked<CaseRepository>;
    mockGuildConfigRepo = new GuildConfigRepository() as jest.Mocked<GuildConfigRepository>;
    mockAuditLogRepo = new AuditLogRepository() as jest.Mocked<AuditLogRepository>;
    mockStaffRepo = new StaffRepository() as jest.Mocked<StaffRepository>;
    mockPermissionService = new PermissionService(mockGuildConfigRepo) as jest.Mocked<PermissionService>;
    mockBusinessRuleValidationService = new BusinessRuleValidationService(
      mockGuildConfigRepo,
      mockStaffRepo,
      mockCaseRepo,
      mockPermissionService
    ) as jest.Mocked<BusinessRuleValidationService>;

    archiveService = new CaseChannelArchiveService(
      mockCaseRepo,
      mockGuildConfigRepo,
      mockAuditLogRepo,
      mockPermissionService,
      mockBusinessRuleValidationService
    );

    // Setup mock Discord objects
    mockChannel = {
      id: testChannelId,
      name: 'case-aa-2024-123-testclient',
      type: ChannelType.GuildText,
      parentId: 'original_category_123',
      topic: 'Test case channel',
      edit: jest.fn().mockResolvedValue(true),
      messages: {
        fetch: jest.fn().mockResolvedValue(new Map([
          ['msg1', { createdAt: new Date('2024-01-01') }]
        ]))
      }
    };

    mockArchiveCategory = {
      id: 'archive_category_123',
      name: '🗃️ Case Archives',
      type: ChannelType.GuildCategory
    };

    mockGuild = {
      id: testGuildId,
      channels: {
        cache: new Map([
          [testChannelId, mockChannel],
          ['archive_category_123', mockArchiveCategory]
        ]),
        create: jest.fn().mockResolvedValue(mockArchiveCategory)
      },
      roles: {
        everyone: { id: 'everyone_role' },
        cache: new Map([
          ['managing_partner_role', { id: 'managing_partner_role', name: 'Managing Partner' }],
          ['senior_partner_role', { id: 'senior_partner_role', name: 'Senior Partner' }]
        ])
      }
    };

    mockContext = {
      guildId: testGuildId,
      userId: testUserId,
      userRoles: ['managing_partner_role'],
      isGuildOwner: false
    };

    // Setup default mocks
    mockPermissionService.hasActionPermission.mockResolvedValue(true);
    mockGuildConfigRepo.findByGuildId.mockResolvedValue({
      _id: new ObjectId('507f1f77bcf86cd799439011'),
      guildId: testGuildId,
      caseArchiveCategoryId: 'archive_category_123',
      permissions: {
        admin: [],
        'senior-staff': [],
        case: [],
        config: [],
        lawyer: [],
        'lead-attorney': [],
        repair: []
      },
      adminRoles: [],
      adminUsers: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mockAuditLogRepo.add.mockResolvedValue({} as any);
  });

  describe('archiveCaseChannel', () => {
    it('should archive a case channel successfully', async () => {
      const caseData: Partial<Case> = {
        _id: new ObjectId('507f1f77bcf86cd799439012'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: CasePriority.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId,
        closedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      } as Case;

      const result = await archiveService.archiveCaseChannel(mockGuild, caseData as Case, mockContext);

      expect(result.success).toBe(true);
      expect(result.channelId).toBe(testChannelId);
      expect(result.archiveCategoryId).toBe('archive_category_123');
      expect(result.caseNumber).toBe('AA-2024-123');
      expect(mockChannel.edit).toHaveBeenCalledWith({
        name: '[ARCHIVED]-case-aa-2024-123-testclient',
        parent: 'archive_category_123',
        topic: expect.stringContaining('Archived:'),
        permissionOverwrites: expect.any(Array)
      });
      expect(mockAuditLogRepo.add).toHaveBeenCalled();
    });

    it('should handle case with no channel', async () => {
      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439013'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: CasePriority.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        createdAt: new Date(),
        updatedAt: new Date()
        // No channelId
      };

      const result = await archiveService.archiveCaseChannel(mockGuild, caseData, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Case has no associated channel');
    });

    it('should handle channel not found in guild', async () => {
      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439014'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: CasePriority.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: 'nonexistent_channel',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await archiveService.archiveCaseChannel(mockGuild, caseData, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel not found in guild');
    });

    it('should handle insufficient permissions', async () => {
      mockPermissionService.hasActionPermission.mockResolvedValue(false);

      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439015'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: CasePriority.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(archiveService.archiveCaseChannel(mockGuild, caseData, mockContext))
        .rejects.toThrow('Insufficient permissions to archive case channels');
    });

    it('should create archive category if it does not exist', async () => {
      // Remove existing archive category
      mockGuild.channels.cache.delete('archive_category_123');
      mockGuildConfigRepo.findByGuildId.mockResolvedValue({
        _id: new ObjectId('507f1f77bcf86cd799439016'),
        guildId: testGuildId,
        // No caseArchiveCategoryId
        permissions: {
        admin: [],
        'senior-staff': [],
        case: [],
        config: [],
        lawyer: [],
        'lead-attorney': [],
        repair: []
      },
        adminRoles: [],
        adminUsers: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439017'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: CasePriority.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await archiveService.archiveCaseChannel(mockGuild, caseData, mockContext);

      expect(mockGuild.channels.create).toHaveBeenCalledWith({
        name: '🗃️ Case Archives',
        type: ChannelType.GuildCategory,
        permissionOverwrites: expect.any(Array)
      });
      expect(result.success).toBe(true);
    });
  });

  describe('archiveClosedCaseChannels', () => {
    it('should archive multiple closed case channels', async () => {
      const closedCases: Case[] = [
        {
          _id: new ObjectId('507f1f77bcf86cd799439001'),
          guildId: testGuildId,
          caseNumber: 'AA-2024-001',
          clientId: 'client_1',
          clientUsername: 'client1',
          title: 'Case 1',
          description: 'Description 1',
          status: CaseStatus.CLOSED,
          priority: CasePriority.MEDIUM,
          assignedLawyerIds: [],
          documents: [],
          notes: [],
          channelId: 'channel_1',
          closedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439002'),
          guildId: testGuildId,
          caseNumber: 'AA-2024-002',
          clientId: 'client_2',
          clientUsername: 'client2',
          title: 'Case 2',
          description: 'Description 2',
          status: CaseStatus.CLOSED,
          priority: CasePriority.MEDIUM,
          assignedLawyerIds: [],
          documents: [],
          notes: [],
          channelId: 'channel_2',
          closedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (too recent)
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockCaseRepo.findByGuildAndStatus.mockResolvedValue(closedCases);

      // Add mock channels to guild
      mockGuild.channels.cache.set('channel_1', {
        ...mockChannel,
        id: 'channel_1',
        name: 'case-aa-2024-001-client1'
      });
      mockGuild.channels.cache.set('channel_2', {
        ...mockChannel,
        id: 'channel_2',
        name: 'case-aa-2024-002-client2'
      });

      const results = await archiveService.archiveClosedCaseChannels(mockGuild, mockContext);

      expect(results).toHaveLength(1); // Only case_1 should be archived (case_2 is too recent)
      expect(results[0]!.success).toBe(true);
      expect(results[0]!.channelId).toBe('channel_1');
    });

    it('should handle permission check failure', async () => {
      mockPermissionService.hasActionPermission.mockResolvedValue(false);

      await expect(archiveService.archiveClosedCaseChannels(mockGuild, mockContext))
        .rejects.toThrow('Insufficient permissions to archive case channels');
    });
  });

  describe('findOrphanedCaseChannels', () => {
    it('should find orphaned case channels', async () => {
      // Setup additional channels that look like case channels
      const orphanedChannel = {
        id: 'orphaned_channel_123',
        name: 'case-aa-2024-999-orphaned',
        type: ChannelType.GuildText,
        parentId: 'some_category',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map([
            ['msg1', { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }] // 10 days old
          ]))
        }
      };

      mockGuild.channels.cache.set('orphaned_channel_123', orphanedChannel);

      // Mock case repository to return no cases for orphaned channel
      mockCaseRepo.findByFilters.mockResolvedValue([]);

      const orphanedChannels = await archiveService.findOrphanedCaseChannels(mockGuild, mockContext);

      expect(orphanedChannels).toHaveLength(1);
      expect(orphanedChannels[0]?.channelId).toBe('orphaned_channel_123');
      expect(orphanedChannels[0]?.channelName).toBe('case-aa-2024-999-orphaned');
      expect(orphanedChannels[0]?.inactiveDays).toBe(10);
      expect(orphanedChannels[0]?.shouldArchive).toBe(true);
    });

    it('should ignore non-case channels', async () => {
      // Add a non-case channel
      const regularChannel = {
        id: 'regular_channel_123',
        name: 'general-chat',
        type: ChannelType.GuildText
      };

      mockGuild.channels.cache.set('regular_channel_123', regularChannel);
      mockCaseRepo.findByFilters.mockResolvedValue([]);

      const orphanedChannels = await archiveService.findOrphanedCaseChannels(mockGuild, mockContext);

      // Should not include the regular channel
      expect(orphanedChannels.find(c => c.channelId === 'regular_channel_123')).toBeUndefined();
    });

    it('should handle permission check failure', async () => {
      mockPermissionService.hasActionPermission.mockResolvedValue(false);

      await expect(archiveService.findOrphanedCaseChannels(mockGuild, mockContext))
        .rejects.toThrow('Insufficient permissions to scan for orphaned channels');
    });
  });

  describe('archiveOrphanedChannels', () => {
    it('should archive eligible orphaned channels', async () => {
      const orphanedChannels: OrphanedChannelInfo[] = [
        {
          channelId: 'orphaned_1',
          channelName: 'case-aa-2024-001-old',
          inactiveDays: 10,
          shouldArchive: true,
          shouldDelete: false
        },
        {
          channelId: 'orphaned_2',
          channelName: 'case-aa-2024-002-recent',
          inactiveDays: 3,
          shouldArchive: false,
          shouldDelete: false
        }
      ];

      // Add mock channels
      mockGuild.channels.cache.set('orphaned_1', {
        ...mockChannel,
        id: 'orphaned_1',
        name: 'case-aa-2024-001-old'
      });

      const results = await archiveService.archiveOrphanedChannels(
        mockGuild,
        orphanedChannels,
        mockContext
      );

      expect(results).toHaveLength(1); // Only orphaned_1 should be archived
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.channelId).toBe('orphaned_1');
    });

    it('should handle missing channels gracefully', async () => {
      const orphanedChannels: OrphanedChannelInfo[] = [
        {
          channelId: 'missing_channel',
          channelName: 'case-aa-2024-999-missing',
          inactiveDays: 10,
          shouldArchive: true,
          shouldDelete: false
        }
      ];

      const results = await archiveService.archiveOrphanedChannels(
        mockGuild,
        orphanedChannels,
        mockContext
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toBe('Channel not found');
    });
  });

  describe('error handling', () => {
    it('should handle Discord API errors gracefully', async () => {
      mockChannel.edit.mockRejectedValue(new Error('Discord API error'));

      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439018'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: CasePriority.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(archiveService.archiveCaseChannel(mockGuild, caseData, mockContext))
        .rejects.toThrow('Discord API error');
    });

    it('should handle audit logging failures gracefully', async () => {
      mockAuditLogRepo.add.mockRejectedValue(new Error('Audit log error'));

      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439019'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: CasePriority.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Should still succeed despite audit log failure
      const result = await archiveService.archiveCaseChannel(mockGuild, caseData, mockContext);
      expect(result.success).toBe(true);
    });
  });

  describe('configuration handling', () => {
    it('should use default configuration when guild config is missing', async () => {
      mockGuildConfigRepo.findByGuildId.mockResolvedValue(null);

      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439020'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: CasePriority.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId,
        closedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await archiveService.archiveCaseChannel(mockGuild, caseData, mockContext);
      expect(result.success).toBe(true); // Should use default config
    });

    it('should handle guild config repository errors', async () => {
      mockGuildConfigRepo.findByGuildId.mockRejectedValue(new Error('Database error'));

      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439021'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: CasePriority.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Should fallback to default config
      const result = await archiveService.archiveCaseChannel(mockGuild, caseData, mockContext);
      expect(result.success).toBe(true);
    });
  });
});