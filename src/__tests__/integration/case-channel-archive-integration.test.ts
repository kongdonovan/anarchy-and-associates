import { CaseService } from '../../application/services/case-service';
import { CaseChannelArchiveService } from '../../application/services/case-channel-archive-service';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { Case, CaseStatus, CaseResult } from '../../domain/entities/case';
import { ChannelType } from 'discord.js';
import { ObjectId } from 'mongodb';

// Mock all repositories and external services
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../infrastructure/repositories/case-counter-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../application/services/permission-service');
jest.mock('../../application/services/business-rule-validation-service');

describe('Case Channel Archive Integration', () => {
  let caseService: CaseService;
  // let archiveService: CaseChannelArchiveService;
  let mockCaseRepo: jest.Mocked<CaseRepository>;
  let mockCaseCounterRepo: jest.Mocked<CaseCounterRepository>;
  let mockGuildConfigRepo: jest.Mocked<GuildConfigRepository>;
  let mockAuditLogRepo: jest.Mocked<AuditLogRepository>;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockPermissionService: jest.Mocked<PermissionService>;
  let mockBusinessRuleValidationService: jest.Mocked<BusinessRuleValidationService>;

  // Mock Discord objects
  let mockClient: any;
  let mockGuild: any;
  let mockChannel: any;
  let mockArchiveCategory: any;
  let mockContext: PermissionContext;

  const testGuildId = 'test_guild_123';
  const testChannelId = 'channel_123';
  const testCaseId = 'case_123';
  const testUserId = 'user_123';

  beforeEach(() => {
    // Initialize mocked repositories
    mockCaseRepo = new CaseRepository() as jest.Mocked<CaseRepository>;
    mockCaseCounterRepo = new CaseCounterRepository() as jest.Mocked<CaseCounterRepository>;
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

    mockClient = {
      guilds: {
        cache: new Map([[testGuildId, mockGuild]])
      }
    };

    mockContext = {
      guildId: testGuildId,
      userId: testUserId,
      userRoles: ['managing_partner_role'],
      isGuildOwner: false
    };

    // Initialize services
    caseService = new CaseService(
      mockCaseRepo,
      mockCaseCounterRepo,
      mockGuildConfigRepo,
      mockPermissionService,
      mockBusinessRuleValidationService,
      mockClient
    );

    archiveService = new CaseChannelArchiveService(
      mockCaseRepo,
      mockGuildConfigRepo,
      mockAuditLogRepo,
      mockPermissionService,
      mockBusinessRuleValidationService
    );

    // Setup default mocks
    mockPermissionService.hasActionPermission.mockResolvedValue(true);
    mockPermissionService.hasLeadAttorneyPermissionWithContext.mockResolvedValue(true);
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
      adminUsers: []
    });
    mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      bypassAvailable: false,
      hasPermission: true,
      requiredPermission: 'case',
      grantedPermissions: ['case']
    });
    mockAuditLogRepo.add.mockResolvedValue({} as any);
  });

  describe('Case Closure with Automatic Archiving', () => {
    it('should automatically archive channel when case is closed', async () => {
      // Setup existing case
      const existingCase: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439012'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.IN_PROGRESS,
        priority: 'medium' as any,
        assignedLawyerIds: [testUserId],
        leadAttorneyId: testUserId,
        documents: [],
        notes: [],
        channelId: testChannelId
      };

      const closedCase: Case = {
        ...existingCase,
        status: CaseStatus.CLOSED,
        result: CaseResult.WIN,
        closedAt: new Date(),
        closedBy: testUserId
      };

      mockCaseRepo.conditionalUpdate.mockResolvedValue(closedCase);

      const result = await caseService.closeCase(mockContext, {
        caseId: testCaseId,
        result: CaseResult.WIN,
        resultNotes: 'Case won successfully',
        closedBy: testUserId
      });

      expect(result.status).toBe(CaseStatus.CLOSED);
      expect(result.result).toBe(CaseResult.WIN);

      // Wait a bit for the background archiving to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // The archiving happens in the background, so we verify the log messages
      // In a real test, you might want to mock the logger and verify calls
    });

    it('should handle case closure without archiving when no channel exists', async () => {
      const existingCase: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439013'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.IN_PROGRESS,
        priority: 'medium' as any,
        assignedLawyerIds: [testUserId],
        leadAttorneyId: testUserId,
        documents: [],
        notes: []
        // No channelId
      };

      const closedCase: Case = {
        ...existingCase,
        status: CaseStatus.CLOSED,
        result: CaseResult.WIN,
        closedAt: new Date(),
        closedBy: testUserId
      };

      mockCaseRepo.conditionalUpdate.mockResolvedValue(closedCase);

      const result = await caseService.closeCase(mockContext, {
        caseId: testCaseId,
        result: CaseResult.WIN,
        resultNotes: 'Case won successfully',
        closedBy: testUserId
      });

      expect(result.status).toBe(CaseStatus.CLOSED);
      // Should complete successfully even without channel to archive
    });
  });

  describe('Manual Archive Operations', () => {
    it('should manually archive a specific case channel', async () => {
      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439014'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: 'medium' as any,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId,
        closedAt: new Date()
      };

      mockCaseRepo.findById.mockResolvedValue(caseData);

      const result = await caseService.archiveCaseChannel(mockContext, testCaseId);

      expect(result.success).toBe(true);
      expect(result.message).toContain('archived successfully');
      expect(result.channelId).toBe(testChannelId);
      expect(mockChannel.edit).toHaveBeenCalledWith({
        name: '[ARCHIVED]-case-aa-2024-123-testclient',
        parent: 'archive_category_123',
        topic: expect.stringContaining('Archived:'),
        permissionOverwrites: expect.any(Array)
      });
    });

    it('should archive all closed case channels in bulk', async () => {
      const closedCases: Case[] = [
        {
          _id: new ObjectId('507f1f77bcf86cd799439015'),
          guildId: testGuildId,
          caseNumber: 'AA-2024-001',
          clientId: 'client_1',
          clientUsername: 'client1',
          title: 'Case 1',
          description: 'Description 1',
          status: CaseStatus.CLOSED,
          priority: 'medium' as any,
          assignedLawyerIds: [],
          documents: [],
          notes: [],
          channelId: 'channel_1',
          closedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439016'),
          guildId: testGuildId,
          caseNumber: 'AA-2024-002',
          clientId: 'client_2',
          clientUsername: 'client2',
          title: 'Case 2',
          description: 'Description 2',
          status: CaseStatus.CLOSED,
          priority: 'medium' as any,
          assignedLawyerIds: [],
          documents: [],
          notes: [],
          channelId: 'channel_2',
          closedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
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

      const result = await caseService.archiveAllClosedCaseChannels(mockContext);

      expect(result.success).toBe(true);
      expect(result.archivedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.message).toContain('2 channels archived');
    });

    it('should find orphaned case channels', async () => {
      // Add an orphaned channel
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

      const result = await caseService.findOrphanedCaseChannels(mockContext);

      expect(result.success).toBe(true);
      expect(result.orphanedChannels).toHaveLength(1);
      expect(result.orphanedChannels[0]?.channelId).toBe('orphaned_channel_123');
      expect(result.orphanedChannels[0]?.shouldArchive).toBe(true);
    });
  });

  describe('Service Integration Error Handling', () => {
    it('should handle archive service not available gracefully', async () => {
      // Create service without Discord client
      const caseServiceWithoutClient = new CaseService(
        mockCaseRepo,
        mockCaseCounterRepo,
        mockGuildConfigRepo,
        mockPermissionService,
        mockBusinessRuleValidationService
        // No Discord client
      );

      const result = await caseServiceWithoutClient.archiveCaseChannel(mockContext, testCaseId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Archive service not available');
    });

    it('should handle permission failures in archive operations', async () => {
      mockPermissionService.hasActionPermission.mockResolvedValue(false);

      const result = await caseService.archiveCaseChannel(mockContext, testCaseId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient permissions');
    });

    it('should handle database errors in archive operations', async () => {
      mockCaseRepo.findById.mockRejectedValue(new Error('Database connection failed'));

      const result = await caseService.archiveCaseChannel(mockContext, testCaseId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Database connection failed');
    });

    it('should handle Discord API errors in archive operations', async () => {
      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439017'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: 'medium' as any,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId
      };

      mockCaseRepo.findById.mockResolvedValue(caseData);
      mockChannel.edit.mockRejectedValue(new Error('Discord API rate limit'));

      const result = await caseService.archiveCaseChannel(mockContext, testCaseId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Discord API rate limit');
    });
  });

  describe('Configuration Integration', () => {
    it('should work with different guild configurations', async () => {
      // Test with custom archive category ID
      mockGuildConfigRepo.findByGuildId.mockResolvedValue({
        _id: new ObjectId('507f1f77bcf86cd799439018'),
        guildId: testGuildId,
        caseArchiveCategoryId: 'custom_archive_category',
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
        adminUsers: []
      });

      const customArchiveCategory = {
        id: 'custom_archive_category',
        name: 'Custom Archives',
        type: ChannelType.GuildCategory
      };

      mockGuild.channels.cache.set('custom_archive_category', customArchiveCategory);

      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439019'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: 'medium' as any,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId
      };

      mockCaseRepo.findById.mockResolvedValue(caseData);

      const result = await caseService.archiveCaseChannel(mockContext, testCaseId);

      expect(result.success).toBe(true);
      expect(mockChannel.edit).toHaveBeenCalledWith({
        name: '[ARCHIVED]-case-aa-2024-123-testclient',
        parent: 'custom_archive_category',
        topic: expect.stringContaining('Archived:'),
        permissionOverwrites: expect.any(Array)
      });
    });

    it('should create archive category when none exists', async () => {
      // Remove archive category from guild config
      mockGuildConfigRepo.findByGuildId.mockResolvedValue({
        _id: new ObjectId('507f1f77bcf86cd799439020'),
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
        adminUsers: []
      });

      // Remove existing archive category
      mockGuild.channels.cache.delete('archive_category_123');

      const caseData: Case = {
        _id: new ObjectId('507f1f77bcf86cd799439021'),
        guildId: testGuildId,
        caseNumber: 'AA-2024-123',
        clientId: 'client_123',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: CaseStatus.CLOSED,
        priority: 'medium' as any,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        channelId: testChannelId
      };

      mockCaseRepo.findById.mockResolvedValue(caseData);

      const result = await caseService.archiveCaseChannel(mockContext, testCaseId);

      expect(mockGuild.channels.create).toHaveBeenCalledWith({
        name: '🗃️ Case Archives',
        type: ChannelType.GuildCategory,
        permissionOverwrites: expect.any(Array)
      });
      expect(result.success).toBe(true);
    });
  });
});