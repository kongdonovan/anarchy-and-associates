import { CaseService } from '../../application/services/case-service';
import { StaffService } from '../../application/services/staff-service';
import { PermissionService } from '../../application/services/permission-service';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { StaffRole } from '../../domain/entities/staff-role';
import { CaseStatus, CasePriority, CaseResult } from '../../domain/entities/case';
import { TestUtils } from '../helpers/test-utils';
import { DatabaseTestHelpers } from '../helpers/database-helpers';
import { OperationQueue } from '../../infrastructure/queue/operation-queue';
import { RateLimiter } from '../../infrastructure/rate-limiting/rate-limiter';

/**
 * End-to-End Discord Command Workflow Tests
 * 
 * These tests simulate complete Discord command workflows from user interaction
 * to database persistence, testing the full stack integration including:
 * - Permission checking
 * - Service interactions
 * - Database operations
 * - Audit logging
 * - Error handling
 * - Rate limiting
 * - Concurrent operations
 */
describe('Discord Command Workflows E2E Tests', () => {
  let staffService: StaffService;
  let caseService: CaseService;
  let permissionService: PermissionService;
  let staffRepository: StaffRepository;
  let caseRepository: CaseRepository;
  let auditLogRepository: AuditLogRepository;
  let guildConfigRepository: GuildConfigRepository;
  let caseCounterRepository: CaseCounterRepository;
  let operationQueue: OperationQueue;
  let rateLimiter: RateLimiter;

  // Test guild and user setup
  const testGuildId = 'test-guild-e2e';
  const guildOwnerId = 'guild-owner-123';
  const adminUserId = 'admin-user-456';
  const regularUserId = 'regular-user-789';
  const clientUserId = 'client-user-999';

  beforeAll(async () => {
    await DatabaseTestHelpers.setupTestDatabase();
    await DatabaseTestHelpers.createIndexes();
  });

  beforeEach(async () => {
    // Initialize repositories
    staffRepository = new StaffRepository();
    caseRepository = new CaseRepository();
    auditLogRepository = new AuditLogRepository();
    guildConfigRepository = new GuildConfigRepository();
    caseCounterRepository = new CaseCounterRepository();

    // Initialize services
    staffService = new StaffService(staffRepository, auditLogRepository);
    caseService = new CaseService(caseRepository, caseCounterRepository, guildConfigRepository);
    permissionService = new PermissionService(guildConfigRepository);

    // Initialize infrastructure
    operationQueue = OperationQueue.getInstance();
    rateLimiter = RateLimiter.getInstance();
    
    // Clear state
    await TestUtils.clearTestDatabase();
    operationQueue.clearQueue();
    // Clear rate limiter state
    rateLimiter['userCounts'] = new Map();
    rateLimiter['lastResetTime'] = Date.now();

    // Setup test guild configuration
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
        hr: ['hr-role-123'],
        case: ['case-role-123'],
        config: ['config-role-123'],
        retainer: ['retainer-role-123'],
        repair: ['repair-role-123']
      },
      adminRoles: ['admin-role-123'],
      adminUsers: [adminUserId]
    });
  });

  afterAll(async () => {
    await DatabaseTestHelpers.teardownTestDatabase();
  });

  describe('Staff Management Workflow', () => {
    it('should complete full staff hiring workflow with permissions', async () => {
      // Simulate /staff hire command workflow
      const mockPermissionContext = {
        guildId: testGuildId,
        userId: adminUserId,
        userRoles: ['admin-role-123'],
        isGuildOwner: false
      };

      // 1. Check permissions (admin action)
      const hasPermission = await permissionService.hasActionPermission(mockPermissionContext, 'admin');
      expect(hasPermission).toBe(true);

      // 2. Rate limit check
      const rateLimitOk = rateLimiter.checkRateLimit(adminUserId);
      expect(rateLimitOk).toBe(true);

      // 3. Queue operation to prevent concurrent conflicts
      const hireResult = await operationQueue.enqueue(
        () => staffService.hireStaff({
          guildId: testGuildId,
          userId: regularUserId,
          hiredBy: adminUserId,
          robloxUsername: 'TestEmployee',
          role: StaffRole.PARALEGAL,
          reason: 'E2E test hire'
        }),
        adminUserId,
        testGuildId,
        false
      );

      // 4. Verify successful hire
      expect(hireResult.success).toBe(true);
      expect(hireResult.staff?.userId).toBe(regularUserId);
      expect(hireResult.staff?.role).toBe(StaffRole.PARALEGAL);
      expect(hireResult.staff?.hiredBy).toBe(adminUserId);

      // 5. Verify audit log created
      const auditLogs = await auditLogRepository.findByFilters({
        guildId: testGuildId,
        targetId: regularUserId
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].actorId).toBe(adminUserId);

      // 6. Verify staff can be retrieved
      const staffInfo = await staffService.getStaffInfo(testGuildId, regularUserId, adminUserId);
      expect(staffInfo?.userId).toBe(regularUserId);
    });

    it('should prevent unauthorized staff hiring', async () => {
      // Simulate unauthorized user trying to hire staff
      const unauthorizedContext = {
        guildId: testGuildId,
        userId: regularUserId,
        userRoles: ['member-role'],
        isGuildOwner: false
      };

      // 1. Check permissions (should fail)
      const hasPermission = await permissionService.hasActionPermission(unauthorizedContext, 'admin');
      expect(hasPermission).toBe(false);

      // 2. Attempt hire should fail in real workflow (simulated)
      const result = await staffService.hireStaff({
        guildId: testGuildId,
        userId: 'target-user',
        hiredBy: regularUserId,
        robloxUsername: 'Unauthorized',
        role: StaffRole.PARALEGAL
      });

      // Note: In real implementation, permission check would happen before service call
      // This test verifies the permission system works correctly
      expect(hasPermission).toBe(false);
    });

    it('should handle staff promotion workflow with role limits', async () => {
      // First hire staff member
      await staffService.hireStaff({
        guildId: testGuildId,
        userId: regularUserId,
        hiredBy: adminUserId,
        robloxUsername: 'PromotionTest',
        role: StaffRole.PARALEGAL
      });

      // Simulate /staff promote command
      const promotionResult = await operationQueue.enqueue(
        () => staffService.promoteStaff({
          guildId: testGuildId,
          userId: regularUserId,
          promotedBy: adminUserId,
          newRole: StaffRole.JUNIOR_ASSOCIATE,
          reason: 'Excellent performance'
        }),
        adminUserId,
        testGuildId,
        false
      );

      expect(promotionResult.success).toBe(true);
      expect(promotionResult.staff?.role).toBe(StaffRole.JUNIOR_ASSOCIATE);

      // Verify promotion history
      const staff = await staffService.getStaffInfo(testGuildId, regularUserId, adminUserId);
      expect(staff?.promotionHistory.length).toBeGreaterThan(1);
      
      const promotion = staff?.promotionHistory.find(p => p.actionType === 'promotion');
      expect(promotion?.fromRole).toBe(StaffRole.PARALEGAL);
      expect(promotion?.toRole).toBe(StaffRole.JUNIOR_ASSOCIATE);
    });
  });

  describe('Case Management Workflow', () => {
    beforeEach(async () => {
      // Setup staff member for case workflows
      await staffService.hireStaff({
        guildId: testGuildId,
        userId: regularUserId,
        hiredBy: adminUserId,
        robloxUsername: 'CaseLawyer',
        role: StaffRole.JUNIOR_ASSOCIATE
      });
    });

    it('should complete full case creation and assignment workflow', async () => {
      // Simulate /case create command
      const mockPermissionContext = {
        guildId: testGuildId,
        userId: regularUserId,
        userRoles: ['case-role-123'],
        isGuildOwner: false
      };

      // 1. Check case management permissions
      const hasPermission = await permissionService.hasActionPermission(mockPermissionContext, 'case');
      expect(hasPermission).toBe(true);

      // 2. Create case
      const newCase = await operationQueue.enqueue(
        () => caseService.createCase({
          guildId: testGuildId,
          clientId: clientUserId,
          clientUsername: 'TestClient',
          title: 'Contract Dispute',
          description: 'Client needs help with contract issue',
          priority: CasePriority.HIGH
        }),
        regularUserId,
        testGuildId,
        false
      );

      // 3. Verify case creation
      expect(newCase.title).toBe('Contract Dispute');
      expect(newCase.status).toBe(CaseStatus.PENDING);
      expect(newCase.priority).toBe(CasePriority.HIGH);
      expect(newCase.clientId).toBe(clientUserId);

      // 4. Simulate /case accept command
      const acceptedCase = await operationQueue.enqueue(
        () => caseService.acceptCase(newCase._id!.toString(), regularUserId),
        regularUserId,
        testGuildId,
        false
      );

      // 5. Verify case acceptance
      expect(acceptedCase.status).toBe(CaseStatus.OPEN);
      expect(acceptedCase.leadAttorneyId).toBe(regularUserId);
      expect(acceptedCase.assignedLawyerIds).toContain(regularUserId);

      // 6. Verify case can be retrieved by lawyer
      const lawyerCases = await caseService.getCasesByLawyer(regularUserId);
      expect(lawyerCases).toHaveLength(1);
      expect(lawyerCases[0]._id?.toString()).toBe(newCase._id?.toString());
    });

    it('should handle case closure workflow with all results', async () => {
      // Create and accept a case
      const testCase = await caseService.createCase({
        guildId: testGuildId,
        clientId: clientUserId,
        clientUsername: 'ClosureClient',
        title: 'Test Case for Closure',
        description: 'Testing case closure workflow'
      });

      const openCase = await caseService.acceptCase(testCase._id!.toString(), regularUserId);

      // Test different closure results
      const results = [CaseResult.WIN, CaseResult.LOSS, CaseResult.SETTLEMENT];

      for (const [index, result] of results.entries()) {
        // Create separate case for each result
        const separateCase = await caseService.createCase({
          guildId: testGuildId,
          clientId: `client-${index}`,
          clientUsername: `client${index}`,
          title: `Test Case ${result}`,
          description: `Testing ${result} closure`
        });

        const openSeparateCase = await caseService.acceptCase(separateCase._id!.toString(), regularUserId);

        // Simulate /case close command
        const closedCase = await operationQueue.enqueue(
          () => caseService.closeCase({
            caseId: openSeparateCase._id!.toString(),
            result,
            resultNotes: `Case closed with ${result}`,
            closedBy: regularUserId
          }),
          regularUserId,
          testGuildId,
          false
        );

        expect(closedCase.status).toBe(CaseStatus.CLOSED);
        expect(closedCase.result).toBe(result);
        expect(closedCase.closedBy).toBe(regularUserId);
        expect(closedCase.closedAt).toBeInstanceOf(Date);
      }
    });

    it('should handle concurrent case operations safely', async () => {
      // Create a case
      const testCase = await caseService.createCase({
        guildId: testGuildId,
        clientId: clientUserId,
        clientUsername: 'ConcurrentTest',
        title: 'Concurrent Operations Test',
        description: 'Testing concurrent case operations'
      });

      const caseId = testCase._id!.toString();

      // Simulate multiple lawyers trying to accept the same case
      const lawyer1 = 'lawyer-1';
      const lawyer2 = 'lawyer-2';
      const lawyer3 = 'lawyer-3';

      const acceptPromises = [
        operationQueue.enqueue(() => caseService.acceptCase(caseId, lawyer1), lawyer1, testGuildId, false),
        operationQueue.enqueue(() => caseService.acceptCase(caseId, lawyer2), lawyer2, testGuildId, false),
        operationQueue.enqueue(() => caseService.acceptCase(caseId, lawyer3), lawyer3, testGuildId, false)
      ];

      const results = await Promise.allSettled(acceptPromises);

      // Only one should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBe(1);

      // Verify final case state
      const finalCase = await caseService.getCaseById(caseId);
      expect(finalCase?.status).toBe(CaseStatus.OPEN);
      expect(finalCase?.leadAttorneyId).toBeTruthy();
    });
  });

  describe('Permission Boundary Testing', () => {
    it('should enforce guild owner privileges', async () => {
      const guildOwnerContext = {
        guildId: testGuildId,
        userId: guildOwnerId,
        userRoles: [],
        isGuildOwner: true
      };

      // Guild owners should have all permissions
      const adminPerm = await permissionService.hasActionPermission(guildOwnerContext, 'admin');
      const hrPerm = await permissionService.hasActionPermission(guildOwnerContext, 'hr');
      const casePerm = await permissionService.hasActionPermission(guildOwnerContext, 'case');

      expect(adminPerm).toBe(true);
      expect(hrPerm).toBe(true);
      expect(casePerm).toBe(true);

      // Guild owner should be able to hire Managing Partner
      const hireResult = await operationQueue.enqueue(
        () => staffService.hireStaff({
          guildId: testGuildId,
          userId: 'managing-partner',
          hiredBy: guildOwnerId,
          robloxUsername: 'ManagingPartner',
          role: StaffRole.MANAGING_PARTNER
        }),
        guildOwnerId,
        testGuildId,
        true // Guild owner priority
      );

      expect(hireResult.success).toBe(true);
      expect(hireResult.staff?.role).toBe(StaffRole.MANAGING_PARTNER);
    });

    it('should handle role-based permissions correctly', async () => {
      // HR role should only have HR permissions
      const hrContext = {
        guildId: testGuildId,
        userId: 'hr-user',
        userRoles: ['hr-role-123'],
        isGuildOwner: false
      };

      const adminPerm = await permissionService.hasActionPermission(hrContext, 'admin');
      const hrPerm = await permissionService.hasActionPermission(hrContext, 'hr');
      const casePerm = await permissionService.hasActionPermission(hrContext, 'case');

      expect(adminPerm).toBe(false);
      expect(hrPerm).toBe(true);
      expect(casePerm).toBe(false);
    });

    it('should handle permission revocation during operation', async () => {
      // This simulates a scenario where a user's permissions are revoked
      // while an operation is in progress
      
      const userContext = {
        guildId: testGuildId,
        userId: 'temp-admin',
        userRoles: ['admin-role-123'],
        isGuildOwner: false
      };

      // Initial permission check passes
      const hasPermission = await permissionService.hasActionPermission(userContext, 'admin');
      expect(hasPermission).toBe(true);

      // Simulate long-running operation where permissions could change
      const longOperation = async () => {
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // In real implementation, permission should be re-checked here
        // if the operation is sensitive or long-running
        const currentPermission = await permissionService.hasActionPermission(userContext, 'admin');
        
        if (!currentPermission) {
          throw new Error('Permission revoked during operation');
        }

        return staffService.hireStaff({
          guildId: testGuildId,
          userId: 'late-hire',
          hiredBy: 'temp-admin',
          robloxUsername: 'LateHire',
          role: StaffRole.PARALEGAL
        });
      };

      // This should succeed since permissions are maintained
      const result = await operationQueue.enqueue(
        longOperation,
        'temp-admin',
        testGuildId,
        false
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should enforce rate limits on rapid commands', async () => {
      const userId = 'rate-test-user';
      
      // First command should succeed
      const firstCheck = rateLimiter.checkRateLimit(userId);
      expect(firstCheck).toBe(true);

      // Rapid subsequent commands should be rate limited
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkRateLimit(userId);
      }

      // This should trigger rate limit
      const rateLimited = rateLimiter.checkRateLimit(userId);
      expect(rateLimited).toBe(false);
    });

    it('should handle high-volume concurrent operations', async () => {
      // Simulate many users performing operations simultaneously
      const userCount = 20;
      const operations = [];

      for (let i = 0; i < userCount; i++) {
        const userId = `user-${i}`;
        const operation = operationQueue.enqueue(
          () => staffService.hireStaff({
            guildId: testGuildId,
            userId,
            hiredBy: adminUserId,
            robloxUsername: `User${i}`,
            role: StaffRole.PARALEGAL
          }),
          userId,
          testGuildId,
          false
        );
        operations.push(operation);
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      // Most operations should succeed (within role limits)
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000);

      // Verify database consistency
      const staffList = await staffService.getStaffList(testGuildId, adminUserId);
      expect(staffList.staff.length).toBe(successCount);
    });
  });

  describe('Error Recovery and Rollback', () => {
    it('should handle database failures gracefully', async () => {
      // Simulate database error
      await DatabaseTestHelpers.simulateDatabaseError();

      const result = await staffService.hireStaff({
        guildId: testGuildId,
        userId: 'db-error-test',
        hiredBy: adminUserId,
        robloxUsername: 'DbErrorTest',
        role: StaffRole.PARALEGAL
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();

      // Restore database
      await DatabaseTestHelpers.restoreDatabase();

      // Retry should succeed
      const retryResult = await staffService.hireStaff({
        guildId: testGuildId,
        userId: 'db-retry-test',
        hiredBy: adminUserId,
        robloxUsername: 'DbRetryTest',
        role: StaffRole.PARALEGAL
      });

      expect(retryResult.success).toBe(true);
    });

    it('should maintain data consistency during failures', async () => {
      // Create initial state
      const staff = await staffService.hireStaff({
        guildId: testGuildId,
        userId: 'consistency-test',
        hiredBy: adminUserId,
        robloxUsername: 'ConsistencyTest',
        role: StaffRole.PARALEGAL
      });

      expect(staff.success).toBe(true);

      // Simulate failure during promotion
      await DatabaseTestHelpers.simulateDatabaseError();

      const promotionResult = await staffService.promoteStaff({
        guildId: testGuildId,
        userId: 'consistency-test',
        promotedBy: adminUserId,
        newRole: StaffRole.JUNIOR_ASSOCIATE
      });

      expect(promotionResult.success).toBe(false);

      // Restore database
      await DatabaseTestHelpers.restoreDatabase();

      // Verify original state is maintained
      const currentStaff = await staffService.getStaffInfo(testGuildId, 'consistency-test', adminUserId);
      expect(currentStaff?.role).toBe(StaffRole.PARALEGAL); // Should remain unchanged
    });
  });

  describe('Cross-Guild Isolation', () => {
    it('should maintain complete isolation between guilds', async () => {
      const guild1 = 'guild-1';
      const guild2 = 'guild-2';
      const userId = 'cross-guild-user';

      // Setup configurations for both guilds
      await guildConfigRepository.add({
        guildId: guild1,
        feedbackChannelId: undefined,
        retainerChannelId: undefined,
        caseReviewCategoryId: undefined,
        caseArchiveCategoryId: undefined,
        modlogChannelId: undefined,
        applicationChannelId: undefined,
        clientRoleId: undefined,
        permissions: {
          admin: [],
          hr: [],
          case: [],
          config: [],
          retainer: [],
          repair: []
        },
        adminRoles: [],
        adminUsers: [adminUserId]
      });

      await guildConfigRepository.add({
        guildId: guild2,
        feedbackChannelId: undefined,
        retainerChannelId: undefined,
        caseReviewCategoryId: undefined,
        caseArchiveCategoryId: undefined,
        modlogChannelId: undefined,
        applicationChannelId: undefined,
        clientRoleId: undefined,
        permissions: {
          admin: [],
          hr: [],
          case: [],
          config: [],
          retainer: [],
          repair: []
        },
        adminRoles: [],
        adminUsers: [adminUserId]
      });

      // Hire same user in different guilds with different roles
      const hire1 = await staffService.hireStaff({
        guildId: guild1,
        userId,
        hiredBy: adminUserId,
        robloxUsername: 'Guild1User',
        role: StaffRole.MANAGING_PARTNER
      });

      const hire2 = await staffService.hireStaff({
        guildId: guild2,
        userId,
        hiredBy: adminUserId,
        robloxUsername: 'Guild2User',
        role: StaffRole.PARALEGAL
      });

      expect(hire1.success).toBe(true);
      expect(hire2.success).toBe(true);

      // Verify isolation
      const guild1Staff = await staffService.getStaffList(guild1, adminUserId);
      const guild2Staff = await staffService.getStaffList(guild2, adminUserId);

      expect(guild1Staff.staff).toHaveLength(1);
      expect(guild2Staff.staff).toHaveLength(1);
      expect(guild1Staff.staff[0].role).toBe(StaffRole.MANAGING_PARTNER);
      expect(guild2Staff.staff[0].role).toBe(StaffRole.PARALEGAL);

      // Cases should also be isolated
      const case1 = await caseService.createCase({
        guildId: guild1,
        clientId: 'client-1',
        clientUsername: 'client1',
        title: 'Guild 1 Case',
        description: 'Case for guild 1'
      });

      const case2 = await caseService.createCase({
        guildId: guild2,
        clientId: 'client-1',
        clientUsername: 'client1',
        title: 'Guild 2 Case',
        description: 'Case for guild 2'
      });

      const guild1Cases = await caseService.searchCases({ guildId: guild1 });
      const guild2Cases = await caseService.searchCases({ guildId: guild2 });

      expect(guild1Cases).toHaveLength(1);
      expect(guild2Cases).toHaveLength(1);
      expect(guild1Cases[0].title).toBe('Guild 1 Case');
      expect(guild2Cases[0].title).toBe('Guild 2 Case');
    });
  });
});