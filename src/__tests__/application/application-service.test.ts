import { ApplicationService, ApplicationSubmissionRequest } from '../../application/services/application-service';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { RobloxService } from '../../infrastructure/external/roblox-service';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { 
  Application, 
  ApplicationAnswer,
  Job,
  ApplicationStatus
} from '../../validation';
import { TestUtils } from '../helpers/test-utils';

/**
 * Unit tests for ApplicationService
 * Tests business logic with mocked repositories and external services to ensure isolation
 */
describe('ApplicationService Unit Tests', () => {
  let applicationService: ApplicationService;
  let mockApplicationRepository: jest.Mocked<ApplicationRepository>;
  let mockJobRepository: jest.Mocked<JobRepository>;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
  let mockRobloxService: jest.Mocked<RobloxService>;
  let mockPermissionService: jest.Mocked<PermissionService>;
  let mockPermissionContext: PermissionContext;

  // Test data constants
  const testGuildId = '123456789012345678';
  const testApplicantId = '234567890123456789';
  const testJobId = TestUtils.generateObjectId().toString();
  const testApplicationId = TestUtils.generateObjectId().toString();
  const testReviewerId = '345678901234567890';



  beforeEach(() => {
    // Create mock permission context
    mockPermissionContext = {
      guildId: testGuildId,
      userId: testReviewerId,
      userRoles: [],
      isGuildOwner: false
    };

    // Create partial mock repositories with only the methods we need
    mockApplicationRepository = {
      add: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findByJob: jest.fn(),
      findByApplicant: jest.fn(),
      findByGuild: jest.fn(),
      findPendingApplications: jest.fn(),
      findByApplicantAndJob: jest.fn(),
      hasExistingApplication: jest.fn()
    } as jest.Mocked<Partial<ApplicationRepository>> as jest.Mocked<ApplicationRepository>;

    mockJobRepository = {
      findById: jest.fn()
    } as jest.Mocked<Partial<JobRepository>> as jest.Mocked<JobRepository>;

    mockStaffRepository = {
      findByUserId: jest.fn()
    } as jest.Mocked<Partial<StaffRepository>> as jest.Mocked<StaffRepository>;

    mockRobloxService = {
      validateUsername: jest.fn()
    } as jest.Mocked<Partial<RobloxService>> as jest.Mocked<RobloxService>;

    mockPermissionService = {
      hasHRPermissionWithContext: jest.fn(),
      hasActionPermission: jest.fn()
    } as jest.Mocked<Partial<PermissionService>> as jest.Mocked<PermissionService>;

    applicationService = new ApplicationService(
      mockApplicationRepository,
      mockJobRepository,
      mockStaffRepository,
      mockRobloxService,
      mockPermissionService
    );

    jest.clearAllMocks();
  });

  describe('submitApplication', () => {
    const mockSubmissionRequest: ApplicationSubmissionRequest = {
      guildId: testGuildId,
      jobId: testJobId,
      applicantId: testApplicantId,
      robloxUsername: 'testuser123',
      answers: [
        { questionId: 'q1', answer: 'Test answer 1' },
        { questionId: 'q2', answer: 'Test answer 2' }
      ]
    };

    const mockJob = TestUtils.generateMockJob({
      _id: TestUtils.generateObjectId().toString(),
      guildId: testGuildId,
      title: 'Test Job',
      description: 'Test job description',
      staffRole: 'Junior Associate' as const,
      isOpen: true,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    const mockCreatedApplication = TestUtils.generateMockApplication({
      _id: TestUtils.generateObjectId().toString(),
      guildId: testGuildId,
      jobId: testJobId,
      applicantId: testApplicantId,
      robloxUsername: 'testuser123',
      answers: mockSubmissionRequest.answers,
      status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    it('should submit application successfully with valid data', async () => {
      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockResolvedValue({ isValid: true });
      mockApplicationRepository.add.mockResolvedValue((mockCreatedApplication));

      const result = await applicationService.submitApplication(mockSubmissionRequest);

      expect(mockJobRepository.findById).toHaveBeenCalledWith(testJobId);
      expect(mockStaffRepository.findByUserId).toHaveBeenCalledWith(testGuildId, testApplicantId);
      expect(mockRobloxService.validateUsername).toHaveBeenCalledWith('testuser123');
      expect(mockApplicationRepository.add).toHaveBeenCalledWith({
        guildId: testGuildId,
        jobId: testJobId,
        applicantId: testApplicantId,
        robloxUsername: 'testuser123',
        answers: mockSubmissionRequest.answers,
        status: 'pending' as const
      });
      expect(result).toEqual(mockCreatedApplication);
    });

    it('should submit application with Roblox validation warning', async () => {
      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockResolvedValue({ 
        isValid: false, 
        error: 'User not found' 
      });
      mockApplicationRepository.add.mockResolvedValue((mockCreatedApplication));

      const result = await applicationService.submitApplication(mockSubmissionRequest);

      expect(result).toEqual(mockCreatedApplication);
      expect(mockApplicationRepository.add).toHaveBeenCalled();
    });

    it('should submit application when Roblox validation throws error', async () => {
      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockRejectedValue(new Error('Roblox API error'));
      mockApplicationRepository.add.mockResolvedValue((mockCreatedApplication));

      const result = await applicationService.submitApplication(mockSubmissionRequest);

      expect(result).toEqual(mockCreatedApplication);
      expect(mockApplicationRepository.add).toHaveBeenCalled();
    });

    it('should throw error when job not found', async () => {
      mockJobRepository.findById.mockResolvedValue(null);

      await expect(applicationService.submitApplication(mockSubmissionRequest))
        .rejects.toThrow('Application validation failed: Job not found');

      expect(mockApplicationRepository.add).not.toHaveBeenCalled();
    });

    it('should throw error when job is not open', async () => {
      const closedJob = { ...mockJob, isOpen: false };
      mockJobRepository.findById.mockResolvedValue((closedJob));

      await expect(applicationService.submitApplication(mockSubmissionRequest))
        .rejects.toThrow('Application validation failed: Job is not open for applications');

      expect(mockApplicationRepository.add).not.toHaveBeenCalled();
    });

    it('should throw error when active staff member tries to apply', async () => {
      const activeStaff = TestUtils.generateMockStaff({
        guildId: testGuildId,
        userId: testApplicantId,
        status: 'active' as const
      });

      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue((activeStaff));

      await expect(applicationService.submitApplication(mockSubmissionRequest))
        .rejects.toThrow('Application validation failed: Active staff members cannot apply for positions');

      expect(mockApplicationRepository.add).not.toHaveBeenCalled();
    });

    it('should allow inactive staff member to apply', async () => {
      const inactiveStaff = TestUtils.generateMockStaff({
        guildId: testGuildId,
        userId: testApplicantId,
        status: 'inactive'
      });

      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue((inactiveStaff));
      mockRobloxService.validateUsername.mockResolvedValue({ isValid: true });
      mockApplicationRepository.add.mockResolvedValue((mockCreatedApplication));

      const result = await applicationService.submitApplication(mockSubmissionRequest);

      expect(result).toEqual(mockCreatedApplication);
      expect(mockApplicationRepository.add).toHaveBeenCalled();
    });

    it('should throw error when answers are empty', async () => {
      const requestWithoutAnswers = {
        ...mockSubmissionRequest,
        answers: []
      };

      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);

      await expect(applicationService.submitApplication(requestWithoutAnswers))
        .rejects.toThrow('Application validation failed: Application answers are required');

      expect(mockApplicationRepository.add).not.toHaveBeenCalled();
    });

    it('should throw error when answers are undefined', async () => {
      const requestWithoutAnswers = {
        ...mockSubmissionRequest,
        answers: undefined as any
      };

      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);

      await expect(applicationService.submitApplication(requestWithoutAnswers))
        .rejects.toThrow('Application submission request: Validation failed - answers: Required');

      expect(mockApplicationRepository.add).not.toHaveBeenCalled();
    });

    it('should handle repository add failure', async () => {
      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockResolvedValue({ isValid: true });
      mockApplicationRepository.add.mockRejectedValue(new Error('Database error'));

      await expect(applicationService.submitApplication(mockSubmissionRequest))
        .rejects.toThrow('Database error');
    });

    it('should handle job repository failure', async () => {
      mockJobRepository.findById.mockRejectedValue(new Error('Job repository error'));

      await expect(applicationService.submitApplication(mockSubmissionRequest))
        .rejects.toThrow('Job repository error');
    });

    it('should handle staff repository failure', async () => {
      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockRejectedValue(new Error('Staff repository error'));

      await expect(applicationService.submitApplication(mockSubmissionRequest))
        .rejects.toThrow('Staff repository error');
    });

    it('should handle complex application answers', async () => {
      const complexAnswers: ApplicationAnswer[] = [
        { questionId: 'experience', answer: 'I have 5 years of legal experience working in corporate law...' },
        { questionId: 'availability', answer: 'Full-time, Monday through Friday' },
        { questionId: 'specialization', answer: 'Corporate mergers and acquisitions' },
        { questionId: 'references', answer: 'Jane Doe - Senior Partner at Law Firm XYZ, john.doe@lawfirm.com' }
      ];

      const requestWithComplexAnswers = {
        ...mockSubmissionRequest,
        answers: complexAnswers
      };

      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockResolvedValue({ isValid: true });
      mockApplicationRepository.add.mockResolvedValue(({
        ...mockCreatedApplication,
        answers: complexAnswers
      }));

      const result = await applicationService.submitApplication(requestWithComplexAnswers);

      expect(mockApplicationRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          answers: complexAnswers
        })
      );
      expect(result.answers).toEqual(complexAnswers);
    });
  });

  describe('reviewApplication', () => {
    const mockReviewRequest = {
      applicationId: testApplicationId,
      decision: 'accepted' as const,
      reviewedBy: testReviewerId,
      reason: 'Strong qualifications and experience'
    };

    const mockPendingApplication = TestUtils.generateMockApplication({
      _id: TestUtils.generateObjectId().toString(),
      guildId: testGuildId,
      jobId: testJobId,
      applicantId: testApplicantId,
      status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    const mockReviewedApplication: Application = {
      ...mockPendingApplication,
      status: 'accepted' as ApplicationStatus,
      reviewedBy: testReviewerId,
      reviewedAt: new Date(),
      reviewReason: 'Strong qualifications and experience'
    };

    it('should approve application successfully', async () => {
      mockApplicationRepository.findById.mockResolvedValue((mockPendingApplication));
      mockApplicationRepository.update.mockResolvedValue(mockReviewedApplication);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.reviewApplication(mockPermissionContext, mockReviewRequest);

      expect(mockApplicationRepository.findById).toHaveBeenCalledWith(testApplicationId);
      expect(mockApplicationRepository.update).toHaveBeenCalledWith(testApplicationId, {
        status: 'accepted' as const,
        reviewedBy: testReviewerId,
        reviewedAt: expect.any(Date),
        reviewReason: 'Strong qualifications and experience'
      });
      expect(result).toEqual(mockReviewedApplication);
    });

    it('should reject application successfully', async () => {
      const rejectRequest = {
        ...mockReviewRequest,
        decision: 'rejected' as const,
        reason: 'Insufficient experience'
      };

      const rejectedApplication = {
        ...mockPendingApplication,
        status: 'rejected' as const,
        reviewedBy: testReviewerId,
        reviewedAt: new Date(),
        reviewReason: 'Insufficient experience'
      };

      mockApplicationRepository.findById.mockResolvedValue((mockPendingApplication));
      mockApplicationRepository.update.mockResolvedValue(rejectedApplication);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.reviewApplication(mockPermissionContext, rejectRequest);

      expect(mockApplicationRepository.update).toHaveBeenCalledWith(testApplicationId, {
        status: 'rejected' as const,
        reviewedBy: testReviewerId,
        reviewedAt: expect.any(Date),
        reviewReason: 'Insufficient experience'
      });
      expect(result.status).toBe('rejected');
    });

    it('should review application without reason', async () => {
      const requestWithoutReason = {
        applicationId: testApplicationId,
        decision: 'accepted' as const,
        reviewedBy: testReviewerId
      };

      mockApplicationRepository.findById.mockResolvedValue((mockPendingApplication));
      mockApplicationRepository.update.mockResolvedValue({
        ...mockReviewedApplication,
        reviewReason: undefined
      });

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.reviewApplication(mockPermissionContext, requestWithoutReason);

      expect(mockApplicationRepository.update).toHaveBeenCalledWith(testApplicationId, {
        status: 'accepted' as const,
        reviewedBy: testReviewerId,
        reviewedAt: expect.any(Date),
        reviewReason: undefined
      });
      expect(result.reviewReason).toBeUndefined();
    });

    it('should throw error when application not found', async () => {
      mockApplicationRepository.findById.mockResolvedValue(null);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      await expect(applicationService.reviewApplication(mockPermissionContext, mockReviewRequest))
        .rejects.toThrow('Application not found');

      expect(mockApplicationRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when application already reviewed', async () => {
      const alreadyReviewedApplication = {
        ...mockPendingApplication,
        status: 'accepted' as const
      };

      mockApplicationRepository.findById.mockResolvedValue((alreadyReviewedApplication));

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      await expect(applicationService.reviewApplication(mockPermissionContext, mockReviewRequest))
        .rejects.toThrow('Application is already accepted');

      expect(mockApplicationRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when application is rejected status', async () => {
      const rejectedApplication = {
        ...mockPendingApplication,
        status: 'rejected' as const
      };

      mockApplicationRepository.findById.mockResolvedValue((rejectedApplication));

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      await expect(applicationService.reviewApplication(mockPermissionContext, mockReviewRequest))
        .rejects.toThrow('Application is already rejected');

      expect(mockApplicationRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when update fails', async () => {
      mockApplicationRepository.findById.mockResolvedValue((mockPendingApplication));
      mockApplicationRepository.update.mockResolvedValue(null);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      await expect(applicationService.reviewApplication(mockPermissionContext, mockReviewRequest))
        .rejects.toThrow('Failed to update application');
    });

    it('should handle repository find failure', async () => {
      mockApplicationRepository.findById.mockRejectedValue(new Error('Database error'));

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      await expect(applicationService.reviewApplication(mockPermissionContext, mockReviewRequest))
        .rejects.toThrow('Database error');
    });

    it('should handle repository update failure', async () => {
      mockApplicationRepository.findById.mockResolvedValue((mockPendingApplication));
      mockApplicationRepository.update.mockRejectedValue(new Error('Update failed'));

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      await expect(applicationService.reviewApplication(mockPermissionContext, mockReviewRequest))
        .rejects.toThrow('Update failed');
    });
  });

  describe('validateApplication', () => {
    const mockValidationRequest: ApplicationSubmissionRequest = {
      guildId: testGuildId,
      jobId: testJobId,
      applicantId: testApplicantId,
      robloxUsername: 'testuser123',
      answers: [
        { questionId: 'q1', answer: 'Test answer' }
      ]
    };

    const mockOpenJob: Job = TestUtils.generateMockJob({
      _id: TestUtils.generateObjectId().toString(),
      guildId: testGuildId,
      isOpen: true,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    it('should return valid result for valid application', async () => {
      mockJobRepository.findById.mockResolvedValue((mockOpenJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockResolvedValue({ isValid: true });

      const result = await applicationService.validateApplication(mockValidationRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return errors for non-existent job', async () => {
      mockJobRepository.findById.mockResolvedValue(null);

      const result = await applicationService.validateApplication(mockValidationRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Job not found');
    });

    it('should return errors for closed job', async () => {
      const closedJob = { ...mockOpenJob, isOpen: false };
      mockJobRepository.findById.mockResolvedValue((closedJob));

      const result = await applicationService.validateApplication(mockValidationRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Job is not open for applications');
    });

    it('should return errors for active staff applicant', async () => {
      const activeStaff = TestUtils.generateMockStaff({
        guildId: testGuildId,
        userId: testApplicantId,
        status: 'active' as const
      });

      mockJobRepository.findById.mockResolvedValue((mockOpenJob));
      mockStaffRepository.findByUserId.mockResolvedValue((activeStaff));

      const result = await applicationService.validateApplication(mockValidationRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Active staff members cannot apply for positions');
    });

    it('should return warnings for invalid Roblox username', async () => {
      mockJobRepository.findById.mockResolvedValue((mockOpenJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockResolvedValue({
        isValid: false,
        error: 'User not found'
      });

      const result = await applicationService.validateApplication(mockValidationRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain('Roblox validation warning: User not found');
    });

    it('should return warnings when Roblox validation throws error', async () => {
      mockJobRepository.findById.mockResolvedValue((mockOpenJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockRejectedValue(new Error('API timeout'));

      const result = await applicationService.validateApplication(mockValidationRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain('Could not validate Roblox username - please ensure it is correct');
    });

    it('should return errors for missing answers', async () => {
      const requestWithoutAnswers = {
        ...mockValidationRequest,
        answers: []
      };

      mockJobRepository.findById.mockResolvedValue((mockOpenJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);

      const result = await applicationService.validateApplication(requestWithoutAnswers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Application answers are required');
    });

    it('should accumulate multiple errors', async () => {
      const requestWithoutAnswers = {
        ...mockValidationRequest,
        answers: []
      };

      const activeStaff = TestUtils.generateMockStaff({
        guildId: testGuildId,
        userId: testApplicantId,
        status: 'active' as const
      });

      mockJobRepository.findById.mockResolvedValue(null);
      mockStaffRepository.findByUserId.mockResolvedValue((activeStaff));

      const result = await applicationService.validateApplication(requestWithoutAnswers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Job not found');
      expect(result.errors).toContain('Active staff members cannot apply for positions');
      expect(result.errors).toContain('Application answers are required');
    });
  });

  describe('getApplicationById', () => {
    const mockApplication = TestUtils.generateMockApplication({
      _id: TestUtils.generateObjectId().toString(),
      guildId: testGuildId,
      jobId: testJobId,
      applicantId: testApplicantId,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    it('should return application when found', async () => {
      mockApplicationRepository.findById.mockResolvedValue((mockApplication));

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getApplicationById(mockPermissionContext, testApplicationId);

      expect(mockApplicationRepository.findById).toHaveBeenCalledWith(testApplicationId);
      expect(result).toEqual(mockApplication);
    });

    it('should return null when application not found', async () => {
      mockApplicationRepository.findById.mockResolvedValue(null);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getApplicationById(mockPermissionContext, TestUtils.generateObjectId().toString());

      expect(result).toBeNull();
    });

    it('should handle repository errors', async () => {
      mockApplicationRepository.findById.mockRejectedValue(new Error('Database error'));

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      await expect(applicationService.getApplicationById(mockPermissionContext, testApplicationId))
        .rejects.toThrow('Database error');
    });
  });

  describe('getApplicationsByJob', () => {
    const mockApplications = [
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        jobId: testJobId,
        applicantId: testApplicantId,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        jobId: testJobId,
        applicantId: '345678901234567890',
        status: 'accepted' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ];

    it('should return applications for job', async () => {
      mockApplicationRepository.findByJob.mockResolvedValue(mockApplications);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getApplicationsByJob(mockPermissionContext, testJobId);

      expect(mockApplicationRepository.findByJob).toHaveBeenCalledWith(testJobId);
      expect(result).toEqual(mockApplications);
    });

    it('should return empty array when no applications found', async () => {
      mockApplicationRepository.findByJob.mockResolvedValue([]);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getApplicationsByJob(mockPermissionContext, TestUtils.generateObjectId().toString());

      expect(result).toEqual([]);
    });

    it('should handle repository errors', async () => {
      mockApplicationRepository.findByJob.mockRejectedValue(new Error('Database error'));

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      await expect(applicationService.getApplicationsByJob(mockPermissionContext, testJobId))
        .rejects.toThrow('Database error');
    });
  });

  describe('getApplicationsByApplicant', () => {
    const mockApplications = [
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        jobId: testJobId,
        applicantId: testApplicantId,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        jobId: TestUtils.generateObjectId().toString(),
        applicantId: testApplicantId,
        status: 'rejected' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ];

    it('should return applications for applicant', async () => {
      mockApplicationRepository.findByApplicant.mockResolvedValue(mockApplications);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getApplicationsByApplicant(mockPermissionContext, testApplicantId);

      expect(mockApplicationRepository.findByApplicant).toHaveBeenCalledWith(testApplicantId);
      expect(result).toEqual(mockApplications);
    });

    it('should return empty array when no applications found', async () => {
      mockApplicationRepository.findByApplicant.mockResolvedValue([]);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getApplicationsByApplicant(mockPermissionContext, TestUtils.generateSnowflake());

      expect(result).toEqual([]);
    });

    it('should handle repository errors', async () => {
      mockApplicationRepository.findByApplicant.mockRejectedValue(new Error('Database error'));

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      await expect(applicationService.getApplicationsByApplicant(mockPermissionContext, testApplicantId))
        .rejects.toThrow('Database error');
    });
  });

  describe('getPendingApplications', () => {
    const mockPendingApplications = [
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        jobId: testJobId,
        applicantId: testApplicantId,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        jobId: TestUtils.generateObjectId().toString(),
        applicantId: '345678901234567890',
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ];

    it('should return pending applications for guild', async () => {
      mockApplicationRepository.findPendingApplications.mockResolvedValue(mockPendingApplications);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getPendingApplications(mockPermissionContext);

      expect(mockApplicationRepository.findPendingApplications).toHaveBeenCalledWith(testGuildId);
      expect(result).toEqual(mockPendingApplications);
    });

    it('should return empty array when no pending applications', async () => {
      mockApplicationRepository.findPendingApplications.mockResolvedValue([]);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getPendingApplications(mockPermissionContext);

      expect(result).toEqual([]);
    });

    it('should handle repository errors', async () => {
      mockApplicationRepository.findPendingApplications.mockRejectedValue(new Error('Database error'));

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      await expect(applicationService.getPendingApplications(mockPermissionContext))
        .rejects.toThrow('Database error');
    });
  });

  describe('getApplicationStats', () => {
    const mockAllApplications = [
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        status: 'accepted' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        status: 'accepted' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        status: 'accepted' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        status: 'rejected' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      TestUtils.generateMockApplication({
        _id: TestUtils.generateObjectId().toString(),
        guildId: testGuildId,
        status: 'rejected' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ];

    it('should return correct application statistics', async () => {
      mockApplicationRepository.findByGuild.mockResolvedValue(mockAllApplications);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getApplicationStats(mockPermissionContext);

      expect(mockApplicationRepository.findByGuild).toHaveBeenCalledWith(testGuildId);
      expect(result).toEqual({
        total: 7,
        pending: 2,
        accepted: 3,
        rejected: 2
      });
    });

    it('should return zero stats when no applications', async () => {
      mockApplicationRepository.findByGuild.mockResolvedValue([]);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getApplicationStats(mockPermissionContext);

      expect(result).toEqual({
        total: 0,
        pending: 0,
        accepted: 0,
        rejected: 0
      });
    });

    it('should handle repository errors', async () => {
      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      mockApplicationRepository.findByGuild.mockRejectedValue(new Error('Database error'));

      await expect(applicationService.getApplicationStats(mockPermissionContext))
        .rejects.toThrow('Database error');
    });

    it('should handle edge case with only one status', async () => {
      const onlyPendingApplications = [
        TestUtils.generateMockApplication({ guildId: testGuildId, status: 'pending' as const }),
        TestUtils.generateMockApplication({ guildId: testGuildId, status: 'pending' as const }),
        TestUtils.generateMockApplication({ guildId: testGuildId, status: 'pending' as const })
      ];

      mockApplicationRepository.findByGuild.mockResolvedValue(onlyPendingApplications);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getApplicationStats(mockPermissionContext);

      expect(result).toEqual({
        total: 3,
        pending: 3,
        accepted: 0,
        rejected: 0
      });
    });
  });

  describe('generateApplicationId', () => {
    it('should generate a valid UUID', () => {
      const id1 = applicationService.generateApplicationId();
      const id2 = applicationService.generateApplicationId();

      // Should be strings
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');

      // Should be different
      expect(id1).not.toBe(id2);

      // Should match UUID format (basic check)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(id1)).toBe(true);
      expect(uuidRegex.test(id2)).toBe(true);
    });

    it('should generate unique IDs on multiple calls', () => {
      const ids = Array.from({ length: 100 }, () => applicationService.generateApplicationId());
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed application data gracefully', async () => {
      const malformedRequest = {
        guildId: '',
        jobId: '',
        applicantId: '',
        robloxUsername: '',
        answers: []
      } as ApplicationSubmissionRequest;

      mockJobRepository.findById.mockResolvedValue(null);

      await expect(applicationService.submitApplication(malformedRequest))
        .rejects.toThrow('Application submission request: Validation failed');
    });

    it('should handle concurrent application submissions', async () => {
      const mockJob = TestUtils.generateMockJob({
        guildId: testGuildId,
        isOpen: true
      });

      const request: ApplicationSubmissionRequest = {
        guildId: testGuildId,
        jobId: testJobId,
        applicantId: testApplicantId,
        robloxUsername: 'testuser123',
        answers: [{ questionId: 'q1', answer: 'Test answer' }]
      };

      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockResolvedValue({ isValid: true });
      mockApplicationRepository.add.mockResolvedValue((TestUtils.generateMockApplication()));

      // Simulate concurrent submissions
      const submissions = Array.from({ length: 5 }, () =>
        applicationService.submitApplication(request)
      );

      const results = await Promise.all(submissions);
      expect(results).toHaveLength(5);
      expect(mockApplicationRepository.add).toHaveBeenCalledTimes(5);
    });

    it('should handle very large application answers', async () => {
      const largeAnswer = 'A'.repeat(1500); // Within 2000 char limit
      const requestWithLargeAnswer: ApplicationSubmissionRequest = {
        guildId: testGuildId,
        jobId: testJobId,
        applicantId: testApplicantId,
        robloxUsername: 'testuser123',
        answers: [{ questionId: 'essay', answer: largeAnswer }]
      };

      const mockJob = TestUtils.generateMockJob({
        guildId: testGuildId,
        isOpen: true
      });

      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockResolvedValue({ isValid: true });
      mockApplicationRepository.add.mockResolvedValue((TestUtils.generateMockApplication({
        answers: [{ questionId: 'essay', answer: largeAnswer }]
      })));

      const result = await applicationService.submitApplication(requestWithLargeAnswer);

      expect(result.answers?.[0]?.answer).toHaveLength(1500);
      expect(mockApplicationRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          answers: [{ questionId: 'essay', answer: largeAnswer }]
        })
      );
    });

    it('should handle special characters in Roblox usernames', async () => {
      const specialUsernameRequest: ApplicationSubmissionRequest = {
        guildId: testGuildId,
        jobId: testJobId,
        applicantId: testApplicantId,
        robloxUsername: 'test_user_123',
        answers: [{ questionId: 'q1', answer: 'Test answer' }]
      };

      const mockJob = TestUtils.generateMockJob({
        guildId: testGuildId,
        isOpen: true
      });

      mockJobRepository.findById.mockResolvedValue((mockJob));
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockRobloxService.validateUsername.mockResolvedValue({ isValid: true });
      mockApplicationRepository.add.mockResolvedValue((TestUtils.generateMockApplication({
        robloxUsername: 'test_user_123'
      })));

      const result = await applicationService.submitApplication(specialUsernameRequest);

      expect(result.robloxUsername).toBe('test_user_123');
      expect(mockRobloxService.validateUsername).toHaveBeenCalledWith('test_user_123');
    });

    it('should handle database connection failures gracefully', async () => {
      const request: ApplicationSubmissionRequest = {
        guildId: testGuildId,
        jobId: testJobId,
        applicantId: testApplicantId,
        robloxUsername: 'testuser123',
        answers: [{ questionId: 'q1', answer: 'Test answer' }]
      };

      mockJobRepository.findById.mockRejectedValue(new Error('Connection timeout'));

      await expect(applicationService.submitApplication(request))
        .rejects.toThrow('Connection timeout');
    });

    it('should handle null responses from repositories', async () => {
      mockApplicationRepository.findById.mockResolvedValue(null);

      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const result = await applicationService.getApplicationById(mockPermissionContext, TestUtils.generateObjectId().toString());
      expect(result).toBeNull();

      mockApplicationRepository.findByJob.mockResolvedValue([]);
      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const jobResults = await applicationService.getApplicationsByJob(mockPermissionContext, TestUtils.generateObjectId().toString());
      expect(jobResults).toEqual([]);

      mockApplicationRepository.findByApplicant.mockResolvedValue([]);
      mockPermissionService.hasHRPermissionWithContext.mockResolvedValue(true);
      const applicantResults = await applicationService.getApplicationsByApplicant(mockPermissionContext, TestUtils.generateSnowflake());
      expect(applicantResults).toEqual([]);
    });
  });
});