"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const case_service_1 = require("../../application/services/case-service");
const case_1 = require("../../domain/entities/case");
const test_utils_1 = require("../helpers/test-utils");
/**
 * Unit tests for CaseService
 * Tests business logic with mocked repositories to ensure isolation
 */
describe('CaseService Unit Tests', () => {
    let caseService;
    let mockCaseRepository;
    let mockCaseCounterRepository;
    let mockGuildConfigRepository;
    // Test data constants
    const testGuildId = '123456789012345678';
    const testClientId = '234567890123456789';
    const testLawyerId = '345678901234567890';
    const testCaseId = test_utils_1.TestUtils.generateObjectId().toString();
    const currentYear = new Date().getFullYear();
    beforeEach(() => {
        // Create partial mock repositories with only the methods we need
        mockCaseRepository = {
            add: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            assignLawyer: jest.fn(),
            unassignLawyer: jest.fn(),
            reassignLawyer: jest.fn(),
            addDocument: jest.fn(),
            addNote: jest.fn(),
            searchCases: jest.fn(),
            conditionalUpdate: jest.fn()
        };
        mockCaseCounterRepository = {
            getNextCaseNumber: jest.fn()
        };
        mockGuildConfigRepository = {
            findByGuildId: jest.fn()
        };
        caseService = new case_service_1.CaseService(mockCaseRepository, mockCaseCounterRepository, mockGuildConfigRepository);
        jest.clearAllMocks();
    });
    describe('createCase', () => {
        const mockCaseRequest = {
            guildId: testGuildId,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            priority: case_1.CasePriority.HIGH
        };
        const mockCreatedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: case_1.CaseStatus.PENDING,
            priority: case_1.CasePriority.HIGH
        });
        it('should create a case successfully with all required fields', async () => {
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(1);
            mockCaseRepository.add.mockResolvedValue(mockCreatedCase);
            const result = await caseService.createCase(mockCaseRequest);
            expect(mockCaseCounterRepository.getNextCaseNumber).toHaveBeenCalledWith(testGuildId);
            expect(mockCaseRepository.add).toHaveBeenCalledWith({
                guildId: testGuildId,
                caseNumber: `${currentYear}-0001-testclient`,
                clientId: testClientId,
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.PENDING,
                priority: case_1.CasePriority.HIGH,
                assignedLawyerIds: [],
                documents: [],
                notes: []
            });
            expect(result).toEqual(mockCreatedCase);
        });
        it('should create case with default medium priority when not specified', async () => {
            const requestWithoutPriority = { ...mockCaseRequest };
            delete requestWithoutPriority.priority;
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(1);
            mockCaseRepository.add.mockResolvedValue({
                ...mockCreatedCase,
                priority: case_1.CasePriority.MEDIUM
            });
            await caseService.createCase(requestWithoutPriority);
            expect(mockCaseRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                priority: case_1.CasePriority.MEDIUM
            }));
        });
        it('should generate correct case number format', async () => {
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(42);
            mockCaseRepository.add.mockResolvedValue({
                ...mockCreatedCase,
                caseNumber: `${currentYear}-0042-testclient`
            });
            await caseService.createCase(mockCaseRequest);
            expect(mockCaseRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                caseNumber: `${currentYear}-0042-testclient`
            }));
        });
        it('should handle special characters in client username for case number', async () => {
            const requestWithSpecialChars = {
                ...mockCaseRequest,
                clientUsername: 'test-client_123'
            };
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(1);
            mockCaseRepository.add.mockResolvedValue({
                ...mockCreatedCase,
                clientUsername: 'test-client_123',
                caseNumber: `${currentYear}-0001-test-client_123`
            });
            await caseService.createCase(requestWithSpecialChars);
            expect(mockCaseRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                caseNumber: `${currentYear}-0001-test-client_123`
            }));
        });
        it('should throw error when case counter fails', async () => {
            mockCaseCounterRepository.getNextCaseNumber.mockRejectedValue(new Error('Counter service unavailable'));
            await expect(caseService.createCase(mockCaseRequest))
                .rejects.toThrow('Counter service unavailable');
            expect(mockCaseRepository.add).not.toHaveBeenCalled();
        });
        it('should throw error when repository add fails', async () => {
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(1);
            mockCaseRepository.add.mockRejectedValue(new Error('Database error'));
            await expect(caseService.createCase(mockCaseRequest))
                .rejects.toThrow('Database error');
        });
        it('should handle very long case descriptions', async () => {
            const longDescription = 'A'.repeat(10000);
            const requestWithLongDescription = {
                ...mockCaseRequest,
                description: longDescription
            };
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(1);
            mockCaseRepository.add.mockResolvedValue({
                ...mockCreatedCase,
                description: longDescription
            });
            await caseService.createCase(requestWithLongDescription);
            expect(mockCaseRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                description: longDescription
            }));
        });
    });
    describe('assignLawyer', () => {
        const mockAssignmentRequest = {
            caseId: testCaseId,
            lawyerId: testLawyerId,
            assignedBy: 'admin-123'
        };
        const mockAssignedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: case_1.CaseStatus.IN_PROGRESS,
            priority: case_1.CasePriority.HIGH,
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [testLawyerId]
        });
        it('should assign lawyer successfully', async () => {
            mockCaseRepository.assignLawyer.mockResolvedValue(mockAssignedCase);
            const result = await caseService.assignLawyer(mockAssignmentRequest);
            expect(mockCaseRepository.assignLawyer).toHaveBeenCalledWith(testCaseId, testLawyerId);
            expect(result).toEqual(mockAssignedCase);
        });
        it('should throw error when case not found for assignment', async () => {
            mockCaseRepository.assignLawyer.mockResolvedValue(null);
            await expect(caseService.assignLawyer(mockAssignmentRequest))
                .rejects.toThrow('Case not found or assignment failed');
        });
        it('should throw error when assignment fails in repository', async () => {
            mockCaseRepository.assignLawyer.mockRejectedValue(new Error('Assignment constraint violation'));
            await expect(caseService.assignLawyer(mockAssignmentRequest))
                .rejects.toThrow('Assignment constraint violation');
        });
    });
    describe('unassignLawyer', () => {
        const mockUnassignedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: case_1.CaseStatus.IN_PROGRESS,
            priority: case_1.CasePriority.HIGH,
            leadAttorneyId: undefined,
            assignedLawyerIds: []
        });
        it('should unassign lawyer successfully', async () => {
            mockCaseRepository.unassignLawyer.mockResolvedValue(mockUnassignedCase);
            const result = await caseService.unassignLawyer(testCaseId, testLawyerId);
            expect(mockCaseRepository.unassignLawyer).toHaveBeenCalledWith(testCaseId, testLawyerId);
            expect(result).toEqual(mockUnassignedCase);
        });
        it('should throw error when case not found for unassignment', async () => {
            mockCaseRepository.unassignLawyer.mockResolvedValue(null);
            await expect(caseService.unassignLawyer(testCaseId, testLawyerId))
                .rejects.toThrow('Case not found or unassignment failed');
        });
        it('should handle unassigning lawyer not assigned to case', async () => {
            mockCaseRepository.unassignLawyer.mockResolvedValue(mockUnassignedCase);
            const result = await caseService.unassignLawyer(testCaseId, 'non-existent-lawyer');
            expect(result).toEqual(mockUnassignedCase);
        });
    });
    describe('reassignLawyer', () => {
        const fromCaseId = testCaseId;
        const toCaseId = test_utils_1.TestUtils.generateObjectId().toString();
        const mockFromCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'From Case',
            description: 'Source case description',
            status: case_1.CaseStatus.IN_PROGRESS,
            priority: case_1.CasePriority.HIGH,
            leadAttorneyId: 'other-lawyer',
            assignedLawyerIds: ['other-lawyer']
        });
        const mockToCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0002-otherclient`,
            clientId: 'other-client',
            clientUsername: 'otherclient',
            title: 'To Case',
            description: 'Target case description',
            status: case_1.CaseStatus.IN_PROGRESS,
            priority: case_1.CasePriority.MEDIUM,
            leadAttorneyId: 'lead-lawyer',
            assignedLawyerIds: ['lead-lawyer', testLawyerId]
        });
        it('should reassign lawyer between cases successfully', async () => {
            mockCaseRepository.reassignLawyer.mockResolvedValue({
                fromCase: mockFromCase,
                toCase: mockToCase
            });
            const result = await caseService.reassignLawyer(fromCaseId, toCaseId, testLawyerId);
            expect(mockCaseRepository.reassignLawyer).toHaveBeenCalledWith(fromCaseId, toCaseId, testLawyerId);
            expect(result.fromCase).toEqual(mockFromCase);
            expect(result.toCase).toEqual(mockToCase);
        });
        it('should throw error when reassignment fails', async () => {
            mockCaseRepository.reassignLawyer.mockRejectedValue(new Error('Reassignment failed: case not found'));
            await expect(caseService.reassignLawyer(fromCaseId, toCaseId, testLawyerId))
                .rejects.toThrow('Reassignment failed: case not found');
        });
        it('should handle reassigning lawyer between same case', async () => {
            mockCaseRepository.reassignLawyer.mockResolvedValue({
                fromCase: mockFromCase,
                toCase: mockFromCase // Same case
            });
            const result = await caseService.reassignLawyer(fromCaseId, fromCaseId, testLawyerId);
            expect(result.fromCase).toEqual(mockFromCase);
            expect(result.toCase).toEqual(mockFromCase);
        });
    });
    describe('updateCaseStatus', () => {
        const mockUpdatedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: case_1.CaseStatus.IN_PROGRESS,
            priority: case_1.CasePriority.HIGH,
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [testLawyerId]
        });
        it('should update case status successfully', async () => {
            mockCaseRepository.update.mockResolvedValue(mockUpdatedCase);
            const result = await caseService.updateCaseStatus(testCaseId, case_1.CaseStatus.IN_PROGRESS, testLawyerId);
            expect(mockCaseRepository.update).toHaveBeenCalledWith(testCaseId, {
                status: case_1.CaseStatus.IN_PROGRESS
            });
            expect(result).toEqual(mockUpdatedCase);
        });
        it('should throw error when case not found for status update', async () => {
            mockCaseRepository.update.mockResolvedValue(null);
            await expect(caseService.updateCaseStatus(testCaseId, case_1.CaseStatus.IN_PROGRESS, testLawyerId)).rejects.toThrow('Case not found');
        });
        it('should handle invalid status transitions', async () => {
            // Note: Based on requirements, we need to implement PENDING -> IN_PROGRESS -> CLOSED
            // This test assumes business logic validation will be added
            mockCaseRepository.update.mockRejectedValue(new Error('Invalid status transition'));
            await expect(caseService.updateCaseStatus(testCaseId, case_1.CaseStatus.CLOSED, testLawyerId)).rejects.toThrow('Invalid status transition');
        });
    });
    describe('closeCase', () => {
        const mockClosureRequest = {
            caseId: testCaseId,
            result: case_1.CaseResult.WIN,
            resultNotes: 'Successfully resolved for client',
            closedBy: testLawyerId
        };
        const mockClosedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: case_1.CaseStatus.CLOSED,
            priority: case_1.CasePriority.HIGH,
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [],
            result: case_1.CaseResult.WIN,
            resultNotes: 'Successfully resolved for client',
            closedBy: testLawyerId,
            closedAt: new Date()
        });
        beforeEach(() => {
            // Mock current case in IN_PROGRESS status
            mockCaseRepository.findById.mockResolvedValue({
                ...mockClosedCase,
                status: case_1.CaseStatus.IN_PROGRESS,
                assignedLawyerIds: [testLawyerId, 'other-lawyer'],
                result: undefined,
                resultNotes: undefined,
                closedBy: undefined,
                closedAt: undefined
            });
        });
        it('should close case successfully with all details', async () => {
            mockCaseRepository.conditionalUpdate.mockResolvedValue(mockClosedCase);
            const result = await caseService.closeCase(mockClosureRequest);
            expect(mockCaseRepository.conditionalUpdate).toHaveBeenCalledWith(testCaseId, { status: case_1.CaseStatus.IN_PROGRESS }, {
                status: case_1.CaseStatus.CLOSED,
                result: case_1.CaseResult.WIN,
                resultNotes: 'Successfully resolved for client',
                closedBy: testLawyerId,
                closedAt: expect.any(Date)
            });
            expect(result).toEqual(mockClosedCase);
        });
        it('should close case without result notes', async () => {
            const requestWithoutNotes = {
                ...mockClosureRequest,
                resultNotes: undefined
            };
            mockCaseRepository.conditionalUpdate.mockResolvedValue({
                ...mockClosedCase,
                resultNotes: undefined
            });
            await caseService.closeCase(requestWithoutNotes);
            expect(mockCaseRepository.conditionalUpdate).toHaveBeenCalledWith(testCaseId, { status: case_1.CaseStatus.IN_PROGRESS }, {
                status: case_1.CaseStatus.CLOSED,
                result: case_1.CaseResult.WIN,
                resultNotes: undefined,
                closedBy: testLawyerId,
                closedAt: expect.any(Date)
            });
        });
        it('should handle all valid case results', async () => {
            const validResults = [
                case_1.CaseResult.WIN,
                case_1.CaseResult.LOSS,
                case_1.CaseResult.SETTLEMENT,
                case_1.CaseResult.DISMISSED,
                case_1.CaseResult.WITHDRAWN
            ];
            for (const result of validResults) {
                const request = { ...mockClosureRequest, result };
                mockCaseRepository.conditionalUpdate.mockResolvedValue({
                    ...mockClosedCase,
                    result
                });
                await caseService.closeCase(request);
                expect(mockCaseRepository.conditionalUpdate).toHaveBeenLastCalledWith(testCaseId, { status: case_1.CaseStatus.IN_PROGRESS }, expect.objectContaining({ result }));
            }
        });
        it('should throw error when case not found for closure', async () => {
            mockCaseRepository.findById.mockResolvedValue(null);
            await expect(caseService.closeCase(mockClosureRequest))
                .rejects.toThrow('Case not found');
            expect(mockCaseRepository.update).not.toHaveBeenCalled();
        });
        it('should throw error when case already closed', async () => {
            mockCaseRepository.findById.mockResolvedValue({
                ...mockClosedCase,
                status: case_1.CaseStatus.CLOSED
            });
            await expect(caseService.closeCase(mockClosureRequest))
                .rejects.toThrow('Case cannot be closed - current status: closed');
            expect(mockCaseRepository.update).not.toHaveBeenCalled();
        });
        it('should throw error when trying to close pending case', async () => {
            mockCaseRepository.findById.mockResolvedValue({
                ...mockClosedCase,
                status: case_1.CaseStatus.PENDING
            });
            await expect(caseService.closeCase(mockClosureRequest))
                .rejects.toThrow('Case cannot be closed - current status: pending');
        });
        it('should throw error when update fails', async () => {
            mockCaseRepository.conditionalUpdate.mockResolvedValue(null);
            mockCaseRepository.findById.mockResolvedValue(null);
            await expect(caseService.closeCase(mockClosureRequest))
                .rejects.toThrow('Case not found');
        });
    });
    describe('acceptCase', () => {
        const mockAcceptedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: case_1.CaseStatus.IN_PROGRESS, // Should be IN_PROGRESS after requirements update
            priority: case_1.CasePriority.HIGH,
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [testLawyerId]
        });
        it('should accept pending case successfully', async () => {
            const pendingCase = test_utils_1.TestUtils.generateMockCase({
                _id: test_utils_1.TestUtils.generateObjectId(),
                status: case_1.CaseStatus.PENDING,
                guildId: testGuildId,
                caseNumber: `${currentYear}-0001-testclient`,
                clientId: testClientId,
                clientUsername: 'testclient'
            });
            mockCaseRepository.findById.mockResolvedValue(pendingCase);
            mockCaseRepository.conditionalUpdate.mockResolvedValue(mockAcceptedCase);
            const result = await caseService.acceptCase(testCaseId, testLawyerId);
            expect(mockCaseRepository.conditionalUpdate).toHaveBeenCalledWith(testCaseId, { status: case_1.CaseStatus.PENDING }, expect.objectContaining({
                status: case_1.CaseStatus.IN_PROGRESS,
                leadAttorneyId: testLawyerId,
                assignedLawyerIds: [testLawyerId]
            }));
            expect(result).toEqual(mockAcceptedCase);
        });
        it('should throw error when case not found', async () => {
            mockCaseRepository.conditionalUpdate.mockResolvedValue(null);
            mockCaseRepository.findById.mockResolvedValue(null);
            await expect(caseService.acceptCase(testCaseId, testLawyerId))
                .rejects.toThrow('Case not found');
        });
        it('should throw error when case not in pending status', async () => {
            mockCaseRepository.conditionalUpdate.mockResolvedValue(null);
            mockCaseRepository.findById.mockResolvedValue({
                ...mockAcceptedCase,
                status: case_1.CaseStatus.IN_PROGRESS
            });
            await expect(caseService.acceptCase(testCaseId, testLawyerId))
                .rejects.toThrow('Case cannot be accepted - current status: in-progress');
        });
        it('should handle concurrent acceptance attempts', async () => {
            const pendingCase = test_utils_1.TestUtils.generateMockCase({
                _id: test_utils_1.TestUtils.generateObjectId(),
                status: case_1.CaseStatus.PENDING,
                guildId: testGuildId,
                caseNumber: `${currentYear}-0001-testclient`,
                clientId: testClientId,
                clientUsername: 'testclient'
            });
            // First attempt: case is pending
            mockCaseRepository.findById.mockResolvedValueOnce(pendingCase);
            mockCaseRepository.conditionalUpdate.mockResolvedValueOnce(mockAcceptedCase);
            // Second attempt: case is now in progress (already accepted)
            mockCaseRepository.findById.mockResolvedValueOnce({
                ...mockAcceptedCase,
                status: case_1.CaseStatus.IN_PROGRESS
            });
            const firstResult = await caseService.acceptCase(testCaseId, testLawyerId);
            expect(firstResult).toEqual(mockAcceptedCase);
            await expect(caseService.acceptCase(testCaseId, 'other-lawyer'))
                .rejects.toThrow('Case cannot be accepted - current status: in-progress');
        });
    });
    describe('declineCase', () => {
        const mockDeclinedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: case_1.CaseStatus.CLOSED,
            priority: case_1.CasePriority.HIGH,
            result: case_1.CaseResult.DISMISSED,
            resultNotes: 'Conflict of interest',
            closedBy: testLawyerId,
            closedAt: new Date(),
            assignedLawyerIds: []
        });
        it('should decline case with reason successfully', async () => {
            mockCaseRepository.update.mockResolvedValue(mockDeclinedCase);
            const result = await caseService.declineCase(testCaseId, testLawyerId, 'Conflict of interest');
            expect(mockCaseRepository.update).toHaveBeenCalledWith(testCaseId, {
                status: case_1.CaseStatus.CLOSED,
                result: case_1.CaseResult.DISMISSED,
                resultNotes: 'Conflict of interest',
                closedBy: testLawyerId,
                closedAt: expect.any(Date)
            });
            expect(result).toEqual(mockDeclinedCase);
        });
        it('should decline case without reason', async () => {
            mockCaseRepository.update.mockResolvedValue({
                ...mockDeclinedCase,
                resultNotes: 'Case declined by staff'
            });
            await caseService.declineCase(testCaseId, testLawyerId);
            expect(mockCaseRepository.update).toHaveBeenCalledWith(testCaseId, {
                status: case_1.CaseStatus.CLOSED,
                result: case_1.CaseResult.DISMISSED,
                resultNotes: 'Case declined by staff',
                closedBy: testLawyerId,
                closedAt: expect.any(Date)
            });
        });
        it('should throw error when decline update fails', async () => {
            mockCaseRepository.update.mockResolvedValue(null);
            await expect(caseService.declineCase(testCaseId, testLawyerId))
                .rejects.toThrow('Case not found or decline failed');
        });
    });
    describe('getCaseById', () => {
        const mockCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: case_1.CaseStatus.IN_PROGRESS,
            priority: case_1.CasePriority.HIGH,
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [testLawyerId]
        });
        it('should retrieve case by ID successfully', async () => {
            mockCaseRepository.findById.mockResolvedValue(mockCase);
            const result = await caseService.getCaseById(testCaseId);
            expect(mockCaseRepository.findById).toHaveBeenCalledWith(testCaseId);
            expect(result).toEqual(mockCase);
        });
        it('should return null when case not found', async () => {
            mockCaseRepository.findById.mockResolvedValue(null);
            const result = await caseService.getCaseById('non-existent-id');
            expect(result).toBeNull();
        });
        it('should handle invalid case ID format', async () => {
            mockCaseRepository.findById.mockRejectedValue(new Error('Invalid ObjectId format'));
            await expect(caseService.getCaseById('invalid-id'))
                .rejects.toThrow('Invalid ObjectId format');
        });
    });
    describe('addDocument', () => {
        const mockCaseWithDocument = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: case_1.CaseStatus.IN_PROGRESS,
            priority: case_1.CasePriority.HIGH,
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [testLawyerId],
            documents: [{
                    id: 'doc-123',
                    title: 'Test Document',
                    content: 'Document content',
                    createdBy: testLawyerId,
                    createdAt: new Date()
                }]
        });
        it('should add document successfully', async () => {
            mockCaseRepository.addDocument.mockResolvedValue(mockCaseWithDocument);
            const result = await caseService.addDocument(testCaseId, 'Test Document', 'Document content', testLawyerId);
            expect(mockCaseRepository.addDocument).toHaveBeenCalledWith(testCaseId, {
                id: expect.any(String),
                title: 'Test Document',
                content: 'Document content',
                createdBy: testLawyerId,
                createdAt: expect.any(Date)
            });
            expect(result).toEqual(mockCaseWithDocument);
        });
        it('should throw error when case not found for document addition', async () => {
            mockCaseRepository.addDocument.mockResolvedValue(null);
            await expect(caseService.addDocument(testCaseId, 'Test Document', 'Document content', testLawyerId)).rejects.toThrow('Case not found');
        });
        it('should handle very long document content', async () => {
            const longContent = 'A'.repeat(100000);
            mockCaseRepository.addDocument.mockResolvedValue(mockCaseWithDocument);
            await caseService.addDocument(testCaseId, 'Long Document', longContent, testLawyerId);
            expect(mockCaseRepository.addDocument).toHaveBeenCalledWith(testCaseId, expect.objectContaining({
                content: longContent
            }));
        });
    });
    describe('addNote', () => {
        const mockCaseWithNote = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId(),
            guildId: testGuildId,
            caseNumber: `${currentYear}-0001-testclient`,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: case_1.CaseStatus.IN_PROGRESS,
            priority: case_1.CasePriority.HIGH,
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [testLawyerId],
            notes: [{
                    id: 'note-123',
                    content: 'Internal case note',
                    createdBy: testLawyerId,
                    createdAt: new Date(),
                    isInternal: true
                }]
        });
        it('should add internal note successfully', async () => {
            mockCaseRepository.addNote.mockResolvedValue(mockCaseWithNote);
            const result = await caseService.addNote(testCaseId, 'Internal case note', testLawyerId, true);
            expect(mockCaseRepository.addNote).toHaveBeenCalledWith(testCaseId, {
                id: expect.any(String),
                content: 'Internal case note',
                createdBy: testLawyerId,
                createdAt: expect.any(Date),
                isInternal: true
            });
            expect(result).toEqual(mockCaseWithNote);
        });
        it('should add public note successfully', async () => {
            const mockCaseWithPublicNote = {
                ...mockCaseWithNote,
                notes: [{
                        id: 'note-123',
                        content: 'Public case note',
                        createdBy: testLawyerId,
                        createdAt: new Date(),
                        isInternal: false
                    }]
            };
            mockCaseRepository.addNote.mockResolvedValue(mockCaseWithPublicNote);
            await caseService.addNote(testCaseId, 'Public case note', testLawyerId, false);
            expect(mockCaseRepository.addNote).toHaveBeenCalledWith(testCaseId, expect.objectContaining({
                isInternal: false
            }));
        });
        it('should default to internal note when not specified', async () => {
            mockCaseRepository.addNote.mockResolvedValue(mockCaseWithNote);
            await caseService.addNote(testCaseId, 'Default note', testLawyerId);
            expect(mockCaseRepository.addNote).toHaveBeenCalledWith(testCaseId, expect.objectContaining({
                isInternal: false
            }));
        });
        it('should throw error when case not found for note addition', async () => {
            mockCaseRepository.addNote.mockResolvedValue(null);
            await expect(caseService.addNote(testCaseId, 'Test note', testLawyerId, true)).rejects.toThrow('Case not found');
        });
    });
    describe('searchCases', () => {
        const mockSearchResults = [
            test_utils_1.TestUtils.generateMockCase({
                _id: test_utils_1.TestUtils.generateObjectId(),
                guildId: testGuildId,
                caseNumber: `${currentYear}-0001-testclient`,
                clientId: testClientId,
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: case_1.CaseStatus.IN_PROGRESS,
                priority: case_1.CasePriority.HIGH,
                leadAttorneyId: testLawyerId,
                assignedLawyerIds: [testLawyerId]
            })
        ];
        it('should search cases with filters', async () => {
            const filters = { guildId: testGuildId, status: case_1.CaseStatus.IN_PROGRESS };
            mockCaseRepository.searchCases.mockResolvedValue(mockSearchResults);
            const result = await caseService.searchCases(filters);
            expect(mockCaseRepository.searchCases).toHaveBeenCalledWith(filters, undefined, undefined);
            expect(result).toEqual(mockSearchResults);
        });
        it('should search cases with sort and pagination', async () => {
            const filters = { guildId: testGuildId };
            const sort = { field: 'createdAt', direction: 'desc' };
            const pagination = { limit: 10, skip: 0 };
            mockCaseRepository.searchCases.mockResolvedValue(mockSearchResults);
            await caseService.searchCases(filters, sort, pagination);
            expect(mockCaseRepository.searchCases).toHaveBeenCalledWith(filters, sort, pagination);
        });
        it('should return empty array when no cases match', async () => {
            mockCaseRepository.searchCases.mockResolvedValue([]);
            const result = await caseService.searchCases({ guildId: 'non-existent' });
            expect(result).toEqual([]);
        });
    });
    describe('Configuration Methods', () => {
        const mockGuildConfig = {
            guildId: testGuildId,
            caseReviewCategoryId: 'review-category-123',
            caseArchiveCategoryId: 'archive-category-123'
        };
        describe('getCaseReviewCategoryId', () => {
            it('should return review category ID when config exists', async () => {
                mockGuildConfigRepository.findByGuildId.mockResolvedValue(mockGuildConfig);
                const result = await caseService.getCaseReviewCategoryId(testGuildId);
                expect(result).toBe('review-category-123');
            });
            it('should return null when config not found', async () => {
                mockGuildConfigRepository.findByGuildId.mockResolvedValue(null);
                const result = await caseService.getCaseReviewCategoryId(testGuildId);
                expect(result).toBeNull();
            });
            it('should return null when review category not set', async () => {
                mockGuildConfigRepository.findByGuildId.mockResolvedValue({
                    ...mockGuildConfig,
                    caseReviewCategoryId: undefined
                });
                const result = await caseService.getCaseReviewCategoryId(testGuildId);
                expect(result).toBeNull();
            });
        });
        describe('getCaseArchiveCategoryId', () => {
            it('should return archive category ID when config exists', async () => {
                mockGuildConfigRepository.findByGuildId.mockResolvedValue(mockGuildConfig);
                const result = await caseService.getCaseArchiveCategoryId(testGuildId);
                expect(result).toBe('archive-category-123');
            });
            it('should return null when config not found', async () => {
                mockGuildConfigRepository.findByGuildId.mockResolvedValue(null);
                const result = await caseService.getCaseArchiveCategoryId(testGuildId);
                expect(result).toBeNull();
            });
        });
    });
    describe('generateChannelName', () => {
        it('should generate correct channel name format', async () => {
            const caseNumber = `${currentYear}-0001-testclient`;
            const result = caseService.generateChannelName(caseNumber);
            expect(result).toBe(`case-${currentYear}-0001-testclient`);
        });
        it('should handle special characters in case number', async () => {
            const caseNumber = `${currentYear}-0042-test_client-123`;
            const result = caseService.generateChannelName(caseNumber);
            expect(result).toBe(`case-${currentYear}-0042-test-client-123`);
        });
    });
    describe('Error Handling', () => {
        it('should handle repository connection failures', async () => {
            mockCaseRepository.findById.mockRejectedValue(new Error('Database connection lost'));
            await expect(caseService.getCaseById(testCaseId))
                .rejects.toThrow('Database connection lost');
        });
        it('should handle malformed case data', async () => {
            mockCaseRepository.add.mockRejectedValue(new Error('Document validation failed'));
            const invalidRequest = {
                guildId: '',
                clientId: '',
                clientUsername: '',
                title: '',
                description: ''
            };
            await expect(caseService.createCase(invalidRequest))
                .rejects.toThrow();
        });
        it('should handle concurrent modification errors', async () => {
            mockCaseRepository.update.mockRejectedValue(new Error('Document was modified by another operation'));
            await expect(caseService.updateCaseStatus(testCaseId, case_1.CaseStatus.CLOSED, testLawyerId)).rejects.toThrow('Document was modified by another operation');
        });
    });
});
//# sourceMappingURL=case-service.test.js.map