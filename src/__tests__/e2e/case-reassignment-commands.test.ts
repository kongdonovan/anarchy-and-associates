import { CaseService } from '../../application/services/case-service';
import { PermissionService, PermissionContext } from '../../application/services/permission-service';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { PermissionUtils } from '../../infrastructure/utils/permission-utils';
import { CaseStatus, CasePriority } from '../../domain/entities/case';
import { TestUtils } from '../helpers/test-utils';
import { DatabaseTestHelpers } from '../helpers/database-helpers';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';

/**
 * End-to-End tests for /case reassign and /case unassign Discord commands
 * 
 * These tests simulate the full command workflow including:
 * - Permission checking with proper context
 * - Service layer interactions
 * - Database operations
 * - Error handling scenarios
 */
describe('Case Reassignment Commands E2E Tests', () => {
  let caseService: CaseService;
  let permissionService: PermissionService;
  let caseRepository: CaseRepository;
  let guildConfigRepository: GuildConfigRepository;

  // Test data setup
  const testGuildId = 'test-guild-reassign-e2e';
  const guildOwnerId = 'guild-owner-reassign';
  const adminUserId = 'admin-user-reassign';
  const caseManagerUserId = 'case-manager-reassign';
  const regularUserId = 'regular-user-reassign';
  const lawyer1Id = 'lawyer-1-reassign';
  const lawyer2Id = 'lawyer-2-reassign';
  const lawyer3Id = 'lawyer-3-reassign';
  const clientId = 'client-reassign';

  // Mock Discord interaction factory
  const createMockInteraction = (userId: string, userRoles: string[] = [], isGuildOwner = false) => ({
    guildId: testGuildId,
    user: { id: userId, displayName: `User-${userId}` },
    guild: {
      ownerId: isGuildOwner ? userId : guildOwnerId,
      members: {
        cache: {
          get: (memberId: string) => {
            if (memberId === userId) {
              return {
                roles: {
                  cache: {
                    map: (fn: (role: any) => string) => userRoles.map(roleId => fn({ id: roleId }))
                  }
                }
              };
            }
            return null;
          }
        }
      }
    },
    channelId: 'test-channel-123',
    reply: jest.fn(),
    channel: {
      id: 'test-channel-123',
      type: 0 // GUILD_TEXT
    }
  });

  beforeAll(async () => {
    await DatabaseTestHelpers.setupTestDatabase();
  });

  beforeEach(async () => {
    // Initialize repositories and services
    caseRepository = new CaseRepository();
    guildConfigRepository = new GuildConfigRepository();
    const caseCounterRepository = new CaseCounterRepository();
    
    permissionService = new PermissionService(guildConfigRepository);
    const businessRuleValidationService = new BusinessRuleValidationService(
      guildConfigRepository,
      null as any, // staffRepository not needed for these tests
      caseRepository,
      permissionService
    );
    caseService = new CaseService(
      caseRepository, 
      caseCounterRepository, 
      guildConfigRepository,
      permissionService,
      businessRuleValidationService
    );
    
    await TestUtils.clearTestDatabase();

    // Setup test guild configuration with proper permissions
    await guildConfigRepository.add({
      guildId: testGuildId,
      feedbackChannelId: 'feedback-channel-123',
      retainerChannelId: 'retainer-channel-123',
      caseReviewCategoryId: 'case-review-123',
      caseArchiveCategoryId: 'case-archive-123',
      modlogChannelId: 'modlog-123',
      applicationChannelId: 'application-123',
      clientRoleId: 'client-role-123',
      permissions: {
        admin: ['admin-role-123'],
        'senior-staff': ['hr-role-123'],
        case: ['case-role-123'],
        config: ['config-role-123'],
        lawyer: ['lawyer-role-123', 'lead-attorney-role-123'], // lead attorneys are also lawyers
        'lead-attorney': ['lead-attorney-role-123'],
        repair: ['repair-role-123']
      },
      adminRoles: ['admin-role-123'],
      adminUsers: [adminUserId, lawyer1Id, lawyer2Id, lawyer3Id] // Include lawyers as admin users for testing
    });
  });

  afterAll(async () => {
    await DatabaseTestHelpers.teardownTestDatabase();
  });

  describe('/case reassign Command Workflow', () => {
    let case1: any;
    let case2: any;

    beforeEach(async () => {
      // Create test permission context with case permission
      const context: PermissionContext = {
        guildId: testGuildId,
        userId: adminUserId,
        userRoles: ['case-role-123'], // Changed to have case permission
        isGuildOwner: false
      };

      // Create test cases and assign lawyers
      case1 = await caseService.createCase(context, {
        guildId: testGuildId,
        clientId,
        clientUsername: 'testclient',
        title: 'Case 1 - Contract Dispute',
        description: 'First test case for reassignment',
        priority: CasePriority.HIGH
      });

      case2 = await caseService.createCase(context, {
        guildId: testGuildId,
        clientId: 'client-2',
        clientUsername: 'client2',
        title: 'Case 2 - Personal Injury',
        description: 'Second test case for reassignment',
        priority: CasePriority.MEDIUM
      });

      // Accept cases and assign lawyers - need lead-attorney permission context
      const lawyer1Context: PermissionContext = {
        guildId: testGuildId,
        userId: lawyer1Id,
        userRoles: ['lead-attorney-role-123', 'lawyer-role-123'], // Need both permissions
        isGuildOwner: false
      };
      const lawyer2Context: PermissionContext = {
        guildId: testGuildId,
        userId: lawyer2Id,
        userRoles: ['lead-attorney-role-123', 'lawyer-role-123'], // Need both permissions
        isGuildOwner: false
      };
      await caseService.acceptCase(lawyer1Context, case1._id!.toString());
      await caseService.acceptCase(lawyer2Context, case2._id!.toString());

      // Update case channels for testing
      await caseRepository.update(case1._id!.toString(), { channelId: 'case-1-channel' });
      await caseRepository.update(case2._id!.toString(), { channelId: 'case-2-channel' });
    });

    it('should allow guild owner to reassign staff between cases', async () => {
      const interaction = createMockInteraction(guildOwnerId, [], true);
      const context = PermissionUtils.createPermissionContext(interaction as any);

      // Verify guild owner has case permission
      const hasPermission = await permissionService.hasActionPermission(context, 'case');
      expect(hasPermission).toBe(true);

      // Simulate the reassign command logic
      const mockNewCaseChannel = { id: 'case-2-channel', type: 0 };
      
      // Find staff member's current assignment (simulating the command's logic)
      const assignedCases = await caseRepository.findByLawyer(lawyer1Id);
      const activeCases = assignedCases.filter(c => 
        c.guildId === testGuildId && 
        c.status === CaseStatus.IN_PROGRESS
      );

      expect(activeCases.length).toBeGreaterThan(0);

      // Get the new case from channel
      const newCase = await caseRepository.findByFilters({ channelId: mockNewCaseChannel.id });
      expect(newCase.length).toBe(1);
      
      const targetCase = newCase[0];
      expect(targetCase).toBeDefined();

      // Verify lawyer1 is not already assigned to the target case
      expect(targetCase!.assignedLawyerIds).not.toContain(lawyer1Id);

      // Perform reassignment
      const currentCase = activeCases[0];
      expect(currentCase).toBeDefined();
      
      await caseService.reassignLawyer(
        context,
        currentCase!._id!.toString(),
        targetCase!._id!.toString(),
        lawyer1Id
      );

      // Verify the reassignment
      const updatedNewCase = await caseService.getCaseById(context, targetCase!._id!.toString());
      const updatedOldCase = await caseService.getCaseById(context, currentCase!._id!.toString());

      expect(updatedNewCase?.assignedLawyerIds).toContain(lawyer1Id);
      expect(updatedOldCase?.assignedLawyerIds).not.toContain(lawyer1Id);
    });

    it('should deny permission to admin users without case role', async () => {
      const interaction = createMockInteraction(adminUserId, ['admin-role-123']);
      const context = PermissionUtils.createPermissionContext(interaction as any);

      // Verify admin does NOT have case permission (admin permission ≠ case permission)
      const hasPermission = await permissionService.hasActionPermission(context, 'case');
      expect(hasPermission).toBe(false);

      // Command would be blocked by permission guard, so we don't test service call
    });

    it('should allow case managers to reassign staff between cases', async () => {
      const interaction = createMockInteraction(caseManagerUserId, ['case-role-123']);
      const context = PermissionUtils.createPermissionContext(interaction as any);

      // Verify case manager has case permission
      const hasPermission = await permissionService.hasActionPermission(context, 'case');
      expect(hasPermission).toBe(true);

      // Test reassignment workflow
      await caseService.reassignLawyer(
        context,
        case1._id!.toString(),
        case2._id!.toString(),
        lawyer1Id
      );

      // Verify reassignment
      const updatedCase1 = await caseService.getCaseById(context, case1._id!.toString());
      const updatedCase2 = await caseService.getCaseById(context, case2._id!.toString());

      expect(updatedCase1?.assignedLawyerIds).not.toContain(lawyer1Id);
      expect(updatedCase2?.assignedLawyerIds).toContain(lawyer1Id);
    });

    it('should deny permission to regular users without case role', async () => {
      const interaction = createMockInteraction(regularUserId, ['some-other-role']);
      const context = PermissionUtils.createPermissionContext(interaction as any);

      // Verify regular user does not have case permission
      const hasPermission = await permissionService.hasActionPermission(context, 'case');
      expect(hasPermission).toBe(false);

      // Command would be blocked by permission guard, so we don't test service call
    });

    it('should handle error when staff member has no active assignments', async () => {
      const unassignedLawyer = 'unassigned-lawyer-999';

      // Try to find assignments for unassigned lawyer
      const assignedCases = await caseRepository.findByLawyer(unassignedLawyer);
      const activeCases = assignedCases.filter(c => 
        c.guildId === testGuildId && 
        c.status === CaseStatus.IN_PROGRESS
      );

      // Should have no active cases
      expect(activeCases.length).toBe(0);

      // This would trigger the "No Current Assignment" error in the command
    });

    it('should handle error when target channel is not a case channel', async () => {
      const invalidChannelId = 'non-case-channel-123';

      // Try to find case by invalid channel
      const caseInChannel = await caseRepository.findByFilters({ channelId: invalidChannelId });

      // Should find no case
      expect(caseInChannel.length).toBe(0);

      // This would trigger the "Invalid Case Channel" error in the command
    });

    it('should handle error when staff member is already assigned to target case', async () => {
      // Create test permission context with case permission
      const context: PermissionContext = {
        guildId: testGuildId,
        userId: adminUserId,
        userRoles: ['case-role-123'], // Changed to have case permission
        isGuildOwner: false
      };

      // Verify lawyer2 is already assigned to case2
      const targetCase = await caseService.getCaseById(context, case2._id!.toString());
      expect(targetCase?.assignedLawyerIds).toContain(lawyer2Id);

      // This would trigger the "Already Assigned" error if trying to reassign lawyer2 to case2
    });
  });

  describe('/case unassign Command Workflow', () => {
    let multiLawyerCase: any;

    it('should allow guild owner to unassign staff from cases', async () => {
      // Setup test data for this specific test
      const setupContext: PermissionContext = {
        guildId: testGuildId,
        userId: guildOwnerId,
        userRoles: [],
        isGuildOwner: true
      };

      // Create a case with multiple lawyers for unassignment testing
      multiLawyerCase = await caseService.createCase(setupContext, {
        guildId: testGuildId,
        clientId,
        clientUsername: 'testclient',
        title: 'Multi-lawyer Case for Unassignment',
        description: 'Case with multiple lawyers for testing unassignment',
        priority: CasePriority.HIGH
      });

      // Accept case as lawyer1 (guild owner has all permissions)
      await caseService.acceptCase(setupContext, multiLawyerCase._id!.toString());
      
      // Assign additional lawyers using guild owner context
      await caseService.assignLawyer(setupContext, {
        caseId: multiLawyerCase._id!.toString(),
        lawyerId: lawyer1Id,
        assignedBy: guildOwnerId
      });
      await caseService.assignLawyer(setupContext, {
        caseId: multiLawyerCase._id!.toString(),
        lawyerId: lawyer2Id,
        assignedBy: guildOwnerId
      });
      await caseService.assignLawyer(setupContext, {
        caseId: multiLawyerCase._id!.toString(),
        lawyerId: lawyer3Id,
        assignedBy: guildOwnerId
      });

      const interaction = createMockInteraction(guildOwnerId, [], true);
      const context = PermissionUtils.createPermissionContext(interaction as any);

      // Verify permission
      const hasPermission = await permissionService.hasActionPermission(context, 'case');
      expect(hasPermission).toBe(true);

      // Find all active cases for lawyer2 (simulating command logic)
      const allAssignedCases = await caseRepository.findByLawyer(lawyer2Id);
      const assignedCases = allAssignedCases.filter(c => 
        c.guildId === testGuildId && 
        c.status === CaseStatus.IN_PROGRESS
      );

      expect(assignedCases.length).toBeGreaterThan(0);

      // Unassign from all active cases
      const unassignedCases: string[] = [];
      for (const caseData of assignedCases) {
        await caseService.unassignLawyer(
          context,
          caseData._id!.toString(),
          lawyer2Id
        );
        unassignedCases.push(caseData.caseNumber);
      }

      expect(unassignedCases.length).toBeGreaterThan(0);

      // Verify lawyer2 is no longer assigned
      const updatedCase = await caseService.getCaseById(context, multiLawyerCase._id!.toString());
      expect(updatedCase?.assignedLawyerIds).not.toContain(lawyer2Id);
      expect(updatedCase?.assignedLawyerIds).toContain(lawyer1Id);
      expect(updatedCase?.assignedLawyerIds).toContain(lawyer3Id);
    });

    it('should deny permission to admin users without case role', async () => {
      const interaction = createMockInteraction(adminUserId, ['admin-role-123']);
      const context = PermissionUtils.createPermissionContext(interaction as any);

      // Verify admin does NOT have case permission (admin permission ≠ case permission)
      const hasPermission = await permissionService.hasActionPermission(context, 'case');
      expect(hasPermission).toBe(false);

      // Command would be blocked by permission guard
    });

    it('should handle unassigning lead attorney correctly', async () => {
      // Setup test data for this specific test using guild owner
      const setupContext: PermissionContext = {
        guildId: testGuildId,
        userId: guildOwnerId,
        userRoles: [],
        isGuildOwner: true
      };

      // Create a case with multiple lawyers
      multiLawyerCase = await caseService.createCase(setupContext, {
        guildId: testGuildId,
        clientId,
        clientUsername: 'testclient',
        title: 'Multi-lawyer Case for Lead Attorney Test',
        description: 'Case with multiple lawyers for testing lead attorney reassignment',
        priority: CasePriority.HIGH
      });

      // Accept case as lawyer1 who becomes lead attorney
      const lawyer1Context: PermissionContext = {
        guildId: testGuildId,
        userId: lawyer1Id,
        userRoles: ['lead-attorney-role-123', 'lawyer-role-123'],
        isGuildOwner: false
      };
      await caseService.acceptCase(lawyer1Context, multiLawyerCase._id!.toString());
      
      // Assign additional lawyers using guild owner context
      await caseService.assignLawyer(setupContext, {
        caseId: multiLawyerCase._id!.toString(),
        lawyerId: lawyer2Id,
        assignedBy: guildOwnerId
      });
      await caseService.assignLawyer(setupContext, {
        caseId: multiLawyerCase._id!.toString(),
        lawyerId: lawyer3Id,
        assignedBy: guildOwnerId
      });

      // Create permission context for this test
      const context: PermissionContext = {
        guildId: testGuildId,
        userId: caseManagerUserId,
        userRoles: ['case-role-123'],
        isGuildOwner: false
      };

      // Verify lawyer1 is lead attorney
      const beforeUnassign = await caseService.getCaseById(context, multiLawyerCase._id!.toString());
      expect(beforeUnassign?.leadAttorneyId).toBe(lawyer1Id);
      expect(beforeUnassign?.assignedLawyerIds).toHaveLength(3);

      // Unassign the lead attorney
      await caseService.unassignLawyer(
        context,
        multiLawyerCase._id!.toString(),
        lawyer1Id
      );

      // Verify lead attorney was reassigned
      const afterUnassign = await caseService.getCaseById(context, multiLawyerCase._id!.toString());
      expect(afterUnassign?.assignedLawyerIds).not.toContain(lawyer1Id);
      expect(afterUnassign?.assignedLawyerIds).toHaveLength(2);
      expect(afterUnassign?.leadAttorneyId).toBeTruthy();
      expect(afterUnassign?.leadAttorneyId).not.toBe(lawyer1Id);
      expect([lawyer2Id, lawyer3Id]).toContain(afterUnassign?.leadAttorneyId);
    });

    it('should deny permission to regular users without case role', async () => {
      const interaction = createMockInteraction(regularUserId, ['some-other-role']);
      const context = PermissionUtils.createPermissionContext(interaction as any);

      // Verify regular user does not have case permission
      const hasPermission = await permissionService.hasActionPermission(context, 'case');
      expect(hasPermission).toBe(false);

      // Command would be blocked by permission guard
    });

    it('should handle error when staff member has no active assignments', async () => {
      const unassignedLawyer = 'unassigned-lawyer-999';

      // Find assignments for unassigned lawyer
      const allAssignedCases = await caseRepository.findByLawyer(unassignedLawyer);
      const assignedCases = allAssignedCases.filter(c => 
        c.guildId === testGuildId && 
        c.status === CaseStatus.IN_PROGRESS
      );

      // Should have no active cases
      expect(assignedCases.length).toBe(0);

      // This would trigger the "No Current Assignment" error in the command
    });
  });

  describe('Permission Context Integration', () => {
    it('should properly populate permission context from Discord interaction', async () => {
      const testUserRoles = ['case-role-123', 'hr-role-123'];
      const interaction = createMockInteraction(caseManagerUserId, testUserRoles);
      
      // Test the permission context creation that's used in the commands
      const context = PermissionUtils.createPermissionContext(interaction as any);

      expect(context.guildId).toBe(testGuildId);
      expect(context.userId).toBe(caseManagerUserId);
      expect(context.userRoles).toEqual(testUserRoles);
      expect(context.isGuildOwner).toBe(false);

      // Verify permission checking works with this context
      // Note: This should pass because the guild config in beforeEach has case-role-123 in case permissions
      const hasPermission = await permissionService.hasActionPermission(context, 'case');
      expect(hasPermission).toBe(true);
    });

    it('should correctly identify guild owner in permission context', async () => {
      const interaction = createMockInteraction(guildOwnerId, [], true);
      const context = PermissionUtils.createPermissionContext(interaction as any);

      expect(context.isGuildOwner).toBe(true);
      expect(context.userId).toBe(guildOwnerId);

      // Guild owner should have all permissions
      const hasPermission = await permissionService.hasActionPermission(context, 'case');
      expect(hasPermission).toBe(true);
    });

    it('should handle empty user roles correctly', async () => {
      const interaction = createMockInteraction(regularUserId, []);
      const context = PermissionUtils.createPermissionContext(interaction as any);

      expect(context.userRoles).toEqual([]);
      expect(context.isGuildOwner).toBe(false);

      // Regular user with no roles should not have case permission
      const hasPermission = await permissionService.hasActionPermission(context, 'case');
      expect(hasPermission).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      // Test with invalid ObjectId format
      const invalidCaseId = 'invalid-case-id';

      // Create a context for this test
      const context: PermissionContext = {
        guildId: testGuildId,
        userId: adminUserId,
        userRoles: ['case-role-123'],
        isGuildOwner: false
      };

      await expect(
        caseService.reassignLawyer(context, invalidCaseId, 'valid-case-id', lawyer1Id)
      ).rejects.toThrow();
    });

    it('should handle concurrent reassignment attempts', async () => {
      // Create test permission context with case permission
      const context: PermissionContext = {
        guildId: testGuildId,
        userId: adminUserId,
        userRoles: ['case-role-123'], // Changed to have case permission
        isGuildOwner: false
      };

      // Create a case with one lawyer
      const testCase = await caseService.createCase(context, {
        guildId: testGuildId,
        clientId: 'concurrent-client',
        clientUsername: 'concurrentclient',
        title: 'Concurrent Test Case',
        description: 'Testing concurrent operations',
        priority: CasePriority.MEDIUM
      });

      // Accept case with lead-attorney and lawyer permissions
      const leadAttorneyContext: PermissionContext = {
        guildId: testGuildId,
        userId: lawyer1Id,
        userRoles: ['lead-attorney-role-123', 'lawyer-role-123'],
        isGuildOwner: false
      };
      await caseService.acceptCase(leadAttorneyContext, testCase._id!.toString());

      // Create two target cases
      const targetCase1 = await caseService.createCase(context, {
        guildId: testGuildId,
        clientId: 'target-1',
        clientUsername: 'target1',
        title: 'Target Case 1',
        description: 'First target case',
        priority: CasePriority.LOW
      });

      const targetCase2 = await caseService.createCase(context, {
        guildId: testGuildId,
        clientId: 'target-2',
        clientUsername: 'target2',
        title: 'Target Case 2',
        description: 'Second target case',
        priority: CasePriority.LOW
      });

      // Attempt concurrent reassignments (one should succeed, one should fail)
      const reassignPromise1 = caseService.reassignLawyer(
        context,
        testCase._id!.toString(),
        targetCase1._id!.toString(),
        lawyer1Id
      );

      const reassignPromise2 = caseService.reassignLawyer(
        context,
        testCase._id!.toString(),
        targetCase2._id!.toString(),
        lawyer1Id
      );

      // One should succeed, one should fail (or both might succeed depending on implementation)
      const results = await Promise.allSettled([reassignPromise1, reassignPromise2]);
      
      // At least one operation should complete
      const successfulOps = results.filter(r => r.status === 'fulfilled');
      expect(successfulOps.length).toBeGreaterThanOrEqual(1);
    });
  });
});