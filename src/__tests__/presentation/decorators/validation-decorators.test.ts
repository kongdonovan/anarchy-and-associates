import { CommandInteraction } from 'discord.js';
import { 
  ValidateCommand, 
  ValidatePermissions, 
  ValidateEntity, 
  ValidateBusinessRules,
  clearValidationRules,
  addCustomValidationRule
} from '../../../presentation/decorators/validation-decorators';
import { CommandValidationService } from '../../../application/services/command-validation-service';
import { BusinessRuleValidationService } from '../../../application/services/business-rule-validation-service';
import { CrossEntityValidationService } from '../../../application/services/cross-entity-validation-service';
import { PermissionContext } from '../../../application/services/permission-service';
import { logger } from '../../../infrastructure/logger';

// Mock logger
jest.mock('../../../infrastructure/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Validation Decorators', () => {
  let mockInteraction: jest.Mocked<CommandInteraction>;
  let mockCommandValidationService: jest.Mocked<CommandValidationService>;
  let mockBusinessRuleValidationService: jest.Mocked<BusinessRuleValidationService>;
  let mockCrossEntityValidationService: jest.Mocked<CrossEntityValidationService>;
  let TestClass: any;
  let testInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    clearValidationRules();

    // Create mock interaction
    mockInteraction = {
      isCommand: jest.fn().mockReturnValue(true),
      guildId: 'guild123',
      user: { id: 'user123' },
      guild: { ownerId: 'owner123' },
      reply: jest.fn(),
      showModal: jest.fn(),
      deferred: false,
      replied: false,
      options: {
        getSubcommand: jest.fn().mockReturnValue(null),
        data: []
      }
    } as unknown as jest.Mocked<CommandInteraction>;

    // Create mock services
    mockCommandValidationService = {
      validateCommand: jest.fn(),
      extractValidationContext: jest.fn(),
      createBypassModal: jest.fn()
    } as unknown as jest.Mocked<CommandValidationService>;

    mockBusinessRuleValidationService = {
      validatePermission: jest.fn(),
      validateRoleLimit: jest.fn(),
      validateClientCaseLimit: jest.fn(),
      validateStaffMember: jest.fn()
    } as unknown as jest.Mocked<BusinessRuleValidationService>;

    mockCrossEntityValidationService = {
      validateBeforeOperation: jest.fn()
    } as unknown as jest.Mocked<CrossEntityValidationService>;

    // Create test class
    class TestCommandClass {
      commandValidationService = mockCommandValidationService;
      businessRuleValidationService = mockBusinessRuleValidationService;
      crossEntityValidationService = mockCrossEntityValidationService;

      async getPermissionContext(interaction: CommandInteraction): Promise<PermissionContext> {
        return {
          guildId: interaction.guildId!,
          userId: interaction.user.id,
          userRoles: [],
          isGuildOwner: interaction.guild?.ownerId === interaction.user.id
        };
      }

      createErrorEmbed(title: string, message: string) {
        return { title, message };
      }

      createInfoEmbed(title: string, message: string) {
        return { title, message };
      }

      @ValidateCommand()
      async testMethod(interaction: CommandInteraction) {
        return 'success';
      }

      @ValidatePermissions('admin')
      async testPermissionMethod(interaction: CommandInteraction) {
        return 'success';
      }

      @ValidateEntity('staff', 'update')
      async testEntityMethod(interaction: CommandInteraction) {
        return 'success';
      }

      @ValidateBusinessRules('role_limit')
      async testBusinessRuleMethod(interaction: CommandInteraction) {
        return 'success';
      }

      @ValidatePermissions('senior-staff')
      @ValidateBusinessRules('role_limit', 'staff_member')
      @ValidateEntity('staff', 'create')
      async testCombinedMethod(interaction: CommandInteraction) {
        return 'success';
      }
    }

    TestClass = TestCommandClass;
    testInstance = new TestClass();
  });

  describe('@ValidateCommand', () => {
    it('should execute method when validation passes', async () => {
      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
        commandName: 'test',
        options: {}
      });

      mockCommandValidationService.validateCommand.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const result = await testInstance.testMethod(mockInteraction);

      expect(result).toBe('success');
      expect(mockCommandValidationService.validateCommand).toHaveBeenCalled();
      expect(mockInteraction.reply).not.toHaveBeenCalled();
    });

    it('should block method execution when validation fails', async () => {
      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
        commandName: 'test',
        options: {}
      });

      mockCommandValidationService.validateCommand.mockResolvedValue({
        isValid: false,
        errors: ['Validation failed'],
        warnings: []
      });

      const result = await testInstance.testMethod(mockInteraction);

      expect(result).toBeUndefined();
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [{ title: 'Validation Failed', message: 'Validation failed' }],
        ephemeral: true
      });
    });

    it('should show warnings but continue execution', async () => {
      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
        commandName: 'test',
        options: {}
      });

      mockCommandValidationService.validateCommand.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: ['This is a warning']
      });

      const result = await new Promise((resolve) => {
        testInstance.testMethod(mockInteraction).then(resolve);
        // Wait for the timeout
        setTimeout(() => {}, 150);
      });

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [{ title: 'Validation Warnings', message: 'This is a warning' }],
        ephemeral: true
      });
      // Method should still execute after warning
      expect(result).toBe('success');
    });

    it('should show bypass modal for guild owner', async () => {
      mockInteraction.guild!.ownerId = mockInteraction.user.id; // Make user guild owner

      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: true },
        commandName: 'test',
        options: {}
      });

      mockCommandValidationService.validateCommand.mockResolvedValue({
        isValid: false,
        errors: ['Role limit reached'],
        warnings: [],
        requiresConfirmation: true,
        bypassRequests: [{
          validationResult: { valid: false, errors: ['Role limit reached'], warnings: [], bypassAvailable: true },
          context: {} as any
        }]
      });

      const modal = { customId: 'bypass_modal' };
      mockCommandValidationService.createBypassModal.mockReturnValue(modal as any);

      await testInstance.testMethod(mockInteraction);

      expect(mockInteraction.showModal).toHaveBeenCalledWith(modal);
      expect(mockInteraction.reply).not.toHaveBeenCalled();
    });
  });

  describe('@ValidatePermissions', () => {
    it('should validate permissions correctly', async () => {
      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
        commandName: 'test',
        options: {}
      });

      mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
        valid: false,
        errors: ['You do not have admin permission'],
        warnings: [],
        bypassAvailable: false
      });

      mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
        // Execute the custom rules that were added by the decorator
        const customRules = options?.customRules || [];
        for (const rule of customRules) {
          const result = await rule.validate(context);
          if (!result.valid) {
            return {
              isValid: false,
              errors: result.errors,
              warnings: result.warnings
            };
          }
        }
        return { isValid: true, errors: [], warnings: [] };
      });

      await testInstance.testPermissionMethod(mockInteraction);

      expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: 'guild123', userId: 'user123' }),
        'admin'
      );
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [{ title: 'Validation Failed', message: 'You do not have admin permission' }],
        ephemeral: true
      });
    });
  });

  describe('@ValidateEntity', () => {
    it('should validate entity operations correctly', async () => {
      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
        commandName: 'test',
        options: { user: 'user456' }
      });

      mockCrossEntityValidationService.validateBeforeOperation.mockResolvedValue({
        valid: false,
        errors: [{ message: 'Staff member has active cases' }],
        warnings: []
      });

      mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
        const customRules = options?.customRules || [];
        for (const rule of customRules) {
          const result = await rule.validate(context);
          if (!result.valid) {
            return {
              isValid: false,
              errors: result.errors,
              warnings: result.warnings
            };
          }
        }
        return { isValid: true, errors: [], warnings: [] };
      });

      await testInstance.testEntityMethod(mockInteraction);

      expect(mockCrossEntityValidationService.validateBeforeOperation).toHaveBeenCalledWith(
        'staff',
        'update',
        'guild123',
        { user: 'user456' }
      );
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [{ title: 'Validation Failed', message: 'Staff member has active cases' }],
        ephemeral: true
      });
    });
  });

  describe('@ValidateBusinessRules', () => {
    it('should validate role limit rule', async () => {
      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
        commandName: 'test',
        options: { role: 'Managing Partner' }
      });

      mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
        valid: false,
        errors: ['Managing Partner role limit reached (1/1)'],
        warnings: [],
        bypassAvailable: true
      });

      mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
        const customRules = options?.customRules || [];
        for (const rule of customRules) {
          const result = await rule.validate(context);
          if (!result.valid) {
            return {
              isValid: false,
              errors: result.errors,
              warnings: result.warnings,
              requiresConfirmation: result.bypassAvailable,
              bypassRequests: result.bypassAvailable ? [{ validationResult: result, context }] : []
            };
          }
        }
        return { isValid: true, errors: [], warnings: [] };
      });

      await testInstance.testBusinessRuleMethod(mockInteraction);

      expect(mockBusinessRuleValidationService.validateRoleLimit).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: 'guild123' }),
        'Managing Partner'
      );
    });

    it('should validate multiple business rules', async () => {
      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
        commandName: 'test',
        options: { role: 'Senior Partner', user: 'user456' }
      });

      // All validations pass
      mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false
      });

      mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false
      });

      mockBusinessRuleValidationService.validateStaffMember.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false
      });

      mockCrossEntityValidationService.validateBeforeOperation.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      mockCommandValidationService.validateCommand.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const result = await testInstance.testCombinedMethod(mockInteraction);

      expect(result).toBe('success');
      expect(mockInteraction.reply).not.toHaveBeenCalled();
    });
  });

  describe('addCustomValidationRule', () => {
    it('should allow adding custom validation rules', async () => {
      const customRule = {
        name: 'custom_rule',
        priority: 5,
        bypassable: false,
        validate: jest.fn().mockResolvedValue({
          valid: false,
          errors: ['Custom validation failed'],
          warnings: [],
          bypassAvailable: false
        })
      };

      addCustomValidationRule(testInstance, 'testMethod', customRule);

      mockCommandValidationService.extractValidationContext.mockResolvedValue({
        interaction: mockInteraction,
        permissionContext: { guildId: 'guild123', userId: 'user123', userRoles: [], isGuildOwner: false },
        commandName: 'test',
        options: {}
      });

      mockCommandValidationService.validateCommand.mockImplementation(async (context, options) => {
        const customRules = options?.customRules || [];
        for (const rule of customRules) {
          const result = await rule.validate(context);
          if (!result.valid) {
            return {
              isValid: false,
              errors: result.errors,
              warnings: result.warnings
            };
          }
        }
        return { isValid: true, errors: [], warnings: [] };
      });

      await testInstance.testMethod(mockInteraction);

      expect(customRule.validate).toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [{ title: 'Validation Failed', message: 'Custom validation failed' }],
        ephemeral: true
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing validation service gracefully', async () => {
      testInstance.commandValidationService = undefined;

      const result = await testInstance.testMethod(mockInteraction);

      expect(result).toBe('success');
      expect(logger.warn).toHaveBeenCalledWith(
        'CommandValidationService not found in command class',
        expect.any(Object)
      );
    });

    it('should handle validation errors gracefully', async () => {
      mockCommandValidationService.extractValidationContext.mockRejectedValue(
        new Error('Context extraction failed')
      );

      const result = await testInstance.testMethod(mockInteraction);

      expect(result).toBe('success');
      expect(logger.error).toHaveBeenCalledWith(
        'Error in validation decorator:',
        expect.any(Error)
      );
    });

    it('should handle non-command interactions', async () => {
      mockInteraction.isCommand.mockReturnValue(false);

      const result = await testInstance.testMethod(mockInteraction);

      expect(result).toBe('success');
      expect(mockCommandValidationService.validateCommand).not.toHaveBeenCalled();
    });
  });
});