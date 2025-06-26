import { CommandInteraction, User, Guild, GuildMember, ApplicationCommandOptionType } from 'discord.js';
import { StaffCommands } from '../../../presentation/commands/staff-commands';
import { CaseCommands } from '../../../presentation/commands/case-commands';
import { JobsCommands } from '../../../presentation/commands/job-commands';
import { StaffRepository } from '../../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../../infrastructure/repositories/guild-config-repository';
import { PermissionService } from '../../../application/services/permission-service';
import { BusinessRuleValidationService } from '../../../application/services/business-rule-validation-service';
import { CommandValidationService } from '../../../application/services/command-validation-service';
import { CrossEntityValidationService } from '../../../application/services/cross-entity-validation-service';
import { StaffRole } from '../../../domain/entities/staff-role';
import { clearValidationRules } from '../../../presentation/decorators/validation-decorators';
import { ObjectId } from 'mongodb';
import { RetainerStatus } from '../../../domain/entities/retainer';

// Mock Discord.js ApplicationCommandOptionType
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
  },
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
  },
}));

// Mock all dependencies
jest.mock('../../../infrastructure/repositories/staff-repository');
jest.mock('../../../infrastructure/repositories/case-repository');
jest.mock('../../../infrastructure/repositories/case-counter-repository');
jest.mock('../../../infrastructure/repositories/guild-config-repository');
jest.mock('../../../infrastructure/repositories/application-repository');
jest.mock('../../../infrastructure/repositories/job-repository');
jest.mock('../../../infrastructure/repositories/retainer-repository');
jest.mock('../../../infrastructure/repositories/feedback-repository');
jest.mock('../../../infrastructure/repositories/reminder-repository');
jest.mock('../../../infrastructure/repositories/audit-log-repository');
jest.mock('../../../application/services/staff-service');
jest.mock('../../../application/services/case-service');
jest.mock('../../../application/services/job-service');
jest.mock('../../../application/services/discord-role-sync-service');
jest.mock('../../../application/services/job-question-service');
jest.mock('../../../application/services/job-cleanup-service');
jest.mock('../../../application/services/application-service');
jest.mock('../../../infrastructure/external/roblox-service');
jest.mock('../../../infrastructure/logger');

describe('Command Validation Tests', () => {
  let mockInteraction: jest.Mocked<CommandInteraction>;
  let mockGuild: jest.Mocked<Guild>;
  let mockMember: jest.Mocked<GuildMember>;
  let mockUser: jest.Mocked<User>;

  beforeEach(() => {
    jest.clearAllMocks();
    clearValidationRules();

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
        cache: new Map([[mockUser.id, mockMember]])
      }
    } as unknown as jest.Mocked<Guild>;

    // Create mock interaction
    mockInteraction = {
      guildId: 'guild123',
      guild: mockGuild,
      user: mockUser,
      member: mockMember,
      commandName: 'staff',
      isCommand: jest.fn().mockReturnValue(true),
      replied: false,
      deferred: false,
      reply: jest.fn(),
      editReply: jest.fn(),
      deferReply: jest.fn(),
      showModal: jest.fn(),
      options: {
        getSubcommand: jest.fn(),
        getUser: jest.fn(),
        getString: jest.fn(),
        data: []
      },
      channelId: 'channel123'
    } as unknown as jest.Mocked<CommandInteraction>;
  });

  describe('StaffCommands Validation', () => {
    let staffCommands: StaffCommands;
    let mockStaffRepo: jest.Mocked<StaffRepository>;
    let mockPermissionService: jest.Mocked<PermissionService>;
    let mockBusinessRuleService: jest.Mocked<BusinessRuleValidationService>;

    beforeEach(() => {
      staffCommands = new StaffCommands();
      
      // Access private services through any
      mockStaffRepo = (staffCommands as any).staffRepository;
      mockPermissionService = (staffCommands as any).permissionService;
      mockBusinessRuleService = (staffCommands as any).businessRuleValidationService;
    });

    describe('promoteStaff validation', () => {
      beforeEach(() => {
        mockInteraction.options.getUser = jest.fn().mockReturnValue(mockUser);
        mockInteraction.options.getString = jest.fn()
          .mockReturnValueOnce(StaffRole.SENIOR_PARTNER)
          .mockReturnValueOnce('Promotion reason');
      });

      it('should validate permissions before promoting', async () => {
        // Mock permission check failure
        mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(false);
        
        // Mock validation results
        mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
          valid: false,
          errors: ['You do not have permission to promote staff members.'],
          warnings: [],
          bypassAvailable: false
        });

        await staffCommands.promoteStaff(
          mockUser,
          StaffRole.SENIOR_PARTNER,
          'Promotion reason',
          mockInteraction
        );

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  description: expect.stringContaining('You do not have permission')
                })
              })
            ]),
            ephemeral: true
          })
        );
      });

      it('should validate staff member exists', async () => {
        // Mock permission check success
        mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(true);
        mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
          bypassAvailable: false
        });

        // Mock staff member validation
        mockBusinessRuleService.validateStaffMember = jest.fn().mockResolvedValue({
          valid: false,
          errors: ['User is not a staff member.'],
          warnings: [],
          bypassAvailable: false
        });

        // Mock staff not found
        mockStaffRepo.findByUserId = jest.fn().mockResolvedValue(null);

        await staffCommands.promoteStaff(
          mockUser,
          StaffRole.SENIOR_PARTNER,
          'Promotion reason',
          mockInteraction
        );

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  description: expect.stringContaining('User is not a staff member')
                })
              })
            ]),
            ephemeral: true
          })
        );
      });

      it('should validate role limit for promotion', async () => {
        // Mock permission check success
        mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(true);
        mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
          bypassAvailable: false
        });

        // Mock staff member exists
        mockStaffRepo.findByUserId = jest.fn().mockResolvedValue({
          userId: mockUser.id,
          role: StaffRole.JUNIOR_PARTNER,
          status: RetainerStatus.ACTIVE
        });

        mockBusinessRuleService.validateStaffMember = jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
          bypassAvailable: false
        });

        // Mock role limit validation failure
        mockBusinessRuleService.validateRoleLimit = jest.fn().mockResolvedValue({
          valid: false,
          errors: ['Senior Partner role limit reached (3/3).'],
          warnings: [],
          bypassAvailable: true
        });

        await staffCommands.promoteStaff(
          mockUser,
          StaffRole.SENIOR_PARTNER,
          'Promotion reason',
          mockInteraction
        );

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  description: expect.stringContaining('role limit reached')
                })
              })
            ]),
            ephemeral: true
          })
        );
      });
    });

    describe('demoteStaff validation', () => {
      beforeEach(() => {
        mockInteraction.options.getUser = jest.fn().mockReturnValue(mockUser);
        mockInteraction.options.getString = jest.fn()
          .mockReturnValueOnce(StaffRole.JUNIOR_PARTNER)
          .mockReturnValueOnce('Demotion reason');
      });

      it('should validate permissions before demoting', async () => {
        // Mock permission check failure
        mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(false);
        mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
          valid: false,
          errors: ['You do not have permission to demote staff members.'],
          warnings: [],
          bypassAvailable: false
        });

        await staffCommands.demoteStaff(
          mockUser,
          StaffRole.JUNIOR_PARTNER,
          'Demotion reason',
          mockInteraction
        );

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  description: expect.stringContaining('You do not have permission')
                })
              })
            ]),
            ephemeral: true
          })
        );
      });

      it('should validate entity before update', async () => {
        // Mock all validations as successful
        mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(true);
        mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
          bypassAvailable: false
        });

        mockStaffRepo.findByUserId = jest.fn().mockResolvedValue({
          userId: mockUser.id,
          role: StaffRole.SENIOR_PARTNER,
          status: RetainerStatus.ACTIVE
        });

        mockBusinessRuleService.validateStaffMember = jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
          bypassAvailable: false
        });

        // Entity validation should occur
        const mockCrossEntityService = (staffCommands as any).crossEntityValidationService;
        mockCrossEntityService.validateBeforeOperation = jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: []
        });

        await staffCommands.demoteStaff(
          mockUser,
          StaffRole.JUNIOR_PARTNER,
          'Demotion reason',
          mockInteraction
        );

        // Verify entity validation was called
        expect(mockCrossEntityService.validateBeforeOperation).toHaveBeenCalledWith(
          'staff',
          'update',
          'guild123',
          expect.any(Object)
        );
      });
    });
  });

  describe('CaseCommands Validation', () => {
    let caseCommands: CaseCommands;
    let mockCaseRepo: jest.Mocked<CaseRepository>;
    let mockPermissionService: jest.Mocked<PermissionService>;

    beforeEach(() => {
      caseCommands = new CaseCommands();
      
      // Access private services
      mockCaseRepo = (caseCommands as any).caseRepository;
      mockPermissionService = (caseCommands as any).permissionService;
    });

    describe('closeCase validation', () => {
      beforeEach(() => {
        mockInteraction.options.getString = jest.fn()
          .mockReturnValueOnce('settled')
          .mockReturnValueOnce('Case settled out of court');
        
        // Mock case exists in channel
        (caseCommands as any).getCaseFromChannel = jest.fn().mockResolvedValue({
          _id: new ObjectId(),
          caseNumber: 'CASE-001',
          clientId: 'client123',
          leadAttorneyId: 'attorney123',
          status: 'in_progress',
        createdAt: new Date(),
        updatedAt: new Date()
        });
      });

      it('should validate case permissions before closing', async () => {
        // Mock permission check failure
        mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(false);
        const mockBusinessRuleService = (caseCommands as any).businessRuleValidationService;
        mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
          valid: false,
          errors: ['You do not have permission to close cases.'],
          warnings: [],
          bypassAvailable: false
        });

        await caseCommands.closeCase(
          'settled',
          'Case settled out of court',
          mockInteraction
        );

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  description: expect.stringContaining('You do not have permission')
                })
              })
            ]),
            ephemeral: true
          })
        );
      });

      it('should validate entity before closing case', async () => {
        // Mock all validations as successful
        mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(true);
        const mockBusinessRuleService = (caseCommands as any).businessRuleValidationService;
        mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
          bypassAvailable: false
        });

        // Mock case in channel
        (caseCommands as any).getCaseFromChannel = jest.fn().mockResolvedValue({
          _id: new ObjectId(),
          caseNumber: 'CASE-001',
          clientId: mockUser.id, // User is the client
          status: 'in_progress',
        createdAt: new Date(),
        updatedAt: new Date()
        });

        // Mock cross-entity validation
        const mockCrossEntityService = (caseCommands as any).crossEntityValidationService;
        mockCrossEntityService.validateBeforeOperation = jest.fn().mockResolvedValue({
          valid: false,
          errors: [{ message: 'Case has pending reminders that must be resolved first.' }],
          warnings: []
        });

        await caseCommands.closeCase(
          'settled',
          'Case settled out of court',
          mockInteraction
        );

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  description: expect.stringContaining('pending reminders')
                })
              })
            ]),
            ephemeral: true
          })
        );
      });
    });
  });

  describe('JobsCommands Validation', () => {
    let jobsCommands: JobsCommands;
    let mockPermissionService: jest.Mocked<PermissionService>;
    let mockBusinessRuleService: jest.Mocked<BusinessRuleValidationService>;

    beforeEach(() => {
      jobsCommands = new JobsCommands();
      
      // Access private services
      mockPermissionService = (jobsCommands as any).permissionService;
      mockBusinessRuleService = (jobsCommands as any).businessRuleValidationService;
    });

    describe('add job validation', () => {
      beforeEach(() => {
        mockInteraction.options.getString = jest.fn()
          .mockReturnValueOnce('Senior Associate')
          .mockReturnValueOnce(StaffRole.SENIOR_ASSOCIATE)
          .mockReturnValueOnce('We are looking for a Senior Associate...')
          .mockReturnValueOnce('requirements');
        mockInteraction.options.getInteger = jest.fn().mockReturnValue(2);
      });

      it('should validate HR permissions', async () => {
        // Mock permission check failure
        mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(false);
        mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
          valid: false,
          errors: ['You do not have HR permission to manage jobs.'],
          warnings: [],
          bypassAvailable: false
        });

        await jobsCommands.add(
          'Senior Associate',
          StaffRole.SENIOR_ASSOCIATE,
          'We are looking for a Senior Associate...',
          'requirements',
          2,
          mockInteraction
        );

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  description: expect.stringContaining('HR permission')
                })
              })
            ]),
            ephemeral: true
          })
        );
      });

      it('should validate role limit for job creation', async () => {
        // Mock permission check success
        mockPermissionService.hasActionPermission = jest.fn().mockResolvedValue(true);
        mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
          bypassAvailable: false
        });

        // Mock role limit validation
        mockBusinessRuleService.validateRoleLimit = jest.fn().mockResolvedValue({
          valid: false,
          errors: ['Cannot create job: Senior Associate role limit is already at maximum (10/10).'],
          warnings: [],
          bypassAvailable: true
        });

        await jobsCommands.add(
          'Senior Associate',
          StaffRole.SENIOR_ASSOCIATE,
          'We are looking for a Senior Associate...',
          'requirements',
          2,
          mockInteraction
        );

        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  description: expect.stringContaining('role limit')
                })
              })
            ]),
            ephemeral: true
          })
        );
      });
    });

    describe('apply command validation', () => {
      it('should NOT have validation decorators', async () => {
        // The apply command should bypass validation
        // Mock no permission check - it should proceed without checking
        const mockJobRepo = (jobsCommands as any).jobRepository;
        mockJobRepo.findByFilters = jest.fn().mockResolvedValue([]);

        await jobsCommands.apply(mockInteraction);

        // Should not check permissions
        expect(mockPermissionService.hasActionPermission).not.toHaveBeenCalled();
        
        // Should show no jobs available
        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  title: 'No Open Positions'
                })
              })
            ])
          })
        );
      });
    });
  });

  describe('Validation Bypass for Guild Owners', () => {
    let staffCommands: StaffCommands;
    let mockBusinessRuleService: jest.Mocked<BusinessRuleValidationService>;

    beforeEach(() => {
      staffCommands = new StaffCommands();
      mockBusinessRuleService = (staffCommands as any).businessRuleValidationService;
      
      // Make interaction user the guild owner
      mockGuild.ownerId = mockUser.id;
    });

    it('should show bypass modal for guild owner when role limit reached', async () => {
      mockInteraction.options.getUser = jest.fn().mockReturnValue(mockUser);
      mockInteraction.options.getString = jest.fn()
        .mockReturnValueOnce(StaffRole.MANAGING_PARTNER)
        .mockReturnValueOnce('testuser')
        .mockReturnValueOnce('Exceptional candidate');

      // Mock permission validation success
      mockBusinessRuleService.validatePermission = jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false
      });

      // Mock role limit validation with bypass available
      mockBusinessRuleService.validateRoleLimit = jest.fn().mockResolvedValue({
        valid: false,
        errors: ['Managing Partner role limit reached (1/1).'],
        warnings: [],
        bypassAvailable: true,
        bypassType: 'role_limit'
      });

      const mockCommandValidationService = (staffCommands as any).commandValidationService;
      mockCommandValidationService.validateCommand = jest.fn().mockResolvedValue({
        isValid: false,
        errors: ['Managing Partner role limit reached (1/1).'],
        warnings: [],
        requiresConfirmation: true,
        bypassRequests: [{
          validationResult: {
            valid: false,
            errors: ['Managing Partner role limit reached (1/1).'],
            warnings: [],
            bypassAvailable: true
          },
          context: {}
        }]
      });

      await staffCommands.hireStaff(
        mockUser,
        StaffRole.MANAGING_PARTNER,
        'testuser',
        'Exceptional candidate',
        mockInteraction
      );

      // Should show modal for bypass
      expect(mockInteraction.showModal).toHaveBeenCalled();
    });
  });

  describe('Command Validation Integration', () => {
    it('should properly integrate validation services across commands', async () => {
      const staffCommands = new StaffCommands();
      const caseCommands = new CaseCommands();
      const jobsCommands = new JobsCommands();

      // Verify all commands have validation services initialized
      expect((staffCommands as any).commandValidationService).toBeDefined();
      expect((staffCommands as any).businessRuleValidationService).toBeDefined();
      expect((staffCommands as any).crossEntityValidationService).toBeDefined();
      expect((staffCommands as any).permissionService).toBeDefined();

      expect((caseCommands as any).commandValidationService).toBeDefined();
      expect((caseCommands as any).businessRuleValidationService).toBeDefined();
      expect((caseCommands as any).crossEntityValidationService).toBeDefined();
      expect((caseCommands as any).permissionService).toBeDefined();

      expect((jobsCommands as any).commandValidationService).toBeDefined();
      expect((jobsCommands as any).businessRuleValidationService).toBeDefined();
      expect((jobsCommands as any).crossEntityValidationService).toBeDefined();
      expect((jobsCommands as any).permissionService).toBeDefined();
    });
  });
});