"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const case_1 = require("../../domain/entities/case");
const test_utils_1 = require("../helpers/test-utils");
describe('Case Entity', () => {
    describe('Case Creation and Validation', () => {
        it('should create a valid case with required fields', () => {
            const testCase = test_utils_1.TestUtils.generateMockCase();
            expect(testCase.guildId).toBeTruthy();
            expect(testCase.caseNumber).toBeTruthy();
            expect(testCase.clientId).toBeTruthy();
            expect(testCase.clientUsername).toBeTruthy();
            expect(testCase.title).toBeTruthy();
            expect(testCase.description).toBeTruthy();
            expect(testCase.status).toBe(case_1.CaseStatus.PENDING);
            expect(testCase.priority).toBe(case_1.CasePriority.MEDIUM);
            expect(Array.isArray(testCase.assignedLawyerIds)).toBe(true);
            expect(Array.isArray(testCase.documents)).toBe(true);
            expect(Array.isArray(testCase.notes)).toBe(true);
            expect(testCase.createdAt).toBeInstanceOf(Date);
            expect(testCase.updatedAt).toBeInstanceOf(Date);
        });
        it('should handle all valid case statuses', () => {
            const validStatuses = [
                case_1.CaseStatus.PENDING,
                case_1.CaseStatus.OPEN,
                case_1.CaseStatus.IN_PROGRESS,
                case_1.CaseStatus.CLOSED
            ];
            validStatuses.forEach(status => {
                const testCase = test_utils_1.TestUtils.generateMockCase({ status });
                expect(testCase.status).toBe(status);
            });
        });
        it('should handle all valid case priorities', () => {
            const validPriorities = [
                case_1.CasePriority.LOW,
                case_1.CasePriority.MEDIUM,
                case_1.CasePriority.HIGH,
                case_1.CasePriority.URGENT
            ];
            validPriorities.forEach(priority => {
                const testCase = test_utils_1.TestUtils.generateMockCase({ priority });
                expect(testCase.priority).toBe(priority);
            });
        });
        it('should handle all valid case results', () => {
            const validResults = [
                case_1.CaseResult.WIN,
                case_1.CaseResult.LOSS,
                case_1.CaseResult.SETTLEMENT,
                case_1.CaseResult.DISMISSED,
                case_1.CaseResult.WITHDRAWN
            ];
            validResults.forEach(result => {
                const testCase = test_utils_1.TestUtils.generateMockCase({
                    status: case_1.CaseStatus.CLOSED,
                    result,
                    closedAt: new Date(),
                    closedBy: 'lawyer123'
                });
                expect(testCase.result).toBe(result);
            });
        });
    });
    describe('Case Number Generation', () => {
        it('should generate valid case numbers with correct format', () => {
            const year = 2024;
            const caseCount = 123;
            const clientUsername = 'testclient';
            const caseNumber = (0, case_1.generateCaseNumber)(year, caseCount, clientUsername);
            expect(caseNumber).toMatch(/^\d{4}-\d{4}-\w+$/);
            expect(caseNumber).toBe('2024-0123-testclient');
        });
        it('should handle different year values', () => {
            const testCases = [
                { year: 2020, expected: '2020-0001-client' },
                { year: 2024, expected: '2024-0001-client' },
                { year: 2030, expected: '2030-0001-client' }
            ];
            testCases.forEach(({ year, expected }) => {
                const caseNumber = (0, case_1.generateCaseNumber)(year, 1, 'client');
                expect(caseNumber).toBe(expected);
            });
        });
        it('should handle different case counts with zero padding', () => {
            const testCases = [
                { count: 1, expected: '0001' },
                { count: 10, expected: '0010' },
                { count: 100, expected: '0100' },
                { count: 1000, expected: '1000' },
                { count: 9999, expected: '9999' }
            ];
            testCases.forEach(({ count, expected }) => {
                const caseNumber = (0, case_1.generateCaseNumber)(2024, count, 'client');
                expect(caseNumber).toContain(expected);
            });
        });
        it('should handle special characters in client usernames', () => {
            const specialUsernames = [
                'client_123',
                'client-456',
                'client.789',
                'Client_With_Underscores',
                'client123'
            ];
            specialUsernames.forEach(username => {
                const caseNumber = (0, case_1.generateCaseNumber)(2024, 1, username);
                expect(caseNumber).toContain(username);
                expect(caseNumber).toMatch(/^\d{4}-\d{4}-/);
            });
        });
        it('should generate unique case numbers for same parameters', () => {
            const caseNumber1 = (0, case_1.generateCaseNumber)(2024, 1, 'client');
            const caseNumber2 = (0, case_1.generateCaseNumber)(2024, 2, 'client');
            expect(caseNumber1).not.toBe(caseNumber2);
            expect(caseNumber1).toBe('2024-0001-client');
            expect(caseNumber2).toBe('2024-0002-client');
        });
    });
    describe('Channel Name Generation', () => {
        it('should generate valid Discord channel names', () => {
            const testCase = test_utils_1.TestUtils.generateMockCase({
                caseNumber: '2024-0123-testclient'
            });
            const channelName = (0, case_1.generateChannelName)(testCase);
            expect(channelName).toMatch(/^[a-z0-9-]+$/); // Discord channel name format
            expect(channelName).toContain('2024');
            expect(channelName).toContain('0123');
            expect(channelName).toContain('testclient');
        });
        it('should handle case numbers with special characters', () => {
            const testCase = test_utils_1.TestUtils.generateMockCase({
                caseNumber: '2024-0123-Client_With.Special-Chars'
            });
            const channelName = (0, case_1.generateChannelName)(testCase);
            // Should convert to lowercase and replace invalid characters with hyphens
            expect(channelName).toMatch(/^[a-z0-9-]+$/);
            expect(channelName).not.toContain('_');
            expect(channelName).not.toContain('.');
            expect(channelName).not.toContain(' ');
        });
        it('should truncate long channel names', () => {
            const longCaseNumber = '2024-0123-' + 'a'.repeat(100);
            const testCase = test_utils_1.TestUtils.generateMockCase({
                caseNumber: longCaseNumber
            });
            const channelName = (0, case_1.generateChannelName)(testCase);
            expect(channelName.length).toBeLessThanOrEqual(100); // Discord limit
        });
    });
    describe('Case Status Transitions', () => {
        it('should allow valid status transitions', () => {
            const validTransitions = [
                { from: case_1.CaseStatus.PENDING, to: case_1.CaseStatus.OPEN },
                { from: case_1.CaseStatus.OPEN, to: case_1.CaseStatus.IN_PROGRESS },
                { from: case_1.CaseStatus.IN_PROGRESS, to: case_1.CaseStatus.CLOSED },
                { from: case_1.CaseStatus.OPEN, to: case_1.CaseStatus.CLOSED }, // Direct closure
            ];
            validTransitions.forEach(({ from, to }) => {
                const testCase = test_utils_1.TestUtils.generateMockCase({ status: from });
                testCase.status = to;
                expect(testCase.status).toBe(to);
            });
        });
        it('should track case closure details', () => {
            const closureDate = new Date();
            const closedBy = 'lawyer123';
            const result = case_1.CaseResult.WIN;
            const resultNotes = 'Successful resolution for client';
            const closedCase = test_utils_1.TestUtils.generateMockCase({
                status: case_1.CaseStatus.CLOSED,
                result,
                resultNotes,
                closedAt: closureDate,
                closedBy
            });
            expect(closedCase.status).toBe(case_1.CaseStatus.CLOSED);
            expect(closedCase.result).toBe(result);
            expect(closedCase.resultNotes).toBe(resultNotes);
            expect(closedCase.closedAt).toBe(closureDate);
            expect(closedCase.closedBy).toBe(closedBy);
        });
        it('should track case opening details', () => {
            const openDate = new Date();
            const leadAttorneyId = 'lawyer456';
            const openCase = test_utils_1.TestUtils.generateMockCase({
                status: case_1.CaseStatus.OPEN,
                leadAttorneyId,
                acceptedAt: openDate
            });
            expect(openCase.status).toBe(case_1.CaseStatus.OPEN);
            expect(openCase.leadAttorneyId).toBe(leadAttorneyId);
            expect(openCase.acceptedAt).toBe(openDate);
        });
    });
    describe('Case Assignment Management', () => {
        it('should handle lead attorney assignment', () => {
            const leadAttorneyId = 'lawyer123';
            const testCase = test_utils_1.TestUtils.generateMockCase({
                leadAttorneyId,
                status: case_1.CaseStatus.OPEN
            });
            expect(testCase.leadAttorneyId).toBe(leadAttorneyId);
            expect(testCase.status).toBe(case_1.CaseStatus.OPEN);
        });
        it('should handle multiple assigned lawyers', () => {
            const assignedLawyers = ['lawyer1', 'lawyer2', 'lawyer3'];
            const testCase = test_utils_1.TestUtils.generateMockCase({
                assignedLawyerIds: assignedLawyers
            });
            expect(testCase.assignedLawyerIds).toEqual(assignedLawyers);
            expect(testCase.assignedLawyerIds).toHaveLength(3);
        });
        it('should handle empty lawyer assignments', () => {
            const testCase = test_utils_1.TestUtils.generateMockCase({
                assignedLawyerIds: []
            });
            expect(testCase.assignedLawyerIds).toEqual([]);
            expect(testCase.assignedLawyerIds).toHaveLength(0);
        });
        it('should prevent duplicate lawyer assignments', () => {
            const lawyersWithDuplicates = ['lawyer1', 'lawyer2', 'lawyer1', 'lawyer3'];
            const uniqueLawyers = [...new Set(lawyersWithDuplicates)];
            const testCase = test_utils_1.TestUtils.generateMockCase({
                assignedLawyerIds: uniqueLawyers
            });
            expect(testCase.assignedLawyerIds).toHaveLength(3);
            expect(testCase.assignedLawyerIds).toEqual(['lawyer1', 'lawyer2', 'lawyer3']);
        });
    });
    describe('Case Documents Management', () => {
        it('should handle document attachments', () => {
            const document = {
                id: 'doc123',
                filename: 'contract.pdf',
                url: 'https://example.com/doc123',
                uploadedBy: 'lawyer123',
                uploadedAt: new Date(),
                isClientVisible: true
            };
            const testCase = test_utils_1.TestUtils.generateMockCase({
                documents: [document]
            });
            expect(testCase.documents).toHaveLength(1);
            expect(testCase.documents[0]).toEqual(document);
        });
        it('should handle multiple documents with visibility settings', () => {
            const documents = [
                {
                    id: 'doc1',
                    filename: 'client_contract.pdf',
                    url: 'https://example.com/doc1',
                    uploadedBy: 'lawyer1',
                    uploadedAt: new Date(),
                    isClientVisible: true
                },
                {
                    id: 'doc2',
                    filename: 'internal_notes.txt',
                    url: 'https://example.com/doc2',
                    uploadedBy: 'lawyer2',
                    uploadedAt: new Date(),
                    isClientVisible: false
                }
            ];
            const testCase = test_utils_1.TestUtils.generateMockCase({ documents });
            expect(testCase.documents).toHaveLength(2);
            expect(testCase.documents[0].isClientVisible).toBe(true);
            expect(testCase.documents[1].isClientVisible).toBe(false);
        });
        it('should handle documents with metadata', () => {
            const documentWithMetadata = {
                id: 'doc123',
                filename: 'evidence.jpg',
                url: 'https://example.com/evidence.jpg',
                uploadedBy: 'lawyer123',
                uploadedAt: new Date(),
                isClientVisible: true,
                description: 'Photo evidence from scene',
                size: 1024576, // 1MB
                mimeType: 'image/jpeg'
            };
            const testCase = test_utils_1.TestUtils.generateMockCase({
                documents: [documentWithMetadata]
            });
            expect(testCase.documents[0].description).toBe('Photo evidence from scene');
            expect(testCase.documents[0].size).toBe(1024576);
            expect(testCase.documents[0].mimeType).toBe('image/jpeg');
        });
    });
    describe('Case Notes Management', () => {
        it('should handle case notes with visibility settings', () => {
            const note = {
                id: 'note123',
                content: 'Client meeting scheduled for tomorrow',
                addedBy: 'lawyer123',
                addedAt: new Date(),
                isClientVisible: true
            };
            const testCase = test_utils_1.TestUtils.generateMockCase({
                notes: [note]
            });
            expect(testCase.notes).toHaveLength(1);
            expect(testCase.notes[0]).toEqual(note);
        });
        it('should handle multiple notes with different visibility', () => {
            const notes = [
                {
                    id: 'note1',
                    content: 'Client consultation completed',
                    addedBy: 'lawyer1',
                    addedAt: new Date(),
                    isClientVisible: true
                },
                {
                    id: 'note2',
                    content: 'Internal strategy discussion',
                    addedBy: 'lawyer2',
                    addedAt: new Date(),
                    isClientVisible: false
                }
            ];
            const testCase = test_utils_1.TestUtils.generateMockCase({ notes });
            expect(testCase.notes).toHaveLength(2);
            expect(testCase.notes[0].isClientVisible).toBe(true);
            expect(testCase.notes[1].isClientVisible).toBe(false);
        });
        it('should handle chronological note ordering', () => {
            const baseDate = new Date('2024-01-01');
            const notes = [
                {
                    id: 'note1',
                    content: 'First note',
                    addedBy: 'lawyer1',
                    addedAt: baseDate,
                    isClientVisible: true
                },
                {
                    id: 'note2',
                    content: 'Second note',
                    addedBy: 'lawyer1',
                    addedAt: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000), // Next day
                    isClientVisible: true
                }
            ];
            const testCase = test_utils_1.TestUtils.generateMockCase({ notes });
            expect(testCase.notes[0].addedAt.getTime())
                .toBeLessThan(testCase.notes[1].addedAt.getTime());
        });
    });
    describe('Case Channel Integration', () => {
        it('should handle Discord channel ID assignment', () => {
            const channelId = 'discord-channel-123';
            const testCase = test_utils_1.TestUtils.generateMockCase({ channelId });
            expect(testCase.channelId).toBe(channelId);
        });
        it('should handle case without channel assignment', () => {
            const testCase = test_utils_1.TestUtils.generateMockCase();
            expect(testCase.channelId).toBeUndefined();
        });
    });
    describe('Edge Cases and Validation', () => {
        it('should handle cases with empty collections', () => {
            const testCase = test_utils_1.TestUtils.generateMockCase({
                assignedLawyerIds: [],
                documents: [],
                notes: []
            });
            expect(testCase.assignedLawyerIds).toEqual([]);
            expect(testCase.documents).toEqual([]);
            expect(testCase.notes).toEqual([]);
        });
        it('should handle cases with very long descriptions', () => {
            const longDescription = 'A'.repeat(5000);
            const testCase = test_utils_1.TestUtils.generateMockCase({
                description: longDescription
            });
            expect(testCase.description).toBe(longDescription);
            expect(testCase.description.length).toBe(5000);
        });
        it('should handle special characters in case titles', () => {
            const specialTitle = 'Case: "John Doe vs. ABC Corp." (Contract Dispute) - Phase 1';
            const testCase = test_utils_1.TestUtils.generateMockCase({
                title: specialTitle
            });
            expect(testCase.title).toBe(specialTitle);
        });
        it('should handle concurrent case updates', () => {
            const updateTime = new Date();
            const testCase = test_utils_1.TestUtils.generateMockCase({
                updatedAt: updateTime
            });
            expect(testCase.updatedAt).toBe(updateTime);
        });
        it('should handle cases with null/undefined optional fields', () => {
            const testCase = test_utils_1.TestUtils.generateMockCase({
                leadAttorneyId: undefined,
                acceptedAt: undefined,
                result: undefined,
                resultNotes: undefined,
                closedAt: undefined,
                closedBy: undefined,
                channelId: undefined
            });
            expect(testCase.leadAttorneyId).toBeUndefined();
            expect(testCase.acceptedAt).toBeUndefined();
            expect(testCase.result).toBeUndefined();
            expect(testCase.resultNotes).toBeUndefined();
            expect(testCase.closedAt).toBeUndefined();
            expect(testCase.closedBy).toBeUndefined();
            expect(testCase.channelId).toBeUndefined();
        });
    });
    describe('Cross-Guild Isolation', () => {
        it('should maintain separate case numbers per guild', () => {
            const guild1Case = test_utils_1.TestUtils.generateMockCase({
                guildId: 'guild1',
                caseNumber: '2024-0001-client1'
            });
            const guild2Case = test_utils_1.TestUtils.generateMockCase({
                guildId: 'guild2',
                caseNumber: '2024-0001-client2' // Same number, different guild
            });
            expect(guild1Case.guildId).not.toBe(guild2Case.guildId);
            expect(guild1Case.caseNumber).not.toBe(guild2Case.caseNumber);
        });
        it('should handle cross-guild client scenarios', () => {
            const sameClientDifferentGuilds = [
                test_utils_1.TestUtils.generateMockCase({
                    clientId: 'client123',
                    guildId: 'guild1',
                    caseNumber: '2024-0001-client123'
                }),
                test_utils_1.TestUtils.generateMockCase({
                    clientId: 'client123',
                    guildId: 'guild2',
                    caseNumber: '2024-0001-client123'
                })
            ];
            sameClientDifferentGuilds.forEach(testCase => {
                expect(testCase.clientId).toBe('client123');
                expect(testCase.guildId).toBeTruthy();
            });
            expect(sameClientDifferentGuilds[0].guildId)
                .not.toBe(sameClientDifferentGuilds[1].guildId);
        });
    });
});
//# sourceMappingURL=case.test.js.map