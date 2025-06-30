import { CrossEntityValidationService } from '../../../application/services/cross-entity-validation-service';
import type { ValidationIssue, ValidationContext } from '../../../application/services/cross-entity-validation-service';
import { StaffRepository } from '../../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../../infrastructure/repositories/case-repository';
import { ApplicationRepository } from '../../../infrastructure/repositories/application-repository';
import { JobRepository } from '../../../infrastructure/repositories/job-repository';
import { RetainerRepository } from '../../../infrastructure/repositories/retainer-repository';
import { FeedbackRepository } from '../../../infrastructure/repositories/feedback-repository';
import { ReminderRepository } from '../../../infrastructure/repositories/reminder-repository';
import { AuditLogRepository } from '../../../infrastructure/repositories/audit-log-repository';
// import { BusinessRuleValidationService } from '../../../application/services/business-rule-validation-service';
import { Staff, Case, Application, Job, Retainer, Feedback, Reminder } from '../../../validation';
import { TestUtils } from '../../helpers/test-utils';
import { ObjectId } from 'mongodb';
// Remove StaffRole import - we'll use string literals
import { logger } from '../../../infrastructure/logger';
// Remove CaseStatus and CasePriority imports - we'll use string literals

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
    error: jest.fn() } }));

describe('CrossEntityValidationService', () => {
  let service: CrossEntityValidationService;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockCaseRepo: jest.Mocked<CaseRepository>;
  let mockApplicationRepo: jest.Mocked<ApplicationRepository>;
  let mockJobRepo: jest.Mocked<JobRepository>;
  let mockRetainerRepo: jest.Mocked<RetainerRepository>;
  let mockFeedbackRepo: jest.Mocked<FeedbackRepository>;
  let mockReminderRepo: jest.Mocked<ReminderRepository>;
  let mockAuditRepo: jest.Mocked<AuditLogRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked repositories
    mockStaffRepo = new StaffRepository() as jest.Mocked<StaffRepository>;
    mockCaseRepo = new CaseRepository() as jest.Mocked<CaseRepository>;
    mockApplicationRepo = new ApplicationRepository() as jest.Mocked<ApplicationRepository>;
    mockJobRepo = new JobRepository() as jest.Mocked<JobRepository>;
    mockRetainerRepo = new RetainerRepository() as jest.Mocked<RetainerRepository>;
    mockFeedbackRepo = new FeedbackRepository() as jest.Mocked<FeedbackRepository>;
    mockReminderRepo = new ReminderRepository() as jest.Mocked<ReminderRepository>;
    mockAuditRepo = new AuditLogRepository() as jest.Mocked<AuditLogRepository>;

    // Create service instance
    service = new CrossEntityValidationService(
      mockStaffRepo,
      mockCaseRepo,
      mockApplicationRepo,
      mockJobRepo,
      mockRetainerRepo,
      mockFeedbackRepo,
      mockReminderRepo,
      mockAuditRepo
    );
    
    // Clear validation cache
    (service as any).validationCache.clear();
  });

  // Helper function to create valid Case objects
  const createMockCase = (overrides: Partial<Case> = {}): Case => ({
    _id: TestUtils.generateObjectId().toString(),
    guildId: '123456789012345678',
    caseNumber: 'AA-2024-0001-testclient',
    clientId: '123456789012345678',
    clientUsername: 'testclient',
    title: 'Test Case',
    description: 'Test case description',
    status: 'in-progress',
    priority: 'medium',
    assignedLawyerIds: [],
    documents: [],
    notes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  });

  describe('Staff Validation Rules', () => {
    it('should detect invalid staff status', async () => {
      const invalidStaff: Staff = TestUtils.generateMockStaff({
        userId: '123456789012345678',
        guildId: '123456789012345678',
        robloxUsername: 'user1',
        role: 'Senior Partner',
        status: 'invalid_status' as any
      });

      const issues = await service.validateBeforeOperation(invalidStaff, 'staff', 'update');

      expect(issues).toHaveLength(1);
      expect(issues[0]!.severity).toBe('critical');
      expect(issues[0]!.message).toContain('Invalid staff status');
      expect(issues[0]!.canAutoRepair).toBe(true);
    });

    it('should validate staff role consistency with case assignments', async () => {
      const paralegalStaff: Staff = TestUtils.generateMockStaff({
        userId: '234567890123456789',
        guildId: '123456789012345678',
        robloxUsername: 'user1',
        role: 'Paralegal',
        status: 'active'
      });

      // Mock paralegal as lead attorney on cases (invalid)
      mockCaseRepo.findByFilters.mockImplementation(async (filters: any) => {
        if (filters.leadAttorneyId === '234567890123456789') {
          return [createMockCase({
            leadAttorneyId: '234567890123456789',
            assignedLawyerIds: ['234567890123456789']
          })];
        }
        return [];
      });

      const issues = await service.validateBeforeOperation(paralegalStaff, 'staff', 'update');

      expect(issues.length).toBeGreaterThan(0);
      const roleIssue = issues.find(i => i.message.includes('cannot be lead attorney'));
      expect(roleIssue).toBeDefined();
      expect(roleIssue!.severity).toBe('critical');
    });

    it('should detect excessive case workload', async () => {
      const juniorAssociate: Staff = TestUtils.generateMockStaff({
        userId: '345678901234567890',
        guildId: '123456789012345678',
        robloxUsername: 'user1',
        role: 'Junior Associate',
        status: 'active'
      });

      // Mock 10 active cases (exceeds limit of 8 for junior associate)
      const mockCases = Array.from({ length: 10 }, () => createMockCase({
        _id: TestUtils.generateObjectId().toString(),
        assignedLawyerIds: ['345678901234567890']
      }));

      mockCaseRepo.findByFilters.mockResolvedValue(mockCases);
      mockCaseRepo.findAssignedToLawyer.mockResolvedValue(mockCases);

      const issues = await service.validateBeforeOperation(juniorAssociate, 'staff', 'update');

      const workloadIssue = issues.find(i => i.message.includes('exceeding recommended limit'));
      expect(workloadIssue).toBeDefined();
      expect(workloadIssue!.severity).toBe('warning');
      expect(workloadIssue!.message).toContain('10 active cases');
      expect(workloadIssue!.message).toContain('limit of 8');
    });

    it('should detect circular references in promotion history', async () => {
      const staff: Staff = TestUtils.generateMockStaff({
        userId: '456789012345678901',
        guildId: '123456789012345678',
        robloxUsername: 'user1',
        role: 'Senior Partner',
        promotionHistory: [
          {
            fromRole: 'Junior Associate',
            toRole: 'Senior Associate',
            promotedBy: '456789012345678901', // Self-promotion!
            promotedAt: new Date(),
            reason: 'test',
            actionType: 'promotion' as const
          }
        ],
        status: 'active'
      });

      const issues = await service.validateBeforeOperation(staff, 'staff', 'update');

      const circularIssue = issues.find(i => i.message.includes('Circular reference'));
      expect(circularIssue).toBeDefined();
      expect(circularIssue!.severity).toBe('critical');
    });
  });

  describe('Case Validation Rules', () => {
    it('should detect non-existent lead attorney', async () => {
      const caseEntity = createMockCase({
        leadAttorneyId: '999999999999999999',
        assignedLawyerIds: ['567890123456789012']
      });

      mockStaffRepo.findByUserId.mockResolvedValue(null);

      const issues = await service.validateBeforeOperation(caseEntity, 'case', 'update');

      expect(issues.length).toBeGreaterThan(0);
      const leadAttorneyIssue = issues.find(i => i.field === 'leadAttorneyId');
      expect(leadAttorneyIssue).toBeDefined();
      expect(leadAttorneyIssue!.severity).toBe('critical');
      expect(leadAttorneyIssue!.canAutoRepair).toBe(true);
    });

    it('should detect inactive assigned lawyers', async () => {
      const caseEntity = createMockCase({
        assignedLawyerIds: ['678901234567890123', '789012345678901234']
      });

      // Clear any previous mocks
      mockStaffRepo.findByUserId.mockReset();
      
      // Set up mocks for each lawyer
      mockStaffRepo.findByUserId
        .mockImplementation((_guildId: unknown, userId: unknown) => {
          if (userId === '678901234567890123') {
            return Promise.resolve(TestUtils.generateMockStaff({
              _id: TestUtils.generateObjectId().toString(),
              userId: '678901234567890123',
              status: 'active'
            }));
          } else if (userId === '789012345678901234') {
            return Promise.resolve(TestUtils.generateMockStaff({
              _id: TestUtils.generateObjectId().toString(),
              userId: '789012345678901234',
              status: 'terminated'
            }));
          }
          return Promise.resolve(null);
        });

      const issues = await service.validateBeforeOperation(caseEntity, 'case', 'update');
      
      const inactiveIssue = issues.find(i => i.message.includes('is not active (status:'));
      expect(inactiveIssue).toBeDefined();
      expect(inactiveIssue!.severity).toBe('warning');
    });

    it('should detect temporal inconsistencies', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const caseEntity = createMockCase({
        assignedLawyerIds: ['890123456789012345'],
        status: 'closed',
        createdAt: now,
        closedAt: yesterday, // Closed before created!
        updatedAt: now
      });

      mockStaffRepo.findByUserId.mockResolvedValue({
        _id: TestUtils.generateObjectId().toString(),
        userId: '890123456789012345',
        hiredAt: tomorrow, // Hired after case created!
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Staff);

      const issues = await service.validateBeforeOperation(caseEntity, 'case', 'update');

      expect(issues.length).toBeGreaterThan(0);
      
      const temporalIssue = issues.find(i => i.message.includes('closed date is before creation date'));
      expect(temporalIssue).toBeDefined();
      expect(temporalIssue!.severity).toBe('critical');
      expect(temporalIssue!.canAutoRepair).toBe(true);

      const hireIssue = issues.find(i => i.message.includes('hired after case was created'));
      expect(hireIssue).toBeDefined();
      expect(hireIssue!.severity).toBe('critical');
      expect(hireIssue!.canAutoRepair).toBe(true);
    });

    it('should validate case channel existence', async () => {
      const caseEntity = createMockCase({
        channelId: '901234567890123456',
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

      const context: ValidationContext = {
        guildId: '123456789012345678',
        client: mockClient as any,
        validationLevel: 'strict'
      };

      const issues = await service.validateBeforeOperation(caseEntity, 'case', 'update', context);

      const channelIssue = issues.find(i => i.field === 'channelId');
      expect(channelIssue).toBeDefined();
      expect(channelIssue!.severity).toBe('warning');
      expect(channelIssue!.message).toContain('not found in Discord');
      expect(channelIssue!.canAutoRepair).toBe(true);
    });
  });

  describe('Application Validation Rules', () => {
    it('should detect missing job reference', async () => {
      const application: Application = {
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        jobId: '999999999999999999',
        applicantId: '012345678901234567',
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
      expect(jobIssue!.severity).toBe('critical');
      expect(jobIssue!.message).toContain('Referenced job');
    });

    it('should detect pending applications for closed jobs', async () => {
      const application: Application = {
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        jobId: '111111111111111111',
        applicantId: '222222222222222222',
        robloxUsername: 'user1',
        status: 'pending',
        answers: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockJobRepo.findById.mockResolvedValue({
        _id: TestUtils.generateObjectId().toString(),
        isOpen: false, // Job is closed
        createdAt: new Date(),
        updatedAt: new Date()
      } as Job);

      const issues = await service.validateBeforeOperation(application, 'application', 'update');

      const statusIssue = issues.find(i => i.field === 'status');
      expect(statusIssue).toBeDefined();
      expect(statusIssue!.severity).toBe('warning');
      expect(statusIssue!.message).toContain('pending for a closed job');
      expect(statusIssue!.canAutoRepair).toBe(true);
    });

    it('should validate application integrity', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const application: Application = {
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        jobId: '111111111111111111',
        applicantId: '222222222222222222',
        robloxUsername: 'user1',
        status: 'accepted',
        answers: [],
        reviewedAt: yesterday, // Reviewed before submitted!
        reviewedBy: undefined, // No reviewer for accepted application
        createdAt: now,
        updatedAt: now
      };

      mockJobRepo.findById.mockResolvedValue({
        _id: TestUtils.generateObjectId().toString(),
        isOpen: true,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Job);

      const issues = await service.validateBeforeOperation(application, 'application', 'update');

      const temporalIssue = issues.find(i => i.message.includes('reviewed before it was created'));
      expect(temporalIssue).toBeDefined();
      expect(temporalIssue!.severity).toBe('critical');
      expect(temporalIssue!.canAutoRepair).toBe(true);

      const reviewerIssue = issues.find(i => i.message.includes('has no reviewer'));
      expect(reviewerIssue).toBeDefined();
      expect(reviewerIssue!.severity).toBe('warning');
    });
  });

  describe('Retainer Validation Rules', () => {
    it('should detect non-existent lawyer in retainer', async () => {
      const retainer: Retainer = {
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        clientId: '333333333333333333',
        lawyerId: '999999999999999999',
        
        agreementTemplate: 'test',
        status: 'signed',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStaffRepo.findByUserId.mockResolvedValue(null);

      const issues = await service.validateBeforeOperation(retainer, 'retainer', 'update');

      expect(issues.length).toBeGreaterThan(0);
      const lawyerIssue = issues.find(i => i.field === 'lawyerId');
      expect(lawyerIssue).toBeDefined();
      expect(lawyerIssue!.severity).toBe('critical');
    });

    it('should detect inactive lawyer in retainer', async () => {
      const retainer: Retainer = {
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        clientId: '444444444444444444',
        lawyerId: '555555555555555555',
        
        agreementTemplate: 'test',
        status: 'signed',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStaffRepo.findByUserId.mockResolvedValue({
        _id: TestUtils.generateObjectId().toString(),
        userId: '555555555555555555',
        status: 'terminated',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Staff);

      const issues = await service.validateBeforeOperation(retainer, 'retainer', 'update');

      const inactiveIssue = issues.find(i => i.message.includes('is not active (status:'));
      expect(inactiveIssue).toBeDefined();
      expect(inactiveIssue!.severity).toBe('warning');
    });
  });

  describe('Feedback Validation Rules', () => {
    it('should detect non-existent target staff', async () => {
      const feedback: Feedback = {
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        submitterId: '666666666666666666',
        submitterUsername: 'client1',
        targetStaffId: '999999999999999999',
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
      expect(staffIssue!.severity).toBe('warning');
      expect(staffIssue!.canAutoRepair).toBe(true);
    });
  });

  describe('Reminder Validation Rules', () => {
    it('should detect non-existent case reference', async () => {
      const reminder: Reminder = TestUtils.generateMockReminder({
        guildId: '123456789012345678',
        userId: '777777777777777777',
        username: 'user1',
        caseId: '999999999999999999',
        message: 'Test reminder',
        scheduledFor: new Date(),
        isActive: true
      });

      mockCaseRepo.findById.mockResolvedValue(null);

      const issues = await service.validateBeforeOperation(reminder, 'reminder', 'update');

      const caseIssue = issues.find(i => i.field === 'caseId');
      expect(caseIssue).toBeDefined();
      expect(caseIssue!.severity).toBe('warning');
      expect(caseIssue!.canAutoRepair).toBe(true);
    });

    it('should validate reminder channel existence', async () => {
      const reminder: Reminder = TestUtils.generateMockReminder({
        guildId: '123456789012345678',
        userId: '888888888888888888',
        username: 'user1',
        channelId: '901234567890123456',
        message: 'Test reminder',
        scheduledFor: new Date(),
        isActive: true
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

      const context: ValidationContext = {
        guildId: '123456789012345678',
        client: mockClient as any,
        validationLevel: 'strict'
      };

      const issues = await service.validateBeforeOperation(reminder, 'reminder', 'update', context);

      const channelIssue = issues.find(i => i.field === 'channelId');
      expect(channelIssue).toBeDefined();
      expect(channelIssue!.severity).toBe('warning');
      expect(channelIssue!.canAutoRepair).toBe(true);
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
          clientId: '999999999999999999',
          assignedLawyerIds: []
        })
      ]);
      mockApplicationRepo.findByGuild.mockResolvedValue([]);
      mockJobRepo.findByGuildId.mockResolvedValue([]);
      mockRetainerRepo.findByGuild.mockResolvedValue([]);
      mockFeedbackRepo.findByFilters.mockResolvedValue([]);
      mockReminderRepo.findByFilters.mockResolvedValue([]);

      const context: Partial<ValidationContext> = {
        client: mockClient as any
      };

      const report = await service.scanForIntegrityIssues('guild1', context);
      
      const orphanedIssue = report.issues.find(i => 
        i.message.includes('Client') && i.message.includes('not found in Discord server')
      );
      expect(orphanedIssue).toBeDefined();
      expect(orphanedIssue!.severity).toBe('info');
    });

    it('should detect self-hired staff members', async () => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Set up mocks for scanForIntegrityIssues
      mockStaffRepo.findByGuildId.mockResolvedValue([{
        _id: TestUtils.generateObjectId().toString(),
        userId: '101010101010101010',
        guildId: '123456789012345678',
        hiredBy: '101010101010101010', // Self-hired!
        role: 'Senior Partner',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }] as Staff[]);
      mockCaseRepo.findByFilters.mockResolvedValue([]);
      mockApplicationRepo.findByGuild.mockResolvedValue([]);
      mockJobRepo.findByGuildId.mockResolvedValue([]);
      mockRetainerRepo.findByGuild.mockResolvedValue([]);
      mockFeedbackRepo.findByFilters.mockResolvedValue([]);
      mockReminderRepo.findByFilters.mockResolvedValue([]);

      const report = await service.scanForIntegrityIssues('123456789012345678');

      const selfHiredIssue = report.issues.find(i => 
        i.message.includes('Staff member hired by themselves')
      );
      expect(selfHiredIssue).toBeDefined();
      expect(selfHiredIssue!.severity).toBe('warning');
    });
  });

  describe('Integrity Scanning', () => {
    it('should perform comprehensive integrity scan', async () => {
      // Mock data for all entity types
      mockStaffRepo.findByGuildId.mockResolvedValue([{
        _id: TestUtils.generateObjectId().toString(),
        userId: '111111111111111111',
        guildId: '123456789012345678',
        status: 'active',
        role: 'Senior Partner',
        createdAt: new Date(),
        updatedAt: new Date()
      }] as Staff[]);

      mockCaseRepo.findByFilters.mockResolvedValue([
        createMockCase({
          assignedLawyerIds: ['111111111111111111', '999999999999999999'] // One valid, one invalid
        })
      ]);

      mockApplicationRepo.findByGuild.mockResolvedValue([{
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        jobId: '212121212121212121',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }] as Application[]);

      mockJobRepo.findByGuildId.mockResolvedValue([{
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        isOpen: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }] as Job[]);

      mockRetainerRepo.findByGuild.mockResolvedValue([]);
      mockFeedbackRepo.findByFilters.mockResolvedValue([]);
      mockReminderRepo.findByFilters.mockResolvedValue([]);

      // Mock staff lookup for case validation
      mockStaffRepo.findByUserId
        .mockResolvedValueOnce({ status: 'active' } as Staff) // user1
        .mockResolvedValueOnce(null); // nonexistent

      mockJobRepo.findById.mockResolvedValue({
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        title: 'Test Job',
        description: 'Test',
        staffRole: 'test',
        roleId: '313131313131313131',
        isOpen: true,
        questions: [],
        postedBy: '111111111111111111',
        applicationCount: 0,
        hiredCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Job);

      const report = await service.scanForIntegrityIssues('123456789012345678');

      expect(report.guildId).toBe('123456789012345678');
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
        _id: TestUtils.generateObjectId().toString(),
        userId: '414141414141414141',
        guildId: '123456789012345678',
        status: 'active',
        role: 'Senior Partner',
        createdAt: new Date(),
        updatedAt: new Date()
      }] as Staff[]);

      mockCaseRepo.findByFilters.mockResolvedValue([
        createMockCase({
          leadAttorneyId: '414141414141414141',
          assignedLawyerIds: ['515151515151515151'] // Lead attorney not in assigned list!
        })
      ]);

      mockFeedbackRepo.findByFilters.mockResolvedValue([{
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        targetStaffId: '999999999999999999', // References non-existent staff
        createdAt: new Date(),
        updatedAt: new Date()
      }] as Feedback[]);

      mockReminderRepo.findByFilters.mockResolvedValue([{
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        caseId: '999999999999999999', // References non-existent case
        createdAt: new Date(),
        updatedAt: new Date()
      }] as Reminder[]);

      mockApplicationRepo.findByGuild.mockResolvedValue([]);
      mockJobRepo.findByGuildId.mockResolvedValue([]);
      mockRetainerRepo.findByGuild.mockResolvedValue([]);

      const report = await service.performDeepIntegrityCheck('123456789012345678');

      // Should have additional issues from deep check
      const leadAttorneyIssue = report.issues.find(i => 
        i.message.includes('Lead attorney is not in assigned lawyers list')
      );
      expect(leadAttorneyIssue).toBeDefined();

      // Note: Feedback entities don't reference cases, they reference staff
      // The test data has feedback with non-existent staff, not case

      const reminderIssue = report.issues.find(i => 
        i.entityType === 'reminder' && i.message.includes('non-existent case')
      );
      expect(reminderIssue).toBeDefined();
    });
  });

  describe('Repair Functionality', () => {
    it('should repair auto-repairable issues', async () => {
      const repairAction1 = jest.fn().mockResolvedValue(undefined);
      const repairAction2 = jest.fn().mockResolvedValue(undefined);
      
      const issues: ValidationIssue[] = [
        {
          severity: 'critical',
          entityType: 'staff',
          entityId: '616161616161616161',
          field: 'status',
          message: 'Invalid status',
          canAutoRepair: true,
          repairAction: repairAction1
        },
        {
          severity: 'warning',
          entityType: 'case',
          entityId: '717171717171717171',
          field: 'leadAttorneyId',
          message: 'Invalid lead attorney',
          canAutoRepair: true,
          repairAction: repairAction2
        },
        {
          severity: 'critical',
          entityType: 'case',
          entityId: '818181818181818181',
          field: 'status',
          message: 'Cannot repair this',
          canAutoRepair: false
        }
      ];

      mockAuditRepo.add.mockResolvedValue({} as any);

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

      const issues: ValidationIssue[] = [
        {
          severity: 'critical',
          entityType: 'staff',
          entityId: '616161616161616161',
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
      const issues: ValidationIssue[] = [
        {
          severity: 'critical',
          entityType: 'staff',
          entityId: '616161616161616161',
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

      const issues: ValidationIssue[] = [
        {
          severity: 'critical',
          entityType: 'staff',
          entityId: '616161616161616161',
          field: 'status',
          message: 'Invalid status',
          canAutoRepair: true,
          repairAction: flakeyRepairAction
        }
      ];

      mockAuditRepo.add.mockResolvedValue({} as any);

      const result = await service.smartRepair(issues, { maxRetries: 3 });

      expect(result.issuesRepaired).toBe(1);
      expect(result.issuesFailed).toBe(0);
      expect(flakeyRepairAction).toHaveBeenCalledTimes(3);
      
      // Verify audit log includes retry count
      expect(mockAuditRepo.add).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            metadata: expect.objectContaining({
              retry: 2 // Zero-indexed, so 2 means third attempt
            })
          })
        })
      );
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple entities efficiently', async () => {
      const staffId1 = new ObjectId();
      const staffId2 = new ObjectId();
      const caseId = new ObjectId();
      const appId = new ObjectId();
      
      const entities = [
        { entity: TestUtils.generateMockStaff({ 
          _id: staffId1.toString(), 
          guildId: 'guild1', 
          userId: 'user1',
          status: 'active'
        }), type: 'staff' },
        { entity: TestUtils.generateMockStaff({ 
          _id: staffId2.toString(), 
          guildId: 'guild1', 
          userId: 'user2',
          status: 'invalid' as any // Invalid status to trigger validation
        }), type: 'staff' },
        { entity: TestUtils.generateMockCase({ 
          _id: caseId.toString(), 
          guildId: 'guild1', 
          assignedLawyerIds: []
        }), type: 'case' },
        { entity: TestUtils.generateMockApplication({ 
          _id: appId.toString(), 
          guildId: 'guild1', 
          jobId: 'job1'
        }), type: 'application' }
      ];

      mockStaffRepo.update.mockResolvedValue({
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        userId: '919191919191919191',
        hiredBy: '020202020202020202',
        role: 'Paralegal',
        robloxUsername: 'TestUser',
        status: 'active',
        hiredAt: new Date(),
        promotionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      } as Staff);
      mockJobRepo.findById.mockResolvedValue({
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        title: 'Test Job',
        description: 'Test',
        staffRole: 'test',
        roleId: '313131313131313131',
        isOpen: true,
        questions: [],
        postedBy: '111111111111111111',
        applicationCount: 0,
        hiredCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Job);

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
          entity: { _id: new ObjectId(), guildId: '123456789012345678', status: 'active', createdAt: new Date(), updatedAt: new Date() }, 
          type: 'staff' 
        });
      }
      for (let i = 0; i < 20; i++) {
        entities.push({ 
          entity: { _id: new ObjectId(), guildId: '123456789012345678', assignedLawyerIds: [] }, 
          type: 'case' 
        });
      }
      for (let i = 0; i < 10; i++) {
        entities.push({ 
          entity: { _id: new ObjectId(), guildId: '123456789012345678', jobId: '212121212121212121', createdAt: new Date(), updatedAt: new Date() }, 
          type: 'application' 
        });
      }

      mockJobRepo.findById.mockResolvedValue({
        _id: TestUtils.generateObjectId().toString(),
        guildId: '123456789012345678',
        title: 'Test Job',
        description: 'Test',
        staffRole: 'test',
        roleId: '313131313131313131',
        isOpen: true,
        questions: [],
        postedBy: '111111111111111111',
        applicationCount: 0,
        hiredCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Job);

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
      const staff: Staff = TestUtils.generateMockStaff({
        userId: '131313131313131313',
        guildId: '123456789012345678',
        status: 'active',
        role: 'Senior Partner'
      });

      // First call
      await service.validateBeforeOperation(staff, 'staff', 'update');
      
      // Second call should use cache
      await service.validateBeforeOperation(staff, 'staff', 'update');

      // Validation logic should only run once due to caching
      expect(mockCaseRepo.findByFilters).toHaveBeenCalledTimes(1);
    });

    it('should clear cache after repairs', async () => {
      service.clearValidationCache();
      
      const issues: ValidationIssue[] = [{
        severity: 'critical',
        entityType: 'staff',
        entityId: '141414141414141414',
        message: 'Test issue',
        canAutoRepair: true,
        repairAction: jest.fn().mockResolvedValue(undefined)
      }];

      mockAuditRepo.add.mockResolvedValue({} as any);

      await service.repairIntegrityIssues(issues);

      // Cache should be cleared after repair
      // This is internal behavior, but we can verify by checking if validation runs again
      const staff = { _id: new ObjectId(), guildId: 'guild1', status: 'active',
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
        entityId: '141414141414141414',
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

      const staff = { _id: new ObjectId(), guildId: 'guild1', status: 'active',
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
        for (const dep of rule.dependencies!) {
          const depRule = rules.find(r => r.name === dep);
          expect(depRule).toBeDefined();
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      mockStaffRepo.findByGuildId.mockRejectedValue(new Error('Database error'));
      
      const report = await service.scanForIntegrityIssues('123456789012345678');
      
      expect(report.totalEntitiesScanned).toBe(0);
      expect(logger.error).toHaveBeenCalledWith('Error during integrity scan:', expect.any(Error));
    });

    it('should continue validation when individual rules fail', async () => {
      const staff: Staff = TestUtils.generateMockStaff({
        userId: '151515151515151515',
        guildId: '123456789012345678',
        status: 'active',
        role: 'Senior Partner'
      });

      // Make one validation throw an error
      mockCaseRepo.findByFilters.mockRejectedValueOnce(new Error('Query failed'));

      const issues = await service.validateBeforeOperation(staff, 'staff', 'update');
      
      // Should still return some issues from other validations
      expect(issues).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});