"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cross_entity_validation_service_1 = require("../../../application/services/cross-entity-validation-service");
const case_1 = require("../../../domain/entities/case");
const job_1 = require("../../../domain/entities/job");
const retainer_1 = require("../../../domain/entities/retainer");
const feedback_1 = require("../../../domain/entities/feedback");
const staff_role_1 = require("../../../domain/entities/staff-role");
const mongodb_1 = require("mongodb");
describe('CrossEntityValidationService', () => {
    let service;
    let mockStaffRepository;
    let mockCaseRepository;
    let mockApplicationRepository;
    let mockJobRepository;
    let mockRetainerRepository;
    let mockFeedbackRepository;
    let mockReminderRepository;
    let mockAuditLogRepository;
    let mockBusinessRuleValidationService;
    beforeEach(() => {
        // Create mocks
        mockStaffRepository = {
            findByUserId: jest.fn(),
            findByGuildId: jest.fn(),
            update: jest.fn()
        };
        mockCaseRepository = {
            findById: jest.fn(),
            findByGuildId: jest.fn(),
            update: jest.fn()
        };
        mockApplicationRepository = {
            findByGuild: jest.fn(),
            update: jest.fn()
        };
        mockJobRepository = {
            findById: jest.fn(),
            findByGuildId: jest.fn()
        };
        mockRetainerRepository = {
            findByGuild: jest.fn(),
            update: jest.fn()
        };
        mockFeedbackRepository = {
            findByFilters: jest.fn(),
            update: jest.fn()
        };
        mockReminderRepository = {
            findByFilters: jest.fn(),
            update: jest.fn()
        };
        mockAuditLogRepository = {
            add: jest.fn()
        };
        mockBusinessRuleValidationService = {};
        service = new cross_entity_validation_service_1.CrossEntityValidationService(mockStaffRepository, mockCaseRepository, mockApplicationRepository, mockJobRepository, mockRetainerRepository, mockFeedbackRepository, mockReminderRepository, mockAuditLogRepository, mockBusinessRuleValidationService);
    });
    describe('Staff Validation', () => {
        it('should detect invalid staff status', async () => {
            const invalidStaff = {
                _id: new mongodb_1.ObjectId(),
                userId: 'user-1',
                guildId: 'guild-1',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                status: 'invalid',
                robloxUsername: 'testuser',
                hiredAt: new Date(),
                hiredBy: 'admin-1',
                promotionHistory: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.findByGuildId.mockResolvedValue([invalidStaff]);
            mockCaseRepository.findByGuildId.mockResolvedValue([]);
            mockApplicationRepository.findByGuild.mockResolvedValue([]);
            mockJobRepository.findByGuildId.mockResolvedValue([]);
            mockRetainerRepository.findByGuild.mockResolvedValue([]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([]);
            mockReminderRepository.findByFilters.mockResolvedValue([]);
            const report = await service.scanForIntegrityIssues('guild-1');
            expect(report.issues).toHaveLength(1);
            expect(report.issues[0]?.severity).toBe('critical');
            expect(report.issues[0]?.message).toContain('Invalid staff status');
            expect(report.issues[0]?.canAutoRepair).toBe(true);
        });
    });
    describe('Case Validation', () => {
        it('should detect non-existent lead attorney', async () => {
            const caseWithBadLead = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild-1',
                caseNumber: '2024-0001-user',
                clientId: 'client-1',
                clientUsername: 'client',
                title: 'Test Case',
                description: 'Test',
                status: case_1.CaseStatus.InProgress,
                priority: case_1.CasePriority.Medium,
                leadAttorneyId: 'non-existent-attorney',
                assignedLawyerIds: [],
                documents: [],
                notes: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.findByGuildId.mockResolvedValue([]);
            mockStaffRepository.findByUserId.mockResolvedValue(null);
            mockCaseRepository.findByGuildId.mockResolvedValue([caseWithBadLead]);
            mockApplicationRepository.findByGuild.mockResolvedValue([]);
            mockJobRepository.findByGuildId.mockResolvedValue([]);
            mockRetainerRepository.findByGuild.mockResolvedValue([]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([]);
            mockReminderRepository.findByFilters.mockResolvedValue([]);
            const report = await service.scanForIntegrityIssues('guild-1');
            expect(report.issues).toHaveLength(1);
            expect(report.issues[0]?.severity).toBe('critical');
            expect(report.issues[0]?.message).toContain('Lead attorney');
            expect(report.issues[0]?.message).toContain('not found');
            expect(report.issues[0]?.canAutoRepair).toBe(true);
        });
        it('should detect inactive assigned lawyers', async () => {
            const inactiveStaff = {
                _id: new mongodb_1.ObjectId(),
                userId: 'lawyer-1',
                guildId: 'guild-1',
                role: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
                status: 'terminated',
                robloxUsername: 'lawyer1',
                hiredAt: new Date(),
                hiredBy: 'admin-1',
                promotionHistory: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const caseWithInactiveLawyer = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild-1',
                caseNumber: '2024-0001-user',
                clientId: 'client-1',
                clientUsername: 'client',
                title: 'Test Case',
                description: 'Test',
                status: case_1.CaseStatus.InProgress,
                priority: case_1.CasePriority.Medium,
                assignedLawyerIds: ['lawyer-1'],
                documents: [],
                notes: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.findByGuildId.mockResolvedValue([inactiveStaff]);
            mockStaffRepository.findByUserId.mockResolvedValue(inactiveStaff);
            mockCaseRepository.findByGuildId.mockResolvedValue([caseWithInactiveLawyer]);
            mockApplicationRepository.findByGuild.mockResolvedValue([]);
            mockJobRepository.findByGuildId.mockResolvedValue([]);
            mockRetainerRepository.findByGuild.mockResolvedValue([]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([]);
            mockReminderRepository.findByFilters.mockResolvedValue([]);
            const report = await service.scanForIntegrityIssues('guild-1');
            const lawyerIssue = report.issues.find(i => i.message.includes('is not active'));
            expect(lawyerIssue).toBeDefined();
            expect(lawyerIssue.severity).toBe('warning');
            expect(lawyerIssue.canAutoRepair).toBe(false);
        });
    });
    describe('Application Validation', () => {
        it('should detect applications for non-existent jobs', async () => {
            const orphanedApplication = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild-1',
                jobId: 'non-existent-job',
                applicantId: 'applicant-1',
                robloxUsername: 'applicant',
                answers: [],
                status: case_1.CaseStatus.PENDING,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.findByGuildId.mockResolvedValue([]);
            mockCaseRepository.findByGuildId.mockResolvedValue([]);
            mockApplicationRepository.findByGuild.mockResolvedValue([orphanedApplication]);
            mockJobRepository.findById.mockResolvedValue(null);
            mockJobRepository.findByGuildId.mockResolvedValue([]);
            mockRetainerRepository.findByGuild.mockResolvedValue([]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([]);
            mockReminderRepository.findByFilters.mockResolvedValue([]);
            const report = await service.scanForIntegrityIssues('guild-1');
            expect(report.issues).toHaveLength(1);
            expect(report.issues[0]?.severity).toBe('critical');
            expect(report.issues[0]?.message).toContain('Referenced job');
            expect(report.issues[0]?.message).toContain('not found');
            expect(report.issues[0]?.canAutoRepair).toBe(false);
        });
        it('should detect pending applications for closed jobs', async () => {
            const closedJob = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild-1',
                title: 'Test Job',
                description: 'Test',
                roleId: 'role-1',
                status: job_1.JobStatus.Closed,
                postedBy: 'admin-1',
                questions: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const pendingApplication = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild-1',
                jobId: 'job-1',
                applicantId: 'applicant-1',
                robloxUsername: 'applicant',
                answers: [],
                status: case_1.CaseStatus.PENDING,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.findByGuildId.mockResolvedValue([]);
            mockCaseRepository.findByGuildId.mockResolvedValue([]);
            mockApplicationRepository.findByGuild.mockResolvedValue([pendingApplication]);
            mockJobRepository.findById.mockResolvedValue(closedJob);
            mockJobRepository.findByGuildId.mockResolvedValue([closedJob]);
            mockRetainerRepository.findByGuild.mockResolvedValue([]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([]);
            mockReminderRepository.findByFilters.mockResolvedValue([]);
            const report = await service.scanForIntegrityIssues('guild-1');
            expect(report.issues).toHaveLength(1);
            expect(report.issues[0]?.severity).toBe('warning');
            expect(report.issues[0]?.message).toContain('pending for a');
            expect(report.issues[0]?.canAutoRepair).toBe(true);
        });
    });
    describe('Retainer Validation', () => {
        it('should detect retainers with non-existent lawyers', async () => {
            const orphanedRetainer = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild-1',
                clientId: 'client-1',
                lawyerId: 'non-existent-lawyer',
                status: retainer_1.RetainerStatus.Pending,
                agreementTemplate: 'template',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.findByGuildId.mockResolvedValue([]);
            mockStaffRepository.findByUserId.mockResolvedValue(null);
            mockCaseRepository.findByGuildId.mockResolvedValue([]);
            mockApplicationRepository.findByGuild.mockResolvedValue([]);
            mockJobRepository.findByGuildId.mockResolvedValue([]);
            mockRetainerRepository.findByGuild.mockResolvedValue([orphanedRetainer]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([]);
            mockReminderRepository.findByFilters.mockResolvedValue([]);
            const report = await service.scanForIntegrityIssues('guild-1');
            expect(report.issues).toHaveLength(1);
            expect(report.issues[0]?.severity).toBe('critical');
            expect(report.issues[0]?.field).toBe('lawyerId');
            expect(report.issues[0]?.message).toContain('not found in staff records');
        });
    });
    describe('Feedback Validation', () => {
        it('should detect feedback for non-existent staff', async () => {
            const orphanedFeedback = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild-1',
                submitterId: 'client-1',
                submitterUsername: 'client',
                targetStaffId: 'non-existent-staff',
                targetStaffUsername: 'ghost',
                rating: feedback_1.FeedbackRating.FiveStars,
                comment: 'Great service',
                isForFirm: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.findByGuildId.mockResolvedValue([]);
            mockStaffRepository.findByUserId.mockResolvedValue(null);
            mockCaseRepository.findByGuildId.mockResolvedValue([]);
            mockApplicationRepository.findByGuild.mockResolvedValue([]);
            mockJobRepository.findByGuildId.mockResolvedValue([]);
            mockRetainerRepository.findByGuild.mockResolvedValue([]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([orphanedFeedback]);
            mockReminderRepository.findByFilters.mockResolvedValue([]);
            const report = await service.scanForIntegrityIssues('guild-1');
            expect(report.issues).toHaveLength(1);
            expect(report.issues[0]?.severity).toBe('warning');
            expect(report.issues[0]?.message).toContain('Target staff member');
            expect(report.issues[0]?.message).toContain('not found');
            expect(report.issues[0]?.canAutoRepair).toBe(true);
        });
    });
    describe('Reminder Validation', () => {
        it('should detect reminders for non-existent cases', async () => {
            const orphanedReminder = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild-1',
                userId: 'user-1',
                username: 'user',
                message: 'Test reminder',
                scheduledFor: new Date(),
                caseId: 'non-existent-case',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.findByGuildId.mockResolvedValue([]);
            mockCaseRepository.findByGuildId.mockResolvedValue([]);
            mockCaseRepository.findById.mockResolvedValue(null);
            mockApplicationRepository.findByGuild.mockResolvedValue([]);
            mockJobRepository.findByGuildId.mockResolvedValue([]);
            mockRetainerRepository.findByGuild.mockResolvedValue([]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([]);
            mockReminderRepository.findByFilters.mockResolvedValue([orphanedReminder]);
            const report = await service.scanForIntegrityIssues('guild-1');
            expect(report.issues).toHaveLength(1);
            expect(report.issues[0]?.severity).toBe('warning');
            expect(report.issues[0]?.field).toBe('caseId');
            expect(report.issues[0]?.message).toContain('Referenced case');
            expect(report.issues[0]?.message).toContain('not found');
            expect(report.issues[0]?.canAutoRepair).toBe(true);
        });
    });
    describe('Repair Functionality', () => {
        it('should successfully repair auto-repairable issues', async () => {
            const issues = [
                {
                    severity: 'critical',
                    entityType: 'staff',
                    entityId: 'staff-1',
                    field: 'status',
                    message: 'Invalid staff status',
                    canAutoRepair: true,
                    repairAction: jest.fn().mockResolvedValue(undefined)
                },
                {
                    severity: 'warning',
                    entityType: 'case',
                    entityId: 'case-1',
                    field: 'leadAttorneyId',
                    message: 'Lead attorney not found',
                    canAutoRepair: true,
                    repairAction: jest.fn().mockResolvedValue(undefined)
                },
            ];
            const result = await service.repairIntegrityIssues(issues);
            expect(result.totalIssuesFound).toBe(2);
            expect(result.issuesRepaired).toBe(2);
            expect(result.issuesFailed).toBe(0);
            expect(issues[0].repairAction).toHaveBeenCalled();
            expect(issues[1].repairAction).toHaveBeenCalled();
            expect(mockAuditLogRepository.add).toHaveBeenCalledTimes(2);
        });
        it('should handle repair failures gracefully', async () => {
            const issues = [
                {
                    severity: 'critical',
                    entityType: 'staff',
                    entityId: 'staff-1',
                    field: 'status',
                    message: 'Invalid staff status',
                    canAutoRepair: true,
                    repairAction: jest.fn().mockRejectedValue(new Error('Repair failed'))
                },
            ];
            const result = await service.repairIntegrityIssues(issues);
            expect(result.totalIssuesFound).toBe(1);
            expect(result.issuesRepaired).toBe(0);
            expect(result.issuesFailed).toBe(1);
            expect(result.failedRepairs).toHaveLength(1);
            expect(result.failedRepairs[0].error).toBe('Repair failed');
        });
        it('should skip non-repairable issues', async () => {
            const issues = [
                {
                    severity: 'critical',
                    entityType: 'application',
                    entityId: 'app-1',
                    message: 'Referenced job not found',
                    canAutoRepair: false
                },
            ];
            const result = await service.repairIntegrityIssues(issues);
            expect(result.totalIssuesFound).toBe(1);
            expect(result.issuesRepaired).toBe(0);
            expect(result.issuesFailed).toBe(0);
            expect(mockAuditLogRepository.add).not.toHaveBeenCalled();
        });
    });
    describe('Batch Validation', () => {
        it('should validate multiple entities in batches', async () => {
            const entities = [
                { entity: { _id: new mongodb_1.ObjectId(), guildId: 'guild-1', status: 'active',
                        createdAt: new Date(),
                        updatedAt: new Date() }, type: 'staff' },
                { entity: { _id: new mongodb_1.ObjectId(), guildId: 'guild-1', status: 'active',
                        createdAt: new Date(),
                        updatedAt: new Date() }, type: 'staff' },
                { entity: { _id: new mongodb_1.ObjectId(), guildId: 'guild-1', leadAttorneyId: 'lawyer-1',
                        createdAt: new Date(),
                        updatedAt: new Date() }, type: 'case' },
            ];
            mockStaffRepository.findByUserId.mockResolvedValue({
                _id: new mongodb_1.ObjectId(),
                userId: 'lawyer-1',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const results = await service.batchValidate(entities);
            expect(results.size).toBe(0); // No issues found
        });
    });
    describe('Custom Rules', () => {
        it('should allow adding custom validation rules', async () => {
            const customRule = {
                name: 'custom-staff-check',
                description: 'Custom validation for staff',
                entityType: 'staff',
                priority: 50,
                validate: jest.fn().mockResolvedValue([
                    {
                        severity: 'info',
                        entityType: 'staff',
                        entityId: 'staff-1',
                        message: 'Custom validation message',
                        canAutoRepair: false
                    },
                ])
            };
            service.addCustomRule(customRule);
            const staff = {
                _id: new mongodb_1.ObjectId(),
                userId: 'user-1',
                guildId: 'guild-1',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                status: 'active',
                robloxUsername: 'testuser',
                hiredAt: new Date(),
                hiredBy: 'admin-1',
                promotionHistory: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.findByGuildId.mockResolvedValue([staff]);
            mockCaseRepository.findByGuildId.mockResolvedValue([]);
            mockApplicationRepository.findByGuild.mockResolvedValue([]);
            mockJobRepository.findByGuildId.mockResolvedValue([]);
            mockRetainerRepository.findByGuild.mockResolvedValue([]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([]);
            mockReminderRepository.findByFilters.mockResolvedValue([]);
            const report = await service.scanForIntegrityIssues('guild-1');
            expect(customRule.validate).toHaveBeenCalled();
            const customIssue = report.issues.find(i => i.message === 'Custom validation message');
            expect(customIssue).toBeDefined();
        });
    });
    describe('Cache Management', () => {
        it('should cache validation results within same scan', async () => {
            const staff = {
                _id: new mongodb_1.ObjectId(),
                userId: 'user-1',
                guildId: 'guild-1',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                status: 'active',
                robloxUsername: 'testuser',
                hiredAt: new Date(),
                hiredBy: 'admin-1',
                promotionHistory: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStaffRepository.findByGuildId.mockResolvedValue([staff]);
            mockCaseRepository.findByGuildId.mockResolvedValue([]);
            mockApplicationRepository.findByGuild.mockResolvedValue([]);
            mockJobRepository.findByGuildId.mockResolvedValue([]);
            mockRetainerRepository.findByGuild.mockResolvedValue([]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([]);
            mockReminderRepository.findByFilters.mockResolvedValue([]);
            // First scan
            await service.scanForIntegrityIssues('guild-1');
            // Validate the same entity again (within cache TTL)
            const issues = await service.validateBeforeOperation(staff, 'staff', 'update', { guildId: 'guild-1' });
            // Should return cached results
            expect(issues).toHaveLength(0); // No issues for valid staff
        });
        it('should clear cache after repairs', async () => {
            await service.repairIntegrityIssues([]);
            // Cache should be cleared - verify by checking that a new scan fetches fresh data
            mockStaffRepository.findByGuildId.mockResolvedValue([]);
            mockCaseRepository.findByGuildId.mockResolvedValue([]);
            mockApplicationRepository.findByGuild.mockResolvedValue([]);
            mockJobRepository.findByGuildId.mockResolvedValue([]);
            mockRetainerRepository.findByGuild.mockResolvedValue([]);
            mockFeedbackRepository.findByFilters.mockResolvedValue([]);
            mockReminderRepository.findByFilters.mockResolvedValue([]);
            await service.scanForIntegrityIssues('guild-1');
            expect(mockStaffRepository.findByGuildId).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=cross-entity-validation-service.test.js.map