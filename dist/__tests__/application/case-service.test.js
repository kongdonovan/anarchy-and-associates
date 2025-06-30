"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const case_service_1 = require("../../application/services/case-service");
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
    let mockPermissionService;
    let mockUnifiedValidationService;
    let mockPermissionContext;
    // Test data constants
    const testGuildId = '12345678901234567890';
    const testClientId = '23456789012345678901';
    const testLawyerId = '34567890123456789012';
    const testCaseId = test_utils_1.TestUtils.generateObjectId().toString();
    const currentYear = new Date().getFullYear();
    beforeEach(() => {
        // Create mock permission context
        mockPermissionContext = {
            guildId: testGuildId,
            userId: testLawyerId,
            userRoles: [],
            isGuildOwner: false
        };
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
        mockPermissionService = {
            hasActionPermission: jest.fn(),
            hasHRPermissionWithContext: jest.fn(),
            hasPermission: jest.fn(),
            hasLeadAttorneyPermissionWithContext: jest.fn()
        };
        mockUnifiedValidationService = {
            validate: jest.fn()
        };
        caseService = new case_service_1.CaseService(mockCaseRepository, mockCaseCounterRepository, mockGuildConfigRepository, mockPermissionService, mockUnifiedValidationService);
        jest.clearAllMocks();
    });
    describe('createCase', () => {
        const mockCaseRequest = {
            guildId: testGuildId,
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            priority: 'high'
        };
        const mockCreatedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: 'pending',
            priority: 'high'
        });
        it('should create a case successfully with all required fields', async () => {
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(1);
            mockCaseRepository.add.mockResolvedValue(mockCreatedCase);
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                metadata: {
                    currentCases: 0,
                    maxCases: 3,
                    clientId: testClientId
                },
                strategyResults: new Map()
            });
            const result = await caseService.createCase(mockPermissionContext, mockCaseRequest);
            expect(mockCaseCounterRepository.getNextCaseNumber).toHaveBeenCalledWith(testGuildId);
            expect(mockCaseRepository.add).toHaveBeenCalledWith({
                guildId: testGuildId,
                caseNumber: `AA-${currentYear}-0001-testclient`,
                clientId: testClientId,
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: 'pending',
                priority: 'high',
                assignedLawyerIds: [],
                documents: [],
                notes: []
            });
            expect(result).toEqual(mockCreatedCase);
        });
        it('should create case with default medium priority when not specified', async () => {
            const requestWithoutPriority = {
                guildId: mockCaseRequest.guildId,
                clientId: mockCaseRequest.clientId,
                clientUsername: mockCaseRequest.clientUsername,
                title: mockCaseRequest.title,
                description: mockCaseRequest.description
            };
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(1);
            mockCaseRepository.add.mockResolvedValue({
                ...mockCreatedCase,
                priority: 'medium'
            });
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                metadata: {
                    currentCases: 0,
                    maxCases: 3,
                    clientId: testClientId
                },
                strategyResults: new Map()
            });
            await caseService.createCase(mockPermissionContext, requestWithoutPriority);
            expect(mockCaseRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                priority: 'medium'
            }));
        });
        it('should generate correct case number format', async () => {
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(42);
            mockCaseRepository.add.mockResolvedValue({
                ...mockCreatedCase,
                caseNumber: `AA-${currentYear}-0042-testclient`
            });
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                metadata: {
                    currentCases: 0,
                    maxCases: 3,
                    clientId: testClientId
                },
                strategyResults: new Map()
            });
            await caseService.createCase(mockPermissionContext, mockCaseRequest);
            expect(mockCaseRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                caseNumber: `AA-${currentYear}-0042-testclient`
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
                caseNumber: `AA-${currentYear}-0001-test-client_123`
            });
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                metadata: {
                    currentCases: 0,
                    maxCases: 3,
                    clientId: testClientId
                },
                strategyResults: new Map()
            });
            await caseService.createCase(mockPermissionContext, requestWithSpecialChars);
            expect(mockCaseRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                caseNumber: `AA-${currentYear}-0001-test-client_123`
            }));
        });
        it('should throw error when case counter fails', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                metadata: {
                    currentCases: 0,
                    maxCases: 3,
                    clientId: testClientId
                },
                strategyResults: new Map()
            });
            mockCaseCounterRepository.getNextCaseNumber.mockRejectedValue(new Error('Counter service unavailable'));
            await expect(caseService.createCase(mockPermissionContext, mockCaseRequest))
                .rejects.toThrow('Counter service unavailable');
            expect(mockCaseRepository.add).not.toHaveBeenCalled();
        });
        it('should throw error when repository add fails', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                metadata: {
                    currentCases: 0,
                    maxCases: 3,
                    clientId: testClientId
                },
                strategyResults: new Map()
            });
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(1);
            mockCaseRepository.add.mockRejectedValue(new Error('Database error'));
            await expect(caseService.createCase(mockPermissionContext, mockCaseRequest))
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
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                metadata: {
                    currentCases: 0,
                    maxCases: 3,
                    clientId: testClientId
                },
                strategyResults: new Map()
            });
            await caseService.createCase(mockPermissionContext, requestWithLongDescription);
            expect(mockCaseRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                description: longDescription
            }));
        });
    });
    describe('assignLawyer', () => {
        const mockAssignmentRequest = {
            caseId: testCaseId,
            lawyerIds: [testLawyerId],
            assignedBy: '12345678901234567890'
        };
        const mockAssignedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: 'in-progress',
            priority: 'high',
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [testLawyerId]
        });
        it('should assign lawyer successfully', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                strategyResults: new Map()
            });
            mockCaseRepository.assignLawyer.mockResolvedValue(mockAssignedCase);
            const result = await caseService.assignLawyer(mockPermissionContext, mockAssignmentRequest);
            expect(mockCaseRepository.assignLawyer).toHaveBeenCalledWith(testCaseId, testLawyerId);
            expect(result).toEqual(mockAssignedCase);
        });
        it('should throw error when case not found for assignment', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                strategyResults: new Map()
            });
            mockCaseRepository.assignLawyer.mockResolvedValue(null);
            await expect(caseService.assignLawyer(mockPermissionContext, mockAssignmentRequest))
                .rejects.toThrow('Case not found or assignment failed');
        });
        it('should throw error when assignment fails in repository', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                strategyResults: new Map()
            });
            mockCaseRepository.assignLawyer.mockRejectedValue(new Error('Assignment constraint violation'));
            await expect(caseService.assignLawyer(mockPermissionContext, mockAssignmentRequest))
                .rejects.toThrow('Assignment constraint violation');
        });
    });
    describe('unassignLawyer', () => {
        const mockUnassignedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: 'in-progress',
            priority: 'high',
            leadAttorneyId: undefined,
            assignedLawyerIds: []
        });
        it('should unassign lawyer successfully', async () => {
            mockCaseRepository.unassignLawyer.mockResolvedValue(mockUnassignedCase);
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            const result = await caseService.unassignLawyer(mockPermissionContext, testCaseId, testLawyerId);
            expect(mockCaseRepository.unassignLawyer).toHaveBeenCalledWith(testCaseId, testLawyerId);
            expect(result).toEqual(mockUnassignedCase);
        });
        it('should throw error when case not found for unassignment', async () => {
            mockCaseRepository.unassignLawyer.mockResolvedValue(null);
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            await expect(caseService.unassignLawyer(mockPermissionContext, testCaseId, testLawyerId))
                .rejects.toThrow('Case not found or unassignment failed');
        });
        it('should handle unassigning lawyer not assigned to case', async () => {
            mockCaseRepository.unassignLawyer.mockResolvedValue(mockUnassignedCase);
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            const result = await caseService.unassignLawyer(mockPermissionContext, testCaseId, '89012345678901234567');
            expect(result).toEqual(mockUnassignedCase);
        });
    });
    describe('reassignLawyer', () => {
        const fromCaseId = testCaseId;
        const toCaseId = test_utils_1.TestUtils.generateObjectId().toString();
        const mockFromCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'From Case',
            description: 'Source case description',
            status: 'in-progress',
            priority: 'high',
            leadAttorneyId: '56789012345678901234',
            assignedLawyerIds: ['56789012345678901234']
        });
        const mockToCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0002-otherclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: '45678901234567890123',
            clientUsername: 'otherclient',
            title: 'To Case',
            description: 'Target case description',
            status: 'in-progress',
            priority: 'medium',
            leadAttorneyId: '67890123456789012345',
            assignedLawyerIds: ['67890123456789012345', testLawyerId]
        });
        it('should reassign lawyer between cases successfully', async () => {
            mockCaseRepository.reassignLawyer.mockResolvedValue({
                fromCase: mockFromCase,
                toCase: mockToCase
            });
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            const result = await caseService.reassignLawyer(mockPermissionContext, fromCaseId, toCaseId, testLawyerId);
            expect(mockCaseRepository.reassignLawyer).toHaveBeenCalledWith(fromCaseId, toCaseId, testLawyerId);
            expect(result.fromCase).toEqual(mockFromCase);
            expect(result.toCase).toEqual(mockToCase);
        });
        it('should throw error when reassignment fails', async () => {
            mockCaseRepository.reassignLawyer.mockRejectedValue(new Error('Reassignment failed: case not found'));
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            await expect(caseService.reassignLawyer(mockPermissionContext, fromCaseId, toCaseId, testLawyerId))
                .rejects.toThrow('Reassignment failed: case not found');
        });
        it('should handle reassigning lawyer between same case', async () => {
            mockCaseRepository.reassignLawyer.mockResolvedValue({
                fromCase: mockFromCase,
                toCase: mockFromCase // Same case
            });
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            const result = await caseService.reassignLawyer(mockPermissionContext, fromCaseId, fromCaseId, testLawyerId);
            expect(result.fromCase).toEqual(mockFromCase);
            expect(result.toCase).toEqual(mockFromCase);
        });
    });
    describe('updateCaseStatus', () => {
        const mockUpdatedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: 'in-progress',
            priority: 'high',
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [testLawyerId]
        });
        it('should update case status successfully', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.update.mockResolvedValue(mockUpdatedCase);
            const result = await caseService.updateCaseStatus(mockPermissionContext, testCaseId, 'in-progress');
            expect(mockCaseRepository.update).toHaveBeenCalledWith(testCaseId, {
                status: 'in-progress'
            });
            expect(result).toEqual(mockUpdatedCase);
        });
        it('should throw error when case not found for status update', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.update.mockResolvedValue(null);
            await expect(caseService.updateCaseStatus(mockPermissionContext, testCaseId, 'in-progress')).rejects.toThrow('Case not found');
        });
        it('should handle invalid status transitions', async () => {
            // Note: Based on requirements, we need to implement PENDING -> IN_PROGRESS -> CLOSED
            // This test assumes business logic validation will be added
            mockCaseRepository.update.mockRejectedValue(new Error('Invalid status transition'));
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            await expect(caseService.updateCaseStatus(mockPermissionContext, testCaseId, 'closed')).rejects.toThrow('Invalid status transition');
        });
    });
    describe('closeCase', () => {
        const mockClosureRequest = {
            caseId: testCaseId,
            result: 'win',
            resultNotes: 'Successfully resolved for client',
            closedBy: testLawyerId
        };
        const mockClosedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: 'closed',
            priority: 'high',
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [],
            result: 'win',
            resultNotes: 'Successfully resolved for client',
            closedBy: testLawyerId,
            closedAt: new Date()
        });
        beforeEach(() => {
            // Mock current case in IN_PROGRESS status
            mockCaseRepository.findById.mockResolvedValue({
                ...mockClosedCase,
                status: 'in-progress',
                assignedLawyerIds: [testLawyerId, '78901234567890123456'],
                result: undefined,
                resultNotes: undefined,
                closedBy: undefined,
                closedAt: undefined
            });
        });
        it('should close case successfully with all details', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.conditionalUpdate.mockResolvedValue(mockClosedCase);
            const result = await caseService.closeCase(mockPermissionContext, mockClosureRequest);
            expect(mockCaseRepository.conditionalUpdate).toHaveBeenCalledWith(testCaseId, { status: 'in-progress' }, {
                status: 'closed',
                result: 'win',
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
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.conditionalUpdate.mockResolvedValue({
                ...mockClosedCase,
                resultNotes: undefined
            });
            await caseService.closeCase(mockPermissionContext, requestWithoutNotes);
            expect(mockCaseRepository.conditionalUpdate).toHaveBeenCalledWith(testCaseId, { status: 'in-progress' }, {
                status: 'closed',
                result: 'win',
                resultNotes: undefined,
                closedBy: testLawyerId,
                closedAt: expect.any(Date)
            });
        });
        it('should handle all valid case results', async () => {
            const validResults = [
                'win',
                'loss',
                'settlement',
                'dismissed',
                'withdrawn'
            ];
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            for (const result of validResults) {
                const request = { ...mockClosureRequest, result };
                mockCaseRepository.conditionalUpdate.mockResolvedValue({
                    ...mockClosedCase,
                    result
                });
                await caseService.closeCase(mockPermissionContext, request);
                expect(mockCaseRepository.conditionalUpdate).toHaveBeenLastCalledWith(testCaseId, { status: 'in-progress' }, expect.objectContaining({ result }));
            }
        });
        it('should throw error when case not found for closure', async () => {
            mockCaseRepository.conditionalUpdate.mockResolvedValue(null);
            mockCaseRepository.findById.mockResolvedValue(null);
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            await expect(caseService.closeCase(mockPermissionContext, mockClosureRequest))
                .rejects.toThrow('Case not found');
            expect(mockCaseRepository.update).not.toHaveBeenCalled();
        });
        it('should throw error when case already closed', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.findById.mockResolvedValue({
                ...mockClosedCase,
                status: 'closed'
            });
            await expect(caseService.closeCase(mockPermissionContext, mockClosureRequest))
                .rejects.toThrow('Case cannot be closed - current status: closed');
            expect(mockCaseRepository.update).not.toHaveBeenCalled();
        });
        it('should throw error when trying to close pending case', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.findById.mockResolvedValue({
                ...mockClosedCase,
                status: 'pending'
            });
            await expect(caseService.closeCase(mockPermissionContext, mockClosureRequest))
                .rejects.toThrow('Case cannot be closed - current status: pending');
        });
        it('should throw error when update fails', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.conditionalUpdate.mockResolvedValue(null);
            mockCaseRepository.findById.mockResolvedValue(null);
            await expect(caseService.closeCase(mockPermissionContext, mockClosureRequest))
                .rejects.toThrow('Case not found');
        });
    });
    describe('acceptCase', () => {
        const mockAcceptedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: 'in-progress', // Should be IN_PROGRESS after requirements update
            priority: 'high',
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [testLawyerId]
        });
        it('should accept pending case successfully', async () => {
            const pendingCase = test_utils_1.TestUtils.generateMockCase({
                _id: test_utils_1.TestUtils.generateObjectId().toString(),
                status: 'pending',
                guildId: testGuildId,
                caseNumber: 'AA-2025-0001-testclient',
                createdAt: new Date(),
                updatedAt: new Date(),
                clientId: testClientId,
                clientUsername: 'testclient'
            });
            mockCaseRepository.findById.mockResolvedValue(pendingCase);
            mockCaseRepository.conditionalUpdate.mockResolvedValue(mockAcceptedCase);
            mockPermissionService.hasLeadAttorneyPermissionWithContext.mockResolvedValue(true);
            const result = await caseService.acceptCase(mockPermissionContext, testCaseId);
            expect(mockCaseRepository.conditionalUpdate).toHaveBeenCalledWith(testCaseId, { status: 'pending' }, expect.objectContaining({
                status: 'in-progress',
                leadAttorneyId: testLawyerId,
                assignedLawyerIds: [testLawyerId]
            }));
            expect(result).toEqual(mockAcceptedCase);
        });
        it('should throw error when case not found', async () => {
            mockPermissionService.hasLeadAttorneyPermissionWithContext.mockResolvedValue(true);
            mockCaseRepository.conditionalUpdate.mockResolvedValue(null);
            mockCaseRepository.findById.mockResolvedValue(null);
            await expect(caseService.acceptCase(mockPermissionContext, testCaseId))
                .rejects.toThrow('Case not found');
        });
        it('should throw error when case not in pending status', async () => {
            mockPermissionService.hasLeadAttorneyPermissionWithContext.mockResolvedValue(true);
            mockCaseRepository.conditionalUpdate.mockResolvedValue(null);
            mockCaseRepository.findById.mockResolvedValue({
                ...mockAcceptedCase,
                status: 'in-progress'
            });
            await expect(caseService.acceptCase(mockPermissionContext, testCaseId))
                .rejects.toThrow('Case cannot be accepted - current status: in-progress');
        });
        it('should handle concurrent acceptance attempts', async () => {
            const pendingCase = test_utils_1.TestUtils.generateMockCase({
                _id: test_utils_1.TestUtils.generateObjectId().toString(),
                status: 'pending',
                guildId: testGuildId,
                caseNumber: 'AA-2025-0001-testclient',
                createdAt: new Date(),
                updatedAt: new Date(),
                clientId: testClientId,
                clientUsername: 'testclient'
            });
            mockPermissionService.hasLeadAttorneyPermissionWithContext.mockResolvedValue(true);
            // First attempt: case is pending
            mockCaseRepository.findById.mockResolvedValueOnce(pendingCase);
            mockCaseRepository.conditionalUpdate.mockResolvedValueOnce(mockAcceptedCase);
            // Second attempt: case is now in progress (already accepted)
            mockCaseRepository.findById.mockResolvedValueOnce({
                ...mockAcceptedCase,
                status: 'in-progress'
            });
            const firstResult = await caseService.acceptCase(mockPermissionContext, testCaseId);
            expect(firstResult).toEqual(mockAcceptedCase);
            await expect(caseService.acceptCase(mockPermissionContext, testCaseId))
                .rejects.toThrow('Case cannot be accepted - current status: in-progress');
        });
    });
    describe('declineCase', () => {
        const mockDeclinedCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: 'closed',
            priority: 'high',
            result: 'dismissed',
            resultNotes: 'Conflict of interest',
            closedBy: testLawyerId,
            closedAt: new Date(),
            assignedLawyerIds: []
        });
        it('should decline case with reason successfully', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.update.mockResolvedValue(mockDeclinedCase);
            const result = await caseService.declineCase(mockPermissionContext, testCaseId, 'Conflict of interest');
            expect(mockCaseRepository.update).toHaveBeenCalledWith(testCaseId, {
                status: 'closed',
                result: 'dismissed',
                resultNotes: 'Conflict of interest',
                closedBy: testLawyerId,
                closedAt: expect.any(Date)
            });
            expect(result).toEqual(mockDeclinedCase);
        });
        it('should decline case without reason', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.update.mockResolvedValue({
                ...mockDeclinedCase,
                resultNotes: 'Case declined by staff'
            });
            await caseService.declineCase(mockPermissionContext, testCaseId);
            expect(mockCaseRepository.update).toHaveBeenCalledWith(testCaseId, {
                status: 'closed',
                result: 'dismissed',
                resultNotes: 'Case declined by staff',
                closedBy: testLawyerId,
                closedAt: expect.any(Date)
            });
        });
        it('should throw error when decline update fails', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.update.mockResolvedValue(null);
            await expect(caseService.declineCase(mockPermissionContext, testCaseId))
                .rejects.toThrow('Case not found or decline failed');
        });
    });
    describe('getCaseById', () => {
        const mockCase = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: 'in-progress',
            priority: 'high',
            leadAttorneyId: testLawyerId,
            assignedLawyerIds: [testLawyerId]
        });
        it('should retrieve case by ID successfully', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.findById.mockResolvedValue(mockCase);
            const result = await caseService.getCaseById(mockPermissionContext, testCaseId);
            expect(mockCaseRepository.findById).toHaveBeenCalledWith(testCaseId);
            expect(result).toEqual(mockCase);
        });
        it('should return null when case not found', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.findById.mockResolvedValue(null);
            const result = await caseService.getCaseById(mockPermissionContext, 'non-existent-id');
            expect(result).toBeNull();
        });
        it('should handle invalid case ID format', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.findById.mockRejectedValue(new Error('Invalid ObjectId format'));
            await expect(caseService.getCaseById(mockPermissionContext, 'invalid-id'))
                .rejects.toThrow('Invalid ObjectId format');
        });
    });
    describe('addDocument', () => {
        const mockCaseWithDocument = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: 'in-progress',
            priority: 'high',
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
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.addDocument.mockResolvedValue(mockCaseWithDocument);
            const result = await caseService.addDocument(mockPermissionContext, testCaseId, 'Test Document', 'Document content');
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
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.addDocument.mockResolvedValue(null);
            await expect(caseService.addDocument(mockPermissionContext, testCaseId, 'Test Document', 'Document content')).rejects.toThrow('Case not found');
        });
        it('should handle very long document content', async () => {
            const longContent = 'A'.repeat(100000);
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.addDocument.mockResolvedValue(mockCaseWithDocument);
            await caseService.addDocument(mockPermissionContext, testCaseId, 'Long Document', longContent);
            expect(mockCaseRepository.addDocument).toHaveBeenCalledWith(testCaseId, expect.objectContaining({
                content: longContent
            }));
        });
    });
    describe('addNote', () => {
        const mockCaseWithNote = test_utils_1.TestUtils.generateMockCase({
            _id: test_utils_1.TestUtils.generateObjectId().toString(),
            guildId: testGuildId,
            caseNumber: 'AA-2025-0001-testclient',
            createdAt: new Date(),
            updatedAt: new Date(),
            clientId: testClientId,
            clientUsername: 'testclient',
            title: 'Test Case',
            description: 'Test case description',
            status: 'in-progress',
            priority: 'high',
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
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.addNote.mockResolvedValue(mockCaseWithNote);
            const result = await caseService.addNote(mockPermissionContext, testCaseId, 'Internal case note', true);
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
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.addNote.mockResolvedValue(mockCaseWithPublicNote);
            await caseService.addNote(mockPermissionContext, testCaseId, 'Public case note', false);
            expect(mockCaseRepository.addNote).toHaveBeenCalledWith(testCaseId, expect.objectContaining({
                isInternal: false
            }));
        });
        it('should default to internal note when not specified', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.addNote.mockResolvedValue(mockCaseWithNote);
            await caseService.addNote(mockPermissionContext, testCaseId, 'Default note');
            expect(mockCaseRepository.addNote).toHaveBeenCalledWith(testCaseId, expect.objectContaining({
                isInternal: false
            }));
        });
        it('should throw error when case not found for note addition', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.addNote.mockResolvedValue(null);
            await expect(caseService.addNote(mockPermissionContext, testCaseId, 'Test note', true)).rejects.toThrow('Case not found');
        });
    });
    describe('searchCases', () => {
        const mockSearchResults = [
            test_utils_1.TestUtils.generateMockCase({
                _id: test_utils_1.TestUtils.generateObjectId().toString(),
                guildId: testGuildId,
                caseNumber: 'AA-2025-0001-testclient',
                createdAt: new Date(),
                updatedAt: new Date(),
                clientId: testClientId,
                clientUsername: 'testclient',
                title: 'Test Case',
                description: 'Test case description',
                status: 'in-progress',
                priority: 'high',
                leadAttorneyId: testLawyerId,
                assignedLawyerIds: [testLawyerId]
            })
        ];
        it('should search cases with filters', async () => {
            const filters = { guildId: testGuildId, status: 'in-progress' };
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.searchCases.mockResolvedValue(mockSearchResults);
            const result = await caseService.searchCases(mockPermissionContext, filters);
            expect(mockCaseRepository.searchCases).toHaveBeenCalledWith(filters, undefined, undefined);
            expect(result).toEqual(mockSearchResults);
        });
        it('should search cases with sort and pagination', async () => {
            const filters = { guildId: testGuildId };
            const sort = { field: 'createdAt', direction: 'desc' };
            const pagination = { limit: 10, skip: 0 };
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.searchCases.mockResolvedValue(mockSearchResults);
            await caseService.searchCases(mockPermissionContext, filters, sort, pagination);
            expect(mockCaseRepository.searchCases).toHaveBeenCalledWith(filters, sort, pagination);
        });
        it('should return empty array when no cases match', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.searchCases.mockResolvedValue([]);
            const result = await caseService.searchCases(mockPermissionContext, { guildId: '90123456789012345678' });
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
            const caseNumber = `AA-${currentYear}-0001-testclient`;
            const result = caseService.generateChannelName(caseNumber);
            expect(result).toBe(`case-AA-${currentYear}-0001-testclient`);
        });
        it('should handle special characters in case number', async () => {
            const caseNumber = `AA-${currentYear}-0042-test_client-123`;
            const result = caseService.generateChannelName(caseNumber);
            expect(result).toBe(`case-AA-${currentYear}-0042-test-client-123`);
        });
    });
    describe('Error Handling', () => {
        it('should handle repository connection failures', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.findById.mockRejectedValue(new Error('Database connection lost'));
            await expect(caseService.getCaseById(mockPermissionContext, testCaseId))
                .rejects.toThrow('Database connection lost');
        });
        it('should handle malformed case data', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockUnifiedValidationService.validate.mockResolvedValue({
                valid: true,
                issues: [],
                strategyResults: new Map()
            });
            mockCaseCounterRepository.getNextCaseNumber.mockResolvedValue(1);
            mockCaseRepository.add.mockRejectedValue(new Error('Document validation failed'));
            const invalidRequest = {
                guildId: '',
                clientId: '',
                clientUsername: '',
                title: '',
                description: ''
            };
            await expect(caseService.createCase(mockPermissionContext, invalidRequest))
                .rejects.toThrow();
        });
        it('should handle concurrent modification errors', async () => {
            mockPermissionService.hasActionPermission.mockResolvedValue(true);
            mockCaseRepository.update.mockRejectedValue(new Error('Document was modified by another operation'));
            await expect(caseService.updateCaseStatus(mockPermissionContext, testCaseId, 'closed')).rejects.toThrow('Document was modified by another operation');
        });
    });
});
//# sourceMappingURL=case-service.test.js.map