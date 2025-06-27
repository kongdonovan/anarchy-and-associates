"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const case_channel_archive_service_1 = require("../../application/services/case-channel-archive-service");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const permission_service_1 = require("../../application/services/permission-service");
const business_rule_validation_service_1 = require("../../application/services/business-rule-validation-service");
const case_1 = require("../../domain/entities/case");
const discord_js_1 = require("discord.js");
const mongodb_1 = require("mongodb");
// Mock all dependencies
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../application/services/permission-service');
jest.mock('../../application/services/business-rule-validation-service');
describe('CaseChannelArchiveService', () => {
    let archiveService;
    let mockCaseRepo;
    let mockGuildConfigRepo;
    let mockAuditLogRepo;
    let mockStaffRepo;
    let mockPermissionService;
    let mockBusinessRuleValidationService;
    // Mock Discord objects
    let mockGuild;
    let mockChannel;
    let mockArchiveCategory;
    let mockContext;
    const testGuildId = 'test_guild_123';
    const testChannelId = 'channel_123';
    const testUserId = 'user_123';
    beforeEach(() => {
        // Initialize mocked dependencies
        mockCaseRepo = new case_repository_1.CaseRepository();
        mockGuildConfigRepo = new guild_config_repository_1.GuildConfigRepository();
        mockAuditLogRepo = new audit_log_repository_1.AuditLogRepository();
        mockStaffRepo = new staff_repository_1.StaffRepository();
        mockPermissionService = new permission_service_1.PermissionService(mockGuildConfigRepo);
        mockBusinessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(mockGuildConfigRepo, mockStaffRepo, mockCaseRepo, mockPermissionService);
        archiveService = new case_channel_archive_service_1.CaseChannelArchiveService(mockCaseRepo, mockGuildConfigRepo, mockAuditLogRepo, mockPermissionService, mockBusinessRuleValidationService);
        // Setup mock Discord objects
        mockChannel = {
            id: testChannelId,
            name: 'case-aa-2024-123-testclient',
            type: discord_js_1.ChannelType.GuildText,
            parentId: 'original_category_123',
            topic: 'Test case channel',
            edit: jest.fn().mockResolvedValue(true),
            messages: {
                fetch: jest.fn().mockResolvedValue(new Map([
                    ['msg1', { createdAt: new Date('2024-01-01') }]
                ]))
            },
            guild: null // Will be set after mockGuild is created
        };
        mockArchiveCategory = {
            id: 'archive_category_123',
            name: '🗃️ Case Archives',
            type: discord_js_1.ChannelType.GuildCategory
        };
        // Create a mock collection that behaves like Discord.js Collection
        const mockChannelsCache = new Map([
            [testChannelId, mockChannel],
            ['archive_category_123', mockArchiveCategory]
        ]);
        mockChannelsCache.find = jest.fn((fn) => {
            for (const [, channel] of mockChannelsCache) {
                if (fn(channel))
                    return channel;
            }
            return undefined;
        });
        mockChannelsCache.filter = jest.fn((fn) => {
            const result = new Map();
            for (const [id, channel] of mockChannelsCache) {
                if (fn(channel))
                    result.set(id, channel);
            }
            result.find = mockChannelsCache.find;
            result.filter = mockChannelsCache.filter;
            return result;
        });
        // get method is already provided by Map
        const mockRolesCache = new Map([
            ['managing_partner_role', { id: 'managing_partner_role', name: 'Managing Partner' }],
            ['senior_partner_role', { id: 'senior_partner_role', name: 'Senior Partner' }]
        ]);
        mockRolesCache.find = jest.fn((fn) => {
            for (const [, role] of mockRolesCache) {
                if (fn(role))
                    return role;
            }
            return undefined;
        });
        mockGuild = {
            id: testGuildId,
            channels: {
                cache: mockChannelsCache,
                create: jest.fn().mockResolvedValue(mockArchiveCategory)
            },
            roles: {
                everyone: { id: 'everyone_role' },
                cache: mockRolesCache
            }
        };
        // Set the guild reference on mockChannel
        mockChannel.guild = mockGuild;
        mockContext = {
            guildId: testGuildId,
            userId: testUserId,
            userRoles: ['managing_partner_role'],
            isGuildOwner: false
        };
        // Setup default mocks
        mockPermissionService.hasActionPermission.mockResolvedValue(true);
        mockBusinessRuleValidationService.validateArchiveRules = jest.fn().mockResolvedValue(true);
        mockGuildConfigRepo.findByGuildId.mockResolvedValue({
            _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439011'),
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
        mockAuditLogRepo.add.mockResolvedValue({});
    });
    describe('archiveCaseChannel', () => {
        it('should archive a case channel successfully', async () => {
            const caseData = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439012'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.CLOSED,
                priority: case_1.CasePriority.MEDIUM,
                assignedLawyerIds: [],
                documents: [],
                notes: [],
                channelId: testChannelId,
                closedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await archiveService.archiveCaseChannel(mockGuild, caseData, mockContext);
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
            const caseData = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439013'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.CLOSED,
                priority: case_1.CasePriority.MEDIUM,
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
            const caseData = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439014'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.CLOSED,
                priority: case_1.CasePriority.MEDIUM,
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
            const caseData = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439015'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.CLOSED,
                priority: case_1.CasePriority.MEDIUM,
                assignedLawyerIds: [],
                documents: [],
                notes: [],
                channelId: testChannelId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await archiveService.archiveCaseChannel(mockGuild, caseData, mockContext);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Insufficient permissions to archive case channels');
        });
        it('should create archive category if it does not exist', async () => {
            // Remove existing archive category
            mockGuild.channels.cache.delete('archive_category_123');
            mockGuildConfigRepo.findByGuildId.mockResolvedValue({
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439016'),
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
            const caseData = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439017'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.CLOSED,
                priority: case_1.CasePriority.MEDIUM,
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
                type: discord_js_1.ChannelType.GuildCategory,
                permissionOverwrites: expect.any(Array)
            });
            expect(result.success).toBe(true);
        });
    });
    describe('archiveClosedCaseChannels', () => {
        it('should archive multiple closed case channels', async () => {
            const closedCases = [
                {
                    _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439001'),
                    guildId: testGuildId,
                    caseNumber: 'AA-2024-001',
                    clientId: 'client_1',
                    clientUsername: 'client1',
                    title: 'Case 1',
                    description: 'Description 1',
                    status: case_1.CaseStatus.CLOSED,
                    priority: case_1.CasePriority.MEDIUM,
                    assignedLawyerIds: [],
                    documents: [],
                    notes: [],
                    channelId: 'channel_1',
                    closedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439002'),
                    guildId: testGuildId,
                    caseNumber: 'AA-2024-002',
                    clientId: 'client_2',
                    clientUsername: 'client2',
                    title: 'Case 2',
                    description: 'Description 2',
                    status: case_1.CaseStatus.CLOSED,
                    priority: case_1.CasePriority.MEDIUM,
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
            expect(results[0].success).toBe(true);
            expect(results[0].channelId).toBe('channel_1');
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
                type: discord_js_1.ChannelType.GuildText,
                parentId: 'some_category',
                messages: {
                    fetch: jest.fn().mockResolvedValue(new Map([
                        ['msg1', { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }] // 10 days old
                    ]))
                }
            };
            // Add the orphaned channel to the cache
            mockGuild.channels.cache.set('orphaned_channel_123', orphanedChannel);
            // Mock case repository to return no cases for orphaned channel but a case for the original channel
            mockCaseRepo.findByFilters.mockImplementation(async (filters) => {
                if (filters.channelId === testChannelId) {
                    return [{
                            _id: new mongodb_1.ObjectId(),
                            guildId: testGuildId,
                            caseNumber: 'AA-2024-123',
                            clientId: 'client_123',
                            clientUsername: 'testclient',
                            title: 'Test Case',
                            description: 'Test case description',
                            status: case_1.CaseStatus.IN_PROGRESS,
                            priority: case_1.CasePriority.MEDIUM,
                            assignedLawyerIds: [],
                            documents: [],
                            notes: [],
                            channelId: testChannelId,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }];
                }
                return [];
            });
            const orphanedChannels = await archiveService.findOrphanedCaseChannels(mockGuild, mockContext);
            expect(orphanedChannels).toHaveLength(1);
            expect(orphanedChannels[0]?.channelId).toBe('orphaned_channel_123');
            expect(orphanedChannels[0]?.channelName).toBe('case-aa-2024-999-orphaned');
            expect(orphanedChannels[0]?.inactiveDays).toBeGreaterThanOrEqual(10);
            expect(orphanedChannels[0]?.shouldArchive).toBe(true);
        });
        it('should ignore non-case channels', async () => {
            // Add a non-case channel
            const regularChannel = {
                id: 'regular_channel_123',
                name: 'general-chat',
                type: discord_js_1.ChannelType.GuildText
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
            const orphanedChannels = [
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
            const results = await archiveService.archiveOrphanedChannels(mockGuild, orphanedChannels, mockContext);
            expect(results).toHaveLength(1); // Only orphaned_1 should be archived
            expect(results[0]?.success).toBe(true);
            expect(results[0]?.channelId).toBe('orphaned_1');
        });
        it('should handle missing channels gracefully', async () => {
            const orphanedChannels = [
                {
                    channelId: 'missing_channel',
                    channelName: 'case-aa-2024-999-missing',
                    inactiveDays: 10,
                    shouldArchive: true,
                    shouldDelete: false
                }
            ];
            const results = await archiveService.archiveOrphanedChannels(mockGuild, orphanedChannels, mockContext);
            expect(results).toHaveLength(1);
            expect(results[0]?.success).toBe(false);
            expect(results[0]?.error).toBe('Channel not found');
        });
    });
    describe('error handling', () => {
        it('should handle Discord API errors gracefully', async () => {
            mockChannel.edit.mockRejectedValue(new Error('Discord API error'));
            const caseData = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439018'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.CLOSED,
                priority: case_1.CasePriority.MEDIUM,
                assignedLawyerIds: [],
                documents: [],
                notes: [],
                channelId: testChannelId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await archiveService.archiveCaseChannel(mockGuild, caseData, mockContext);
            expect(result.success).toBe(false);
            expect(result.error).toContain('error');
        });
        it('should handle audit logging failures gracefully', async () => {
            mockAuditLogRepo.add.mockRejectedValue(new Error('Audit log error'));
            const caseData = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439019'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.CLOSED,
                priority: case_1.CasePriority.MEDIUM,
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
            const caseData = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439020'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.CLOSED,
                priority: case_1.CasePriority.MEDIUM,
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
            const caseData = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439021'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.CLOSED,
                priority: case_1.CasePriority.MEDIUM,
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
//# sourceMappingURL=case-channel-archive-service.test.js.map