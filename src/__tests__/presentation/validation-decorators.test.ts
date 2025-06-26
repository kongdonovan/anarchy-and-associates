import { CommandInteraction } from 'discord.js';
import { ValidateCommand, ValidatePermissions, ValidateEntity, ValidateBusinessRules, clearValidationRules } from '../../presentation/decorators/validation-decorators';
import { CommandValidationService } from '../../application/services/command-validation-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { CrossEntityValidationService } from '../../application/services/cross-entity-validation-service';
import { PermissionContext } from '../../application/services/permission-service';
import { StaffRole } from '../../domain/entities/staff-role';

// Mock logger
jest.mock('../../infrastructure/logger');

describe('Validation Decorators', () => {
  let mockCommandValidationService: jest.Mocked<CommandValidationService>;
  let mockBusinessRuleValidationService: jest.Mocked<BusinessRuleValidationService>;
  let mockCrossEntityValidationService: jest.Mocked<CrossEntityValidationService>;
  let mockInteraction: jest.Mocked<CommandInteraction>;
  let testInstance: any;

  beforeEach(() => {
    clearValidationRules();

    // Create mock services
    mockCommandValidationService = {
      validateCommand: jest.fn(),
      extractValidationContext: jest.fn(),
      createBypassModal: jest.fn(),
    } as any;

    mockBusinessRuleValidationService = {
      validatePermission: jest.fn(),
      validateRoleLimit: jest.fn(),
      validateClientCaseLimit: jest.fn(),
      validateStaffMember: jest.fn(),
    } as any;

    mockCrossEntityValidationService = {
      validateBeforeOperation: jest.fn(),
    } as any;

    // Create mock interaction
    mockInteraction = {
      commandName: 'test',
      isCommand: jest.fn().mockReturnValue(true),
      reply: jest.fn(),
      showModal: jest.fn(),
      options: {
        getSubcommand: jest.fn().mockReturnValue(null),
        data: [],
      },
    } as any;

    // Create test class instance
    testInstance = {
      commandValidationService: mockCommandValidationService,
      businessRuleValidationService: mockBusinessRuleValidationService,
      crossEntityValidationService: mockCrossEntityValidationService,
      getPermissionContext: jest.fn().mockResolvedValue({
        guildId: 'guild123',
        userId: 'user123',
        userRoles: ['role1'],
        isGuildOwner: false,
      }),
      createErrorEmbed: jest.fn().mockReturnValue({ title: 'Error' }),
      createInfoEmbed: jest.fn().mockReturnValue({ title: 'Info' }),
    };
  });

  describe('@ValidateCommand', () => {
    it('should perform validation before executing method', async () => {
      // Mock successful validation
      mockCommandValidationService.validateCommand.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: testInstance.getPermissionContext(),
        commandName: 'test',
        options: {},
      });

      class TestCommand {
        commandValidationService = mockCommandValidationService;
        getPermissionContext = testInstance.getPermissionContext;

        @ValidateCommand()
        async testMethod(interaction: CommandInteraction) {
          return 'success';
        }
      }

      const instance = new TestCommand();
      const result = await instance.testMethod(mockInteraction);

      expect(mockCommandValidationService.validateCommand).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should block execution when validation fails', async () => {
      // Mock failed validation
      mockCommandValidationService.validateCommand.mockResolvedValue({
        isValid: false,
        errors: ['Validation failed'],
        warnings: [],
      });

      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: testInstance.getPermissionContext(),
        commandName: 'test',
        options: {},
      });

      class TestCommand {
        commandValidationService = mockCommandValidationService;
        getPermissionContext = testInstance.getPermissionContext;
        createErrorEmbed = testInstance.createErrorEmbed;

        @ValidateCommand()
        async testMethod(interaction: CommandInteraction) {
          return 'should not reach here';
        }
      }

      const instance = new TestCommand();
      const result = await instance.testMethod(mockInteraction);

      expect(mockCommandValidationService.validateCommand).toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [{ title: 'Error' }],
        ephemeral: true,
      });
      expect(result).toBeUndefined();
    });

    it('should show bypass modal for guild owner when available', async () => {
      const permissionContext = {
        guildId: 'guild123',
        userId: 'user123',
        userRoles: ['role1'],
        isGuildOwner: true,
      };

      testInstance.getPermissionContext.mockResolvedValue(permissionContext);

      // Mock validation with bypass available
      mockCommandValidationService.validateCommand.mockResolvedValue({
        isValid: false,
        errors: ['Role limit exceeded'],
        warnings: [],
        requiresConfirmation: true,
        bypassRequests: [{}],
      });

      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext,
        commandName: 'test',
        options: {},
      });

      const mockModal = { setCustomId: jest.fn() };
      mockCommandValidationService.createBypassModal.mockReturnValue(mockModal as any);

      class TestCommand {
        commandValidationService = mockCommandValidationService;
        getPermissionContext = testInstance.getPermissionContext;

        @ValidateCommand()
        async testMethod(interaction: CommandInteraction) {
          return 'should not reach here';
        }
      }

      const instance = new TestCommand();
      await instance.testMethod(mockInteraction);

      expect(mockInteraction.showModal).toHaveBeenCalledWith(mockModal);
    });
  });

  describe('@ValidatePermissions', () => {
    it('should add permission validation rule', async () => {
      mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
        // Check that custom rules include permission validation
        expect(options?.customRules).toBeDefined();
        expect(options?.customRules?.length).toBeGreaterThan(0);
        
        const permissionRule = options?.customRules?.find(r => r.name.startsWith('permission_'));
        expect(permissionRule).toBeDefined();
        
        // Execute the permission validation
        if (permissionRule) {
          await permissionRule.validate(context);
        }
        
        return { isValid: true, errors: [], warnings: [] };
      });

      mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        hasPermission: true,
        requiredPermission: 'admin',
        grantedPermissions: ['admin'],
      });

      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: testInstance.getPermissionContext(),
        commandName: 'test',
        options: {},
      });

      class TestCommand {
        commandValidationService = mockCommandValidationService;
        businessRuleValidationService = mockBusinessRuleValidationService;
        getPermissionContext = testInstance.getPermissionContext;

        @ValidatePermissions('admin')
        async testMethod(interaction: CommandInteraction) {
          return 'success';
        }
      }

      const instance = new TestCommand();
      await instance.testMethod(mockInteraction);

      expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalled();
    });
  });

  describe('@ValidateEntity', () => {
    it('should add entity validation rule', async () => {
      mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
        // Check that custom rules include entity validation
        const entityRule = options?.customRules?.find(r => r.name.startsWith('entity_'));
        expect(entityRule).toBeDefined();
        
        // Execute the entity validation
        if (entityRule) {
          await entityRule.validate(context);
        }
        
        return { isValid: true, errors: [], warnings: [] };
      });

      mockCrossEntityValidationService.validateBeforeOperation.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: testInstance.getPermissionContext(),
        commandName: 'test',
        options: { userId: 'user123' },
      });

      class TestCommand {
        commandValidationService = mockCommandValidationService;
        crossEntityValidationService = mockCrossEntityValidationService;
        getPermissionContext = testInstance.getPermissionContext;

        @ValidateEntity('staff', 'delete')
        async testMethod(interaction: CommandInteraction) {
          return 'success';
        }
      }

      const instance = new TestCommand();
      await instance.testMethod(mockInteraction);

      expect(mockCrossEntityValidationService.validateBeforeOperation).toHaveBeenCalledWith(
        'staff',
        'delete',
        'guild123',
        { userId: 'user123' }
      );
    });
  });

  describe('@ValidateBusinessRules', () => {
    it('should validate role limits', async () => {
      mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
        // Check that custom rules include business rule validation
        const businessRule = options?.customRules?.find(r => r.name.includes('role_limit'));
        expect(businessRule).toBeDefined();
        
        // Execute the business rule validation
        if (businessRule) {
          await businessRule.validate(context);
        }
        
        return { isValid: true, errors: [], warnings: [] };
      });

      mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        currentCount: 5,
        maxCount: 10,
        roleName: StaffRole.JUNIOR_ASSOCIATE,
      });

      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: testInstance.getPermissionContext(),
        commandName: 'staff',
        subcommandName: 'hire',
        options: { role: StaffRole.JUNIOR_ASSOCIATE },
      });

      class TestCommand {
        commandValidationService = mockCommandValidationService;
        businessRuleValidationService = mockBusinessRuleValidationService;
        getPermissionContext = testInstance.getPermissionContext;

        @ValidateBusinessRules('role_limit')
        async testMethod(interaction: CommandInteraction) {
          return 'success';
        }
      }

      const instance = new TestCommand();
      await instance.testMethod(mockInteraction);

      expect(mockBusinessRuleValidationService.validateRoleLimit).toHaveBeenCalled();
    });

    it('should validate client case limits', async () => {
      mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
        const businessRule = options?.customRules?.find(r => r.name.includes('client_case_limit'));
        if (businessRule) {
          await businessRule.validate(context);
        }
        return { isValid: true, errors: [], warnings: [] };
      });

      mockBusinessRuleValidationService.validateClientCaseLimit.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        currentCases: 3,
        maxCases: 5,
        clientId: 'client123',
      });

      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: testInstance.getPermissionContext(),
        commandName: 'case',
        subcommandName: 'create',
        options: { client: 'client123' },
      });

      class TestCommand {
        commandValidationService = mockCommandValidationService;
        businessRuleValidationService = mockBusinessRuleValidationService;
        getPermissionContext = testInstance.getPermissionContext;

        @ValidateBusinessRules('client_case_limit')
        async testMethod(interaction: CommandInteraction) {
          return 'success';
        }
      }

      const instance = new TestCommand();
      await instance.testMethod(mockInteraction);

      expect(mockBusinessRuleValidationService.validateClientCaseLimit).toHaveBeenCalledWith(
        'client123',
        'guild123'
      );
    });
  });

  describe('Multiple decorators', () => {
    it('should apply multiple validation decorators in order', async () => {
      const executionOrder: string[] = [];

      mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
        // Track execution of rules
        options?.customRules?.forEach(rule => {
          executionOrder.push(rule.name);
        });
        return { isValid: true, errors: [], warnings: [] };
      });

      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: testInstance.getPermissionContext(),
        commandName: 'staff',
        subcommandName: 'fire',
        options: { user: 'user123' },
      });

      class TestCommand {
        commandValidationService = mockCommandValidationService;
        businessRuleValidationService = mockBusinessRuleValidationService;
        crossEntityValidationService = mockCrossEntityValidationService;
        getPermissionContext = testInstance.getPermissionContext;

        @ValidatePermissions('senior-staff')
        @ValidateBusinessRules('staff_member')
        @ValidateEntity('staff', 'delete')
        async testMethod(interaction: CommandInteraction) {
          return 'success';
        }
      }

      const instance = new TestCommand();
      await instance.testMethod(mockInteraction);

      // Verify all decorators were applied
      expect(executionOrder).toContain('permission_hr');
      expect(executionOrder).toContain('business_rule_staff_member');
      expect(executionOrder).toContain('entity_staff_delete');
    });
  });
});