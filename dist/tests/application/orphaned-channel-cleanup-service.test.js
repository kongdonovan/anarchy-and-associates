"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const orphaned_channel_cleanup_service_1 = require("../../application/services/orphaned-channel-cleanup-service");
const audit_log_1 = require("../../domain/entities/audit-log");
const mongodb_1 = require("mongodb");
const case_1 = require("../../domain/entities/case");
// Mock Discord.js
jest.mock('discord.js', () => {
    const actualDiscord = jest.requireActual('discord.js');
    return {
        ...actualDiscord,
        Client: jest.fn(),
        Guild: jest.fn(),
        TextChannel: jest.fn(),
        CategoryChannel: jest.fn()
    };
});
describe('OrphanedChannelCleanupService', () => {
    let service;
    let mockCaseRepository;
    let mockGuildConfigRepository;
    let mockAuditLogRepository;
    let mockStaffRepository;
    let mockPermissionService;
    let mockBusinessRuleValidationService;
    let mockCaseChannelArchiveService;
    let mockGuild;
    let mockContext;
    beforeEach(() => {
        // Create mocks
        mockCaseRepository = {
            findByFilters: jest.fn(),
            findByGuildAndStatus: jest.fn()
        };
        mockGuildConfigRepository = {
            findByGuildId: jest.fn(),
            update: jest.fn()
        };
        mockAuditLogRepository = {
            add: jest.fn()
        };
        mockStaffRepository = {
            findByGuildId: jest.fn()
        };
        mockPermissionService = {
            hasActionPermission: jest.fn()
        };
        mockBusinessRuleValidationService = {};
        mockCaseChannelArchiveService = {
            archiveOrphanedChannels: jest.fn()
        };
        // Create service instance
        service = new orphaned_channel_cleanup_service_1.OrphanedChannelCleanupService(mockCaseRepository, mockGuildConfigRepository, mockAuditLogRepository, mockStaffRepository, mockPermissionService, mockBusinessRuleValidationService, mockCaseChannelArchiveService);
        // Mock guild
        mockGuild = {
            id: 'test-guild-id',
            channels: {
                cache: new discord_js_1.Collection()
            },
            members: {
                cache: new discord_js_1.Collection()
            },
            roles: {
                everyone: { id: 'everyone-role-id' },
                cache: new discord_js_1.Collection()
            }
        };
        // Mock context
        mockContext = {
            guildId: 'test-guild-id',
            userId: 'test-user-id',
            userRoles: ['admin-role'],
            isGuildOwner: false
        };
        // Default permission mock
        mockPermissionService.hasActionPermission.mockResolvedValue(true);
        // Default guild config mock
        mockGuildConfigRepository.findByGuildId.mockResolvedValue({
            _id: new mongodb_1.ObjectId(),
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
        });
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
                    _id: new mongodb_1.ObjectId(),
                    channelId: 'case-channel-id',
                    guildId: 'test-guild-id',
                    caseNumber: 'AA-2024-001',
                    clientId: 'client-123',
                    clientUsername: 'clientname',
                    title: 'Test Case',
                    description: 'Test description',
                    status: case_1.CaseStatus.IN_PROGRESS,
                    priority: case_1.CasePriority.MEDIUM,
                    assignedLawyerIds: [],
                    documents: [],
                    notes: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                }])
                .mockResolvedValueOnce([]) // orphaned channel has no case
                .mockResolvedValueOnce([]); // general channel has no case (but doesn't match pattern)
            // Mock messages for activity check
            orphanedCaseChannel.messages = {
                fetch: jest.fn().mockResolvedValue(new discord_js_1.Collection())
            };
            const result = await service.scanForOrphanedChannels(mockGuild, mockContext);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                channelId: 'orphaned-channel-id',
                channelName: 'case-aa-2024-002-abandoned',
                channelType: 'case',
                recommendedAction: expect.any(String),
                reasons: expect.arrayContaining(['No corresponding case found in database'])
            });
        });
        it('should detect orphaned staff channels', async () => {
            const staffChannel = createMockTextChannel('staff-john-doe', 'staff-channel-id');
            mockGuild.channels.cache.set(staffChannel.id, staffChannel);
            // Mock no active staff members
            mockStaffRepository.findByGuildId.mockResolvedValue([]);
            // Mock messages
            staffChannel.messages = {
                fetch: jest.fn().mockResolvedValue(new discord_js_1.Collection())
            };
            const result = await service.scanForOrphanedChannels(mockGuild, mockContext);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                channelId: 'staff-channel-id',
                channelName: 'staff-john-doe',
                channelType: 'staff',
                reasons: expect.arrayContaining(['No active staff member associated with channel'])
            });
        });
        it('should detect temporary channels', async () => {
            const tempChannel = createMockTextChannel('temp-meeting-room', 'temp-channel-id');
            mockGuild.channels.cache.set(tempChannel.id, tempChannel);
            // Mock messages
            tempChannel.messages = {
                fetch: jest.fn().mockResolvedValue(new discord_js_1.Collection())
            };
            const result = await service.scanForOrphanedChannels(mockGuild, mockContext);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                channelId: 'temp-channel-id',
                channelName: 'temp-meeting-room',
                reasons: expect.arrayContaining(['Channel appears to be temporary'])
            });
        });
        it('should calculate inactivity days correctly', async () => {
            const inactiveChannel = createMockTextChannel('case-aa-2024-003-old', 'inactive-channel-id');
            mockGuild.channels.cache.set(inactiveChannel.id, inactiveChannel);
            // Mock no corresponding case
            mockCaseRepository.findByFilters.mockResolvedValue([]);
            // Mock old last message
            const oldMessage = {
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
                author: { id: 'user-id', username: 'testuser' }
            };
            const messages = new discord_js_1.Collection();
            messages.set('msg-id', oldMessage);
            inactiveChannel.messages = {
                fetch: jest.fn().mockResolvedValue(messages)
            };
            const result = await service.scanForOrphanedChannels(mockGuild, mockContext);
            expect(result).toHaveLength(1);
            expect(result[0].inactiveDays).toBeGreaterThanOrEqual(59); // Allowing for slight time differences
            expect(result[0].recommendedAction).toBe('archive'); // Should recommend archiving old channels
        });
        it('should respect excluded channels and categories', async () => {
            const excludedChannel = createMockTextChannel('case-aa-2024-004-excluded', 'excluded-channel-id');
            const channelInExcludedCategory = createMockTextChannel('case-aa-2024-005-cat-excluded', 'cat-excluded-channel-id');
            channelInExcludedCategory.parentId = 'excluded-category-id';
            mockGuild.channels.cache.set(excludedChannel.id, excludedChannel);
            mockGuild.channels.cache.set(channelInExcludedCategory.id, channelInExcludedCategory);
            // Mock config with exclusions
            mockGuildConfigRepository.findByGuildId.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
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
                    repair: []
                },
                adminRoles: ['admin-role'],
                adminUsers: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const result = await service.scanForOrphanedChannels(mockGuild, mockContext);
            expect(result).toHaveLength(0); // Both channels should be excluded
        });
        it('should skip channels in archive categories', async () => {
            const archiveCategory = {
                id: 'archive-category-id',
                name: '🗃️ Case Archives',
                type: discord_js_1.ChannelType.GuildCategory
            };
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
                    channelType: 'case',
                    inactiveDays: 30,
                    messageCount: 10,
                    recommendedAction: 'archive',
                    reasons: ['No corresponding case found'],
                    createdAt: new Date()
                },
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
                    success: true
                },
            ]);
            const report = await service.performCleanup(mockGuild, orphanedChannels, mockContext);
            expect(report.channelsArchived).toBe(1);
            expect(report.channelsDeleted).toBe(0);
            expect(report.results[0].action).toBe('archived');
            expect(mockCaseChannelArchiveService.archiveOrphanedChannels).toHaveBeenCalled();
        });
        it('should delete channels marked for deletion', async () => {
            const orphanedChannels = [
                {
                    channelId: 'channel-1',
                    channelName: 'temp-old-channel',
                    channelType: 'unknown',
                    inactiveDays: 100,
                    messageCount: 0,
                    recommendedAction: 'delete',
                    reasons: ['Channel appears to be temporary', 'Inactive for 100 days'],
                    createdAt: new Date()
                },
            ];
            const channel = createMockTextChannel('temp-old-channel', 'channel-1');
            channel.delete = jest.fn().mockResolvedValue(true);
            mockGuild.channels.cache.set(channel.id, channel);
            const report = await service.performCleanup(mockGuild, orphanedChannels, mockContext);
            expect(report.channelsDeleted).toBe(1);
            expect(report.channelsArchived).toBe(0);
            expect(report.results[0].action).toBe('deleted');
            expect(channel.delete).toHaveBeenCalledWith(expect.stringContaining('Orphaned channel cleanup'));
        });
        it('should skip channels marked for review', async () => {
            const orphanedChannels = [
                {
                    channelId: 'channel-1',
                    channelName: 'admin-sensitive',
                    channelType: 'admin',
                    inactiveDays: 50,
                    messageCount: 100,
                    recommendedAction: 'review',
                    reasons: ['Admin channel requires manual review'],
                    createdAt: new Date()
                },
            ];
            const report = await service.performCleanup(mockGuild, orphanedChannels, mockContext, { actionsToPerform: ['archive', 'delete'] } // review is not included
            );
            expect(report.channelsSkipped).toBe(1);
            expect(report.results[0].action).toBe('skipped');
            expect(report.results[0].reason).toContain("Action 'review' not included in cleanup");
        });
        it('should respect dry-run mode', async () => {
            const orphanedChannels = [
                {
                    channelId: 'channel-1',
                    channelName: 'case-aa-2024-001-old',
                    channelType: 'case',
                    inactiveDays: 30,
                    messageCount: 10,
                    recommendedAction: 'archive',
                    reasons: ['No corresponding case found'],
                    createdAt: new Date()
                },
                {
                    channelId: 'channel-2',
                    channelName: 'temp-channel',
                    channelType: 'unknown',
                    inactiveDays: 100,
                    messageCount: 0,
                    recommendedAction: 'delete',
                    reasons: ['Temporary channel'],
                    createdAt: new Date()
                },
            ];
            const channel1 = createMockTextChannel('case-aa-2024-001-old', 'channel-1');
            const channel2 = createMockTextChannel('temp-channel', 'channel-2');
            channel2.delete = jest.fn();
            mockGuild.channels.cache.set(channel1.id, channel1);
            mockGuild.channels.cache.set(channel2.id, channel2);
            const report = await service.performCleanup(mockGuild, orphanedChannels, mockContext, { dryRun: true });
            expect(report.channelsArchived).toBe(0);
            expect(report.channelsDeleted).toBe(0);
            expect(report.channelsSkipped).toBe(2);
            expect(report.results[0].reason).toContain('Dry run');
            expect(report.results[1].reason).toContain('Dry run');
            expect(mockCaseChannelArchiveService.archiveOrphanedChannels).not.toHaveBeenCalled();
            expect(channel2.delete).not.toHaveBeenCalled();
        });
        it('should filter actions based on actionsToPerform option', async () => {
            const orphanedChannels = [
                {
                    channelId: 'channel-1',
                    channelName: 'case-aa-2024-001-old',
                    channelType: 'case',
                    inactiveDays: 30,
                    messageCount: 10,
                    recommendedAction: 'archive',
                    reasons: ['No corresponding case found'],
                    createdAt: new Date()
                },
                {
                    channelId: 'channel-2',
                    channelName: 'temp-channel',
                    channelType: 'unknown',
                    inactiveDays: 100,
                    messageCount: 0,
                    recommendedAction: 'delete',
                    reasons: ['Temporary channel'],
                    createdAt: new Date()
                },
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
                    success: true
                },
            ]);
            const report = await service.performCleanup(mockGuild, orphanedChannels, mockContext, { actionsToPerform: ['archive'] } // Only archive, no delete
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
                    channelType: 'case',
                    inactiveDays: 30,
                    messageCount: 10,
                    recommendedAction: 'archive',
                    reasons: ['No corresponding case found'],
                    createdAt: new Date()
                },
            ];
            const channel = createMockTextChannel('case-aa-2024-001-old', 'channel-1');
            mockGuild.channels.cache.set(channel.id, channel);
            mockCaseChannelArchiveService.archiveOrphanedChannels.mockRejectedValue(new Error('Archive failed'));
            const report = await service.performCleanup(mockGuild, orphanedChannels, mockContext);
            expect(report.errors).toBe(1);
            expect(report.results[0].action).toBe('error');
            expect(report.results[0].error).toBe('Archive failed');
        });
        it('should log cleanup report to audit trail', async () => {
            const orphanedChannels = [
                {
                    channelId: 'channel-1',
                    channelName: 'case-aa-2024-001-old',
                    channelType: 'case',
                    inactiveDays: 30,
                    messageCount: 10,
                    recommendedAction: 'archive',
                    reasons: ['No corresponding case found'],
                    createdAt: new Date()
                },
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
                    success: true
                },
            ]);
            await service.performCleanup(mockGuild, orphanedChannels, mockContext);
            expect(mockAuditLogRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                guildId: 'test-guild-id',
                action: audit_log_1.AuditAction.CHANNEL_ARCHIVED,
                actorId: 'test-user-id',
                details: expect.objectContaining({
                    reason: 'Orphaned channel cleanup',
                    metadata: expect.objectContaining({
                        totalScanned: 1,
                        archived: 1,
                        deleted: 0
                    })
                })
            }));
        });
    });
    describe('setAutoCleanup', () => {
        it('should enable auto cleanup', async () => {
            await service.setAutoCleanup('test-guild-id', true, mockContext);
            expect(mockGuildConfigRepository.update).toHaveBeenCalledWith('config-id', expect.objectContaining({
                channelCleanupConfig: expect.objectContaining({
                    enableAutoCleanup: true
                })
            }));
        });
        it('should disable auto cleanup', async () => {
            await service.setAutoCleanup('test-guild-id', false, mockContext);
            expect(mockGuildConfigRepository.update).toHaveBeenCalledWith('config-id', expect.objectContaining({
                channelCleanupConfig: expect.objectContaining({
                    enableAutoCleanup: false
                })
            }));
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
                _id: new mongodb_1.ObjectId(),
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
                    repair: []
                },
                adminRoles: ['admin-role'],
                adminUsers: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const status = await service.getCleanupStatus('test-guild-id');
            expect(status.enabled).toBe(false); // Interval not actually started in test
            expect(status.config).toMatchObject({
                enableAutoCleanup: true,
                scanInterval: 1440
            });
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
                fetch: jest.fn().mockResolvedValue(new discord_js_1.Collection())
            };
            const result = await service.scanForOrphanedChannels(mockGuild, mockContext);
            expect(result).toHaveLength(1);
            expect(result[0].messageCount).toBe(0);
            expect(result[0].lastActivity).toBeUndefined();
            // Should calculate inactivity from channel creation date
            expect(result[0].inactiveDays).toBeGreaterThanOrEqual(0);
        });
        it('should handle message fetch errors gracefully', async () => {
            const errorChannel = createMockTextChannel('case-aa-2024-001-error', 'error-channel-id');
            mockGuild.channels.cache.set(errorChannel.id, errorChannel);
            // Mock no corresponding case
            mockCaseRepository.findByFilters.mockResolvedValue([]);
            // Mock message fetch error
            errorChannel.messages = {
                fetch: jest.fn().mockRejectedValue(new Error('API Error'))
            };
            const result = await service.scanForOrphanedChannels(mockGuild, mockContext);
            expect(result).toHaveLength(1);
            expect(result[0].messageCount).toBe(0);
            expect(result[0].lastActivity).toBeUndefined();
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
                    fetch: jest.fn().mockResolvedValue(new discord_js_1.Collection())
                };
            });
            const result = await service.scanForOrphanedChannels(mockGuild, mockContext);
            const channel1Result = result.find(r => r.channelId === 'case-1');
            expect(channel1Result?.metadata?.relatedChannels).toContain('case-2');
            expect(channel1Result?.metadata?.relatedChannels).not.toContain('case-3');
        });
    });
});
// Helper function to create mock text channels
function createMockTextChannel(name, id) {
    return {
        id,
        name,
        type: discord_js_1.ChannelType.GuildText,
        guild: { id: 'test-guild-id' },
        parentId: null,
        parent: null,
        createdAt: new Date(),
        delete: jest.fn(),
        edit: jest.fn(),
        send: jest.fn(),
        messages: {
            fetch: jest.fn()
        }
    };
}
//# sourceMappingURL=orphaned-channel-cleanup-service.test.js.map