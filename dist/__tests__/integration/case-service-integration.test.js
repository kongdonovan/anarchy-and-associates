"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const case_service_1 = require("../../application/services/case-service");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const case_1 = require("../../domain/entities/case");
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
const operation_queue_1 = require("../../infrastructure/queue/operation-queue");
describe('CaseService Integration Tests', () => {
    let caseService;
    let caseRepository;
    let caseCounterRepository;
    let guildConfigRepository;
    beforeAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.setupTestDatabase();
        await database_helpers_1.DatabaseTestHelpers.createIndexes();
    });
    beforeEach(async () => {
        caseRepository = new case_repository_1.CaseRepository();
        caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        caseService = new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository);
        await test_utils_1.TestUtils.clearTestDatabase();
    });
    afterAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.teardownTestDatabase();
    });
    describe('Case Creation Integration', () => {
        it('should create case with sequential numbering', async () => {
            const guildId = 'test-guild-123';
            const clientId = 'client-123';
            const clientUsername = 'testclient';
            const case1 = await caseService.createCase({
                guildId,
                clientId,
                clientUsername,
                title: 'First Case',
                description: 'First test case',
                priority: case_1.CasePriority.HIGH
            });
            const case2 = await caseService.createCase({
                guildId,
                clientId: 'client-456',
                clientUsername: 'otherclient',
                title: 'Second Case',
                description: 'Second test case'
            });
            // Verify sequential numbering
            const currentYear = new Date().getFullYear();
            expect(case1.caseNumber).toBe(`${currentYear}-0001-${clientUsername}`);
            expect(case2.caseNumber).toBe(`${currentYear}-0002-otherclient`);
            // Verify default values
            expect(case1.status).toBe(case_1.CaseStatus.PENDING);
            expect(case1.priority).toBe(case_1.CasePriority.HIGH);
            expect(case2.priority).toBe(case_1.CasePriority.MEDIUM); // Default
            expect(case1.assignedLawyerIds).toEqual([]);
            expect(case1.documents).toEqual([]);
            expect(case1.notes).toEqual([]);
        });
        it('should handle concurrent case creation with proper numbering', async () => {
            const guildId = 'test-guild-123';
            const queue = operation_queue_1.OperationQueue.getInstance();
            queue.clearQueue();
            // Create multiple cases concurrently
            const casePromises = Array.from({ length: 5 }, (_, i) => queue.enqueue(() => caseService.createCase({
                guildId,
                clientId: `client-${i}`,
                clientUsername: `client${i}`,
                title: `Case ${i}`,
                description: `Test case ${i}`
            }), `user-${i}`, guildId, false));
            const cases = await Promise.all(casePromises);
            // Verify all cases have unique sequential numbers
            const caseNumbers = cases.map(c => c.caseNumber);
            const uniqueNumbers = new Set(caseNumbers);
            expect(uniqueNumbers.size).toBe(5); // All unique
            // Verify sequential order
            const currentYear = new Date().getFullYear();
            cases.forEach((testCase, index) => {
                const expectedNumber = String(index + 1).padStart(4, '0');
                expect(testCase.caseNumber).toContain(`${currentYear}-${expectedNumber}-`);
            });
        });
        it('should maintain separate case counters per guild', async () => {
            const guild1 = 'guild-1';
            const guild2 = 'guild-2';
            // Create cases in different guilds
            const case1 = await caseService.createCase({
                guildId: guild1,
                clientId: 'client-1',
                clientUsername: 'client1',
                title: 'Guild 1 Case',
                description: 'Test case for guild 1'
            });
            const case2 = await caseService.createCase({
                guildId: guild2,
                clientId: 'client-2',
                clientUsername: 'client2',
                title: 'Guild 2 Case',
                description: 'Test case for guild 2'
            });
            const case3 = await caseService.createCase({
                guildId: guild1,
                clientId: 'client-3',
                clientUsername: 'client3',
                title: 'Guild 1 Case 2',
                description: 'Second test case for guild 1'
            });
            // Verify independent numbering
            const currentYear = new Date().getFullYear();
            expect(case1.caseNumber).toBe(`${currentYear}-0001-client1`);
            expect(case2.caseNumber).toBe(`${currentYear}-0001-client2`); // Resets for new guild
            expect(case3.caseNumber).toBe(`${currentYear}-0002-client3`); // Continues for guild 1
        });
        it('should validate case creation parameters', async () => {
            const guildId = 'test-guild-123';
            // Test missing required fields - these will throw during validation
            await expect(caseService.createCase({
                guildId: '',
                clientId: 'client-123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test description'
            })).rejects.toThrow();
            await expect(caseService.createCase({
                guildId,
                clientId: '',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test description'
            })).rejects.toThrow();
            await expect(caseService.createCase({
                guildId,
                clientId: 'client-123',
                clientUsername: '',
                title: 'Test Case',
                description: 'Test description'
            })).rejects.toThrow();
            await expect(caseService.createCase({
                guildId,
                clientId: 'client-123',
                clientUsername: 'testclient',
                title: '',
                description: 'Test description'
            })).rejects.toThrow();
        });
    });
    describe('Case Assignment Integration', () => {
        let testCase;
        beforeEach(async () => {
            testCase = await caseService.createCase({
                guildId: 'test-guild-123',
                clientId: 'client-123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case for assignment'
            });
        });
        it('should accept and assign case to lead attorney', async () => {
            const lawyerId = 'lawyer-123';
            const caseId = testCase._id.toString();
            const acceptedCase = await caseService.acceptCase(caseId, lawyerId);
            expect(acceptedCase.status).toBe(case_1.CaseStatus.OPEN);
            expect(acceptedCase.leadAttorneyId).toBe(lawyerId);
            expect(acceptedCase.assignedLawyerIds).toContain(lawyerId);
            // Verify case is retrievable by ID
            const retrievedCase = await caseService.getCaseById(caseId);
            expect(retrievedCase?.status).toBe(case_1.CaseStatus.OPEN);
            expect(retrievedCase?.leadAttorneyId).toBe(lawyerId);
        });
        it('should assign additional lawyers to open case', async () => {
            const leadLawyerId = 'lawyer-lead';
            const assistantLawyer1 = 'lawyer-assistant-1';
            const assistantLawyer2 = 'lawyer-assistant-2';
            const assignedBy = 'manager-123';
            const caseId = testCase._id.toString();
            // Accept case first
            await caseService.acceptCase(caseId, leadLawyerId);
            // Assign additional lawyers
            await caseService.assignLawyer({
                caseId,
                lawyerId: assistantLawyer1,
                assignedBy
            });
            await caseService.assignLawyer({
                caseId,
                lawyerId: assistantLawyer2,
                assignedBy
            });
            const updatedCase = await caseService.getCaseById(caseId);
            expect(updatedCase?.leadAttorneyId).toBe(leadLawyerId);
            expect(updatedCase?.assignedLawyerIds).toContain(assistantLawyer1);
            expect(updatedCase?.assignedLawyerIds).toContain(assistantLawyer2);
            expect(updatedCase?.assignedLawyerIds).toHaveLength(3); // Lead + 2 assistants
        });
        it('should handle case decline with reason', async () => {
            const lawyerId = 'lawyer-123';
            const reason = 'Conflict of interest';
            const caseId = testCase._id.toString();
            const declinedCase = await caseService.declineCase(caseId, lawyerId, reason);
            expect(declinedCase.status).toBe(case_1.CaseStatus.CLOSED); // Declined cases are closed
            expect(declinedCase.result).toBe(case_1.CaseResult.DISMISSED);
            expect(declinedCase.resultNotes).toContain(reason);
        });
    });
    describe('Case Closure Integration', () => {
        let openCase;
        beforeEach(async () => {
            // Create and open a case for testing
            const testCase = await caseService.createCase({
                guildId: 'test-guild-123',
                clientId: 'client-123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case for closure'
            });
            openCase = await caseService.acceptCase(testCase._id.toString(), 'lawyer-123');
        });
        it('should close case with complete workflow', async () => {
            const caseId = openCase._id.toString();
            const closedBy = 'lawyer-123';
            const result = case_1.CaseResult.WIN;
            const resultNotes = 'Successful resolution for client';
            const closedCase = await caseService.closeCase({
                caseId,
                result,
                resultNotes,
                closedBy
            });
            expect(closedCase.status).toBe(case_1.CaseStatus.CLOSED);
            expect(closedCase.result).toBe(result);
            expect(closedCase.resultNotes).toBe(resultNotes);
            expect(closedCase.closedBy).toBe(closedBy);
            expect(closedCase.closedAt).toBeInstanceOf(Date);
            // Verify case cannot be modified after closure
            await expect(caseService.assignLawyer({
                caseId,
                lawyerId: 'new-lawyer',
                assignedBy: 'manager'
            })).rejects.toThrow();
        });
        it('should validate case closure parameters', async () => {
            const caseId = openCase._id.toString();
            // Test missing closedBy
            await expect(caseService.closeCase({
                caseId,
                result: case_1.CaseResult.WIN,
                closedBy: ''
            })).rejects.toThrow();
        });
        it('should handle all valid case results', async () => {
            const validResults = [
                case_1.CaseResult.WIN,
                case_1.CaseResult.LOSS,
                case_1.CaseResult.SETTLEMENT,
                case_1.CaseResult.DISMISSED,
                case_1.CaseResult.WITHDRAWN
            ];
            for (const [index, result] of validResults.entries()) {
                // Create new case for each result test
                const testCase = await caseService.createCase({
                    guildId: 'test-guild-123',
                    clientId: `client-${index}`,
                    clientUsername: `client${index}`,
                    title: `Test Case ${index}`,
                    description: `Test case for result ${result}`
                });
                const openCase = await caseService.acceptCase(testCase._id.toString(), 'lawyer-123');
                const closedCase = await caseService.closeCase({
                    caseId: openCase._id.toString(),
                    result,
                    closedBy: 'lawyer-123'
                });
                expect(closedCase.result).toBe(result);
                expect(closedCase.status).toBe(case_1.CaseStatus.CLOSED);
            }
        });
        it('should prevent double closure', async () => {
            const caseId = openCase._id.toString();
            const closedBy = 'lawyer-123';
            // Close case first time
            await caseService.closeCase({
                caseId,
                result: case_1.CaseResult.WIN,
                closedBy
            });
            // Try to close again
            await expect(caseService.closeCase({
                caseId,
                result: case_1.CaseResult.LOSS,
                closedBy
            })).rejects.toThrow();
        });
    });
    describe('Case Querying and Search', () => {
        beforeEach(async () => {
            // Create diverse test cases
            const testCases = [
                {
                    clientUsername: 'client1',
                    title: 'Contract Dispute',
                    priority: case_1.CasePriority.HIGH
                },
                {
                    clientUsername: 'client2',
                    title: 'Personal Injury',
                    priority: case_1.CasePriority.URGENT
                },
                {
                    clientUsername: 'client3',
                    title: 'Real Estate',
                    priority: case_1.CasePriority.MEDIUM
                },
                {
                    clientUsername: 'client4',
                    title: 'Criminal Defense',
                    priority: case_1.CasePriority.LOW
                }
            ];
            for (const [index, caseData] of testCases.entries()) {
                await caseService.createCase({
                    guildId: 'test-guild-123',
                    clientId: `client-${index}`,
                    clientUsername: caseData.clientUsername,
                    title: caseData.title,
                    description: `Description for ${caseData.title}`,
                    priority: caseData.priority
                });
            }
        });
        it('should search cases by filters', async () => {
            const guildId = 'test-guild-123';
            const contractCases = await caseService.searchCases({
                guildId,
                title: 'Contract'
            });
            const injuryCases = await caseService.searchCases({
                guildId,
                title: 'Injury'
            });
            expect(contractCases).toHaveLength(1);
            expect(injuryCases).toHaveLength(1);
            expect(contractCases[0].title).toContain('Contract');
            expect(injuryCases[0].title).toContain('Injury');
        });
        it('should retrieve cases by case number', async () => {
            const currentYear = new Date().getFullYear();
            const expectedCaseNumber = `${currentYear}-0001-client1`;
            const caseByNumber = await caseService.getCaseByCaseNumber(expectedCaseNumber);
            expect(caseByNumber).toBeDefined();
            expect(caseByNumber?.title).toBe('Contract Dispute');
        });
        it('should retrieve cases by client', async () => {
            const clientId = 'client-0';
            const clientCases = await caseService.getCasesByClient(clientId);
            expect(clientCases).toHaveLength(1);
            expect(clientCases[0].clientId).toBe(clientId);
        });
        it('should retrieve cases by lawyer', async () => {
            const guildId = 'test-guild-123';
            const lawyerId = 'lawyer-123';
            // First accept a case
            const cases = await caseService.searchCases({ guildId });
            await caseService.acceptCase(cases[0]._id.toString(), lawyerId);
            const lawyerCases = await caseService.getCasesByLawyer(lawyerId);
            expect(lawyerCases.length).toBeGreaterThan(0);
            lawyerCases.forEach(testCase => {
                const isLead = testCase.leadAttorneyId === lawyerId;
                const isAssigned = testCase.assignedLawyerIds.includes(lawyerId);
                expect(isLead || isAssigned).toBe(true);
            });
        });
        it('should get active and pending cases', async () => {
            const guildId = 'test-guild-123';
            const pendingCases = await caseService.getPendingCases(guildId);
            expect(pendingCases).toHaveLength(4); // All created cases are pending
            // Accept one case
            const cases = await caseService.searchCases({ guildId });
            await caseService.acceptCase(cases[0]._id.toString(), 'lawyer-123');
            const activeCases = await caseService.getActiveCases(guildId);
            expect(activeCases).toHaveLength(1); // One case is now active
            const remainingPending = await caseService.getPendingCases(guildId);
            expect(remainingPending).toHaveLength(3); // Three still pending
        });
    });
    describe('Performance and Scalability', () => {
        it('should handle large case loads efficiently', async () => {
            const guildId = 'test-guild-large';
            const caseCount = 50; // Reduced from 100 for faster tests
            // Create many cases
            const casePromises = Array.from({ length: caseCount }, (_, i) => caseService.createCase({
                guildId,
                clientId: `client-${i}`,
                clientUsername: `client${i}`,
                title: `Case ${i}`,
                description: `Large dataset test case ${i}`,
                priority: Object.values(case_1.CasePriority)[i % 4]
            }));
            const startTime = Date.now();
            await Promise.all(casePromises);
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
            // Verify all cases created
            const allCases = await caseService.searchCases({ guildId });
            expect(allCases).toHaveLength(caseCount);
            // Test search performance
            const searchStart = Date.now();
            await caseService.searchCases({ guildId, title: 'test' });
            const searchEnd = Date.now();
            expect(searchEnd - searchStart).toBeLessThan(1000); // Search should be fast
        });
        it('should handle concurrent case operations', async () => {
            const guildId = 'test-guild-concurrent';
            const queue = operation_queue_1.OperationQueue.getInstance();
            queue.clearQueue();
            // Create a case first
            const testCase = await caseService.createCase({
                guildId,
                clientId: 'client-123',
                clientUsername: 'testclient',
                title: 'Concurrent Test Case',
                description: 'Case for testing concurrent operations'
            });
            const caseId = testCase._id.toString();
            // Try concurrent accept operations (should only allow one)
            const acceptPromises = [
                queue.enqueue(() => caseService.acceptCase(caseId, 'lawyer-1'), 'lawyer-1', guildId, false),
                queue.enqueue(() => caseService.acceptCase(caseId, 'lawyer-2'), 'lawyer-2', guildId, false),
                queue.enqueue(() => caseService.acceptCase(caseId, 'lawyer-3'), 'lawyer-3', guildId, false)
            ];
            const results = await Promise.allSettled(acceptPromises);
            // Only one should succeed
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBe(1);
        });
    });
    describe('Error Handling and Edge Cases', () => {
        it('should handle invalid case IDs gracefully', async () => {
            const invalidIds = ['', 'invalid', '123456789012345678901234', 'not-an-object-id'];
            for (const invalidId of invalidIds) {
                await expect(caseService.getCaseById(invalidId))
                    .rejects.toThrow();
            }
        });
        it('should handle database connection failures', async () => {
            await database_helpers_1.DatabaseTestHelpers.simulateDatabaseError();
            await expect(caseService.createCase({
                guildId: 'test-guild-123',
                clientId: 'client-123',
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test description'
            })).rejects.toThrow();
            await database_helpers_1.DatabaseTestHelpers.restoreDatabase();
        });
    });
    describe('Guild Configuration Integration', () => {
        it('should use guild-specific case archive settings', async () => {
            const guildId = 'test-guild-config';
            // Create guild config
            await guildConfigRepository.add({
                guildId,
                caseArchiveCategoryId: 'archive-category-123',
                feedbackChannelId: undefined,
                retainerChannelId: undefined,
                caseReviewCategoryId: undefined,
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
            const archiveCategoryId = await caseService.getCaseArchiveCategoryId(guildId);
            expect(archiveCategoryId).toBe('archive-category-123');
        });
        it('should handle missing guild configuration gracefully', async () => {
            const guildId = 'test-guild-no-config';
            const archiveCategoryId = await caseService.getCaseArchiveCategoryId(guildId);
            expect(archiveCategoryId).toBeNull();
        });
    });
});
//# sourceMappingURL=case-service-integration.test.js.map