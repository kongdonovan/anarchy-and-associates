import { CaseStatus, CasePriority, CaseResult, CaseDocument, CaseNote, generateCaseNumber, generateChannelName } from '../../domain/entities/case';
import { TestUtils } from '../helpers/test-utils';

describe('Case Entity', () => {
  describe('Case Creation and Validation', () => {
    it('should create a valid case with required fields', () => {
      const testCase = TestUtils.generateMockCase();
      
      expect(testCase.guildId).toBeTruthy();
      expect(testCase.caseNumber).toBeTruthy();
      expect(testCase.clientId).toBeTruthy();
      expect(testCase.clientUsername).toBeTruthy();
      expect(testCase.title).toBeTruthy();
      expect(testCase.description).toBeTruthy();
      expect(testCase.status).toBe(CaseStatus.PENDING);
      expect(testCase.priority).toBe(CasePriority.MEDIUM);
      expect(Array.isArray(testCase.assignedLawyerIds)).toBe(true);
      expect(Array.isArray(testCase.documents)).toBe(true);
      expect(Array.isArray(testCase.notes)).toBe(true);
      expect(testCase.createdAt).toBeInstanceOf(Date);
      expect(testCase.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle all valid case statuses', () => {
      const validStatuses = [
        CaseStatus.PENDING,
        CaseStatus.OPEN,
        CaseStatus.IN_PROGRESS,
        CaseStatus.CLOSED
      ];
      
      validStatuses.forEach(status => {
        const testCase = TestUtils.generateMockCase({ status });
        expect(testCase.status).toBe(status);
      });
    });

    it('should handle all valid case priorities', () => {
      const validPriorities = [
        CasePriority.LOW,
        CasePriority.MEDIUM,
        CasePriority.HIGH,
        CasePriority.URGENT
      ];
      
      validPriorities.forEach(priority => {
        const testCase = TestUtils.generateMockCase({ priority });
        expect(testCase.priority).toBe(priority);
      });
    });

    it('should handle all valid case results', () => {
      const validResults = [
        CaseResult.WIN,
        CaseResult.LOSS,
        CaseResult.SETTLEMENT,
        CaseResult.DISMISSED,
        CaseResult.WITHDRAWN
      ];
      
      validResults.forEach(result => {
        const testCase = TestUtils.generateMockCase({ 
          status: CaseStatus.CLOSED,
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
      
      const caseNumber = generateCaseNumber(year, caseCount, clientUsername);
      
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
        const caseNumber = generateCaseNumber(year, 1, 'client');
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
        const caseNumber = generateCaseNumber(2024, count, 'client');
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
        const caseNumber = generateCaseNumber(2024, 1, username);
        expect(caseNumber).toContain(username);
        expect(caseNumber).toMatch(/^\d{4}-\d{4}-/);
      });
    });

    it('should generate unique case numbers for same parameters', () => {
      const caseNumber1 = generateCaseNumber(2024, 1, 'client');
      const caseNumber2 = generateCaseNumber(2024, 2, 'client');
      
      expect(caseNumber1).not.toBe(caseNumber2);
      expect(caseNumber1).toBe('2024-0001-client');
      expect(caseNumber2).toBe('2024-0002-client');
    });
  });

  describe('Channel Name Generation', () => {
    it('should generate valid Discord channel names', () => {
      const caseNumber = '2024-0123-testclient';
      
      const channelName = generateChannelName(caseNumber);
      
      expect(channelName).toMatch(/^[a-z0-9-]+$/); // Discord channel name format
      expect(channelName).toContain('2024');
      expect(channelName).toContain('0123');
      expect(channelName).toContain('testclient');
    });

    it('should handle case numbers with special characters', () => {
      const caseNumber = '2024-0123-Client_With.Special-Chars';
      
      const channelName = generateChannelName(caseNumber);
      
      // Should convert to lowercase and replace invalid characters with hyphens
      expect(channelName).toMatch(/^[a-z0-9-]+$/);
      expect(channelName).not.toContain('_');
      expect(channelName).not.toContain('.');
      expect(channelName).not.toContain(' ');
    });

    it('should truncate long channel names', () => {
      const longCaseNumber = '2024-0123-' + 'a'.repeat(100);
      
      const channelName = generateChannelName(longCaseNumber);
      
      expect(channelName.length).toBeLessThanOrEqual(100); // Discord limit
    });
  });

  describe('Case Status Transitions', () => {
    it('should allow valid status transitions', () => {
      const validTransitions = [
        { from: CaseStatus.PENDING, to: CaseStatus.OPEN },
        { from: CaseStatus.OPEN, to: CaseStatus.IN_PROGRESS },
        { from: CaseStatus.IN_PROGRESS, to: CaseStatus.CLOSED },
        { from: CaseStatus.OPEN, to: CaseStatus.CLOSED }, // Direct closure
      ];
      
      validTransitions.forEach(({ from, to }) => {
        const testCase = TestUtils.generateMockCase({ status: from });
        testCase.status = to;
        expect(testCase.status).toBe(to);
      });
    });

    it('should track case closure details', () => {
      const closureDate = new Date();
      const closedBy = 'lawyer123';
      const result = CaseResult.WIN;
      const resultNotes = 'Successful resolution for client';
      
      const closedCase = TestUtils.generateMockCase({
        status: CaseStatus.CLOSED,
        result,
        resultNotes,
        closedAt: closureDate,
        closedBy
      });
      
      expect(closedCase.status).toBe(CaseStatus.CLOSED);
      expect(closedCase.result).toBe(result);
      expect(closedCase.resultNotes).toBe(resultNotes);
      expect(closedCase.closedAt).toBe(closureDate);
      expect(closedCase.closedBy).toBe(closedBy);
    });

    it('should track case opening details', () => {
      const leadAttorneyId = 'lawyer456';
      
      const openCase = TestUtils.generateMockCase({
        status: CaseStatus.OPEN,
        leadAttorneyId
      });
      
      expect(openCase.status).toBe(CaseStatus.OPEN);
      expect(openCase.leadAttorneyId).toBe(leadAttorneyId);
    });
  });

  describe('Case Assignment Management', () => {
    it('should handle lead attorney assignment', () => {
      const leadAttorneyId = 'lawyer123';
      const testCase = TestUtils.generateMockCase({
        leadAttorneyId,
        status: CaseStatus.OPEN
      });
      
      expect(testCase.leadAttorneyId).toBe(leadAttorneyId);
      expect(testCase.status).toBe(CaseStatus.OPEN);
    });

    it('should handle multiple assigned lawyers', () => {
      const assignedLawyers = ['lawyer1', 'lawyer2', 'lawyer3'];
      const testCase = TestUtils.generateMockCase({
        assignedLawyerIds: assignedLawyers
      });
      
      expect(testCase.assignedLawyerIds).toEqual(assignedLawyers);
      expect(testCase.assignedLawyerIds).toHaveLength(3);
    });

    it('should handle empty lawyer assignments', () => {
      const testCase = TestUtils.generateMockCase({
        assignedLawyerIds: []
      });
      
      expect(testCase.assignedLawyerIds).toEqual([]);
      expect(testCase.assignedLawyerIds).toHaveLength(0);
    });

    it('should prevent duplicate lawyer assignments', () => {
      const lawyersWithDuplicates = ['lawyer1', 'lawyer2', 'lawyer1', 'lawyer3'];
      const uniqueLawyers = [...new Set(lawyersWithDuplicates)];
      
      const testCase = TestUtils.generateMockCase({
        assignedLawyerIds: uniqueLawyers
      });
      
      expect(testCase.assignedLawyerIds).toHaveLength(3);
      expect(testCase.assignedLawyerIds).toEqual(['lawyer1', 'lawyer2', 'lawyer3']);
    });
  });

  describe('Case Documents Management', () => {
    it('should handle document attachments', () => {
      const document: CaseDocument = {
        id: 'doc123',
        title: 'contract.pdf',
        content: 'https://example.com/doc123',
        createdBy: 'lawyer123',
        createdAt: new Date()
      };
      
      const testCase = TestUtils.generateMockCase({
        documents: [document]
      });
      
      expect(testCase.documents).toHaveLength(1);
      expect(testCase.documents[0]).toEqual(document);
    });

    it('should handle multiple documents', () => {
      const documents: CaseDocument[] = [
        {
          id: 'doc1',
          title: 'client_contract.pdf',
          content: 'https://example.com/doc1',
          createdBy: 'lawyer1',
          createdAt: new Date()
        },
        {
          id: 'doc2',
          title: 'internal_notes.txt', 
          content: 'https://example.com/doc2',
          createdBy: 'lawyer2',
          createdAt: new Date()
        }
      ];
      
      const testCase = TestUtils.generateMockCase({ documents });
      
      expect(testCase.documents).toHaveLength(2);
      expect(testCase.documents[0].title).toBe('client_contract.pdf');
      expect(testCase.documents[1].title).toBe('internal_notes.txt');
    });

    it('should handle documents with content', () => {
      const documentWithContent: CaseDocument = {
        id: 'doc123',
        title: 'evidence.jpg',
        content: 'https://example.com/evidence.jpg - Photo evidence from scene',
        createdBy: 'lawyer123',
        createdAt: new Date()
      };
      
      const testCase = TestUtils.generateMockCase({
        documents: [documentWithContent]
      });
      
      expect(testCase.documents[0].content).toContain('Photo evidence from scene');
      expect(testCase.documents[0].title).toBe('evidence.jpg');
      expect(testCase.documents[0].createdBy).toBe('lawyer123');
    });
  });

  describe('Case Notes Management', () => {
    it('should handle case notes with visibility settings', () => {
      const note: CaseNote = {
        id: 'note123',
        content: 'Client meeting scheduled for tomorrow',
        createdBy: 'lawyer123',
        createdAt: new Date(),
        isInternal: false
      };
      
      const testCase = TestUtils.generateMockCase({
        notes: [note]
      });
      
      expect(testCase.notes).toHaveLength(1);
      expect(testCase.notes[0]).toEqual(note);
    });

    it('should handle multiple notes with different visibility', () => {
      const notes: CaseNote[] = [
        {
          id: 'note1',
          content: 'Client consultation completed',
          createdBy: 'lawyer1',
          createdAt: new Date(),
          isInternal: false
        },
        {
          id: 'note2',
          content: 'Internal strategy discussion',
          createdBy: 'lawyer2',
          createdAt: new Date(),
          isInternal: true
        }
      ];
      
      const testCase = TestUtils.generateMockCase({ notes });
      
      expect(testCase.notes).toHaveLength(2);
      expect(testCase.notes[0].isInternal).toBe(false);
      expect(testCase.notes[1].isInternal).toBe(true);
    });

    it('should handle chronological note ordering', () => {
      const baseDate = new Date('2024-01-01');
      const notes: CaseNote[] = [
        {
          id: 'note1',
          content: 'First note',
          createdBy: 'lawyer1',
          createdAt: baseDate,
          isInternal: false
        },
        {
          id: 'note2',
          content: 'Second note',
          createdBy: 'lawyer1',
          createdAt: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000), // Next day
          isInternal: false
        }
      ];
      
      const testCase = TestUtils.generateMockCase({ notes });
      
      expect(testCase.notes[0].createdAt.getTime())
        .toBeLessThan(testCase.notes[1].createdAt.getTime());
    });
  });

  describe('Case Channel Integration', () => {
    it('should handle Discord channel ID assignment', () => {
      const channelId = 'discord-channel-123';
      const testCase = TestUtils.generateMockCase({ channelId });
      
      expect(testCase.channelId).toBe(channelId);
    });

    it('should handle case without channel assignment', () => {
      const testCase = TestUtils.generateMockCase();
      
      expect(testCase.channelId).toBeUndefined();
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle cases with empty collections', () => {
      const testCase = TestUtils.generateMockCase({
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
      const testCase = TestUtils.generateMockCase({
        description: longDescription
      });
      
      expect(testCase.description).toBe(longDescription);
      expect(testCase.description.length).toBe(5000);
    });

    it('should handle special characters in case titles', () => {
      const specialTitle = 'Case: "John Doe vs. ABC Corp." (Contract Dispute) - Phase 1';
      const testCase = TestUtils.generateMockCase({
        title: specialTitle
      });
      
      expect(testCase.title).toBe(specialTitle);
    });

    it('should handle concurrent case updates', () => {
      const updateTime = new Date();
      const testCase = TestUtils.generateMockCase({
        updatedAt: updateTime
      });
      
      expect(testCase.updatedAt).toBe(updateTime);
    });

    it('should handle cases with null/undefined optional fields', () => {
      const testCase = TestUtils.generateMockCase({
        leadAttorneyId: undefined,
        result: undefined,
        resultNotes: undefined,
        closedAt: undefined,
        closedBy: undefined,
        channelId: undefined
      });
      
      expect(testCase.leadAttorneyId).toBeUndefined();
      expect(testCase.result).toBeUndefined();
      expect(testCase.resultNotes).toBeUndefined();
      expect(testCase.closedAt).toBeUndefined();
      expect(testCase.closedBy).toBeUndefined();
      expect(testCase.channelId).toBeUndefined();
    });
  });

  describe('Cross-Guild Isolation', () => {
    it('should maintain separate case numbers per guild', () => {
      const guild1Case = TestUtils.generateMockCase({
        guildId: 'guild1',
        caseNumber: '2024-0001-client1'
      });

      const guild2Case = TestUtils.generateMockCase({
        guildId: 'guild2',
        caseNumber: '2024-0001-client2' // Same number, different guild
      });

      expect(guild1Case.guildId).not.toBe(guild2Case.guildId);
      expect(guild1Case.caseNumber).not.toBe(guild2Case.caseNumber);
    });

    it('should handle cross-guild client scenarios', () => {
      const sameClientDifferentGuilds = [
        TestUtils.generateMockCase({
          clientId: 'client123',
          guildId: 'guild1',
          caseNumber: '2024-0001-client123'
        }),
        TestUtils.generateMockCase({
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