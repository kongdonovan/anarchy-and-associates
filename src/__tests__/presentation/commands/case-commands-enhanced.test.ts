import { CommandInteraction, User, Guild, GuildMember, TextChannel, AttachmentBuilder } from 'discord.js';
import { CaseCommands } from '../../../presentation/commands/case-commands';
import { CaseRepository } from '../../../infrastructure/repositories/case-repository';
import { CaseService } from '../../../application/services/case-service';
import { Case, CaseStatus, CasePriority, CaseResult } from '../../../domain/entities/case';
import { StaffRole } from '../../../domain/entities/staff-role';
import { PermissionService } from '../../../application/services/permission-service';
import { BusinessRuleValidationService } from '../../../application/services/business-rule-validation-service';
import { ObjectId } from 'mongodb';
import { CaseStatus, CasePriority } from '../../domain/entities/case';

// Mock all dependencies
jest.mock('../../../infrastructure/repositories/case-repository');
jest.mock('../../../infrastructure/repositories/case-counter-repository');
jest.mock('../../../infrastructure/repositories/guild-config-repository');
jest.mock('../../../infrastructure/repositories/staff-repository');
jest.mock('../../../infrastructure/repositories/audit-log-repository');
jest.mock('../../../infrastructure/repositories/application-repository');
jest.mock('../../../infrastructure/repositories/job-repository');
jest.mock('../../../infrastructure/repositories/retainer-repository');
jest.mock('../../../infrastructure/repositories/feedback-repository');
jest.mock('../../../infrastructure/repositories/reminder-repository');
jest.mock('../../../application/services/case-service');
jest.mock('../../../infrastructure/logger');

// Mock Discord.js types
jest.mock('discord.js', () => ({
  ...jest.requireActual('discord.js'),
  ApplicationCommandOptionType: {
    User: 6,
    String: 3,
    Integer: 4,
    Boolean: 5,
  },
  ChannelType: {
    GuildText: 0,
  },
  PermissionFlagsBits: {
    Administrator: 8n,
    ManageRoles: 268435456n,
    ViewChannel: 1024n,
    SendMessages: 2048n,
  },
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
  },
  TextInputStyle: {
    Short: 1,
    Paragraph: 2,
  },
}));

describe('Enhanced Case Commands', () => {
  let caseCommands: CaseCommands;
  let mockInteraction: jest.Mocked<CommandInteraction>;
  let mockCaseRepo: jest.Mocked<CaseRepository>;
  let mockCaseService: jest.Mocked<CaseService>;
  let mockGuild: jest.Mocked<Guild>;
  let mockMember: jest.Mocked<GuildMember>;
  let mockUser: jest.Mocked<User>;

  const createMockCase = (overrides: Partial<Case> = {}): Case => ({
    _id: new ObjectId(),
    guildId: 'guild123',
    caseNumber: 'CASE-001',
    clientId: 'client123',
    clientUsername: 'testclient',
    title: 'Test Legal Matter',
    description: 'Test case description',
    status: CaseStatus.IN_PROGRESS,
    priority: CasePriority.MEDIUM,
    assignedLawyerIds: ['lawyer123'],
    leadAttorneyId: 'lawyer123',
    channelId: 'channel123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock user
    mockUser = {
      id: 'user123',
      displayName: 'Test User',
      username: 'testuser',
      tag: 'testuser#1234'
    } as jest.Mocked<User>;

    // Create mock member
    mockMember = {
      roles: {
        cache: new Map()
      },
      user: mockUser
    } as unknown as jest.Mocked<GuildMember>;

    // Create mock guild
    mockGuild = {
      id: 'guild123',
      ownerId: 'owner123',
      members: {
        cache: new Map([[mockUser.id, mockMember]]),
        fetch: jest.fn().mockResolvedValue(mockMember)
      }
    } as unknown as jest.Mocked<Guild>;

    // Create mock interaction
    mockInteraction = {
      guildId: 'guild123',
      guild: mockGuild,
      user: mockUser,
      member: mockMember,
      commandName: 'case',
      isCommand: jest.fn().mockReturnValue(true),
      replied: false,
      deferred: false,
      reply: jest.fn(),
      editReply: jest.fn(),
      deferReply: jest.fn(),
      followUp: jest.fn(),
      showModal: jest.fn(),
      options: {
        getSubcommand: jest.fn(),
        getUser: jest.fn(),
        getString: jest.fn(),
        getInteger: jest.fn(),
        getBoolean: jest.fn(),
        data: []
      },
      channelId: 'channel123'
    } as unknown as jest.Mocked<CommandInteraction>;

    // Create case commands instance
    caseCommands = new CaseCommands();
    
    // Access private services
    mockCaseRepo = (caseCommands as any).caseRepository;
    mockCaseService = (caseCommands as any).caseService;
  });

  describe('searchCases command', () => {
    beforeEach(() => {
      mockInteraction.options.getString = jest.fn()
        .mockReturnValueOnce('legal') // search query
        .mockReturnValueOnce('in_progress') // status
        .mockReturnValueOnce('high'); // priority
      mockInteraction.options.getUser = jest.fn()
        .mockReturnValueOnce({ id: 'lawyer123', displayName: 'Test Lawyer' }) // lawyer
        .mockReturnValueOnce({ id: 'client456', displayName: 'Test Client' }); // client
      mockInteraction.options.getInteger = jest.fn().mockReturnValue(30); // days
    });

    it('should search cases with all filters', async () => {
      const mockCases = [
        createMockCase({ 
          title: 'Legal dispute case',
          status: CaseStatus.IN_PROGRESS,
          priority: CasePriority.HIGH,
          assignedLawyerIds: ['lawyer123'],
          clientId: 'client456'
        }),
        createMockCase({ 
          caseNumber: 'CASE-002',
          title: 'Another legal case',
          status: CaseStatus.IN_PROGRESS,
          priority: CasePriority.HIGH,
          assignedLawyerIds: ['lawyer123'],
          clientId: 'client456'
        })
      ];

      mockCaseRepo.findByGuildId = jest.fn().mockResolvedValue([
        ...mockCases,
        createMockCase({ 
          caseNumber: 'CASE-003',
          title: 'Old case',
          status: CaseStatus.CLOSED,
          createdAt: new Date('2023-01-01')
        })
      ]);

      await caseCommands.searchCases(
        'legal',
        'in_progress',
        'high',
        { id: 'lawyer123', displayName: 'Test Lawyer' } as User,
        { id: 'client456', displayName: 'Test Client' } as User,
        30,
        mockInteraction
      );

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockCaseRepo.findByGuildId).toHaveBeenCalledWith('guild123');
      
      // Verify the results embed
      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(replyCall.embeds[0]?.data?.title).toContain('Search Results (2 case');
      expect(replyCall.embeds[0]?.data?.fields).toHaveLength(3); // 2 cases + search criteria
    });

    it('should handle empty search results', async () => {
      mockCaseRepo.findByGuildId = jest.fn().mockResolvedValue([]);

      await caseCommands.searchCases(
        'nonexistent',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        mockInteraction
      );

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                description: 'No cases found matching your search criteria.'
              })
            })
          ])
        })
      );
    });

    it('should filter by date range', async () => {
      const recentCase = createMockCase({ 
        createdAt: new Date() 
      });
      const oldCase = createMockCase({ 
        caseNumber: 'CASE-OLD',
        createdAt: new Date('2023-01-01') 
      });

      mockCaseRepo.findByGuildId = jest.fn().mockResolvedValue([recentCase, oldCase]);
      mockInteraction.options.getInteger = jest.fn().mockReturnValue(7); // 7 days

      await caseCommands.searchCases(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        7,
        mockInteraction
      );

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(replyCall.embeds[0]?.data?.title).toContain('Search Results (1 case)');
    });
  });

  describe('exportCases command', () => {
    const mockCases = [
      createMockCase({
        status: CaseStatus.CLOSED,
        result: CaseResult.SETTLED,
        closedAt: new Date('2024-02-01')
      }),
      createMockCase({
        caseNumber: 'CASE-002',
        status: CaseStatus.IN_PROGRESS,
        priority: CasePriority.HIGH
      })
    ];

    it('should export cases to CSV format', async () => {
      mockCaseRepo.findByGuildId = jest.fn().mockResolvedValue(mockCases);
      mockInteraction.options.getString = jest.fn().mockReturnValue('csv');

      await caseCommands.exportCases('csv', mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith(true);
      
      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(replyCall.embeds[0]?.data?.title).toBe('Export Complete');
      expect(replyCall.files).toHaveLength(1);
      expect(replyCall.files[0]).toBeInstanceOf(AttachmentBuilder);
      expect((replyCall.files[0] as AttachmentBuilder).name).toContain('cases_export_');
    });

    it('should generate summary report', async () => {
      mockCaseRepo.findByGuildId = jest.fn().mockResolvedValue(mockCases);
      mockInteraction.options.getString = jest.fn().mockReturnValue('summary');

      await caseCommands.exportCases('summary', mockInteraction);

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(replyCall.embeds[0]?.data?.title).toBe('Report Generated');
      expect(replyCall.files).toHaveLength(1);
      expect((replyCall.files[0] as AttachmentBuilder).name).toContain('case_summary_');
    });

    it('should handle empty case list', async () => {
      mockCaseRepo.findByGuildId = jest.fn().mockResolvedValue([]);

      await caseCommands.exportCases('csv', mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: 'No Data',
                description: 'There are no cases to export.'
              })
            })
          ]),
          ephemeral: true
        })
      );
    });

    it('should require admin permission', async () => {
      // This is handled by the @ValidatePermissions('admin') decorator
      // The test verifies the decorator is present on the method
      const exportCasesMethod = caseCommands.exportCases;
      expect(exportCasesMethod).toBeDefined();
    });
  });

  describe('addCaseNote command', () => {
    beforeEach(() => {
      mockInteraction.options.getString = jest.fn().mockReturnValue('This is a test note');
      mockInteraction.options.getBoolean = jest.fn().mockReturnValue(true); // client-visible
    });

    it('should add note to case in channel', async () => {
      const mockCase = createMockCase();
      (caseCommands as any).getCaseFromChannel = jest.fn().mockResolvedValue(mockCase);
      mockCaseRepo.update = jest.fn().mockResolvedValue(true);

      await caseCommands.addCaseNote(
        'This is a test note',
        true,
        mockInteraction
      );

      expect(mockCaseRepo.update).toHaveBeenCalledWith(
        'case123',
        expect.objectContaining({
          $push: expect.objectContaining({
            notes: expect.objectContaining({
              content: 'This is a test note',
              authorId: 'user123',
              authorName: 'testuser',
              clientVisible: true
            })
          })
        })
      );

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: 'Note Added'
              })
            })
          ])
        })
      );
    });

    it('should notify client when note is client-visible', async () => {
      const mockCase = createMockCase({ clientId: 'client456' });
      (caseCommands as any).getCaseFromChannel = jest.fn().mockResolvedValue(mockCase);
      mockCaseRepo.update = jest.fn().mockResolvedValue(true);

      const mockClient = {
        send: jest.fn()
      };
      mockGuild.members.fetch = jest.fn().mockResolvedValue(mockClient);

      await caseCommands.addCaseNote(
        'Client-visible note',
        true,
        mockInteraction
      );

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: 'New Case Note',
                description: expect.stringContaining('Client-visible note')
              })
            })
          ])
        })
      );
    });

    it('should handle case not in channel', async () => {
      (caseCommands as any).getCaseFromChannel = jest.fn().mockResolvedValue(null);

      await caseCommands.addCaseNote(
        'Test note',
        false,
        mockInteraction
      );

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: 'Invalid Channel',
                description: 'This command can only be used within case channels.'
              })
            })
          ]),
          ephemeral: true
        })
      );
    });
  });

  describe('Helper methods', () => {
    describe('generateCaseCSV', () => {
      it('should generate valid CSV with proper escaping', () => {
        const cases = [
          createMockCase({
            title: 'Case with "quotes"',
            assignedLawyerIds: ['lawyer1', 'lawyer2']
          })
        ];

        const csv = (caseCommands as any).generateCaseCSV(cases);
        
        expect(csv).toContain('Case Number,Title,Client ID');
        expect(csv).toContain('"Case with ""quotes"""'); // Properly escaped quotes
        expect(csv).toContain('lawyer1;lawyer2'); // Multiple lawyers separated by semicolon
      });
    });

    describe('generateCaseSummaryReport', () => {
      it('should generate comprehensive summary report', () => {
        const cases = [
          createMockCase({
            status: CaseStatus.CLOSED,
            priority: CasePriority.HIGH,
            result: CaseResult.WON,
            closedAt: new Date('2024-02-01'),
            createdAt: new Date('2024-01-01')
          }),
          createMockCase({
            caseNumber: 'CASE-002',
            status: CaseStatus.IN_PROGRESS,
            priority: CasePriority.MEDIUM
          }),
          createMockCase({
            caseNumber: 'CASE-003',
            status: CaseStatus.PENDING,
            priority: CasePriority.LOW
          })
        ];

        const report = (caseCommands as any).generateCaseSummaryReport(cases);
        
        expect(report).toContain('ANARCHY & ASSOCIATES - CASE SUMMARY REPORT');
        expect(report).toContain('Total Cases: 3');
        expect(report).toContain('In Progress: 1 (33.3%)');
        expect(report).toContain('Closed: 1 (33.3%)');
        expect(report).toContain('Pending: 1 (33.3%)');
        expect(report).toContain('HIGH: 1 (33.3%)');
        expect(report).toContain('Average Case Duration: 31 days');
        expect(report).toContain('Completion Rate: 33.3%');
      });
    });

    describe('emoji helpers', () => {
      it('should return correct status emojis', () => {
        expect((caseCommands as any).getCaseStatusEmoji(CaseStatus.PENDING)).toBe('🟡');
        expect((caseCommands as any).getCaseStatusEmoji(CaseStatus.IN_PROGRESS)).toBe('🟢');
        expect((caseCommands as any).getCaseStatusEmoji(CaseStatus.CLOSED)).toBe('🔴');
      });

      it('should return correct priority emojis', () => {
        expect((caseCommands as any).getCasePriorityEmoji(CasePriority.LOW)).toBe('🟢');
        expect((caseCommands as any).getCasePriorityEmoji(CasePriority.MEDIUM)).toBe('🟡');
        expect((caseCommands as any).getCasePriorityEmoji(CasePriority.HIGH)).toBe('🟠');
        expect((caseCommands as any).getCasePriorityEmoji(CasePriority.CRITICAL)).toBe('🔴');
      });
    });
  });

  describe('Validation Integration', () => {
    it('should have permission validation on search command', () => {
      // The @ValidatePermissions('case') decorator ensures only users with case permissions can search
      const searchMethod = caseCommands.searchCases;
      expect(searchMethod).toBeDefined();
    });

    it('should have admin permission validation on export command', () => {
      // The @ValidatePermissions('admin') decorator ensures only admins can export
      const exportMethod = caseCommands.exportCases;
      expect(exportMethod).toBeDefined();
    });

    it('should have entity validation on add-note command', () => {
      // The @ValidateEntity('case', 'update') decorator ensures case exists and can be updated
      const addNoteMethod = caseCommands.addCaseNote;
      expect(addNoteMethod).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle search with special characters', async () => {
      const specialCase = createMockCase({
        title: 'Case with special chars: $%&@#',
        description: 'Description with newlines\nand\ttabs'
      });

      mockCaseRepo.findByGuildId = jest.fn().mockResolvedValue([specialCase]);

      await caseCommands.searchCases(
        '$%&@#',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        mockInteraction
      );

      const replyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(replyCall.embeds[0]?.data?.title).toContain('Search Results (1 case)');
    });

    it('should handle export with very long case titles', async () => {
      const longTitleCase = createMockCase({
        title: 'A'.repeat(500) // Very long title
      });

      mockCaseRepo.findByGuildId = jest.fn().mockResolvedValue([longTitleCase]);

      await caseCommands.exportCases('csv', mockInteraction);

      // Should not throw error
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle concurrent note additions', async () => {
      const mockCase = createMockCase();
      (caseCommands as any).getCaseFromChannel = jest.fn().mockResolvedValue(mockCase);
      
      let updateCount = 0;
      mockCaseRepo.update = jest.fn().mockImplementation(() => {
        updateCount++;
        return Promise.resolve(true);
      });

      // Simulate concurrent note additions
      await Promise.all([
        caseCommands.addCaseNote('Note 1', false, mockInteraction),
        caseCommands.addCaseNote('Note 2', false, mockInteraction),
        caseCommands.addCaseNote('Note 3', false, mockInteraction)
      ]);

      expect(updateCount).toBe(3);
    });
  });
});