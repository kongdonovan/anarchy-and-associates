import { CommandInteraction, Guild, User } from 'discord.js';
import { CommandValidationService, CommandValidationContext, CommandValidationOptions } from '../../application/services/command-validation-service';
import { BusinessRuleValidationService } from '../../application/services/business-rule-validation-service';
import { CrossEntityValidationService } from '../../application/services/cross-entity-validation-service';
import { PermissionContext } from '../../application/services/permission-service';
import { StaffRole } from '../../domain/entities/staff-role';

// Mock Discord.js
jest.mock('discord.js');

describe('CommandValidationService', () => {
  let commandValidationService: CommandValidationService;
  let mockBusinessRuleValidationService: jest.Mocked<BusinessRuleValidationService>;
  let mockCrossEntityValidationService: jest.Mocked<CrossEntityValidationService>;
  let mockInteraction: jest.Mocked<CommandInteraction>;
  let mockPermissionContext: PermissionContext;

  beforeEach(() => {
    // Create mock services
    mockBusinessRuleValidationService = {
      validateRoleLimit: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        currentCount: 0,
        maxCount: 10,
        roleName: StaffRole.JUNIOR_ASSOCIATE
      }),
      validateClientCaseLimit: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        currentCases: 0,
        maxCases: 5,
        clientId: 'client123'
      }),
      validateStaffMember: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false
      }),
      validatePermission: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        hasPermission: true,
        requiredPermission: 'senior-staff',
        grantedPermissions: ['senior-staff']
      }),
      validateMultiple: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false
      }),
    } as any;

    mockCrossEntityValidationService = {
      validateBeforeOperation: jest.fn().mockResolvedValue([]),
      validateEntity: jest.fn().mockResolvedValue([]),
      scanForIntegrityIssues: jest.fn().mockResolvedValue([]),
      repairIntegrityIssues: jest.fn().mockResolvedValue({ repaired: 0, failed: 0 }),
      batchValidate: jest.fn().mockResolvedValue([]),
    } as any;

    // Create service instance
    commandValidationService = new CommandValidationService(
      mockBusinessRuleValidationService,
      mockCrossEntityValidationService
    );

    // Create mock interaction
    mockInteraction = {
      commandName: 'staff',
      guildId: 'guild123',
      user: { id: 'user123' } as User,
      options: {
        getSubcommand: jest.fn().mockReturnValue('hire'),
        data: [
          { name: 'user', value: 'targetUser123' },
          { name: 'role', value: StaffRole.JUNIOR_ASSOCIATE },
        ],
      },
      guild: {
        id: 'guild123',
        ownerId: 'owner123',
        members: {
          cache: new Map(),
        },
      } as unknown as Guild,
      reply: jest.fn(),
      showModal: jest.fn(),
      isChatInputCommand: jest.fn().mockReturnValue(true),
    } as any;

    // Create mock permission context
    mockPermissionContext = {
      guildId: 'guild123',
      userId: 'user123',
      userRoles: ['role1', 'role2'],
      isGuildOwner: false,
    };
  });

  describe('validateCommand', () => {
    it('should pass validation when all rules pass', async () => {
      // Mock successful validations
      mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        hasPermission: true,
        requiredPermission: 'senior-staff',
        grantedPermissions: ['senior-staff'],
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

      const context: CommandValidationContext = {
        interaction: mockInteraction,
        permissionContext: mockPermissionContext,
        commandName: 'staff',
        subcommandName: 'hire',
        options: { role: StaffRole.JUNIOR_ASSOCIATE },
      };

      const result = await commandValidationService.validateCommand(context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.requiresConfirmation).toBeFalsy();
    });

    it('should fail validation when permission check fails', async () => {
      // Mock failed permission validation
      mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
        valid: false,
        errors: ['Missing required permission: hr'],
        warnings: [],
        bypassAvailable: false,
        hasPermission: false,
        requiredPermission: 'senior-staff',
        grantedPermissions: [],
      });

      const context: CommandValidationContext = {
        interaction: mockInteraction,
        permissionContext: mockPermissionContext,
        commandName: 'staff',
        subcommandName: 'hire',
        options: { role: StaffRole.JUNIOR_ASSOCIATE },
      };

      const result = await commandValidationService.validateCommand(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required permission: hr');
      expect(result.requiresConfirmation).toBeFalsy();
    });

    it('should offer bypass option for guild owner when validation fails', async () => {
      // Set user as guild owner
      mockPermissionContext.isGuildOwner = true;

      // Mock failed validation with bypass available
      mockBusinessRuleValidationService.validateRoleLimit.mockResolvedValue({
        valid: false,
        errors: ['Cannot hire Junior Associate. Maximum limit of 10 reached'],
        warnings: [],
        bypassAvailable: true,
        bypassType: 'guild-owner',
        currentCount: 10,
        maxCount: 10,
        roleName: StaffRole.JUNIOR_ASSOCIATE,
      });

      mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        hasPermission: true,
        requiredPermission: 'senior-staff',
        grantedPermissions: ['senior-staff'],
      });

      const context: CommandValidationContext = {
        interaction: mockInteraction,
        permissionContext: mockPermissionContext,
        commandName: 'staff',
        subcommandName: 'hire',
        options: { role: StaffRole.JUNIOR_ASSOCIATE },
      };

      const result = await commandValidationService.validateCommand(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot hire Junior Associate. Maximum limit of 10 reached');
      expect(result.requiresConfirmation).toBe(true);
      expect(result.bypassRequests).toHaveLength(1);
    });

    it('should skip specific validation types when options are set', async () => {
      const context: CommandValidationContext = {
        interaction: mockInteraction,
        permissionContext: mockPermissionContext,
        commandName: 'staff',
        subcommandName: 'hire',
        options: { role: StaffRole.JUNIOR_ASSOCIATE },
      };

      const options: CommandValidationOptions = {
        skipPermissionCheck: true,
        skipBusinessRules: true,
      };

      const result = await commandValidationService.validateCommand(context, options);

      expect(result.isValid).toBe(true);
      expect(mockBusinessRuleValidationService.validatePermission).not.toHaveBeenCalled();
      expect(mockBusinessRuleValidationService.validateRoleLimit).not.toHaveBeenCalled();
    });

    it('should cache validation results', async () => {
      // Mock successful validation
      mockBusinessRuleValidationService.validatePermission.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        bypassAvailable: false,
        hasPermission: true,
        requiredPermission: 'senior-staff',
        grantedPermissions: ['senior-staff'],
      });

      const context: CommandValidationContext = {
        interaction: mockInteraction,
        permissionContext: mockPermissionContext,
        commandName: 'staff',
        subcommandName: 'hire',
        options: { role: StaffRole.JUNIOR_ASSOCIATE },
      };

      // First call
      await commandValidationService.validateCommand(context);
      expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await commandValidationService.validateCommand(context);
      expect(mockBusinessRuleValidationService.validatePermission).toHaveBeenCalledTimes(1);
    });

    it('should handle custom validation rules', async () => {
      const customValidationFn = jest.fn().mockResolvedValue({
        valid: false,
        errors: ['Custom validation failed'],
        warnings: [],
        bypassAvailable: false,
      });

      const context: CommandValidationContext = {
        interaction: mockInteraction,
        permissionContext: mockPermissionContext,
        commandName: 'custom',
        subcommandName: undefined,
        options: {},
      };

      const options: CommandValidationOptions = {
        skipPermissionCheck: true,
        skipBusinessRules: true,
        customRules: [
          {
            name: 'custom_rule',
            validate: customValidationFn,
            priority: 0,
          },
        ],
      };

      const result = await commandValidationService.validateCommand(context, options);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Custom validation failed');
      expect(customValidationFn).toHaveBeenCalledWith(context);
    });

    it('should handle entity validation for operations', async () => {
      mockCrossEntityValidationService.validateBeforeOperation.mockResolvedValue([
        { 
          severity: 'critical',
          entityType: 'staff',
          entityId: 'targetUser123',
          field: 'staff',
          message: 'Entity has dependencies',
          canAutoRepair: false
        }
      ]);

      const context: CommandValidationContext = {
        interaction: mockInteraction,
        permissionContext: mockPermissionContext,
        commandName: 'staff',
        subcommandName: 'fire',
        options: { user: 'targetUser123' },
      };

      const result = await commandValidationService.validateCommand(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Entity has dependencies');
      expect(mockCrossEntityValidationService.validateBeforeOperation).toHaveBeenCalledWith(
        { user: 'targetUser123', guildId: 'guild123' },
        'staff',
        'delete',
        { guildId: 'guild123' }
      );
    });

    it('should include warnings in validation result', async () => {
      mockBusinessRuleValidationService.validateClientCaseLimit.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ['Client has 4 active cases (limit: 5)'],
        bypassAvailable: false,
        currentCases: 4,
        maxCases: 5,
        clientId: 'client123',
      });

      const context: CommandValidationContext = {
        interaction: mockInteraction,
        permissionContext: mockPermissionContext,
        commandName: 'case',
        subcommandName: 'create',
        options: { client: 'client123' },
      };

      const result = await commandValidationService.validateCommand(context);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Client has 4 active cases (limit: 5)');
    });
  });

  describe('handleBypassConfirmation', () => {
    it('should confirm bypass when pending bypasses exist', async () => {
      // Set up pending bypasses
      const bypassRequest = {
        validationResult: {
          valid: false,
          errors: ['Test error'],
          warnings: [],
          bypassAvailable: true,
        },
        context: {
          interaction: mockInteraction,
          permissionContext: mockPermissionContext,
          commandName: 'staff',
          subcommandName: 'hire',
          options: {},
        },
      };

      // Store pending bypass
      commandValidationService['pendingBypasses'].set('user123', [bypassRequest]);

      const mockButtonInteraction = {
        user: { id: 'user123' },
        reply: jest.fn(),
      } as any;

      const result = await commandValidationService.handleBypassConfirmation(
        mockButtonInteraction,
        'user123'
      );

      expect(result).toBe(true);
      expect(commandValidationService.getPendingBypasses('user123')).toBeUndefined();
    });

    it('should fail bypass when no pending bypasses exist', async () => {
      const mockButtonInteraction = {
        user: { id: 'user123' },
        reply: jest.fn(),
      } as any;

      const result = await commandValidationService.handleBypassConfirmation(
        mockButtonInteraction,
        'user123'
      );

      expect(result).toBe(false);
      expect(mockButtonInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
        })
      );
    });
  });

  describe('extractValidationContext', () => {
    it('should extract context from interaction correctly', async () => {
      const context = await commandValidationService.extractValidationContext(
        mockInteraction,
        mockPermissionContext
      );

      expect(context.commandName).toBe('staff');
      expect(context.subcommandName).toBe('hire');
      expect(context.options).toEqual({
        user: 'targetUser123',
        role: StaffRole.JUNIOR_ASSOCIATE,
      });
      expect(context.metadata).toEqual({
        guildId: 'guild123',
        userId: 'user123',
        channelId: undefined,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('clearValidationCache', () => {
    it('should clear all cache entries when no context provided', () => {
      // Add some cache entries
      commandValidationService['validationCache'].set('key1', {
        result: { isValid: true, errors: [], warnings: [] },
        timestamp: Date.now(),
      });
      commandValidationService['validationCache'].set('key2', {
        result: { isValid: true, errors: [], warnings: [] },
        timestamp: Date.now(),
      });

      commandValidationService.clearValidationCache();

      expect(commandValidationService['validationCache'].size).toBe(0);
    });

    it('should clear specific cache entry when context provided', () => {
      const context: CommandValidationContext = {
        interaction: mockInteraction,
        permissionContext: mockPermissionContext,
        commandName: 'staff',
        subcommandName: 'hire',
        options: { role: StaffRole.JUNIOR_ASSOCIATE },
      };

      const cacheKey = commandValidationService['getCacheKey'](context);
      
      // Add cache entries
      commandValidationService['validationCache'].set(cacheKey, {
        result: { isValid: true, errors: [], warnings: [] },
        timestamp: Date.now(),
      });
      commandValidationService['validationCache'].set('otherKey', {
        result: { isValid: true, errors: [], warnings: [] },
        timestamp: Date.now(),
      });

      commandValidationService.clearValidationCache(context);

      expect(commandValidationService['validationCache'].has(cacheKey)).toBe(false);
      expect(commandValidationService['validationCache'].has('otherKey')).toBe(true);
    });
  });
});