"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const command_validation_service_1 = require("../../application/services/command-validation-service");
const business_rule_validation_service_1 = require("../../application/services/business-rule-validation-service");
const cross_entity_validation_service_1 = require("../../application/services/cross-entity-validation-service");
const permission_service_1 = require("../../application/services/permission-service");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const application_repository_1 = require("../../infrastructure/repositories/application-repository");
const job_repository_1 = require("../../infrastructure/repositories/job-repository");
const retainer_repository_1 = require("../../infrastructure/repositories/retainer-repository");
const feedback_repository_1 = require("../../infrastructure/repositories/feedback-repository");
const reminder_repository_1 = require("../../infrastructure/repositories/reminder-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const mongodb_1 = require("mongodb");
const validation_error_handler_1 = require("../../presentation/utils/validation-error-handler");
describe('Command Validation Scenarios', () => {
    let mongoServer;
    let mongoClient;
    let commandValidationService;
    let businessRuleValidationService;
    let crossEntityValidationService;
    let permissionService;
    // Repositories
    let staffRepository;
    let caseRepository;
    let guildConfigRepository;
    let auditLogRepository;
    beforeAll(async () => {
        mongoServer = await mongodb_memory_server_1.MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        mongoClient = new mongodb_1.MongoClient(mongoUri);
        await mongoClient.connect();
    });
    afterAll(async () => {
        await mongoClient.close();
        await mongoServer.stop();
    });
    beforeEach(async () => {
        // Clear database
        const db = mongoClient.db();
        const collections = await db.collections();
        for (const collection of collections) {
            await collection.deleteMany({});
        }
        // Initialize repositories
        staffRepository = new staff_repository_1.StaffRepository();
        caseRepository = new case_repository_1.CaseRepository();
        guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        const applicationRepository = new application_repository_1.ApplicationRepository();
        const jobRepository = new job_repository_1.JobRepository();
        const retainerRepository = new retainer_repository_1.RetainerRepository();
        const feedbackRepository = new feedback_repository_1.FeedbackRepository();
        const reminderRepository = new reminder_repository_1.ReminderRepository();
        // Initialize services
        permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        businessRuleValidationService = new business_rule_validation_service_1.BusinessRuleValidationService(guildConfigRepository, staffRepository, caseRepository, permissionService);
        crossEntityValidationService = new cross_entity_validation_service_1.CrossEntityValidationService(staffRepository, caseRepository, applicationRepository, jobRepository, retainerRepository, feedbackRepository, reminderRepository, auditLogRepository, businessRuleValidationService);
        commandValidationService = new command_validation_service_1.CommandValidationService(businessRuleValidationService, crossEntityValidationService);
    });
    describe('Staff Hire Command Validation', () => {
        it('should pass validation for normal hire within limits', async () => {
            // Setup: Add some existing staff
            await staffRepository.add({
                guildId: 'guild123',
                userId: 'existing1',
                discordUsername: 'Existing1#0001',
                robloxUsername: 'ExistingRoblox1',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                hiredAt: new Date(),
                hiredBy: 'manager123',
                status: RetainerStatus.ACTIVE,
            });
            const mockInteraction = createMockInteraction('staff', 'hire', {
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            });
            const permissionContext = {
                guildId: 'guild123',
                userId: 'manager123',
                userRoles: ['hr_role'],
                isGuildOwner: false,
            };
            // Add manager as senior staff
            await staffRepository.add({
                guildId: 'guild123',
                userId: 'manager123',
                discordUsername: 'Manager#0001',
                robloxUsername: 'ManagerRoblox',
                role: staff_role_1.StaffRole.SENIOR_PARTNER,
                hiredAt: new Date(),
                hiredBy: 'owner123',
                status: RetainerStatus.ACTIVE,
            });
            const validationContext = await commandValidationService.extractValidationContext(mockInteraction, permissionContext);
            const result = await commandValidationService.validateCommand(validationContext);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });
        it('should fail validation when role limit is reached', async () => {
            // Fill up Junior Associate positions (max 10)
            for (let i = 0; i < 10; i++) {
                await staffRepository.add({
                    guildId: 'guild123',
                    userId: `junior${i}`,
                    discordUsername: `Junior${i}#0001`,
                    robloxUsername: `JuniorRoblox${i}`,
                    role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                    hiredAt: new Date(),
                    hiredBy: 'manager123',
                    status: RetainerStatus.ACTIVE,
                });
            }
            const mockInteraction = createMockInteraction('staff', 'hire', {
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            });
            const permissionContext = {
                guildId: 'guild123',
                userId: 'manager123',
                userRoles: ['hr_role'],
                isGuildOwner: false,
            };
            const validationContext = await commandValidationService.extractValidationContext(mockInteraction, permissionContext);
            const result = await commandValidationService.validateCommand(validationContext);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Cannot hire Junior Associate. Maximum limit of 10 reached (current: 10)');
            expect(result.requiresConfirmation).toBe(false); // Not guild owner
        });
        it('should offer bypass option for guild owner when limit reached', async () => {
            // Fill up Junior Associate positions
            for (let i = 0; i < 10; i++) {
                await staffRepository.add({
                    guildId: 'guild123',
                    userId: `junior${i}`,
                    discordUsername: `Junior${i}#0001`,
                    robloxUsername: `JuniorRoblox${i}`,
                    role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                    hiredAt: new Date(),
                    hiredBy: 'owner123',
                    status: RetainerStatus.ACTIVE,
                });
            }
            const mockInteraction = createMockInteraction('staff', 'hire', {
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            });
            const permissionContext = {
                guildId: 'guild123',
                userId: 'owner123',
                userRoles: ['owner_role'],
                isGuildOwner: true, // Guild owner
            };
            const validationContext = await commandValidationService.extractValidationContext(mockInteraction, permissionContext);
            const result = await commandValidationService.validateCommand(validationContext);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Cannot hire Junior Associate. Maximum limit of 10 reached (current: 10)');
            expect(result.requiresConfirmation).toBe(true); // Guild owner can bypass
            expect(result.bypassRequests).toHaveLength(1);
            expect(result.bypassRequests[0]?.validationResult?.bypassType).toBe('guild-owner');
        });
    });
    describe('Staff Fire Command Validation', () => {
        it('should validate entity relationships before firing', async () => {
            const staffMember = await staffRepository.add({
                guildId: 'guild123',
                userId: 'staff123',
                discordUsername: 'Staff#0001',
                robloxUsername: 'StaffRoblox',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                hiredAt: new Date(),
                hiredBy: 'manager123',
                status: RetainerStatus.ACTIVE,
            });
            // Create a case assigned to this staff member
            await caseRepository.add({
                guildId: 'guild123',
                caseNumber: 'CASE-001',
                title: 'Test Case',
                description: 'Test',
                status: 'in_progress',
                priority: CasePriority.MEDIUM,
                assignedTo: ['staff123'],
                leadAttorney: 'staff123',
                client: {
                    userId: 'client123',
                    username: 'Client#0001',
                },
                createdBy: 'manager123',
            });
            const mockInteraction = createMockInteraction('staff', 'fire', {
                user: 'staff123',
            });
            const permissionContext = {
                guildId: 'guild123',
                userId: 'manager123',
                userRoles: ['hr_role'],
                isGuildOwner: false,
            };
            const validationContext = await commandValidationService.extractValidationContext(mockInteraction, permissionContext);
            const result = await commandValidationService.validateCommand(validationContext);
            // Should warn about active cases but not block
            expect(result.isValid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain('active cases');
        });
    });
    describe('Case Creation Validation', () => {
        it('should enforce client case limits', async () => {
            const clientId = 'client123';
            // Create 5 active cases for the client (the limit)
            for (let i = 1; i <= 5; i++) {
                await caseRepository.add({
                    guildId: 'guild123',
                    caseNumber: `CASE-00${i}`,
                    title: `Case ${i}`,
                    description: 'Test case',
                    status: 'in_progress',
                    priority: CasePriority.MEDIUM,
                    assignedTo: [],
                    client: {
                        userId: clientId,
                        username: 'Client#0001',
                    },
                    createdBy: 'attorney123',
                });
            }
            const mockInteraction = createMockInteraction('case', 'create', {
                client: clientId,
            });
            const permissionContext = {
                guildId: 'guild123',
                userId: 'attorney123',
                userRoles: ['case_role'],
                isGuildOwner: false,
            };
            const validationContext = await commandValidationService.extractValidationContext(mockInteraction, permissionContext);
            const result = await commandValidationService.validateCommand(validationContext);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Client has reached maximum active case limit (5). Current active cases: 5');
            expect(result.requiresConfirmation).toBe(false); // No bypass for case limits
        });
        it('should warn when approaching case limit', async () => {
            const clientId = 'client123';
            // Create 3 active cases (approaching limit of 5)
            for (let i = 1; i <= 3; i++) {
                await caseRepository.add({
                    guildId: 'guild123',
                    caseNumber: `CASE-00${i}`,
                    title: `Case ${i}`,
                    description: 'Test case',
                    status: 'in_progress',
                    priority: CasePriority.MEDIUM,
                    assignedTo: [],
                    client: {
                        userId: clientId,
                        username: 'Client#0001',
                    },
                    createdBy: 'attorney123',
                });
            }
            const mockInteraction = createMockInteraction('case', 'create', {
                client: clientId,
            });
            const permissionContext = {
                guildId: 'guild123',
                userId: 'attorney123',
                userRoles: ['case_role'],
                isGuildOwner: false,
            };
            const validationContext = await commandValidationService.extractValidationContext(mockInteraction, permissionContext);
            const result = await commandValidationService.validateCommand(validationContext);
            expect(result.isValid).toBe(true);
            expect(result.warnings).toContain('Client has 3 active cases (limit: 5)');
        });
    });
    describe('Validation Error Handling', () => {
        it('should create user-friendly error embeds', () => {
            const validationResult = {
                isValid: false,
                errors: [
                    'Missing required permission: admin',
                    'Cannot hire Managing Partner. Maximum limit of 1 reached (current: 1)',
                ],
                warnings: [],
                requiresConfirmation: false,
            };
            const embed = validation_error_handler_1.ValidationErrorHandler.createValidationErrorEmbed(validationResult, 'staff', 'hire');
            expect(embed.data.title).toBe('❌ Staff Hire Failed');
            expect(embed.data.fields).toBeDefined();
            expect(embed.data.fields.length).toBeGreaterThan(0);
            // Check that errors are categorized
            const permissionField = embed.data.fields.find(f => f.name.includes('Permissions'));
            expect(permissionField).toBeDefined();
            const limitsField = embed.data.fields.find(f => f.name.includes('Limits'));
            expect(limitsField).toBeDefined();
        });
        it('should create bypass confirmation embeds', () => {
            const bypassRequests = [
                {
                    validationResult: {
                        valid: false,
                        errors: ['Cannot hire Junior Associate. Maximum limit of 10 reached'],
                        warnings: [],
                        bypassAvailable: true,
                        bypassType: 'guild-owner',
                    },
                    context: {},
                },
            ];
            const embed = validation_error_handler_1.ValidationErrorHandler.createBypassConfirmationEmbed(bypassRequests);
            expect(embed.data.title).toBe('⚠️ Validation Override Confirmation');
            expect(embed.data.description).toContain('override the following validations');
            expect(embed.data.fields).toBeDefined();
            expect(embed.data.fields.some(f => f.name === '⚠️ Warning')).toBe(true);
        });
    });
    // Helper function to create mock interaction
    function createMockInteraction(commandName, subcommandName, options) {
        return {
            commandName,
            guildId: 'guild123',
            user: { id: 'user123' },
            options: {
                getSubcommand: jest.fn().mockReturnValue(subcommandName),
                data: Object.entries(options).map(([name, value]) => ({ name, value })),
            },
            guild: {
                id: 'guild123',
                ownerId: 'owner123',
            },
            reply: jest.fn(),
            showModal: jest.fn(),
            isCommand: jest.fn().mockReturnValue(true),
        };
    }
});
//# sourceMappingURL=command-validation-scenarios.test.js.map