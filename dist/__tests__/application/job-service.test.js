"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_service_1 = require("../../application/services/job-service");
const job_1 = require("../../domain/entities/job");
const staff_role_1 = require("../../domain/entities/staff-role");
const audit_log_1 = require("../../domain/entities/audit-log");
const test_utils_1 = require("../helpers/test-utils");
const case_1 = require("../../domain/entities/case");
/**
 * Unit tests for JobService
 * Tests business logic with mocked repositories to ensure isolation
 */
describe('JobService Unit Tests', () => {
    let jobService;
    let mockJobRepository;
    let mockAuditLogRepository;
    let mockStaffRepository;
    let mockPermissionService;
    let mockPermissionContext;
    // Test data constants
    const testGuildId = '123456789012345678';
    const testUserId = '234567890123456789';
    const testRoleId = '345678901234567890';
    const testJobId = test_utils_1.TestUtils.generateObjectId().toString();
    beforeEach(() => {
        // Create mock permission context
        mockPermissionContext = {
            guildId: testGuildId,
            userId: testUserId,
            userRoles: [],
            isGuildOwner: false
        };
        // Create partial mock repositories with only the methods we need
        mockJobRepository = {
            createJob: jest.fn(),
            findById: jest.fn(),
            updateJob: jest.fn(),
            closeJob: jest.fn(),
            removeJob: jest.fn(),
            searchJobs: jest.fn(),
            getOpenJobsForRole: jest.fn(),
            incrementApplicationCount: jest.fn(),
            incrementHiredCount: jest.fn(),
            getJobStatistics: jest.fn(),
            findJobsNeedingRoleCleanup: jest.fn(),
            markRoleCleanupComplete: jest.fn()
        };
        mockAuditLogRepository = {
            logAction: jest.fn()
        };
        mockStaffRepository = {};
        mockPermissionService = {
            hasHRPermissionWithContext: jest.fn(),
            hasActionPermission: jest.fn()
        };
        jobService = new job_service_1.JobService(mockJobRepository, mockAuditLogRepository, mockStaffRepository, mockPermissionService);
        jest.clearAllMocks();
    });
    describe('createJob', () => {
        const mockJobRequest = {
            guildId: testGuildId,
            title: 'Senior Associate Position',
            description: 'Join our legal team as a Senior Associate',
            staffRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
            roleId: testRoleId,
            postedBy: testUserId
        };
        const mockCreatedJob = {
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            title: 'Senior Associate Position',
            description: 'Join our legal team as a Senior Associate',
            staffRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
            roleId: testRoleId,
            limit: 10,
            isOpen: true,
            questions: job_1.DEFAULT_JOB_QUESTIONS,
            postedBy: testUserId,
            applicationCount: 0,
            hiredCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        it('should create a job successfully with valid data', async () => {
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockJobRepository.createJob.mockResolvedValue(mockCreatedJob);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, mockJobRequest);
            expect(mockJobRepository.getOpenJobsForRole).toHaveBeenCalledWith(testGuildId, staff_role_1.StaffRole.SENIOR_ASSOCIATE);
            expect(mockJobRepository.createJob).toHaveBeenCalledWith({
                guildId: testGuildId,
                title: 'Senior Associate Position',
                description: 'Join our legal team as a Senior Associate',
                staffRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
                roleId: testRoleId,
                limit: 10,
                isOpen: true,
                questions: job_1.DEFAULT_JOB_QUESTIONS,
                postedBy: testUserId,
                applicationCount: 0,
                hiredCount: 0
            });
            expect(mockAuditLogRepository.logAction).toHaveBeenCalledWith({
                guildId: testGuildId,
                action: audit_log_1.AuditAction.JOB_CREATED,
                actorId: testUserId,
                details: {
                    after: { staffRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE },
                    metadata: {
                        jobId: mockCreatedJob._id?.toHexString(),
                        title: 'Senior Associate Position',
                        roleId: testRoleId
                    }
                },
                timestamp: expect.any(Date)
            });
            expect(result.success).toBe(true);
            expect(result.job).toEqual(mockCreatedJob);
        });
        it('should create a job with custom questions', async () => {
            const customQuestions = [
                {
                    id: 'custom_question',
                    question: 'Why do you want this position?',
                    type: 'paragraph',
                    required: true,
                    maxLength: 500
                }
            ];
            const requestWithCustomQuestions = {
                ...mockJobRequest,
                customQuestions
            };
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockJobRepository.createJob.mockResolvedValue(mockCreatedJob);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, requestWithCustomQuestions);
            expect(mockJobRepository.createJob).toHaveBeenCalledWith(expect.objectContaining({
                questions: [...job_1.DEFAULT_JOB_QUESTIONS, ...customQuestions]
            }));
            expect(result.success).toBe(true);
        });
        it('should reject job creation with invalid staff role', async () => {
            const invalidRequest = {
                ...mockJobRequest,
                staffRole: 'invalid_role'
            };
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, invalidRequest);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid staff role');
            expect(mockJobRepository.createJob).not.toHaveBeenCalled();
        });
        it('should reject job creation when open job already exists for role', async () => {
            const existingJob = {
                ...mockCreatedJob,
                _id: test_utils_1.TestUtils.generateObjectId()
            };
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([existingJob]);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, mockJobRequest);
            expect(result.success).toBe(false);
            expect(result.error).toBe(`There is already an open job posting for ${staff_role_1.StaffRole.SENIOR_ASSOCIATE}. Close the existing job before creating a new one.`);
            expect(mockJobRepository.createJob).not.toHaveBeenCalled();
        });
        it('should reject job creation with invalid custom questions', async () => {
            const invalidQuestions = [
                {
                    id: '',
                    question: 'Invalid question',
                    type: 'short',
                    required: true
                }
            ];
            const requestWithInvalidQuestions = {
                ...mockJobRequest,
                customQuestions: invalidQuestions
            };
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, requestWithInvalidQuestions);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Questions must have id, question, and type fields');
            expect(mockJobRepository.createJob).not.toHaveBeenCalled();
        });
        it('should handle repository errors gracefully', async () => {
            mockJobRepository.getOpenJobsForRole.mockRejectedValue(new Error('Database error'));
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, mockJobRequest);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to create job');
        });
    });
    describe('updateJob', () => {
        const existingJob = {
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            title: 'Original Title',
            description: 'Original Description',
            staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            roleId: testRoleId,
            limit: 10,
            isOpen: true,
            questions: job_1.DEFAULT_JOB_QUESTIONS,
            postedBy: testUserId,
            applicationCount: 0,
            hiredCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const updateRequest = {
            title: 'Updated Title',
            description: 'Updated Description',
            staffRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE
        };
        it('should update job successfully', async () => {
            const updatedJob = { ...existingJob, ...updateRequest, limit: 10 };
            mockJobRepository.findById.mockResolvedValue(existingJob);
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockJobRepository.updateJob.mockResolvedValue(updatedJob);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.updateJob(mockPermissionContext, testJobId, updateRequest);
            expect(mockJobRepository.findById).toHaveBeenCalledWith(testJobId);
            expect(mockJobRepository.getOpenJobsForRole).toHaveBeenCalledWith(testGuildId, staff_role_1.StaffRole.SENIOR_ASSOCIATE);
            expect(mockJobRepository.updateJob).toHaveBeenCalledWith(testJobId, {
                ...updateRequest,
                limit: 10
            });
            expect(mockAuditLogRepository.logAction).toHaveBeenCalledWith({
                guildId: testGuildId,
                action: audit_log_1.AuditAction.JOB_UPDATED,
                actorId: testUserId,
                details: {
                    before: { staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE },
                    after: { staffRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE },
                    metadata: {
                        jobId: testJobId,
                        title: updatedJob.title,
                        changes: Object.keys(updateRequest)
                    }
                },
                timestamp: expect.any(Date)
            });
            expect(result.success).toBe(true);
            expect(result.job).toEqual(updatedJob);
        });
        it('should reject update for non-existent job', async () => {
            mockJobRepository.findById.mockResolvedValue(null);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.updateJob(mockPermissionContext, testJobId, updateRequest);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Job not found');
            expect(mockJobRepository.updateJob).not.toHaveBeenCalled();
        });
        it('should reject update for job from different guild', async () => {
            const jobFromDifferentGuild = { ...existingJob, guildId: 'different_guild' };
            mockJobRepository.findById.mockResolvedValue(jobFromDifferentGuild);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.updateJob(mockPermissionContext, testJobId, updateRequest);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Job not found');
            expect(mockJobRepository.updateJob).not.toHaveBeenCalled();
        });
        it('should reject update with invalid staff role', async () => {
            mockJobRepository.findById.mockResolvedValue(existingJob);
            const invalidUpdate = { staffRole: 'invalid_role' };
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.updateJob(mockPermissionContext, testJobId, invalidUpdate);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid staff role');
            expect(mockJobRepository.updateJob).not.toHaveBeenCalled();
        });
        it('should reject role change when another open job exists for target role', async () => {
            const conflictingJob = {
                ...existingJob,
                _id: test_utils_1.TestUtils.generateObjectId(),
                staffRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE
            };
            mockJobRepository.findById.mockResolvedValue(existingJob);
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([conflictingJob]);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.updateJob(mockPermissionContext, testJobId, { staffRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE });
            expect(result.success).toBe(false);
            expect(result.error).toBe(`There is already an open job posting for ${staff_role_1.StaffRole.SENIOR_ASSOCIATE}`);
            expect(mockJobRepository.updateJob).not.toHaveBeenCalled();
        });
        it('should update with custom questions successfully', async () => {
            const customQuestions = [
                {
                    id: 'custom_q1',
                    question: 'Custom question?',
                    type: 'short',
                    required: true
                }
            ];
            const updateWithQuestions = { customQuestions };
            const updatedJob = { ...existingJob, questions: [...job_1.DEFAULT_JOB_QUESTIONS, ...customQuestions] };
            mockJobRepository.findById.mockResolvedValue(existingJob);
            mockJobRepository.updateJob.mockResolvedValue(updatedJob);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.updateJob(mockPermissionContext, testJobId, updateWithQuestions);
            expect(mockJobRepository.updateJob).toHaveBeenCalledWith(testJobId, {
                questions: [...job_1.DEFAULT_JOB_QUESTIONS, ...customQuestions]
            });
            expect(result.success).toBe(true);
        });
        it('should reject update with invalid custom questions', async () => {
            const invalidQuestions = [
                {
                    id: 'invalid',
                    question: '',
                    type: 'choice',
                    required: true,
                    choices: [] // Empty choices for choice type
                }
            ];
            mockJobRepository.findById.mockResolvedValue(existingJob);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.updateJob(mockPermissionContext, testJobId, { customQuestions: invalidQuestions });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Questions must have id, question, and type fields');
            expect(mockJobRepository.updateJob).not.toHaveBeenCalled();
        });
        it('should handle repository update failure', async () => {
            mockJobRepository.findById.mockResolvedValue(existingJob);
            mockJobRepository.updateJob.mockResolvedValue(null);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.updateJob(mockPermissionContext, testJobId, updateRequest);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to update job');
        });
    });
    describe('closeJob', () => {
        const existingJob = {
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            title: 'Test Job',
            description: 'Test Description',
            staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            roleId: testRoleId,
            limit: 10,
            isOpen: true,
            questions: job_1.DEFAULT_JOB_QUESTIONS,
            postedBy: testUserId,
            applicationCount: 5,
            hiredCount: 2,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        it('should close job successfully', async () => {
            const closedJob = { ...existingJob, isOpen: false, closedAt: new Date(), closedBy: testUserId };
            mockJobRepository.closeJob.mockResolvedValue(closedJob);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.closeJob(mockPermissionContext, testJobId);
            expect(mockJobRepository.closeJob).toHaveBeenCalledWith(testGuildId, testJobId, testUserId);
            expect(mockAuditLogRepository.logAction).toHaveBeenCalledWith({
                guildId: testGuildId,
                action: audit_log_1.AuditAction.JOB_CLOSED,
                actorId: testUserId,
                details: {
                    before: { status: 'open' },
                    after: { status: case_1.CaseStatus.CLOSED },
                    metadata: {
                        jobId: testJobId,
                        title: closedJob.title,
                        staffRole: closedJob.staffRole
                    }
                },
                timestamp: expect.any(Date)
            });
            expect(result.success).toBe(true);
            expect(result.job).toEqual(closedJob);
        });
        it('should reject closing non-existent job', async () => {
            mockJobRepository.closeJob.mockResolvedValue(null);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.closeJob(mockPermissionContext, testJobId);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Job not found or already closed');
        });
        it('should handle repository errors gracefully', async () => {
            mockJobRepository.closeJob.mockRejectedValue(new Error('Database error'));
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.closeJob(mockPermissionContext, testJobId);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to close job');
        });
    });
    describe('removeJob', () => {
        const existingJob = {
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            title: 'Test Job',
            description: 'Test Description',
            staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            roleId: testRoleId,
            limit: 10,
            isOpen: true,
            questions: job_1.DEFAULT_JOB_QUESTIONS,
            postedBy: testUserId,
            applicationCount: 0,
            hiredCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        it('should remove job successfully', async () => {
            mockJobRepository.findById.mockResolvedValue(existingJob);
            mockJobRepository.removeJob.mockResolvedValue(true);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.removeJob(mockPermissionContext, testJobId);
            expect(mockJobRepository.findById).toHaveBeenCalledWith(testJobId);
            expect(mockJobRepository.removeJob).toHaveBeenCalledWith(testGuildId, testJobId, testUserId);
            expect(mockAuditLogRepository.logAction).toHaveBeenCalledWith({
                guildId: testGuildId,
                action: audit_log_1.AuditAction.JOB_REMOVED,
                actorId: testUserId,
                details: {
                    before: { status: 'open' },
                    after: { status: 'removed' },
                    metadata: {
                        jobId: testJobId,
                        title: existingJob.title,
                        staffRole: existingJob.staffRole
                    }
                },
                timestamp: expect.any(Date)
            });
            expect(result.success).toBe(true);
        });
        it('should reject removing non-existent job', async () => {
            mockJobRepository.findById.mockResolvedValue(null);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.removeJob(mockPermissionContext, testJobId);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Job not found');
            expect(mockJobRepository.removeJob).not.toHaveBeenCalled();
        });
        it('should reject removing job from different guild', async () => {
            const jobFromDifferentGuild = { ...existingJob, guildId: 'different_guild' };
            mockJobRepository.findById.mockResolvedValue(jobFromDifferentGuild);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.removeJob(mockPermissionContext, testJobId);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Job not found');
            expect(mockJobRepository.removeJob).not.toHaveBeenCalled();
        });
        it('should handle repository removal failure', async () => {
            mockJobRepository.findById.mockResolvedValue(existingJob);
            mockJobRepository.removeJob.mockResolvedValue(false);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.removeJob(mockPermissionContext, testJobId);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to remove job');
        });
    });
    describe('listJobs', () => {
        const mockJobListResult = {
            jobs: [
                {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: testGuildId,
                    title: 'Test Job 1',
                    description: 'Description 1',
                    staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                    roleId: testRoleId,
                    limit: 10,
                    isOpen: true,
                    questions: job_1.DEFAULT_JOB_QUESTIONS,
                    postedBy: testUserId,
                    applicationCount: 3,
                    hiredCount: 1,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ],
            total: 1,
            totalPages: 1,
            currentPage: 1
        };
        it('should list jobs successfully with default filters', async () => {
            const filters = {};
            mockJobRepository.searchJobs.mockResolvedValue(mockJobListResult);
            const result = await jobService.listJobs(mockPermissionContext, filters, 1);
            expect(mockJobRepository.searchJobs).toHaveBeenCalledWith(testGuildId, filters, 1, 5);
            expect(mockAuditLogRepository.logAction).toHaveBeenCalledWith({
                guildId: testGuildId,
                action: audit_log_1.AuditAction.JOB_LIST_VIEWED,
                actorId: testUserId,
                details: {
                    metadata: {
                        filters,
                        page: 1,
                        resultCount: 1
                    }
                },
                timestamp: expect.any(Date)
            });
            expect(result).toEqual(mockJobListResult);
        });
        it('should list jobs with specific filters', async () => {
            const filters = {
                isOpen: true,
                staffRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
                searchTerm: 'legal'
            };
            mockJobRepository.searchJobs.mockResolvedValue(mockJobListResult);
            const result = await jobService.listJobs(mockPermissionContext, filters, 2);
            expect(mockJobRepository.searchJobs).toHaveBeenCalledWith(testGuildId, filters, 2, 5);
            expect(result).toEqual(mockJobListResult);
        });
        it('should handle repository errors', async () => {
            mockJobRepository.searchJobs.mockRejectedValue(new Error('Database error'));
            await expect(jobService.listJobs(mockPermissionContext, {}, 1)).rejects.toThrow('Database error');
        });
    });
    describe('getJobDetails', () => {
        const mockJob = {
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            title: 'Test Job',
            description: 'Test Description',
            staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            roleId: testRoleId,
            limit: 10,
            isOpen: true,
            questions: job_1.DEFAULT_JOB_QUESTIONS,
            postedBy: testUserId,
            applicationCount: 0,
            hiredCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        it('should get job details successfully', async () => {
            mockJobRepository.findById.mockResolvedValue(mockJob);
            const result = await jobService.getJobDetails(mockPermissionContext, testJobId);
            expect(mockJobRepository.findById).toHaveBeenCalledWith(testJobId);
            expect(mockAuditLogRepository.logAction).toHaveBeenCalledWith({
                guildId: testGuildId,
                action: audit_log_1.AuditAction.JOB_INFO_VIEWED,
                actorId: testUserId,
                details: {
                    metadata: {
                        jobId: testJobId,
                        title: mockJob.title
                    }
                },
                timestamp: expect.any(Date)
            });
            expect(result).toEqual(mockJob);
        });
        it('should return null for non-existent job', async () => {
            mockJobRepository.findById.mockResolvedValue(null);
            const result = await jobService.getJobDetails(mockPermissionContext, testJobId);
            expect(result).toBeNull();
            expect(mockAuditLogRepository.logAction).not.toHaveBeenCalled();
        });
        it('should return null for job from different guild', async () => {
            const jobFromDifferentGuild = { ...mockJob, guildId: 'different_guild' };
            mockJobRepository.findById.mockResolvedValue(jobFromDifferentGuild);
            const result = await jobService.getJobDetails(mockPermissionContext, testJobId);
            expect(result).toBeNull();
            expect(mockAuditLogRepository.logAction).not.toHaveBeenCalled();
        });
    });
    describe('getJobStatistics', () => {
        const mockStats = {
            totalJobs: 10,
            openJobs: 5,
            closedJobs: 5,
            totalApplications: 25,
            totalHired: 8,
            jobsByRole: {
                [staff_role_1.StaffRole.MANAGING_PARTNER]: 1,
                [staff_role_1.StaffRole.SENIOR_PARTNER]: 2,
                [staff_role_1.StaffRole.JUNIOR_PARTNER]: 2,
                [staff_role_1.StaffRole.SENIOR_ASSOCIATE]: 3,
                [staff_role_1.StaffRole.JUNIOR_ASSOCIATE]: 2,
                [staff_role_1.StaffRole.PARALEGAL]: 0
            }
        };
        it('should get job statistics successfully', async () => {
            mockJobRepository.getJobStatistics.mockResolvedValue(mockStats);
            const result = await jobService.getJobStatistics(mockPermissionContext);
            expect(mockJobRepository.getJobStatistics).toHaveBeenCalledWith(testGuildId);
            expect(result).toEqual(mockStats);
        });
        it('should handle repository errors', async () => {
            mockJobRepository.getJobStatistics.mockRejectedValue(new Error('Database error'));
            await expect(jobService.getJobStatistics(mockPermissionContext)).rejects.toThrow('Database error');
        });
    });
    describe('validateJobQuestions', () => {
        it('should validate valid questions', async () => {
            const validQuestions = [
                {
                    id: 'test_q1',
                    question: 'What is your experience?',
                    type: 'paragraph',
                    required: true,
                    maxLength: 500
                },
                {
                    id: 'test_q2',
                    question: 'Choose your preference',
                    type: 'choice',
                    required: true,
                    choices: ['Option 1', 'Option 2']
                },
                {
                    id: 'test_q3',
                    question: 'How many years?',
                    type: 'number',
                    required: false,
                    minValue: 0,
                    maxValue: 50
                }
            ];
            const request = {
                guildId: testGuildId,
                title: 'Test Job',
                description: 'Description',
                staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                roleId: testRoleId,
                customQuestions: validQuestions,
                postedBy: testUserId
            };
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockJobRepository.createJob.mockResolvedValue({});
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, request);
            expect(result.success).toBe(true);
        });
        it('should reject invalid question types', async () => {
            const invalidQuestions = [
                {
                    id: 'test_q1',
                    question: 'Invalid question',
                    type: 'invalid_type',
                    required: true
                }
            ];
            const request = {
                guildId: testGuildId,
                title: 'Test Job',
                description: 'Description',
                staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                roleId: testRoleId,
                customQuestions: invalidQuestions,
                postedBy: testUserId
            };
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, request);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid question type: invalid_type');
        });
        it('should reject choice questions without choices', async () => {
            const invalidQuestions = [
                {
                    id: 'test_q1',
                    question: 'Choose option',
                    type: 'choice',
                    required: true,
                    choices: []
                }
            ];
            const request = {
                guildId: testGuildId,
                title: 'Test Job',
                description: 'Description',
                staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                roleId: testRoleId,
                customQuestions: invalidQuestions,
                postedBy: testUserId
            };
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, request);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Choice questions must have at least one choice option');
        });
        it('should reject number questions with invalid range', async () => {
            const invalidQuestions = [
                {
                    id: 'test_q1',
                    question: 'Invalid range',
                    type: 'number',
                    required: true,
                    minValue: 10,
                    maxValue: 5
                }
            ];
            const request = {
                guildId: testGuildId,
                title: 'Test Job',
                description: 'Description',
                staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                roleId: testRoleId,
                customQuestions: invalidQuestions,
                postedBy: testUserId
            };
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, request);
            expect(result.success).toBe(false);
            expect(result.error).toBe('minValue must be less than maxValue for number questions');
        });
        it('should reject text questions with invalid maxLength', async () => {
            const invalidQuestions = [
                {
                    id: 'test_q1',
                    question: 'Invalid length',
                    type: 'short',
                    required: true,
                    maxLength: -1 // Use -1 instead of 0 to ensure the validation check runs
                }
            ];
            const request = {
                guildId: testGuildId,
                title: 'Test Job',
                description: 'Description',
                staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                roleId: testRoleId,
                customQuestions: invalidQuestions,
                postedBy: testUserId
            };
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, request);
            expect(result.success).toBe(false);
            expect(result.error).toBe('maxLength must be greater than 0 for text questions');
        });
        it('should reject questions with duplicate IDs', async () => {
            const duplicateQuestions = [
                {
                    id: 'duplicate_id',
                    question: 'Question 1',
                    type: 'short',
                    required: true
                },
                {
                    id: 'duplicate_id',
                    question: 'Question 2',
                    type: 'paragraph',
                    required: true
                }
            ];
            const request = {
                guildId: testGuildId,
                title: 'Test Job',
                description: 'Description',
                staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                roleId: testRoleId,
                customQuestions: duplicateQuestions,
                postedBy: testUserId
            };
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, request);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Question IDs must be unique');
        });
    });
    describe('edge cases and error handling', () => {
        it('should handle all repository methods throwing errors', async () => {
            const error = new Error('Database connection failed');
            mockJobRepository.createJob.mockRejectedValue(error);
            mockJobRepository.updateJob.mockRejectedValue(error);
            mockJobRepository.closeJob.mockRejectedValue(error);
            mockJobRepository.removeJob.mockRejectedValue(error);
            mockJobRepository.searchJobs.mockRejectedValue(error);
            mockJobRepository.findById.mockRejectedValue(error);
            mockJobRepository.getJobStatistics.mockRejectedValue(error);
            const basicRequest = {
                guildId: testGuildId,
                title: 'Test Job',
                description: 'Description',
                staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                roleId: testRoleId,
                postedBy: testUserId
            };
            // Test all methods handle errors gracefully
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const createResult = await jobService.createJob(mockPermissionContext, basicRequest);
            expect(createResult.success).toBe(false);
            expect(createResult.error).toBe('Failed to create job');
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const updateResult = await jobService.updateJob(mockPermissionContext, testJobId, {});
            expect(updateResult.success).toBe(false);
            expect(updateResult.error).toBe('Failed to update job');
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const closeResult = await jobService.closeJob(mockPermissionContext, testJobId);
            expect(closeResult.success).toBe(false);
            expect(closeResult.error).toBe('Failed to close job');
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const removeResult = await jobService.removeJob(mockPermissionContext, testJobId);
            expect(removeResult.success).toBe(false);
            expect(removeResult.error).toBe('Failed to remove job');
            await expect(jobService.listJobs(mockPermissionContext, {}, 1)).rejects.toThrow();
            await expect(jobService.getJobDetails(mockPermissionContext, testJobId)).rejects.toThrow();
            await expect(jobService.getJobStatistics(mockPermissionContext)).rejects.toThrow();
        });
        it('should handle audit log failures gracefully during successful operations', async () => {
            const mockJob = {
                _id: test_utils_1.TestUtils.generateObjectId(),
                guildId: testGuildId,
                title: 'Test Job',
                description: 'Description',
                staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                roleId: testRoleId,
                limit: 10,
                isOpen: true,
                questions: job_1.DEFAULT_JOB_QUESTIONS,
                postedBy: testUserId,
                applicationCount: 0,
                hiredCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockJobRepository.getOpenJobsForRole.mockResolvedValue([]);
            mockJobRepository.createJob.mockResolvedValue(mockJob);
            mockAuditLogRepository.logAction.mockRejectedValue(new Error('Audit log failed'));
            const request = {
                guildId: testGuildId,
                title: 'Test Job',
                description: 'Description',
                staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                roleId: testRoleId,
                postedBy: testUserId
            };
            // Should fail because audit log failure causes the whole operation to fail
            mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
            const result = await jobService.createJob(mockPermissionContext, request);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to create job');
        });
    });
});
//# sourceMappingURL=job-service.test.js.map