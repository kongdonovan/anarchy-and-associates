import { StaffService } from '../../application/services/staff-service';
import { CaseService } from '../../application/services/case-service';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { OperationQueue } from '../../infrastructure/queue/operation-queue';
import { StaffRole } from '../../domain/entities/staff-role';
import { CaseStatus, CasePriority, CaseResult } from '../../domain/entities/case';
import { AuditAction } from '../../domain/entities/audit-log';
import { TestUtils } from '../helpers/test-utils';
import { DatabaseTestHelpers } from '../helpers/database-helpers';

/**
 * Concurrency and Race Condition Tests
 * 
 * These tests specifically target race conditions that could occur in a
 * Discord bot environment where multiple users may be executing commands
 * simultaneously. Tests cover:
 * - Concurrent staff hiring/firing
 * - Simultaneous case acceptance
 * - Role limit enforcement under load
 * - Database consistency during concurrent operations
 * - Queue system reliability
 * - Resource contention scenarios
 */
describe('Concurrency and Race Condition Tests', () => {
  let staffService: StaffService;
  let caseService: CaseService;
  let staffRepository: StaffRepository;
  let caseRepository: CaseRepository;
  let auditLogRepository: AuditLogRepository;
  let guildConfigRepository: GuildConfigRepository;
  let caseCounterRepository: CaseCounterRepository;
  let operationQueue: OperationQueue;

  const testGuildId = 'concurrency-test-guild';
  const adminUserId = 'admin-123';

  beforeAll(async () => {
    await DatabaseTestHelpers.setupTestDatabase();
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

    // Initialize queue
    operationQueue = OperationQueue.getInstance();
    
    // Clear state
    await TestUtils.clearTestDatabase();
    operationQueue.clearQueue();

    // Setup test guild
    await guildConfigRepository.add({
      guildId: testGuildId,
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
      adminUsers: []
    });
  });

  afterAll(async () => {
    await DatabaseTestHelpers.teardownTestDatabase();
  });

  describe('Concurrent Staff Operations', () => {
    it('should handle concurrent staff hiring with role limits', async () => {
      const concurrentHires = 15; // More than the paralegal limit of 10
      const operations = [];

      // Create concurrent hire operations
      for (let i = 0; i < concurrentHires; i++) {
        const operation = operationQueue.enqueue(
          () => staffService.hireStaff({
            guildId: testGuildId,
            userId: `concurrent-user-${i}`,
            hiredBy: adminUserId,
            robloxUsername: `ConcurrentUser${i}`,
            role: StaffRole.PARALEGAL
          }),
          `user-${i}`,
          testGuildId,
          false
        );
        operations.push(operation);
      }

      const results = await Promise.allSettled(operations);
      
      // Count successful hires
      const successfulHires = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success === true
      ).length;

      // Should not exceed role limit (10 paralegals max)
      expect(successfulHires).toBeLessThanOrEqual(10);

      // Verify database consistency
      const paralegals = await staffRepository.findByRole(testGuildId, StaffRole.PARALEGAL);
      expect(paralegals.length).toBe(successfulHires);
      expect(paralegals.length).toBeLessThanOrEqual(10);

      // Verify no duplicate userIds
      const userIds = paralegals.map(s => s.userId);
      const uniqueUserIds = new Set(userIds);
      expect(uniqueUserIds.size).toBe(paralegals.length);
    });

    it('should handle concurrent role promotions safely', async () => {
      // First hire some staff
      const staffMembers = [];
      for (let i = 0; i < 5; i++) {
        const hire = await staffService.hireStaff({
          guildId: testGuildId,
          userId: `promotion-test-${i}`,
          hiredBy: adminUserId,
          robloxUsername: `PromotionTest${i}`,
          role: StaffRole.PARALEGAL
        });
        staffMembers.push(hire.staff!);
      }

      // Try to promote multiple paralegals to Junior Associate simultaneously
      const promotionOperations = staffMembers.map((staff, index) =>
        operationQueue.enqueue(
          () => staffService.promoteStaff({
            guildId: testGuildId,
            userId: staff.userId,
            promotedBy: adminUserId,
            newRole: StaffRole.JUNIOR_ASSOCIATE,
            reason: `Concurrent promotion ${index}`
          }),
          `promoter-${index}`,
          testGuildId,
          false
        )
      );

      const results = await Promise.allSettled(promotionOperations);
      
      // All should succeed since there's no limit conflict
      const successfulPromotions = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success === true
      ).length;

      expect(successfulPromotions).toBe(5);

      // Verify database consistency
      const juniorAssociates = await staffRepository.findByRole(testGuildId, StaffRole.JUNIOR_ASSOCIATE);
      expect(juniorAssociates.length).toBe(5);

      const remainingParalegals = await staffRepository.findByRole(testGuildId, StaffRole.PARALEGAL);
      expect(remainingParalegals.length).toBe(0);
    });

    it('should prevent double hiring of same user', async () => {
      const userId = 'double-hire-test';
      
      // Try to hire the same user multiple times concurrently
      const duplicateHires = Array.from({ length: 5 }, (_, i) =>
        operationQueue.enqueue(
          () => staffService.hireStaff({
            guildId: testGuildId,
            userId,
            hiredBy: adminUserId,
            robloxUsername: `DuplicateUser${i}`,
            role: StaffRole.PARALEGAL
          }),
          `hirer-${i}`,
          testGuildId,
          false
        )
      );

      const results = await Promise.allSettled(duplicateHires);
      
      // Only one should succeed
      const successfulHires = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success === true
      ).length;

      expect(successfulHires).toBe(1);

      // Verify only one staff record exists
      const staffRecords = await staffRepository.findByUserId(testGuildId, userId);
      expect(staffRecords).toBeDefined();
      
      const allStaff = await staffRepository.findByFilters({ guildId: testGuildId, userId });
      expect(allStaff.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Concurrent Case Operations', () => {
    it('should handle concurrent case creation with sequential numbering', async () => {
      const concurrentCases = 20;
      const operations = [];

      // Create concurrent case creation operations
      for (let i = 0; i < concurrentCases; i++) {
        const operation = operationQueue.enqueue(
          () => caseService.createCase({
            guildId: testGuildId,
            clientId: `client-${i}`,
            clientUsername: `client${i}`,
            title: `Concurrent Case ${i}`,
            description: `Test case created concurrently ${i}`,
            priority: CasePriority.MEDIUM
          }),
          `creator-${i}`,
          testGuildId,
          false
        );
        operations.push(operation);
      }

      const results = await Promise.all(operations);
      
      // All should succeed
      expect(results.length).toBe(concurrentCases);
      
      // Verify sequential numbering
      const caseNumbers = results.map(c => c.caseNumber).sort();
      const currentYear = new Date().getFullYear();
      
      for (let i = 0; i < concurrentCases; i++) {
        const expectedNumber = String(i + 1).padStart(4, '0');
        const expectedPattern = `${currentYear}-${expectedNumber}-`;
        expect(caseNumbers[i]).toContain(expectedPattern);
      }

      // Verify all cases are unique
      const uniqueCaseNumbers = new Set(caseNumbers);
      expect(uniqueCaseNumbers.size).toBe(concurrentCases);
    });

    it('should handle concurrent case acceptance properly', async () => {
      // Create a case first
      const testCase = await caseService.createCase({
        guildId: testGuildId,
        clientId: 'concurrent-client',
        clientUsername: 'concurrentclient',
        title: 'Concurrent Acceptance Test',
        description: 'Testing concurrent case acceptance'
      });

      const caseId = testCase._id!.toString();

      // Multiple lawyers try to accept the same case
      const lawyerIds = ['lawyer-1', 'lawyer-2', 'lawyer-3', 'lawyer-4', 'lawyer-5'];
      const acceptanceOperations = lawyerIds.map(lawyerId =>
        operationQueue.enqueue(
          () => caseService.acceptCase(caseId, lawyerId),
          lawyerId,
          testGuildId,
          false
        )
      );

      const results = await Promise.allSettled(acceptanceOperations);
      
      // Only one should succeed
      const successfulAcceptances = results.filter(r => r.status === 'fulfilled').length;
      expect(successfulAcceptances).toBe(1);

      // Verify final case state
      const finalCase = await caseService.getCaseById(caseId);
      expect(finalCase?.status).toBe(CaseStatus.IN_PROGRESS);
      expect(finalCase?.leadAttorneyId).toBeTruthy();
      expect(lawyerIds.includes(finalCase!.leadAttorneyId!)).toBe(true);
    });

    it('should handle concurrent case closures', async () => {
      // Create and accept a case
      const testCase = await caseService.createCase({
        guildId: testGuildId,
        clientId: 'closure-client',
        clientUsername: 'closureclient',
        title: 'Concurrent Closure Test',
        description: 'Testing concurrent case closure'
      });

      const openCase = await caseService.acceptCase(testCase._id!.toString(), 'lead-lawyer');
      const caseId = openCase._id!.toString();

      // Multiple users try to close the same case
      const closureOperations = Array.from({ length: 3 }, (_, i) =>
        operationQueue.enqueue(
          () => caseService.closeCase({
            caseId,
            result: i === 0 ? CaseResult.WIN : i === 1 ? CaseResult.LOSS : CaseResult.SETTLEMENT,
            resultNotes: `Closed by concurrent operation ${i}`,
            closedBy: `closer-${i}`
          }),
          `closer-${i}`,
          testGuildId,
          false
        )
      );

      const results = await Promise.allSettled(closureOperations);
      
      // Only one should succeed
      const successfulClosures = results.filter(r => r.status === 'fulfilled').length;
      expect(successfulClosures).toBe(1);

      // Verify case is closed
      const finalCase = await caseService.getCaseById(caseId);
      expect(finalCase?.status).toBe('closed');
      expect(finalCase?.closedBy).toBeTruthy();
    });
  });

  describe('Database Consistency Under Load', () => {
    it('should maintain audit log consistency during concurrent operations', async () => {
      const operationCount = 50;
      const operations = [];

      // Mix of different operations
      for (let i = 0; i < operationCount; i++) {
        if (i % 2 === 0) {
          // Staff hire
          operations.push(
            operationQueue.enqueue(
              () => staffService.hireStaff({
                guildId: testGuildId,
                userId: `audit-test-${i}`,
                hiredBy: adminUserId,
                robloxUsername: `AuditTest${i}`,
                role: StaffRole.PARALEGAL
              }),
              `user-${i}`,
              testGuildId,
              false
            )
          );
        } else {
          // Case creation
          operations.push(
            operationQueue.enqueue(
              () => caseService.createCase({
                guildId: testGuildId,
                clientId: `audit-client-${i}`,
                clientUsername: `auditclient${i}`,
                title: `Audit Test Case ${i}`,
                description: `Case for audit testing ${i}`
              }),
              `user-${i}`,
              testGuildId,
              false
            )
          );
        }
      }

      await Promise.allSettled(operations);

      // Verify audit logs are consistent
      const allAuditLogs = await auditLogRepository.findByFilters({ guildId: testGuildId });
      
      // Should have audit logs for successful staff hires
      const staffHireLogs = allAuditLogs.filter(log => log.action === AuditAction.STAFF_HIRED);
      
      // Count successful staff hires
      const staffCount = await staffRepository.findByFilters({ guildId: testGuildId });
      
      // Audit logs should match successful operations
      expect(staffHireLogs.length).toBe(staffCount.length);

      // Verify no duplicate audit log IDs
      const logIds = allAuditLogs.map(log => log._id?.toString()).filter(Boolean);
      const uniqueLogIds = new Set(logIds);
      expect(uniqueLogIds.size).toBe(logIds.length);
    });

    it('should handle high-volume concurrent operations without data corruption', async () => {
      const highVolumeOperations = 100;
      const operations = [];

      // Create many operations of different types
      for (let i = 0; i < highVolumeOperations; i++) {
        const operationType = i % 4;
        
        switch (operationType) {
          case 0: // Staff hire
            operations.push(
              operationQueue.enqueue(
                () => staffService.hireStaff({
                  guildId: testGuildId,
                  userId: `volume-staff-${i}`,
                  hiredBy: adminUserId,
                  robloxUsername: `VolumeStaff${i}`,
                  role: StaffRole.PARALEGAL
                }),
                `volume-user-${i}`,
                testGuildId,
                false
              )
            );
            break;
            
          case 1: // Case creation
            operations.push(
              operationQueue.enqueue(
                () => caseService.createCase({
                  guildId: testGuildId,
                  clientId: `volume-client-${i}`,
                  clientUsername: `volumeclient${i}`,
                  title: `Volume Case ${i}`,
                  description: `High volume test case ${i}`
                }),
                `volume-user-${i}`,
                testGuildId,
                false
              )
            );
            break;
            
          case 2: // Staff info retrieval
            operations.push(
              operationQueue.enqueue(
                () => staffService.getStaffList(testGuildId, `requester-${i}`),
                `volume-user-${i}`,
                testGuildId,
                false
              )
            );
            break;
            
          case 3: // Case search
            operations.push(
              operationQueue.enqueue(
                () => caseService.searchCases({ guildId: testGuildId }),
                `volume-user-${i}`,
                testGuildId,
                false
              )
            );
            break;
        }
      }

      const startTime = Date.now();
      await Promise.allSettled(operations);
      const endTime = Date.now();

      // Should complete within reasonable time (30 seconds for 100 operations)
      expect(endTime - startTime).toBeLessThan(30000);

      // Verify database consistency
      const allStaff = await staffRepository.findByFilters({ guildId: testGuildId });
      const allCases = await caseRepository.findByFilters({ guildId: testGuildId });

      // Check for data integrity
      expect(allStaff.length).toBeGreaterThan(0);
      expect(allCases.length).toBeGreaterThan(0);

      // Verify no duplicate IDs
      const staffIds = allStaff.map(s => s._id?.toString()).filter(Boolean);
      const uniqueStaffIds = new Set(staffIds);
      expect(uniqueStaffIds.size).toBe(staffIds.length);

      const caseIds = allCases.map(c => c._id?.toString()).filter(Boolean);
      const uniqueCaseIds = new Set(caseIds);
      expect(uniqueCaseIds.size).toBe(caseIds.length);
    });
  });

  describe('Queue System Stress Testing', () => {
    it('should handle queue overflow gracefully', async () => {
      const overflowOperations = 1000;
      const operations = [];

      // Create more operations than typical queue capacity
      for (let i = 0; i < overflowOperations; i++) {
        operations.push(
          operationQueue.enqueue(
            () => Promise.resolve(`operation-${i}`),
            `user-${i}`,
            testGuildId,
            false
          )
        );
      }

      const results = await Promise.allSettled(operations);
      
      // All operations should complete (queue should scale)
      const completedOperations = results.filter(r => r.status === 'fulfilled').length;
      expect(completedOperations).toBe(overflowOperations);
    });

    it('should respect priority ordering under load', async () => {
      const normalOperations = 50;
      const priorityOperations = 10;
      const results: any[] = [];

      // Add normal priority operations
      for (let i = 0; i < normalOperations; i++) {
        operationQueue.enqueue(
          async () => {
            await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
            results.push(`normal-${i}`);
            return `normal-${i}`;
          },
          `user-${i}`,
          testGuildId,
          false
        );
      }

      // Add high priority operations (guild owner)
      for (let i = 0; i < priorityOperations; i++) {
        operationQueue.enqueue(
          async () => {
            results.push(`priority-${i}`);
            return `priority-${i}`;
          },
          `owner-${i}`,
          testGuildId,
          true // High priority
        );
      }

      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Priority operations should appear early in results
      const priorityResultsAtStart = results.slice(0, priorityOperations)
        .filter(r => r.startsWith('priority')).length;
      
      expect(priorityResultsAtStart).toBeGreaterThan(0);
    });

    it('should handle operation timeouts correctly', async () => {
      // Create operations that will timeout
      const timeoutOperations = [
        operationQueue.enqueue(
          () => new Promise(resolve => setTimeout(resolve, 35000)), // Longer than 30s timeout
          'timeout-user-1',
          testGuildId,
          false
        ),
        operationQueue.enqueue(
          () => new Promise(resolve => setTimeout(resolve, 35000)),
          'timeout-user-2',
          testGuildId,
          false
        )
      ];

      const results = await Promise.allSettled(timeoutOperations);
      
      // Operations should timeout and be rejected
      const timeoutCount = results.filter(r => r.status === 'rejected').length;
      expect(timeoutCount).toBe(2);
    }, 40000);
  });

  describe('Resource Contention Scenarios', () => {
    it('should handle database connection limits', async () => {
      // Simulate many concurrent database operations
      const dbOperations = Array.from({ length: 200 }, (_, i) =>
        staffService.getStaffList(testGuildId, `requester-${i}`)
      );

      const results = await Promise.allSettled(dbOperations);
      
      // Most operations should succeed despite connection limits
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(150); // Allow some failures due to limits
    });

    it('should handle rapid sequential operations on same entity', async () => {
      // Create a staff member
      const initialHire = await staffService.hireStaff({
        guildId: testGuildId,
        userId: 'rapid-test-user',
        hiredBy: adminUserId,
        robloxUsername: 'RapidTestUser',
        role: StaffRole.PARALEGAL
      });

      expect(initialHire.success).toBe(true);

      // Perform rapid operations on the same staff member
      const rapidOperations = [
        () => staffService.getStaffInfo(testGuildId, 'rapid-test-user', adminUserId),
        () => staffService.promoteStaff({
          guildId: testGuildId,
          userId: 'rapid-test-user',
          promotedBy: adminUserId,
          newRole: StaffRole.JUNIOR_ASSOCIATE
        }),
        () => staffService.getStaffInfo(testGuildId, 'rapid-test-user', adminUserId),
        () => staffService.demoteStaff({
          guildId: testGuildId,
          userId: 'rapid-test-user',
          promotedBy: adminUserId,
          newRole: StaffRole.PARALEGAL
        }),
        () => staffService.getStaffInfo(testGuildId, 'rapid-test-user', adminUserId)
      ] as (() => Promise<any>)[];

      const queuedOperations = rapidOperations.map((op, i) =>
        operationQueue.enqueue(op, `rapid-requester-${i}`, testGuildId, false)
      );

      const results = await Promise.allSettled(queuedOperations);
      
      // All read operations should succeed, write operations may have conflicts
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(2); // At least reads should work

      // Final state should be consistent
      const finalState = await staffService.getStaffInfo(testGuildId, 'rapid-test-user', adminUserId);
      expect(finalState).toBeDefined();
      expect(finalState?.status).toBe('active');
    });
  });
});