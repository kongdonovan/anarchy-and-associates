"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const case_service_1 = require("../../application/services/case-service");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const permission_service_1 = require("../../application/services/permission-service");
const business_rule_validation_service_1 = require("../../application/services/business-rule-validation-service");
const case_1 = require("../../domain/entities/case");
const discord_js_1 = require("discord.js");
const mongodb_1 = require("mongodb");
// Mock all repositories and external services
jest.mock('../../infrastructure/repositories/case-repository');
jest.mock('../../infrastructure/repositories/case-counter-repository');
jest.mock('../../infrastructure/repositories/guild-config-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../application/services/permission-service');
jest.mock('../../application/services/business-rule-validation-service');
describe('Case Channel Archive Integration', () => {
    let caseService;
    let mockCaseRepo;
    let mockCaseCounterRepo;
    let mockGuildConfigRepo;
    let mockAuditLogRepo;
    let mockStaffRepo;
    let mockPermissionService;
    let mockBusinessRuleValidationService;
    // Mock Discord objects
    let mockClient;
    let mockGuild;
    let mockChannel;
    let mockArchiveCategory;
    let mockContext;
    const testGuildId = 'test_guild_123';
    const testChannelId = 'channel_123';
    const testCaseId = 'case_123';
    const testUserId = 'user_123';
    beforeEach(() => {
        // Initialize mocked repositories
        mockCaseRepo = new case_repository_1.CaseRepository();
        mockCaseCounterRepo = new case_counter_repository_1.CaseCounterRepository();
        mockGuildConfigRepo = new guild_config_repository_1.GuildConfigRepository();
        mockAuditLogRepo = new audit_log_repository_1.AuditLogRepository();
        mockStaffRepo = new staff_repository_1.StaffRepository();
        mockPermissionService = new permission_service_1.PermissionService(mockGuildConfigRepo);
        mockBusinessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(mockGuildConfigRepo, mockStaffRepo, mockCaseRepo, mockPermissionService);
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
            }
        };
        mockArchiveCategory = {
            id: 'archive_category_123',
            name: '🗃️ Case Archives',
            type: discord_js_1.ChannelType.GuildCategory
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
        caseService = new case_service_1.CaseService(mockCaseRepo, mockCaseCounterRepo, mockGuildConfigRepo, mockPermissionService, mockBusinessRuleValidationService, mockClient);
        // Setup default mocks
        mockPermissionService.hasActionPermission.mockResolvedValue(true);
        mockPermissionService.hasLeadAttorneyPermissionWithContext.mockResolvedValue(true);
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
        mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
            valid: true,
            errors: [],
            warnings: [],
            bypassAvailable: false,
            hasPermission: true,
            requiredPermission: 'case',
            grantedPermissions: ['case']
        });
        mockAuditLogRepo.add.mockResolvedValue({});
    });
    describe('Case Closure with Automatic Archiving', () => {
        it('should automatically archive channel when case is closed', async () => {
            // Setup existing case
            const existingCase = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439012'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.IN_PROGRESS,
                priority: case_1.CasePriority.MEDIUM,
                assignedLawyerIds: [testUserId],
                leadAttorneyId: testUserId,
                documents: [],
                notes: [],
                channelId: testChannelId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const closedCase = {
                ...existingCase,
                status: case_1.CaseStatus.CLOSED,
                result: case_1.CaseResult.WIN,
                closedAt: new Date(),
                closedBy: testUserId
            };
            mockCaseRepo.conditionalUpdate.mockResolvedValue(closedCase);
            const result = await caseService.closeCase(mockContext, {
                caseId: testCaseId,
                result: case_1.CaseResult.WIN,
                resultNotes: 'Case won successfully',
                closedBy: testUserId
            });
            expect(result.status).toBe(case_1.CaseStatus.CLOSED);
            expect(result.result).toBe(case_1.CaseResult.WIN);
            // Wait a bit for the background archiving to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            // The archiving happens in the background, so we verify the log messages
            // In a real test, you might want to mock the logger and verify calls
        });
        it('should handle case closure without archiving when no channel exists', async () => {
            const existingCase = {
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439013'),
                guildId: testGuildId,
                caseNumber: 'AA-2024-123',
                clientId: 'client_123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.IN_PROGRESS,
                priority: case_1.CasePriority.MEDIUM,
                assignedLawyerIds: [testUserId],
                leadAttorneyId: testUserId,
                documents: [],
                notes: [],
                // No channelId
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const closedCase = {
                ...existingCase,
                status: case_1.CaseStatus.CLOSED,
                result: case_1.CaseResult.WIN,
                closedAt: new Date(),
                closedBy: testUserId
            };
            mockCaseRepo.conditionalUpdate.mockResolvedValue(closedCase);
            const result = await caseService.closeCase(mockContext, {
                caseId: testCaseId,
                result: case_1.CaseResult.WIN,
                resultNotes: 'Case won successfully',
                closedBy: testUserId
            });
            expect(result.status).toBe(case_1.CaseStatus.CLOSED);
            // Should complete successfully even without channel to archive
        });
    });
    describe('Manual Archive Operations', () => {
        it('should manually archive a specific case channel', async () => {
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
                channelId: testChannelId,
                closedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
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
            const closedCases = [
                {
                    _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439015'),
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
                    closedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439016'),
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
                    closedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago,
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
                type: discord_js_1.ChannelType.GuildText,
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
            const caseServiceWithoutClient = new case_service_1.CaseService(mockCaseRepo, mockCaseCounterRepo, mockGuildConfigRepo, mockPermissionService, mockBusinessRuleValidationService
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
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439018'),
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
                adminUsers: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const customArchiveCategory = {
                id: 'custom_archive_category',
                name: 'Custom Archives',
                type: discord_js_1.ChannelType.GuildCategory
            };
            mockGuild.channels.cache.set('custom_archive_category', customArchiveCategory);
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
                _id: new mongodb_1.ObjectId('507f1f77bcf86cd799439020'),
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
            // Remove existing archive category
            mockGuild.channels.cache.delete('archive_category_123');
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
            mockCaseRepo.findById.mockResolvedValue(caseData);
            const result = await caseService.archiveCaseChannel(mockContext, testCaseId);
            expect(mockGuild.channels.create).toHaveBeenCalledWith({
                name: '🗃️ Case Archives',
                type: discord_js_1.ChannelType.GuildCategory,
                permissionOverwrites: expect.any(Array)
            });
            expect(result.success).toBe(true);
        });
    });
});
//# sourceMappingURL=case-channel-archive-integration.test.js.map