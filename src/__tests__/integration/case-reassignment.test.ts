import { CaseService } from '../../application/services/case-service';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { CasePriority } from '../../domain/entities/case';
import { TestUtils } from '../helpers/test-utils';
import { DatabaseTestHelpers } from '../helpers/database-helpers';

/**
 * Integration tests for case reassignment and unassignment functionality
 * 
 * Tests the new /case reassign and /case unassign commands added to the system
 */
describe('Case Reassignment Integration Tests', () => {
  let caseService: CaseService;
  let caseRepository: CaseRepository;
  let caseCounterRepository: CaseCounterRepository;
  let guildConfigRepository: GuildConfigRepository;

  const testGuildId = 'test-guild-reassign';
  const lawyer1Id = 'lawyer-1';
  const lawyer2Id = 'lawyer-2';
  const lawyer3Id = 'lawyer-3';
  const clientId = 'client-123';

  beforeAll(async () => {
    await DatabaseTestHelpers.setupTestDatabase();
  });

  beforeEach(async () => {
    caseRepository = new CaseRepository();
    caseCounterRepository = new CaseCounterRepository();
    guildConfigRepository = new GuildConfigRepository();
    caseService = new CaseService(caseRepository, caseCounterRepository, guildConfigRepository);
    
    await TestUtils.clearTestDatabase();
  });

  afterAll(async () => {
    await DatabaseTestHelpers.teardownTestDatabase();
  });

  describe('Case Reassignment (reassignLawyer)', () => {
    let case1: any;
    let case2: any;

    beforeEach(async () => {
      // Create two test cases
      case1 = await caseService.createCase({
        guildId: testGuildId,
        clientId,
        clientUsername: 'testclient',
        title: 'Case 1 - Contract Dispute',
        description: 'First test case',
        priority: CasePriority.HIGH
      });

      case2 = await caseService.createCase({
        guildId: testGuildId,
        clientId: 'client-456',
        clientUsername: 'otherclient',
        title: 'Case 2 - Personal Injury',
        description: 'Second test case',
        priority: CasePriority.MEDIUM
      });

      // Accept both cases and assign lawyers
      await caseService.acceptCase(case1._id!.toString(), lawyer1Id);
      await caseService.acceptCase(case2._id!.toString(), lawyer2Id);
    });

    it('should successfully reassign lawyer from one case to another', async () => {
      const fromCaseId = case1._id!.toString();
      const toCaseId = case2._id!.toString();

      // Verify initial state
      const initialCase1 = await caseService.getCaseById(fromCaseId);
      const initialCase2 = await caseService.getCaseById(toCaseId);
      
      expect(initialCase1?.assignedLawyerIds).toContain(lawyer1Id);
      expect(initialCase1?.leadAttorneyId).toBe(lawyer1Id);
      expect(initialCase2?.assignedLawyerIds).toContain(lawyer2Id);
      expect(initialCase2?.leadAttorneyId).toBe(lawyer2Id);

      // Perform reassignment
      const result = await caseService.reassignLawyer(fromCaseId, toCaseId, lawyer1Id);

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.fromCase).toBeDefined();
      expect(result.toCase).toBeDefined();

      // Verify lawyer1 was removed from case1
      expect(result.fromCase?.assignedLawyerIds).not.toContain(lawyer1Id);
      expect(result.fromCase?.leadAttorneyId).toBeNull(); // Should be reassigned or null

      // Verify lawyer1 was added to case2
      expect(result.toCase?.assignedLawyerIds).toContain(lawyer1Id);
      expect(result.toCase?.assignedLawyerIds).toContain(lawyer2Id); // Original lawyer should remain

      // Check database state
      const finalCase1 = await caseService.getCaseById(fromCaseId);
      const finalCase2 = await caseService.getCaseById(toCaseId);

      expect(finalCase1?.assignedLawyerIds).not.toContain(lawyer1Id);
      expect(finalCase2?.assignedLawyerIds).toContain(lawyer1Id);
      expect(finalCase2?.assignedLawyerIds).toContain(lawyer2Id);
    });

    it('should handle lead attorney reassignment correctly', async () => {
      const fromCaseId = case1._id!.toString();
      const toCaseId = case2._id!.toString();

      // Add another lawyer to case1 first
      await caseService.assignLawyer({
        caseId: fromCaseId,
        lawyerId: lawyer3Id,
        assignedBy: 'admin-123'
      });

      // Verify lawyer1 is still lead attorney
      const beforeReassign = await caseService.getCaseById(fromCaseId);
      expect(beforeReassign?.leadAttorneyId).toBe(lawyer1Id);
      expect(beforeReassign?.assignedLawyerIds).toHaveLength(2);

      // Reassign the lead attorney (lawyer1)
      const result = await caseService.reassignLawyer(fromCaseId, toCaseId, lawyer1Id);

      // Verify lead attorney was reassigned to remaining lawyer
      expect(result.fromCase?.leadAttorneyId).toBe(lawyer3Id);
      expect(result.fromCase?.assignedLawyerIds).toContain(lawyer3Id);
      expect(result.fromCase?.assignedLawyerIds).not.toContain(lawyer1Id);

      // Verify lawyer1 is assigned to case2 but lawyer2 remains lead
      expect(result.toCase?.leadAttorneyId).toBe(lawyer2Id);
      expect(result.toCase?.assignedLawyerIds).toContain(lawyer1Id);
      expect(result.toCase?.assignedLawyerIds).toContain(lawyer2Id);
    });

    it('should handle reassignment when target case has no assigned lawyers', async () => {
      // Create a third case with no assigned lawyers
      const case3 = await caseService.createCase({
        guildId: testGuildId,
        clientId: 'client-789',
        clientUsername: 'newclient',
        title: 'Case 3 - New Case',
        description: 'Unassigned case',
        priority: CasePriority.LOW
      });

      const fromCaseId = case1._id!.toString();
      const toCaseId = case3._id!.toString();

      // Reassign lawyer1 to empty case
      const result = await caseService.reassignLawyer(fromCaseId, toCaseId, lawyer1Id);

      // Verify lawyer1 becomes lead attorney of the new case
      expect(result.toCase?.leadAttorneyId).toBe(lawyer1Id);
      expect(result.toCase?.assignedLawyerIds).toContain(lawyer1Id);
      expect(result.toCase?.assignedLawyerIds).toHaveLength(1);

      // Verify lawyer1 was removed from original case
      expect(result.fromCase?.assignedLawyerIds).not.toContain(lawyer1Id);
    });

    it('should handle reassigning non-existent lawyer gracefully', async () => {
      const fromCaseId = case1._id!.toString();
      const toCaseId = case2._id!.toString();
      const nonExistentLawyer = 'non-existent-lawyer';

      // The service should handle this gracefully (idempotent operation)
      const result = await caseService.reassignLawyer(fromCaseId, toCaseId, nonExistentLawyer);

      // Non-existent lawyer should be added to target case (since assignLawyer is permissive)
      expect(result.toCase?.assignedLawyerIds).toContain(nonExistentLawyer);
      
      // Original case should be unchanged since lawyer wasn't assigned there
      expect(result.fromCase?.assignedLawyerIds).toContain(lawyer1Id);
    });

    it('should throw error when using non-existent case IDs', async () => {
      const nonExistentCaseId = 'non-existent-case';

      await expect(
        caseService.reassignLawyer(nonExistentCaseId, case2._id!.toString(), lawyer1Id)
      ).rejects.toThrow();

      await expect(
        caseService.reassignLawyer(case1._id!.toString(), nonExistentCaseId, lawyer1Id)
      ).rejects.toThrow();
    });

    it('should handle reassignment of only lawyer in case', async () => {
      const fromCaseId = case1._id!.toString();
      const toCaseId = case2._id!.toString();

      // Verify case1 has only lawyer1
      const beforeReassign = await caseService.getCaseById(fromCaseId);
      expect(beforeReassign?.assignedLawyerIds).toHaveLength(1);
      expect(beforeReassign?.leadAttorneyId).toBe(lawyer1Id);

      // Reassign the only lawyer
      const result = await caseService.reassignLawyer(fromCaseId, toCaseId, lawyer1Id);

      // Verify case1 has no assigned lawyers
      expect(result.fromCase?.assignedLawyerIds).toHaveLength(0);
      expect(result.fromCase?.leadAttorneyId).toBeNull();

      // Verify lawyer1 is added to case2
      expect(result.toCase?.assignedLawyerIds).toContain(lawyer1Id);
      expect(result.toCase?.assignedLawyerIds).toContain(lawyer2Id);
    });
  });

  describe('Lawyer Unassignment (unassignLawyer)', () => {
    let testCase: any;

    beforeEach(async () => {
      // Create and setup a test case with multiple lawyers
      testCase = await caseService.createCase({
        guildId: testGuildId,
        clientId,
        clientUsername: 'testclient',
        title: 'Multi-lawyer Case',
        description: 'Case with multiple assigned lawyers',
        priority: CasePriority.HIGH
      });

      // Accept case and assign multiple lawyers
      await caseService.acceptCase(testCase._id!.toString(), lawyer1Id);
      await caseService.assignLawyer({
        caseId: testCase._id!.toString(),
        lawyerId: lawyer2Id,
        assignedBy: 'admin-123'
      });
      await caseService.assignLawyer({
        caseId: testCase._id!.toString(),
        lawyerId: lawyer3Id,
        assignedBy: 'admin-123'
      });
    });

    it('should successfully unassign non-lead lawyer', async () => {
      const caseId = testCase._id!.toString();

      // Verify initial state
      const beforeUnassign = await caseService.getCaseById(caseId);
      expect(beforeUnassign?.assignedLawyerIds).toHaveLength(3);
      expect(beforeUnassign?.leadAttorneyId).toBe(lawyer1Id);
      expect(beforeUnassign?.assignedLawyerIds).toContain(lawyer2Id);

      // Unassign lawyer2 (non-lead)
      const result = await caseService.unassignLawyer(caseId, lawyer2Id);

      // Verify lawyer2 was removed but others remain
      expect(result.assignedLawyerIds).not.toContain(lawyer2Id);
      expect(result.assignedLawyerIds).toContain(lawyer1Id);
      expect(result.assignedLawyerIds).toContain(lawyer3Id);
      expect(result.assignedLawyerIds).toHaveLength(2);
      
      // Lead attorney should remain unchanged
      expect(result.leadAttorneyId).toBe(lawyer1Id);
    });

    it('should reassign lead attorney when unassigning current lead', async () => {
      const caseId = testCase._id!.toString();

      // Verify lawyer1 is lead attorney
      const beforeUnassign = await caseService.getCaseById(caseId);
      expect(beforeUnassign?.leadAttorneyId).toBe(lawyer1Id);
      expect(beforeUnassign?.assignedLawyerIds).toHaveLength(3);

      // Unassign the lead attorney
      const result = await caseService.unassignLawyer(caseId, lawyer1Id);

      // Verify lawyer1 was removed
      expect(result.assignedLawyerIds).not.toContain(lawyer1Id);
      expect(result.assignedLawyerIds).toHaveLength(2);

      // Verify new lead attorney was assigned (should be lawyer2 as first remaining)
      expect(result.leadAttorneyId).toBeTruthy();
      expect(result.leadAttorneyId).not.toBe(lawyer1Id);
      expect([lawyer2Id, lawyer3Id]).toContain(result.leadAttorneyId);
    });

    it('should handle unassigning last lawyer in case', async () => {
      const caseId = testCase._id!.toString();

      // First unassign lawyer2 and lawyer3
      await caseService.unassignLawyer(caseId, lawyer2Id);
      await caseService.unassignLawyer(caseId, lawyer3Id);

      // Verify only lawyer1 remains
      const beforeFinalUnassign = await caseService.getCaseById(caseId);
      expect(beforeFinalUnassign?.assignedLawyerIds).toHaveLength(1);
      expect(beforeFinalUnassign?.leadAttorneyId).toBe(lawyer1Id);

      // Unassign the last lawyer
      const result = await caseService.unassignLawyer(caseId, lawyer1Id);

      // Verify case has no assigned lawyers
      expect(result.assignedLawyerIds).toHaveLength(0);
      expect(result.leadAttorneyId).toBeNull();
    });

    it('should handle unassigning non-assigned lawyer gracefully', async () => {
      const caseId = testCase._id!.toString();
      const unassignedLawyer = 'unassigned-lawyer-999';

      // Should complete without error (idempotent operation)
      const result = await caseService.unassignLawyer(caseId, unassignedLawyer);

      // Case should remain unchanged since lawyer wasn't assigned
      expect(result).toBeDefined();
      expect(result.assignedLawyerIds).toHaveLength(3); // Original lawyers still there
      expect(result.assignedLawyerIds).toContain(lawyer1Id);
      expect(result.assignedLawyerIds).toContain(lawyer2Id);
      expect(result.assignedLawyerIds).toContain(lawyer3Id);
      expect(result.assignedLawyerIds).not.toContain(unassignedLawyer);
    });

    it('should throw error when unassigning from non-existent case', async () => {
      const nonExistentCaseId = 'non-existent-case';

      await expect(
        caseService.unassignLawyer(nonExistentCaseId, lawyer1Id)
      ).rejects.toThrow();
    });
  });

  describe('Case Assignment Status Tracking', () => {
    let multiCaseScenario: any[];

    beforeEach(async () => {
      // Create multiple cases for complex assignment tracking
      multiCaseScenario = [];
      
      for (let i = 1; i <= 3; i++) {
        const testCase = await caseService.createCase({
          guildId: testGuildId,
          clientId: `client-${i}`,
          clientUsername: `client${i}`,
          title: `Case ${i}`,
          description: `Test case ${i}`,
          priority: CasePriority.MEDIUM
        });
        
        await caseService.acceptCase(testCase._id!.toString(), lawyer1Id);
        multiCaseScenario.push(testCase);
      }
    });

    it('should track lawyer assignments across multiple cases', async () => {
      // Verify lawyer1 is assigned to all 3 cases
      for (const testCase of multiCaseScenario) {
        const caseData = await caseService.getCaseById(testCase._id!.toString());
        expect(caseData?.assignedLawyerIds).toContain(lawyer1Id);
        expect(caseData?.leadAttorneyId).toBe(lawyer1Id);
      }

      // Reassign lawyer1 from case 1 to case 2 (should add to case 2, remove from case 1)
      const case1Id = multiCaseScenario[0]._id!.toString();
      const case2Id = multiCaseScenario[1]._id!.toString();

      await caseService.reassignLawyer(case1Id, case2Id, lawyer1Id);

      // Verify final assignments
      const finalCase1 = await caseService.getCaseById(case1Id);
      const finalCase2 = await caseService.getCaseById(case2Id);
      const finalCase3 = await caseService.getCaseById(multiCaseScenario[2]._id!.toString());

      expect(finalCase1?.assignedLawyerIds).not.toContain(lawyer1Id);
      expect(finalCase2?.assignedLawyerIds).toContain(lawyer1Id);
      expect(finalCase3?.assignedLawyerIds).toContain(lawyer1Id);

      // Case 2 should have lawyer1 listed once (not duplicated)
      const lawyer1Count = finalCase2?.assignedLawyerIds.filter(id => id === lawyer1Id).length;
      expect(lawyer1Count).toBe(1);
    });

    it('should handle complex reassignment chain', async () => {
      const case1Id = multiCaseScenario[0]._id!.toString();
      const case2Id = multiCaseScenario[1]._id!.toString();
      const case3Id = multiCaseScenario[2]._id!.toString();

      // Add lawyer2 to case2 and lawyer3 to case3
      await caseService.assignLawyer({
        caseId: case2Id,
        lawyerId: lawyer2Id,
        assignedBy: 'admin-123'
      });

      await caseService.assignLawyer({
        caseId: case3Id,
        lawyerId: lawyer3Id,
        assignedBy: 'admin-123'
      });

      // Reassign lawyer1 from case1 to case2, then lawyer2 from case2 to case3
      await caseService.reassignLawyer(case1Id, case2Id, lawyer1Id);
      await caseService.reassignLawyer(case2Id, case3Id, lawyer2Id);

      // Verify final state
      const finalCase1 = await caseService.getCaseById(case1Id);
      const finalCase2 = await caseService.getCaseById(case2Id);
      const finalCase3 = await caseService.getCaseById(case3Id);

      expect(finalCase1?.assignedLawyerIds).toHaveLength(0);
      expect(finalCase2?.assignedLawyerIds).toContain(lawyer1Id);
      expect(finalCase2?.assignedLawyerIds).not.toContain(lawyer2Id);
      expect(finalCase3?.assignedLawyerIds).toContain(lawyer1Id);
      expect(finalCase3?.assignedLawyerIds).toContain(lawyer2Id);
      expect(finalCase3?.assignedLawyerIds).toContain(lawyer3Id);
    });
  });
});