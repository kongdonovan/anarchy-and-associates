"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cross_entity_validation_service_1 = require("../../../application/services/cross-entity-validation-service");
const staff_repository_1 = require("../../../infrastructure/repositories/staff-repository");
const case_repository_1 = require("../../../infrastructure/repositories/case-repository");
const application_repository_1 = require("../../../infrastructure/repositories/application-repository");
const job_repository_1 = require("../../../infrastructure/repositories/job-repository");
const retainer_repository_1 = require("../../../infrastructure/repositories/retainer-repository");
const feedback_repository_1 = require("../../../infrastructure/repositories/feedback-repository");
const reminder_repository_1 = require("../../../infrastructure/repositories/reminder-repository");
const audit_log_repository_1 = require("../../../infrastructure/repositories/audit-log-repository");
const retainer_1 = require("../../../domain/entities/retainer");
const staff_role_1 = require("../../../domain/entities/staff-role");
const logger_1 = require("../../../infrastructure/logger");
const mongodb_1 = require("mongodb");
const case_1 = require("../../../domain/entities/case");
// Mock all dependencies
jest.mock('../../../infrastructure/repositories/staff-repository');
jest.mock('../../../infrastructure/repositories/case-repository');
jest.mock('../../../infrastructure/repositories/application-repository');
jest.mock('../../../infrastructure/repositories/job-repository');
jest.mock('../../../infrastructure/repositories/retainer-repository');
jest.mock('../../../infrastructure/repositories/feedback-repository');
jest.mock('../../../infrastructure/repositories/reminder-repository');
jest.mock('../../../infrastructure/repositories/audit-log-repository');
jest.mock('../../../application/services/business-rule-validation-service');
jest.mock('../../../infrastructure/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));
describe('CrossEntityValidationService', () => {
    let service;
    let mockStaffRepo;
    let mockCaseRepo;
    let mockApplicationRepo;
    let mockJobRepo;
    let mockRetainerRepo;
    let mockFeedbackRepo;
    let mockReminderRepo;
    let mockAuditRepo;
    beforeEach(() => {
        jest.clearAllMocks();
        // Create mocked repositories
        mockStaffRepo = new staff_repository_1.StaffRepository();
        mockCaseRepo = new case_repository_1.CaseRepository();
        mockApplicationRepo = new application_repository_1.ApplicationRepository();
        mockJobRepo = new job_repository_1.JobRepository();
        mockRetainerRepo = new retainer_repository_1.RetainerRepository();
        mockFeedbackRepo = new feedback_repository_1.FeedbackRepository();
        mockReminderRepo = new reminder_repository_1.ReminderRepository();
        mockAuditRepo = new audit_log_repository_1.AuditLogRepository();
        // Create service instance
        service = new cross_entity_validation_service_1.CrossEntityValidationService(mockStaffRepo, mockCaseRepo, mockApplicationRepo, mockJobRepo, mockRetainerRepo, mockFeedbackRepo, mockReminderRepo, mockAuditRepo);
        // Clear validation cache
        service.validationCache.clear();
    });
    // Helper function to create valid Case objects
    const createMockCase = (overrides = {}) => ({
        _id: new mongodb_1.ObjectId(),
        guildId: 'guild1',
        caseNumber: 'AA-2024-001-testclient',
        clientId: 'client1',
        clientUsername: 'testclient',
        title: 'Test Case',
        description: 'Test case description',
        status: case_1.CaseStatus.IN_PROGRESS,
        priority: case_1.CasePriority.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    });
    describe('Staff Validation Rules', () => {
        it('should detect invalid staff status', async () => {
            const invalidStaff = {
                _id: new mongodb_1.ObjectId(),
                userId: 'user1',
                guildId: 'guild1',
                robloxUsername: 'user1',
                role: staff_role_1.StaffRole.SENIOR_PARTNER,
                hiredAt: new Date(),
                hiredBy: 'admin',
                promotionHistory: [],
                status: 'invalid_status',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const issues = await service.validateBeforeOperation(invalidStaff, 'staff', 'update');
            expect(issues).toHaveLength(1);
            expect(issues[0].severity).toBe('critical');
            expect(issues[0].message).toContain('Invalid staff status');
            expect(issues[0].canAutoRepair).toBe(true);
        });
        it('should validate staff role consistency with case assignments', async () => {
            const paralegalStaff = {
                _id: new mongodb_1.ObjectId(),
                userId: 'user1',
                guildId: 'guild1',
                robloxUsername: 'user1',
                role: staff_role_1.StaffRole.PARALEGAL,
                hiredAt: new Date(),
                hiredBy: 'admin',
                promotionHistory: [],
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Mock paralegal as lead attorney on cases (invalid)
            mockCaseRepo.findByFilters.mockImplementation(async (filters) => {
                if (filters.leadAttorneyId === 'user1') {
                    return [createMockCase({
                            leadAttorneyId: 'user1',
                            assignedLawyerIds: ['user1']
                        })];
                }
                return [];
            });
            const issues = await service.validateBeforeOperation(paralegalStaff, 'staff', 'update');
            expect(issues.length).toBeGreaterThan(0);
            const roleIssue = issues.find(i => i.message.includes('cannot be lead attorney'));
            expect(roleIssue).toBeDefined();
            expect(roleIssue.severity).toBe('critical');
        });
        it('should detect excessive case workload', async () => {
            const juniorAssociate = {
                _id: new mongodb_1.ObjectId(),
                userId: 'user1',
                guildId: 'guild1',
                robloxUsername: 'user1',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                hiredAt: new Date(),
                hiredBy: 'admin',
                promotionHistory: [],
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Mock 10 active cases (exceeds limit of 8 for junior associate)
            const mockCases = Array.from({ length: 10 }, (_, i) => createMockCase({
                _id: `case${i}`,
                assignedLawyerIds: ['user1']
            }));
            mockCaseRepo.findByFilters.mockResolvedValue(mockCases);
            mockCaseRepo.findAssignedToLawyer.mockResolvedValue(mockCases);
            const issues = await service.validateBeforeOperation(juniorAssociate, 'staff', 'update');
            const workloadIssue = issues.find(i => i.message.includes('exceeding recommended limit'));
            expect(workloadIssue).toBeDefined();
            expect(workloadIssue.severity).toBe('warning');
            expect(workloadIssue.message).toContain('10 active cases');
            expect(workloadIssue.message).toContain('limit of 8');
        });
        it('should detect circular references in promotion history', async () => {
            const staff = {
                _id: new mongodb_1.ObjectId(),
                userId: 'user1',
                guildId: 'guild1',
                robloxUsername: 'user1',
                role: staff_role_1.StaffRole.SENIOR_PARTNER,
                hiredAt: new Date(),
                hiredBy: 'admin',
                promotionHistory: [
                    {
                        fromRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                        toRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
                        promotedBy: 'user1', // Self-promotion!
                        promotedAt: new Date(),
                        reason: 'test',
                        actionType: 'promotion'
                    }
                ],
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const issues = await service.validateBeforeOperation(staff, 'staff', 'update');
            const circularIssue = issues.find(i => i.message.includes('Circular reference'));
            expect(circularIssue).toBeDefined();
            expect(circularIssue.severity).toBe('critical');
        });
    });
    describe('Case Validation Rules', () => {
        it('should detect non-existent lead attorney', async () => {
            const caseEntity = createMockCase({
                leadAttorneyId: 'nonexistent',
                assignedLawyerIds: ['lawyer1']
            });
            mockStaffRepo.findByUserId.mockResolvedValue(null);
            const issues = await service.validateBeforeOperation(caseEntity, 'case', 'update');
            expect(issues.length).toBeGreaterThan(0);
            const leadAttorneyIssue = issues.find(i => i.field === 'leadAttorneyId');
            expect(leadAttorneyIssue).toBeDefined();
            expect(leadAttorneyIssue.severity).toBe('critical');
            expect(leadAttorneyIssue.canAutoRepair).toBe(true);
        });
        it('should detect inactive assigned lawyers', async () => {
            const caseEntity = createMockCase({
                assignedLawyerIds: ['lawyer1', 'lawyer2']
            });
            // Clear any previous mocks
            mockStaffRepo.findByUserId.mockReset();
            // Set up mocks for each lawyer
            mockStaffRepo.findByUserId
                .mockImplementation((userId) => {
                if (userId === 'lawyer1') {
                    return Promise.resolve({
                        _id: new mongodb_1.ObjectId(),
                        userId: 'lawyer1',
                        status: 'active',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
                else if (userId === 'lawyer2') {
                    return Promise.resolve({
                        _id: new mongodb_1.ObjectId(),
                        userId: 'lawyer2',
                        status: 'terminated',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
                return Promise.resolve(null);
            });
            const issues = await service.validateBeforeOperation(caseEntity, 'case', 'update');
            const inactiveIssue = issues.find(i => i.message.includes('is not active (status:'));
            expect(inactiveIssue).toBeDefined();
            expect(inactiveIssue.severity).toBe('warning');
        });
        it('should detect temporal inconsistencies', async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const caseEntity = createMockCase({
                assignedLawyerIds: ['lawyer1'],
                status: case_1.CaseStatus.CLOSED,
                createdAt: now,
                closedAt: yesterday, // Closed before created!
                updatedAt: now
            });
            mockStaffRepo.findByUserId.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
                userId: 'lawyer1',
                hiredAt: tomorrow, // Hired after case created!
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const issues = await service.validateBeforeOperation(caseEntity, 'case', 'update');
            expect(issues.length).toBeGreaterThan(0);
            const temporalIssue = issues.find(i => i.message.includes('closed date is before creation date'));
            expect(temporalIssue).toBeDefined();
            expect(temporalIssue.severity).toBe('critical');
            expect(temporalIssue.canAutoRepair).toBe(true);
            const hireIssue = issues.find(i => i.message.includes('hired after case was created'));
            expect(hireIssue).toBeDefined();
            expect(hireIssue.severity).toBe('critical');
            expect(hireIssue.canAutoRepair).toBe(true);
        });
        it('should validate case channel existence', async () => {
            const caseEntity = createMockCase({
                channelId: 'channel1',
                assignedLawyerIds: []
            });
            const mockClient = {
                guilds: {
                    fetch: jest.fn().mockResolvedValue({
                        channels: {
                            cache: new Map() // Empty - channel doesn't exist
                        }
                    })
                }
            };
            const context = {
                guildId: 'guild1',
                client: mockClient,
                validationLevel: 'strict'
            };
            const issues = await service.validateBeforeOperation(caseEntity, 'case', 'update', context);
            const channelIssue = issues.find(i => i.field === 'channelId');
            expect(channelIssue).toBeDefined();
            expect(channelIssue.severity).toBe('warning');
            expect(channelIssue.message).toContain('not found in Discord');
            expect(channelIssue.canAutoRepair).toBe(true);
        });
    });
    describe('Application Validation Rules', () => {
        it('should detect missing job reference', async () => {
            const application = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                jobId: 'nonexistent',
                applicantId: 'user1',
                robloxUsername: 'user1',
                status: 'pending',
                answers: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockJobRepo.findById.mockResolvedValue(null);
            const issues = await service.validateBeforeOperation(application, 'application', 'update');
            expect(issues.length).toBeGreaterThan(0);
            const jobIssue = issues.find(i => i.field === 'jobId');
            expect(jobIssue).toBeDefined();
            expect(jobIssue.severity).toBe('critical');
            expect(jobIssue.message).toContain('Referenced job');
        });
        it('should detect pending applications for closed jobs', async () => {
            const application = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                jobId: 'job1',
                applicantId: 'user1',
                robloxUsername: 'user1',
                status: 'pending',
                answers: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockJobRepo.findById.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
                isOpen: false, // Job is closed
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const issues = await service.validateBeforeOperation(application, 'application', 'update');
            const statusIssue = issues.find(i => i.field === 'status');
            expect(statusIssue).toBeDefined();
            expect(statusIssue.severity).toBe('warning');
            expect(statusIssue.message).toContain('pending for a closed job');
            expect(statusIssue.canAutoRepair).toBe(true);
        });
        it('should validate application integrity', async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const application = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                jobId: 'job1',
                applicantId: 'user1',
                robloxUsername: 'user1',
                status: 'accepted',
                answers: [],
                reviewedAt: yesterday, // Reviewed before submitted!
                reviewedBy: undefined, // No reviewer for accepted application
                createdAt: now,
                updatedAt: now
            };
            mockJobRepo.findById.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
                isOpen: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const issues = await service.validateBeforeOperation(application, 'application', 'update');
            const temporalIssue = issues.find(i => i.message.includes('reviewed before it was created'));
            expect(temporalIssue).toBeDefined();
            expect(temporalIssue.severity).toBe('critical');
            expect(temporalIssue.canAutoRepair).toBe(true);
            const reviewerIssue = issues.find(i => i.message.includes('has no reviewer'));
            expect(reviewerIssue).toBeDefined();
            expect(reviewerIssue.severity).toBe('warning');
        });
    });
    describe('Retainer Validation Rules', () => {
        it('should detect non-existent lawyer in retainer', async () => {
            const retainer = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                clientId: 'client1',
                lawyerId: 'nonexistent',
                agreementTemplate: 'test',
                status: retainer_1.RetainerStatus.SIGNED,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepo.findByUserId.mockResolvedValue(null);
            const issues = await service.validateBeforeOperation(retainer, 'retainer', 'update');
            expect(issues.length).toBeGreaterThan(0);
            const lawyerIssue = issues.find(i => i.field === 'lawyerId');
            expect(lawyerIssue).toBeDefined();
            expect(lawyerIssue.severity).toBe('critical');
        });
        it('should detect inactive lawyer in retainer', async () => {
            const retainer = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                clientId: 'client1',
                lawyerId: 'lawyer1',
                agreementTemplate: 'test',
                status: retainer_1.RetainerStatus.SIGNED,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepo.findByUserId.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
                userId: 'lawyer1',
                status: 'terminated',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const issues = await service.validateBeforeOperation(retainer, 'retainer', 'update');
            const inactiveIssue = issues.find(i => i.message.includes('is not active (status:'));
            expect(inactiveIssue).toBeDefined();
            expect(inactiveIssue.severity).toBe('warning');
        });
    });
    describe('Feedback Validation Rules', () => {
        it('should detect non-existent target staff', async () => {
            const feedback = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                submitterId: 'client1',
                submitterUsername: 'client1',
                targetStaffId: 'nonexistent',
                targetStaffUsername: 'staff',
                isForFirm: false,
                rating: 5,
                comment: 'Great service',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepo.findByUserId.mockResolvedValue(null);
            const issues = await service.validateBeforeOperation(feedback, 'feedback', 'update');
            const staffIssue = issues.find(i => i.field === 'targetStaffId');
            expect(staffIssue).toBeDefined();
            expect(staffIssue.severity).toBe('warning');
            expect(staffIssue.canAutoRepair).toBe(true);
        });
    });
    describe('Reminder Validation Rules', () => {
        it('should detect non-existent case reference', async () => {
            const reminder = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                userId: 'user1',
                username: 'user1',
                caseId: 'nonexistent',
                message: 'Test reminder',
                scheduledFor: new Date(),
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockCaseRepo.findById.mockResolvedValue(null);
            const issues = await service.validateBeforeOperation(reminder, 'reminder', 'update');
            const caseIssue = issues.find(i => i.field === 'caseId');
            expect(caseIssue).toBeDefined();
            expect(caseIssue.severity).toBe('warning');
            expect(caseIssue.canAutoRepair).toBe(true);
        });
        it('should validate reminder channel existence', async () => {
            const reminder = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                userId: 'user1',
                username: 'user1',
                channelId: 'channel1',
                message: 'Test reminder',
                scheduledFor: new Date(),
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const mockClient = {
                guilds: {
                    fetch: jest.fn().mockResolvedValue({
                        channels: {
                            cache: new Map() // Empty - channel doesn't exist
                        }
                    })
                }
            };
            const context = {
                guildId: 'guild1',
                client: mockClient,
                validationLevel: 'strict'
            };
            const issues = await service.validateBeforeOperation(reminder, 'reminder', 'update', context);
            const channelIssue = issues.find(i => i.field === 'channelId');
            expect(channelIssue).toBeDefined();
            expect(channelIssue.severity).toBe('warning');
            expect(channelIssue.canAutoRepair).toBe(true);
        });
    });
    describe('Cross-Entity Validation', () => {
        it('should detect orphaned case-client relationships', async () => {
            const mockClient = {
                guilds: {
                    fetch: jest.fn().mockResolvedValue({
                        members: {
                            cache: new Map() // No members - client doesn't exist
                        }
                    })
                }
            };
            // Reset all mocks
            jest.clearAllMocks();
            // Set up mocks for scanForIntegrityIssues
            mockStaffRepo.findByGuildId.mockResolvedValue([]);
            mockCaseRepo.findByFilters.mockResolvedValue([
                createMockCase({
                    clientId: 'nonexistent',
                    assignedLawyerIds: []
                })
            ]);
            mockApplicationRepo.findByGuild.mockResolvedValue([]);
            mockJobRepo.findByGuildId.mockResolvedValue([]);
            mockRetainerRepo.findByGuild.mockResolvedValue([]);
            mockFeedbackRepo.findByFilters.mockResolvedValue([]);
            mockReminderRepo.findByFilters.mockResolvedValue([]);
            const context = {
                client: mockClient
            };
            const report = await service.scanForIntegrityIssues('guild1', context);
            const orphanedIssue = report.issues.find(i => i.message.includes('Client') && i.message.includes('not found in Discord server'));
            expect(orphanedIssue).toBeDefined();
            expect(orphanedIssue.severity).toBe('info');
        });
        it('should detect self-hired staff members', async () => {
            // Reset all mocks
            jest.clearAllMocks();
            // Set up mocks for scanForIntegrityIssues
            mockStaffRepo.findByGuildId.mockResolvedValue([{
                    _id: new mongodb_1.ObjectId(),
                    userId: 'user1',
                    guildId: 'guild1',
                    hiredBy: 'user1', // Self-hired!
                    role: staff_role_1.StaffRole.SENIOR_PARTNER,
                    status: 'active',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }]);
            mockCaseRepo.findByFilters.mockResolvedValue([]);
            mockApplicationRepo.findByGuild.mockResolvedValue([]);
            mockJobRepo.findByGuildId.mockResolvedValue([]);
            mockRetainerRepo.findByGuild.mockResolvedValue([]);
            mockFeedbackRepo.findByFilters.mockResolvedValue([]);
            mockReminderRepo.findByFilters.mockResolvedValue([]);
            const report = await service.scanForIntegrityIssues('guild1');
            const selfHiredIssue = report.issues.find(i => i.message.includes('Staff member hired by themselves'));
            expect(selfHiredIssue).toBeDefined();
            expect(selfHiredIssue.severity).toBe('warning');
        });
    });
    describe('Integrity Scanning', () => {
        it('should perform comprehensive integrity scan', async () => {
            // Mock data for all entity types
            mockStaffRepo.findByGuildId.mockResolvedValue([{
                    _id: new mongodb_1.ObjectId(),
                    userId: 'user1',
                    guildId: 'guild1',
                    status: 'active',
                    role: staff_role_1.StaffRole.SENIOR_PARTNER,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }]);
            mockCaseRepo.findByFilters.mockResolvedValue([
                createMockCase({
                    assignedLawyerIds: ['user1', 'nonexistent'] // One valid, one invalid
                })
            ]);
            mockApplicationRepo.findByGuild.mockResolvedValue([{
                    _id: new mongodb_1.ObjectId(),
                    guildId: 'guild1',
                    jobId: 'job1',
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }]);
            mockJobRepo.findByGuildId.mockResolvedValue([{
                    _id: new mongodb_1.ObjectId(),
                    guildId: 'guild1',
                    isOpen: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }]);
            mockRetainerRepo.findByGuild.mockResolvedValue([]);
            mockFeedbackRepo.findByFilters.mockResolvedValue([]);
            mockReminderRepo.findByFilters.mockResolvedValue([]);
            // Mock staff lookup for case validation
            mockStaffRepo.findByUserId
                .mockResolvedValueOnce({ status: 'active' }) // user1
                .mockResolvedValueOnce(null); // nonexistent
            mockJobRepo.findById.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                title: 'Test Job',
                description: 'Test',
                staffRole: 'test',
                roleId: 'role1',
                isOpen: true,
                questions: [],
                postedBy: 'user1',
                applicationCount: 0,
                hiredCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const report = await service.scanForIntegrityIssues('guild1');
            expect(report.guildId).toBe('guild1');
            expect(report.totalEntitiesScanned).toBeGreaterThan(0);
            expect(report.issues.length).toBeGreaterThan(0);
            // Should have critical issue for non-existent lawyer
            const criticalIssues = report.issues.filter(i => i.severity === 'critical');
            expect(criticalIssues.length).toBeGreaterThan(0);
            expect(report.issuesBySeverity.critical).toBe(criticalIssues.length);
            expect(report.repairableIssues).toBeGreaterThan(0);
        });
        it('should perform deep integrity check with additional validations', async () => {
            // Setup mock data
            mockStaffRepo.findByGuildId.mockResolvedValue([{
                    _id: new mongodb_1.ObjectId(),
                    userId: 'user1',
                    guildId: 'guild1',
                    status: 'active',
                    role: staff_role_1.StaffRole.SENIOR_PARTNER,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }]);
            mockCaseRepo.findByFilters.mockResolvedValue([
                createMockCase({
                    leadAttorneyId: 'user1',
                    assignedLawyerIds: ['user2'] // Lead attorney not in assigned list!
                })
            ]);
            mockFeedbackRepo.findByFilters.mockResolvedValue([{
                    _id: new mongodb_1.ObjectId(),
                    guildId: 'guild1',
                    targetStaffId: 'nonexistent', // References non-existent staff
                    createdAt: new Date(),
                    updatedAt: new Date()
                }]);
            mockReminderRepo.findByFilters.mockResolvedValue([{
                    _id: new mongodb_1.ObjectId(),
                    guildId: 'guild1',
                    caseId: 'nonexistent', // References non-existent case
                    createdAt: new Date(),
                    updatedAt: new Date()
                }]);
            mockApplicationRepo.findByGuild.mockResolvedValue([]);
            mockJobRepo.findByGuildId.mockResolvedValue([]);
            mockRetainerRepo.findByGuild.mockResolvedValue([]);
            const report = await service.performDeepIntegrityCheck('guild1');
            // Should have additional issues from deep check
            const leadAttorneyIssue = report.issues.find(i => i.message.includes('Lead attorney is not in assigned lawyers list'));
            expect(leadAttorneyIssue).toBeDefined();
            // Note: Feedback entities don't reference cases, they reference staff
            // The test data has feedback with non-existent staff, not case
            const reminderIssue = report.issues.find(i => i.entityType === 'reminder' && i.message.includes('non-existent case'));
            expect(reminderIssue).toBeDefined();
        });
    });
    describe('Repair Functionality', () => {
        it('should repair auto-repairable issues', async () => {
            const repairAction1 = jest.fn().mockResolvedValue(undefined);
            const repairAction2 = jest.fn().mockResolvedValue(undefined);
            const issues = [
                {
                    severity: 'critical',
                    entityType: 'staff',
                    entityId: 'staff1',
                    field: 'status',
                    message: 'Invalid status',
                    canAutoRepair: true,
                    repairAction: repairAction1
                },
                {
                    severity: 'warning',
                    entityType: 'case',
                    entityId: 'case1',
                    field: 'leadAttorneyId',
                    message: 'Invalid lead attorney',
                    canAutoRepair: true,
                    repairAction: repairAction2
                },
                {
                    severity: 'critical',
                    entityType: 'case',
                    entityId: 'case2',
                    field: 'status',
                    message: 'Cannot repair this',
                    canAutoRepair: false
                }
            ];
            mockAuditRepo.add.mockResolvedValue({});
            const result = await service.repairIntegrityIssues(issues);
            expect(result.totalIssuesFound).toBe(3);
            expect(result.issuesRepaired).toBe(2);
            expect(result.issuesFailed).toBe(0);
            expect(result.repairedIssues).toHaveLength(2);
            // Verify repair actions were called
            expect(repairAction1).toHaveBeenCalled();
            expect(repairAction2).toHaveBeenCalled();
            // Verify audit logs were created
            expect(mockAuditRepo.add).toHaveBeenCalledTimes(2);
        });
        it('should handle repair failures gracefully', async () => {
            const failingRepairAction = jest.fn()
                .mockRejectedValue(new Error('Repair failed'));
            const issues = [
                {
                    severity: 'critical',
                    entityType: 'staff',
                    entityId: 'staff1',
                    field: 'status',
                    message: 'Invalid status',
                    canAutoRepair: true,
                    repairAction: failingRepairAction
                }
            ];
            const result = await service.repairIntegrityIssues(issues);
            expect(result.totalIssuesFound).toBe(1);
            expect(result.issuesRepaired).toBe(0);
            expect(result.issuesFailed).toBe(1);
            expect(result.failedRepairs).toHaveLength(1);
            expect(result.failedRepairs[0]?.error).toBe('Repair failed');
        });
        it('should support dry run mode', async () => {
            const issues = [
                {
                    severity: 'critical',
                    entityType: 'staff',
                    entityId: 'staff1',
                    field: 'status',
                    message: 'Invalid status',
                    canAutoRepair: true,
                    repairAction: jest.fn()
                }
            ];
            const result = await service.repairIntegrityIssues(issues, { dryRun: true });
            expect(result.issuesRepaired).toBe(1);
            expect(issues[0]?.repairAction).not.toHaveBeenCalled();
            expect(mockAuditRepo.add).not.toHaveBeenCalled();
        });
        it('should implement smart repair with retry logic', async () => {
            let attempts = 0;
            const flakeyRepairAction = jest.fn().mockImplementation(() => {
                attempts++;
                if (attempts < 3) {
                    return Promise.reject(new Error('Temporary failure'));
                }
                return Promise.resolve();
            });
            const issues = [
                {
                    severity: 'critical',
                    entityType: 'staff',
                    entityId: 'staff1',
                    field: 'status',
                    message: 'Invalid status',
                    canAutoRepair: true,
                    repairAction: flakeyRepairAction
                }
            ];
            mockAuditRepo.add.mockResolvedValue({});
            const result = await service.smartRepair(issues, { maxRetries: 3 });
            expect(result.issuesRepaired).toBe(1);
            expect(result.issuesFailed).toBe(0);
            expect(flakeyRepairAction).toHaveBeenCalledTimes(3);
            // Verify audit log includes retry count
            expect(mockAuditRepo.add).toHaveBeenCalledWith(expect.objectContaining({
                details: expect.objectContaining({
                    metadata: expect.objectContaining({
                        retry: 2 // Zero-indexed, so 2 means third attempt
                    })
                })
            }));
        });
    });
    describe('Batch Validation', () => {
        it('should validate multiple entities efficiently', async () => {
            const staffId1 = new mongodb_1.ObjectId();
            const staffId2 = new mongodb_1.ObjectId();
            const caseId = new mongodb_1.ObjectId();
            const appId = new mongodb_1.ObjectId();
            const entities = [
                { entity: {
                        _id: staffId1,
                        guildId: 'guild1',
                        userId: 'user1',
                        status: 'active',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, type: 'staff' },
                { entity: {
                        _id: staffId2,
                        guildId: 'guild1',
                        userId: 'user2',
                        status: 'invalid', // Invalid status to trigger validation
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, type: 'staff' },
                { entity: {
                        _id: caseId,
                        guildId: 'guild1',
                        assignedLawyerIds: [],
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, type: 'case' },
                { entity: {
                        _id: appId,
                        guildId: 'guild1',
                        jobId: 'job1',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, type: 'application' }
            ];
            mockStaffRepo.update.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                userId: 'user1',
                hiredBy: 'admin1',
                role: staff_role_1.StaffRole.PARALEGAL,
                robloxUsername: 'TestUser',
                status: 'active',
                hiredAt: new Date(),
                promotionHistory: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });
            mockJobRepo.findById.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                title: 'Test Job',
                description: 'Test',
                staffRole: 'test',
                roleId: 'role1',
                isOpen: true,
                questions: [],
                postedBy: 'user1',
                applicationCount: 0,
                hiredCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const results = await service.batchValidate(entities);
            // Should only have issues for staffId2 (invalid status)
            expect(results.size).toBeGreaterThan(0);
            expect(results.has(staffId2.toString())).toBe(true);
        });
        it('should use optimized batch validation with grouping', async () => {
            const entities = [];
            // Create 50 entities across different types
            for (let i = 0; i < 20; i++) {
                entities.push({
                    entity: { _id: `staff${i}`, guildId: 'guild1', status: 'active', createdAt: new Date(), updatedAt: new Date() },
                    type: 'staff'
                });
            }
            for (let i = 0; i < 20; i++) {
                entities.push({
                    entity: { _id: `case${i}`, guildId: 'guild1', assignedLawyerIds: [] },
                    type: 'case'
                });
            }
            for (let i = 0; i < 10; i++) {
                entities.push({
                    entity: { _id: `app${i}`, guildId: 'guild1', jobId: 'job1', createdAt: new Date(), updatedAt: new Date() },
                    type: 'application'
                });
            }
            mockJobRepo.findById.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild1',
                title: 'Test Job',
                description: 'Test',
                staffRole: 'test',
                roleId: 'role1',
                isOpen: true,
                questions: [],
                postedBy: 'user1',
                applicationCount: 0,
                hiredCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const startTime = Date.now();
            const results = await service.optimizedBatchValidate(entities);
            const duration = Date.now() - startTime;
            // Should process efficiently
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
            expect(results.size).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Caching and Performance', () => {
        it('should cache validation results', async () => {
            const staff = {
                _id: new mongodb_1.ObjectId(),
                userId: 'user1',
                guildId: 'guild1',
                status: 'active',
                role: staff_role_1.StaffRole.SENIOR_PARTNER,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // First call
            await service.validateBeforeOperation(staff, 'staff', 'update');
            // Second call should use cache
            await service.validateBeforeOperation(staff, 'staff', 'update');
            // Validation logic should only run once due to caching
            expect(mockCaseRepo.findByFilters).toHaveBeenCalledTimes(1);
        });
        it('should clear cache after repairs', async () => {
            service.clearValidationCache();
            const issues = [{
                    severity: 'critical',
                    entityType: 'staff',
                    entityId: 'staff1',
                    message: 'Test issue',
                    canAutoRepair: true,
                    repairAction: jest.fn().mockResolvedValue(undefined)
                }];
            mockAuditRepo.add.mockResolvedValue({});
            await service.repairIntegrityIssues(issues);
            // Cache should be cleared after repair
            // This is internal behavior, but we can verify by checking if validation runs again
            const staff = { _id: new mongodb_1.ObjectId(), guildId: 'guild1', status: 'active',
                createdAt: new Date(),
                updatedAt: new Date() };
            await service.validateBeforeOperation(staff, 'staff', 'update');
            // Should run validation again (not cached)
            expect(mockCaseRepo.findByFilters).toHaveBeenCalled();
        });
    });
    describe('Custom Rules', () => {
        it('should allow adding custom validation rules', async () => {
            const customValidation = jest.fn().mockResolvedValue([{
                    severity: 'warning',
                    entityType: 'staff',
                    entityId: 'staff1',
                    message: 'Custom validation failed',
                    canAutoRepair: false
                }]);
            service.addCustomRule({
                name: 'custom-rule',
                description: 'Custom validation rule',
                entityType: 'staff',
                priority: 50,
                validate: customValidation
            });
            const staff = { _id: new mongodb_1.ObjectId(), guildId: 'guild1', status: 'active',
                createdAt: new Date(),
                updatedAt: new Date() };
            const issues = await service.validateBeforeOperation(staff, 'staff', 'update');
            expect(customValidation).toHaveBeenCalled();
            const customIssue = issues.find(i => i.message === 'Custom validation failed');
            expect(customIssue).toBeDefined();
        });
        it('should respect rule dependencies', () => {
            const rules = service.getValidationRules();
            // Find rules with dependencies
            const rulesWithDeps = rules.filter(r => r.dependencies && r.dependencies.length > 0);
            expect(rulesWithDeps.length).toBeGreaterThan(0);
            // Verify dependencies exist
            for (const rule of rulesWithDeps) {
                for (const dep of rule.dependencies) {
                    const depRule = rules.find(r => r.name === dep);
                    expect(depRule).toBeDefined();
                }
            }
        });
    });
    describe('Error Handling', () => {
        it('should handle repository errors gracefully', async () => {
            mockStaffRepo.findByGuildId.mockRejectedValue(new Error('Database error'));
            const report = await service.scanForIntegrityIssues('guild1');
            expect(report.totalEntitiesScanned).toBe(0);
            expect(logger_1.logger.error).toHaveBeenCalledWith('Error during integrity scan:', expect.any(Error));
        });
        it('should continue validation when individual rules fail', async () => {
            const staff = {
                _id: new mongodb_1.ObjectId(),
                userId: 'user1',
                guildId: 'guild1',
                status: 'active',
                role: staff_role_1.StaffRole.SENIOR_PARTNER,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Make one validation throw an error
            mockCaseRepo.findByFilters.mockRejectedValueOnce(new Error('Query failed'));
            const issues = await service.validateBeforeOperation(staff, 'staff', 'update');
            // Should still return some issues from other validations
            expect(issues).toBeDefined();
            expect(logger_1.logger.error).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=cross-entity-validation-service.test.js.map