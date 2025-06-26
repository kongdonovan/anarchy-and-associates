import { 
  ChannelType, 
  Collection
} from 'discord.js';
import { OrphanedChannelCleanupService } from '../../application/services/orphaned-channel-cleanup-service';
import { CaseChannelArchiveService } from '../../application/services/case-channel-archive-service';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { AuditAction } from '../../domain/entities/audit-log';
import { ObjectId } from 'mongodb';
import { CaseStatus, CasePriority } from '../../domain/entities/case';

// Mock Discord.js
jest.mock('discord.js', () => {
  const actualDiscord = jest.requireActual('discord.js');
  return {
    ...actualDiscord,
    Client: jest.fn(),
    Guild: jest.fn(),
    TextChannel: jest.fn(),
    CategoryChannel: jest.fn() };
});

describe('OrphanedChannelCleanupService', () => {
  let service: OrphanedChannelCleanupService;
  let mockCaseRepository: jest.Mocked<CaseRepository>;
  let mockGuildConfigRepository: jest.Mocked<GuildConfigRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
  let mockPermissionService: jest.Mocked<PermissionService>;
  let mockBusinessRuleValidationService: jest.Mocked<BusinessRuleValidationService>;
  let mockCaseChannelArchiveService: jest.Mocked<CaseChannelArchiveService>;
  let mockGuild: any;
  let mockContext: PermissionContext;

  beforeEach(() => {
    // Create mocks
    mockCaseRepository = {
      findByFilters: jest.fn(),
      findByGuildAndStatus: jest.fn() } as any;

    mockGuildConfigRepository = {
      findByGuildId: jest.fn(),
      update: jest.fn() } as any;

    mockAuditLogRepository = {
      add: jest.fn() } as any;

    mockStaffRepository = {
      findByGuildId: jest.fn() } as any;

    mockPermissionService = {
      hasActionPermission: jest.fn() } as any;

    mockBusinessRuleValidationService = {} as any;

    mockCaseChannelArchiveService = {
      archiveOrphanedChannels: jest.fn() } as any;

    // Create service instance
    service = new OrphanedChannelCleanupService(
      mockCaseRepository,
      mockGuildConfigRepository,
      mockAuditLogRepository,
      mockStaffRepository,
      mockPermissionService,
      mockBusinessRuleValidationService,
      mockCaseChannelArchiveService
    );

    // Mock guild
    mockGuild = {
      id: 'test-guild-id',
      channels: {
        cache: new Collection() },
      members: {
        cache: new Collection() },
      roles: {
        everyone: { id: 'everyone-role-id' },
        cache: new Collection() } };

    // Mock context
    mockContext = {
      guildId: 'test-guild-id',
      userId: 'test-user-id',
      userRoles: ['admin-role'],
      isGuildOwner: false };

    // Default permission mock
    mockPermissionService.hasActionPermission.mockResolvedValue(true);

    // Default guild config mock
    mockGuildConfigRepository.findByGuildId.mockResolvedValue({
      _id: new ObjectId(),
      guildId: 'test-guild-id',
      permissions: {
        admin: ['admin-role'],
        'senior-staff': [],
        case: [],
        config: [],
        lawyer: [],
        'lead-attorney': [],
        repair: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      adminRoles: ['admin-role'],
      adminUsers: [],
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up any intervals
    service.destroy();
  });

  describe('scanForOrphanedChannels', () => {
    it('should scan for orphaned case channels', async () => {
      // Create mock channels
      const caseChannel = createMockTextChannel('case-aa-2024-001-clientname', 'case-channel-id');
      const normalChannel = createMockTextChannel('general', 'general-channel-id');
      const orphanedCaseChannel = createMockTextChannel('case-aa-2024-002-abandoned', 'orphaned-channel-id');

      mockGuild.channels.cache.set(caseChannel.id, caseChannel);
      mockGuild.channels.cache.set(normalChannel.id, normalChannel);
      mockGuild.channels.cache.set(orphanedCaseChannel.id, orphanedCaseChannel);

      // Mock case repository to return case for first channel but not the orphaned one
      mockCaseRepository.findByFilters
        .mockResolvedValueOnce([{ 
          _id: new ObjectId(), 
          channelId: 'case-channel-id',
          guildId: 'test-guild-id',
          caseNumber: 'AA-2024-001',
          clientId: 'client-123',
          clientUsername: 'clientname',
          title: 'Test Case',
          description: 'Test description',
          status: CaseStatus.IN_PROGRESS,
          priority: CasePriority.MEDIUM,
          assignedLawyerIds: [],
          documents: [],
          notes: [],
          createdAt: new Date(),
          updatedAt: new Date()
        } as any])
        .mockResolvedValueOnce([]) // orphaned channel has no case
        .mockResolvedValueOnce([]); // general channel has no case (but doesn't match pattern)

      // Mock messages for activity check
      orphanedCaseChannel.messages = {
        fetch: jest.fn().mockResolvedValue(new Collection()) };

      const result = await service.scanForOrphanedChannels(mockGuild, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        channelId: 'orphaned-channel-id',
        channelName: 'case-aa-2024-002-abandoned',
        channelType: 'case',
        recommendedAction: expect.any(String),
        reasons: expect.arrayContaining(['No corresponding case found in database']) });
    });

    it('should detect orphaned staff channels', async () => {
      const staffChannel = createMockTextChannel('staff-john-doe', 'staff-channel-id');
      mockGuild.channels.cache.set(staffChannel.id, staffChannel);

      // Mock no active staff members
      mockStaffRepository.findByGuildId.mockResolvedValue([]);

      // Mock messages
      staffChannel.messages = {
        fetch: jest.fn().mockResolvedValue(new Collection()) };

      const result = await service.scanForOrphanedChannels(mockGuild, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        channelId: 'staff-channel-id',
        channelName: 'staff-john-doe',
        channelType: 'staff',
        reasons: expect.arrayContaining(['No active staff member associated with channel']) });
    });

    it('should detect temporary channels', async () => {
      const tempChannel = createMockTextChannel('temp-meeting-room', 'temp-channel-id');
      mockGuild.channels.cache.set(tempChannel.id, tempChannel);

      // Mock messages
      tempChannel.messages = {
        fetch: jest.fn().mockResolvedValue(new Collection()) };

      const result = await service.scanForOrphanedChannels(mockGuild, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        channelId: 'temp-channel-id',
        channelName: 'temp-meeting-room',
        reasons: expect.arrayContaining(['Channel appears to be temporary']) });
    });

    it('should calculate inactivity days correctly', async () => {
      const inactiveChannel = createMockTextChannel('case-aa-2024-003-old', 'inactive-channel-id');
      mockGuild.channels.cache.set(inactiveChannel.id, inactiveChannel);

      // Mock no corresponding case
      mockCaseRepository.findByFilters.mockResolvedValue([]);

      // Mock old last message
      const oldMessage = {
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        author: { id: 'user-id', username: 'testuser' } };
      
      const messages = new Collection();
      messages.set('msg-id', oldMessage);
      
      inactiveChannel.messages = {
        fetch: jest.fn().mockResolvedValue(messages) };

      const result = await service.scanForOrphanedChannels(mockGuild, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]!.inactiveDays).toBeGreaterThanOrEqual(59); // Allowing for slight time differences
      expect(result[0]!.recommendedAction).toBe('archive'); // Should recommend archiving old channels
    });

    it('should respect excluded channels and categories', async () => {
      const excludedChannel = createMockTextChannel('case-aa-2024-004-excluded', 'excluded-channel-id');
      const channelInExcludedCategory = createMockTextChannel('case-aa-2024-005-cat-excluded', 'cat-excluded-channel-id');
      channelInExcludedCategory.parentId = 'excluded-category-id';

      mockGuild.channels.cache.set(excludedChannel.id, excludedChannel);
      mockGuild.channels.cache.set(channelInExcludedCategory.id, channelInExcludedCategory);

      // Mock config with exclusions
      mockGuildConfigRepository.findByGuildId.mockResolvedValue({
        _id: new ObjectId(),
        guildId: 'test-guild-id',
        channelCleanupConfig: {
          excludedChannels: ['excluded-channel-id'],
          excludedCategories: ['excluded-category-id'],
        createdAt: new Date(),
        updatedAt: new Date()
        },
        permissions: {
          admin: ['admin-role'],
          'senior-staff': [],
          case: [],
          config: [],
          lawyer: [],
          'lead-attorney': [],
          repair: [] },
        adminRoles: ['admin-role'],
        adminUsers: [],
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      const result = await service.scanForOrphanedChannels(mockGuild, mockContext);

      expect(result).toHaveLength(0); // Both channels should be excluded
    });

    it('should skip channels in archive categories', async () => {
      const archiveCategory = {
        id: 'archive-category-id',
        name: '🗃️ Case Archives',
        type: ChannelType.GuildCategory };

      const archivedChannel = createMockTextChannel('[ARCHIVED]-case-aa-2024-006', 'archived-channel-id');
      archivedChannel.parentId = 'archive-category-id';
      archivedChannel.parent = archiveCategory;

      mockGuild.channels.cache.set(archivedChannel.id, archivedChannel);

      const result = await service.scanForOrphanedChannels(mockGuild, mockContext);

      expect(result).toHaveLength(0); // Archived channels should be skipped
    });

    it('should require admin permission', async () => {
      mockPermissionService.hasActionPermission.mockResolvedValue(false);

      await expect(service.scanForOrphanedChannels(mockGuild, mockContext))
        .rejects.toThrow('Insufficient permissions to scan for orphaned channels');
    });
  });

  describe('performCleanup', () => {
    it('should archive channels marked for archiving', async () => {
      const orphanedChannels = [
        {
          channelId: 'channel-1',
          channelName: 'case-aa-2024-001-old',
          channelType: 'case' as const,
          inactiveDays: 30,
          messageCount: 10,
          recommendedAction: 'archive' as const,
          reasons: ['No corresponding case found'],
          createdAt: new Date() },
      ];

      const channel = createMockTextChannel('case-aa-2024-001-old', 'channel-1');
      mockGuild.channels.cache.set(channel.id, channel);

      mockCaseChannelArchiveService.archiveOrphanedChannels.mockResolvedValue([
        {
          channelId: 'channel-1',
          channelName: '[ARCHIVED]-case-aa-2024-001-old',
          archiveCategoryId: 'archive-category-id',
          archivedAt: new Date(),
          reason: 'Orphaned channel cleanup',
          success: true },
      ]);

      const report = await service.performCleanup(mockGuild, orphanedChannels, mockContext);

      expect(report.channelsArchived).toBe(1);
      expect(report.channelsDeleted).toBe(0);
      expect(report.results[0]!.action).toBe('archived');
      expect(mockCaseChannelArchiveService.archiveOrphanedChannels).toHaveBeenCalled();
    });

    it('should delete channels marked for deletion', async () => {
      const orphanedChannels = [
        {
          channelId: 'channel-1',
          channelName: 'temp-old-channel',
          channelType: 'unknown' as const,
          inactiveDays: 100,
          messageCount: 0,
          recommendedAction: 'delete' as const,
          reasons: ['Channel appears to be temporary', 'Inactive for 100 days'],
          createdAt: new Date() },
      ];

      const channel = createMockTextChannel('temp-old-channel', 'channel-1');
      channel.delete = jest.fn().mockResolvedValue(true);
      mockGuild.channels.cache.set(channel.id, channel);

      const report = await service.performCleanup(mockGuild, orphanedChannels, mockContext);

      expect(report.channelsDeleted).toBe(1);
      expect(report.channelsArchived).toBe(0);
      expect(report.results[0]!.action).toBe('deleted');
      expect(channel.delete).toHaveBeenCalledWith(expect.stringContaining('Orphaned channel cleanup'));
    });

    it('should skip channels marked for review', async () => {
      const orphanedChannels = [
        {
          channelId: 'channel-1',
          channelName: 'admin-sensitive',
          channelType: 'admin' as const,
          inactiveDays: 50,
          messageCount: 100,
          recommendedAction: 'review' as const,
          reasons: ['Admin channel requires manual review'],
          createdAt: new Date() },
      ];

      const report = await service.performCleanup(
        mockGuild, 
        orphanedChannels, 
        mockContext,
        { actionsToPerform: ['archive', 'delete'] } // review is not included
      );

      expect(report.channelsSkipped).toBe(1);
      expect(report.results[0]!.action).toBe('skipped');
      expect(report.results[0]!.reason).toContain("Action 'review' not included in cleanup");
    });

    it('should respect dry-run mode', async () => {
      const orphanedChannels = [
        {
          channelId: 'channel-1',
          channelName: 'case-aa-2024-001-old',
          channelType: 'case' as const,
          inactiveDays: 30,
          messageCount: 10,
          recommendedAction: 'archive' as const,
          reasons: ['No corresponding case found'],
          createdAt: new Date() },
        {
          channelId: 'channel-2',
          channelName: 'temp-channel',
          channelType: 'unknown' as const,
          inactiveDays: 100,
          messageCount: 0,
          recommendedAction: 'delete' as const,
          reasons: ['Temporary channel'],
          createdAt: new Date() },
      ];

      const channel1 = createMockTextChannel('case-aa-2024-001-old', 'channel-1');
      const channel2 = createMockTextChannel('temp-channel', 'channel-2');
      channel2.delete = jest.fn();
      
      mockGuild.channels.cache.set(channel1.id, channel1);
      mockGuild.channels.cache.set(channel2.id, channel2);

      const report = await service.performCleanup(
        mockGuild, 
        orphanedChannels, 
        mockContext,
        { dryRun: true }
      );

      expect(report.channelsArchived).toBe(0);
      expect(report.channelsDeleted).toBe(0);
      expect(report.channelsSkipped).toBe(2);
      expect(report.results[0]!.reason).toContain('Dry run');
      expect(report.results[1]!.reason).toContain('Dry run');
      expect(mockCaseChannelArchiveService.archiveOrphanedChannels).not.toHaveBeenCalled();
      expect(channel2.delete).not.toHaveBeenCalled();
    });

    it('should filter actions based on actionsToPerform option', async () => {
      const orphanedChannels = [
        {
          channelId: 'channel-1',
          channelName: 'case-aa-2024-001-old',
          channelType: 'case' as const,
          inactiveDays: 30,
          messageCount: 10,
          recommendedAction: 'archive' as const,
          reasons: ['No corresponding case found'],
          createdAt: new Date() },
        {
          channelId: 'channel-2',
          channelName: 'temp-channel',
          channelType: 'unknown' as const,
          inactiveDays: 100,
          messageCount: 0,
          recommendedAction: 'delete' as const,
          reasons: ['Temporary channel'],
          createdAt: new Date() },
      ];

      const channel1 = createMockTextChannel('case-aa-2024-001-old', 'channel-1');
      mockGuild.channels.cache.set(channel1.id, channel1);

      mockCaseChannelArchiveService.archiveOrphanedChannels.mockResolvedValue([
        {
          channelId: 'channel-1',
          channelName: '[ARCHIVED]-case-aa-2024-001-old',
          archiveCategoryId: 'archive-category-id',
          archivedAt: new Date(),
          reason: 'Orphaned channel cleanup',
          success: true },
      ]);

      const report = await service.performCleanup(
        mockGuild,
        orphanedChannels,
        mockContext,
        { actionsToPerform: ['archive'] } // Only archive, no delete
      );

      expect(report.channelsArchived).toBe(1);
      expect(report.channelsDeleted).toBe(0);
      expect(report.channelsSkipped).toBe(1); // Delete action was skipped
    });

    it('should handle errors gracefully', async () => {
      const orphanedChannels = [
        {
          channelId: 'channel-1',
          channelName: 'case-aa-2024-001-old',
          channelType: 'case' as const,
          inactiveDays: 30,
          messageCount: 10,
          recommendedAction: 'archive' as const,
          reasons: ['No corresponding case found'],
          createdAt: new Date() },
      ];

      const channel = createMockTextChannel('case-aa-2024-001-old', 'channel-1');
      mockGuild.channels.cache.set(channel.id, channel);

      mockCaseChannelArchiveService.archiveOrphanedChannels.mockRejectedValue(
        new Error('Archive failed')
      );

      const report = await service.performCleanup(mockGuild, orphanedChannels, mockContext);

      expect(report.errors).toBe(1);
      expect(report.results[0]!.action).toBe('error');
      expect(report.results[0]!.error).toBe('Archive failed');
    });

    it('should log cleanup report to audit trail', async () => {
      const orphanedChannels = [
        {
          channelId: 'channel-1',
          channelName: 'case-aa-2024-001-old',
          channelType: 'case' as const,
          inactiveDays: 30,
          messageCount: 10,
          recommendedAction: 'archive' as const,
          reasons: ['No corresponding case found'],
          createdAt: new Date() },
      ];

      const channel = createMockTextChannel('case-aa-2024-001-old', 'channel-1');
      mockGuild.channels.cache.set(channel.id, channel);

      mockCaseChannelArchiveService.archiveOrphanedChannels.mockResolvedValue([
        {
          channelId: 'channel-1',
          channelName: '[ARCHIVED]-case-aa-2024-001-old',
          archiveCategoryId: 'archive-category-id',
          archivedAt: new Date(),
          reason: 'Orphaned channel cleanup',
          success: true },
      ]);

      await service.performCleanup(mockGuild, orphanedChannels, mockContext);

      expect(mockAuditLogRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'test-guild-id',
          action: AuditAction.CHANNEL_ARCHIVED,
          actorId: 'test-user-id',
          details: expect.objectContaining({
            reason: 'Orphaned channel cleanup',
            metadata: expect.objectContaining({
              totalScanned: 1,
              archived: 1,
              deleted: 0 }) }) })
      );
    });
  });

  describe('setAutoCleanup', () => {
    it('should enable auto cleanup', async () => {
      await service.setAutoCleanup('test-guild-id', true, mockContext);

      expect(mockGuildConfigRepository.update).toHaveBeenCalledWith(
        'config-id',
        expect.objectContaining({
          channelCleanupConfig: expect.objectContaining({
            enableAutoCleanup: true }) })
      );
    });

    it('should disable auto cleanup', async () => {
      await service.setAutoCleanup('test-guild-id', false, mockContext);

      expect(mockGuildConfigRepository.update).toHaveBeenCalledWith(
        'config-id',
        expect.objectContaining({
          channelCleanupConfig: expect.objectContaining({
            enableAutoCleanup: false }) })
      );
    });

    it('should require admin permission', async () => {
      mockPermissionService.hasActionPermission.mockResolvedValue(false);

      await expect(service.setAutoCleanup('test-guild-id', true, mockContext))
        .rejects.toThrow('Insufficient permissions to configure auto cleanup');
    });
  });

  describe('getCleanupStatus', () => {
    it('should return cleanup status', async () => {
      mockGuildConfigRepository.findByGuildId.mockResolvedValue({
        _id: new ObjectId(),
        guildId: 'test-guild-id',
        channelCleanupConfig: {
          enableAutoCleanup: true,
          scanInterval: 1440,
          inactivityThreshold: 30,
          archiveThreshold: 7,
          deleteThreshold: 90,
          batchSize: 10,
          excludedCategories: [],
          excludedChannels: [],
        createdAt: new Date(),
        updatedAt: new Date()
        },
        permissions: {
          admin: ['admin-role'],
          'senior-staff': [],
          case: [],
          config: [],
          lawyer: [],
          'lead-attorney': [],
          repair: [] },
        adminRoles: ['admin-role'],
        adminUsers: [],
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      const status = await service.getCleanupStatus('test-guild-id');

      expect(status.enabled).toBe(false); // Interval not actually started in test
      expect(status.config).toMatchObject({
        enableAutoCleanup: true,
        scanInterval: 1440 });
    });
  });

  describe('edge cases', () => {
    it('should handle channels with no messages', async () => {
      const emptyChannel = createMockTextChannel('case-aa-2024-001-empty', 'empty-channel-id');
      mockGuild.channels.cache.set(emptyChannel.id, emptyChannel);

      // Mock no corresponding case
      mockCaseRepository.findByFilters.mockResolvedValue([]);

      // Mock empty messages
      emptyChannel.messages = {
        fetch: jest.fn().mockResolvedValue(new Collection()) };

      const result = await service.scanForOrphanedChannels(mockGuild, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]!.messageCount).toBe(0);
      expect(result[0]!.lastActivity).toBeUndefined();
      // Should calculate inactivity from channel creation date
      expect(result[0]!.inactiveDays).toBeGreaterThanOrEqual(0);
    });

    it('should handle message fetch errors gracefully', async () => {
      const errorChannel = createMockTextChannel('case-aa-2024-001-error', 'error-channel-id');
      mockGuild.channels.cache.set(errorChannel.id, errorChannel);

      // Mock no corresponding case
      mockCaseRepository.findByFilters.mockResolvedValue([]);

      // Mock message fetch error
      errorChannel.messages = {
        fetch: jest.fn().mockRejectedValue(new Error('API Error')) };

      const result = await service.scanForOrphanedChannels(mockGuild, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]!.messageCount).toBe(0);
      expect(result[0]!.lastActivity).toBeUndefined();
    });

    it('should find related channels', async () => {
      const caseChannel1 = createMockTextChannel('case-aa-2024-001-main', 'case-1');
      const caseChannel2 = createMockTextChannel('case-aa-2024-001-documents', 'case-2');
      const unrelatedChannel = createMockTextChannel('case-aa-2024-002-other', 'case-3');

      mockGuild.channels.cache.set(caseChannel1.id, caseChannel1);
      mockGuild.channels.cache.set(caseChannel2.id, caseChannel2);
      mockGuild.channels.cache.set(unrelatedChannel.id, unrelatedChannel);

      // Mock no corresponding cases (all orphaned)
      mockCaseRepository.findByFilters.mockResolvedValue([]);

      // Mock messages
      [caseChannel1, caseChannel2, unrelatedChannel].forEach(channel => {
        channel.messages = {
          fetch: jest.fn().mockResolvedValue(new Collection()) };
      });

      const result = await service.scanForOrphanedChannels(mockGuild, mockContext);

      const channel1Result = result.find(r => r.channelId === 'case-1');
      expect(channel1Result?.metadata?.relatedChannels).toContain('case-2');
      expect(channel1Result?.metadata?.relatedChannels).not.toContain('case-3');
    });
  });
});

// Helper function to create mock text channels
function createMockTextChannel(name: string, id: string): any {
  return {
    id,
    name,
    type: ChannelType.GuildText,
    guild: { id: 'test-guild-id' },
    parentId: null,
    parent: null,
    createdAt: new Date(),
    delete: jest.fn(),
    edit: jest.fn(),
    send: jest.fn(),
    messages: {
      fetch: jest.fn() } };
}