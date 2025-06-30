import { UnifiedValidationService } from '../../../application/validation/unified-validation-service';
import {
  ValidationStrategy,
  ValidationContext,
  ValidationResult,
  ValidationResultHelper,
  ValidationSeverity
} from '../../../application/validation/types';
import { ValidationMigrationAdapter } from '../../../application/validation/migration-adapter';
import { PermissionContext } from '../../../application/services/permission-service';
import { StaffRole } from '../../../domain/entities/staff-role';

// Mock strategy for testing
class MockValidationStrategy implements ValidationStrategy {
  constructor(
    public readonly name: string,
    private canHandleFunc: (context: ValidationContext) => boolean,
    private validateFunc: (context: ValidationContext) => Promise<ValidationResult>
  ) {}

  canHandle(context: ValidationContext): boolean {
    return this.canHandleFunc(context);
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    return this.validateFunc(context);
  }
}

describe('UnifiedValidationService', () => {
  let service: UnifiedValidationService;
  const mockContext: PermissionContext = {
    guildId: 'guild123',
    userId: 'user123',
    userRoles: ['role1'],
    isGuildOwner: false
  };

  beforeEach(() => {
    service = new UnifiedValidationService();
  });

  describe('Strategy Management', () => {
    it('should register and unregister strategies', () => {
      const strategy = new MockValidationStrategy(
        'TestStrategy',
        () => true,
        async () => ValidationResultHelper.success()
      );

      service.registerStrategy(strategy);
      expect(service.getStrategyNames()).toContain('TestStrategy');

      const removed = service.unregisterStrategy('TestStrategy');
      expect(removed).toBe(true);
      expect(service.getStrategyNames()).not.toContain('TestStrategy');
    });

    it('should overwrite existing strategy with same name', () => {
      const strategy1 = new MockValidationStrategy(
        'TestStrategy',
        () => true,
        async () => ValidationResultHelper.success()
      );
      const strategy2 = new MockValidationStrategy(
        'TestStrategy',
        () => false,
        async () => ValidationResultHelper.error('ERROR', 'Error')
      );

      service.registerStrategy(strategy1);
      service.registerStrategy(strategy2);

      expect(service.getStrategyNames()).toHaveLength(1);
      expect(service.getStrategyNames()).toContain('TestStrategy');
    });
  });

  describe('Validation Execution', () => {
    it('should execute applicable strategies', async () => {
      const strategy1 = new MockValidationStrategy(
        'Strategy1',
        (ctx) => ctx.entityType === 'test',
        async () => ValidationResultHelper.success({ strategy1: true })
      );
      const strategy2 = new MockValidationStrategy(
        'Strategy2',
        (ctx) => ctx.entityType === 'test',
        async () => ValidationResultHelper.warning('WARNING', 'Test warning')
      );
      const strategy3 = new MockValidationStrategy(
        'Strategy3',
        (ctx) => ctx.entityType === 'other',
        async () => ValidationResultHelper.error('ERROR', 'Should not run')
      );

      service.registerStrategy(strategy1);
      service.registerStrategy(strategy2);
      service.registerStrategy(strategy3);

      const context = UnifiedValidationService.createContext({
        permissionContext: mockContext,
        entityType: 'test',
        operation: 'validate',
        data: {}
      });

      const result = await service.validate(context);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.severity).toBe(ValidationSeverity.WARNING);
      expect(result.strategyResults.size).toBe(2);
      expect(result.strategyResults.has('Strategy1')).toBe(true);
      expect(result.strategyResults.has('Strategy2')).toBe(true);
      expect(result.strategyResults.has('Strategy3')).toBe(false);
    });

    it('should handle fail-fast option', async () => {
      let strategy2Called = false;

      const strategy1 = new MockValidationStrategy(
        'Strategy1',
        () => true,
        async () => ValidationResultHelper.error('ERROR', 'First error')
      );
      const strategy2 = new MockValidationStrategy(
        'Strategy2',
        () => true,
        async () => {
          strategy2Called = true;
          return ValidationResultHelper.success();
        }
      );

      service.registerStrategy(strategy1);
      service.registerStrategy(strategy2);

      const context = UnifiedValidationService.createContext({
        permissionContext: mockContext,
        entityType: 'test',
        operation: 'validate',
        data: {}
      });

      const result = await service.validate(context, { failFast: true });

      expect(result.valid).toBe(false);
      expect(strategy2Called).toBe(false);
      expect(result.strategyResults.size).toBe(1);
    });

    it('should filter strategies by include/exclude options', async () => {
      const strategy1 = new MockValidationStrategy(
        'Strategy1',
        () => true,
        async () => ValidationResultHelper.success()
      );
      const strategy2 = new MockValidationStrategy(
        'Strategy2',
        () => true,
        async () => ValidationResultHelper.success()
      );
      const strategy3 = new MockValidationStrategy(
        'Strategy3',
        () => true,
        async () => ValidationResultHelper.success()
      );

      service.registerStrategy(strategy1);
      service.registerStrategy(strategy2);
      service.registerStrategy(strategy3);

      const context = UnifiedValidationService.createContext({
        permissionContext: mockContext,
        entityType: 'test',
        operation: 'validate',
        data: {}
      });

      // Test include filter
      const includeResult = await service.validate(context, {
        includeStrategies: ['Strategy1', 'Strategy3']
      });
      expect(includeResult.strategyResults.size).toBe(2);
      expect(includeResult.strategyResults.has('Strategy2')).toBe(false);

      // Test exclude filter
      const excludeResult = await service.validate(context, {
        excludeStrategies: ['Strategy2']
      });
      expect(excludeResult.strategyResults.size).toBe(2);
      expect(excludeResult.strategyResults.has('Strategy2')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle strategy errors gracefully', async () => {
      const strategy = new MockValidationStrategy(
        'ErrorStrategy',
        () => true,
        async () => {
          throw new Error('Strategy error');
        }
      );

      service.registerStrategy(strategy);

      const context = UnifiedValidationService.createContext({
        permissionContext: mockContext,
        entityType: 'test',
        operation: 'validate',
        data: {}
      });

      const result = await service.validate(context);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.code).toBe('STRATEGY_ERROR');
      expect(result.issues[0]?.message).toContain('ErrorStrategy failed');
    });

    it('should throw ValidationError when using validateOrThrow', async () => {
      const strategy = new MockValidationStrategy(
        'FailStrategy',
        () => true,
        async () => ValidationResultHelper.error('FAIL', 'Validation failed')
      );

      service.registerStrategy(strategy);

      const context = UnifiedValidationService.createContext({
        permissionContext: mockContext,
        entityType: 'test',
        operation: 'validate',
        data: {}
      });

      await expect(service.validateOrThrow(context)).rejects.toThrow('Validation failed');
    });
  });

  describe('Specific Strategy Validation', () => {
    it('should validate with specific strategy', async () => {
      const strategy = new MockValidationStrategy(
        'SpecificStrategy',
        () => true,
        async () => ValidationResultHelper.success({ specific: true })
      );

      service.registerStrategy(strategy);

      const context = UnifiedValidationService.createContext({
        permissionContext: mockContext,
        entityType: 'test',
        operation: 'validate',
        data: {}
      });

      const result = await service.validateWithStrategy('SpecificStrategy', context);

      expect(result.valid).toBe(true);
      expect(result.metadata?.specific).toBe(true);
    });

    it('should throw error for non-existent strategy', async () => {
      const context = UnifiedValidationService.createContext({
        permissionContext: mockContext,
        entityType: 'test',
        operation: 'validate',
        data: {}
      });

      await expect(
        service.validateWithStrategy('NonExistent', context)
      ).rejects.toThrow('Validation strategy not found: NonExistent');
    });

    it('should throw error if strategy cannot handle context', async () => {
      const strategy = new MockValidationStrategy(
        'LimitedStrategy',
        (ctx) => ctx.entityType === 'specific',
        async () => ValidationResultHelper.success()
      );

      service.registerStrategy(strategy);

      const context = UnifiedValidationService.createContext({
        permissionContext: mockContext,
        entityType: 'other',
        operation: 'validate',
        data: {}
      });

      await expect(
        service.validateWithStrategy('LimitedStrategy', context)
      ).rejects.toThrow('Strategy LimitedStrategy cannot handle context');
    });
  });

  describe('Result Formatting', () => {
    it('should format successful result', () => {
      const result = ValidationResultHelper.success();
      const formatted = UnifiedValidationService.formatResult(result);
      expect(formatted).toBe('Validation passed');
    });

    it('should format result with errors and warnings', () => {
      const result: ValidationResult = {
        valid: false,
        issues: [
          {
            severity: ValidationSeverity.ERROR,
            code: 'ERROR1',
            message: 'Error message',
            field: 'field1'
          },
          {
            severity: ValidationSeverity.WARNING,
            code: 'WARN1',
            message: 'Warning message'
          }
        ]
      };

      const formatted = UnifiedValidationService.formatResult(result);
      expect(formatted).toContain('**Errors:**');
      expect(formatted).toContain('[field1] Error message');
      expect(formatted).toContain('**Warnings:**');
      expect(formatted).toContain('Warning message');
    });

    it('should include bypass information', () => {
      const result: ValidationResult = {
        valid: false,
        issues: [{
          severity: ValidationSeverity.ERROR,
          code: 'ERROR',
          message: 'Error'
        }],
        bypassAvailable: true,
        bypassType: 'admin'
      };

      const formatted = UnifiedValidationService.formatResult(result);
      expect(formatted).toContain('Bypass available for admin');
    });
  });

  describe('Context Creation', () => {
    it('should create context with default values', () => {
      const context = UnifiedValidationService.createContext({
        permissionContext: mockContext,
        entityType: 'test',
        operation: 'validate'
      });

      expect(context.permissionContext).toBe(mockContext);
      expect(context.entityType).toBe('test');
      expect(context.operation).toBe('validate');
      expect(context.data).toEqual({});
      expect(context.metadata).toEqual({});
    });

    it('should merge provided values', () => {
      const context = UnifiedValidationService.createContext({
        permissionContext: mockContext,
        entityType: 'test',
        operation: 'validate',
        data: { key: 'value' },
        metadata: { meta: 'data' }
      });

      expect(context.data).toEqual({ key: 'value' });
      expect(context.metadata).toEqual({ meta: 'data' });
    });
  });
});

describe('ValidationMigrationAdapter', () => {
  let service: UnifiedValidationService;
  let adapter: ValidationMigrationAdapter;
  const mockContext: PermissionContext = {
    guildId: 'guild123',
    userId: 'user123',
    userRoles: ['role1'],
    isGuildOwner: false
  };

  beforeEach(() => {
    service = new UnifiedValidationService();
    adapter = new ValidationMigrationAdapter(service);
  });

  it('should adapt validateRoleLimit', async () => {
    const strategy = new MockValidationStrategy(
      'BusinessRuleValidation',
      (ctx) => ctx.operation === 'validateRoleLimit',
      async () => ({
        valid: false,
        issues: [{
          severity: ValidationSeverity.ERROR,
          code: 'ROLE_LIMIT',
          message: 'Role limit exceeded'
        }],
        bypassAvailable: true,
        bypassType: 'admin',
        metadata: {
          currentCount: 5,
          maxCount: 5
        }
      })
    );

    service.registerStrategy(strategy);

    const result = await adapter.validateRoleLimit(mockContext, StaffRole.PARALEGAL);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Role limit exceeded');
    expect(result.bypassAvailable).toBe(true);
    expect(result.bypassType).toBe('admin');
    expect(result.currentCount).toBe(5);
    expect(result.maxCount).toBe(5);
    expect(result.roleName).toBe(StaffRole.PARALEGAL);
  });

  it('should adapt validateCommand', async () => {
    const strategy = new MockValidationStrategy(
      'CommandValidation',
      (ctx) => ctx.entityType === 'command',
      async (ctx) => {
        if (!ctx.data.userId) {
          return ValidationResultHelper.error('MISSING_USER', 'User ID is required');
        }
        return ValidationResultHelper.success();
      }
    );

    service.registerStrategy(strategy);

    const result = await adapter.validateCommand('test-command', mockContext, {
      userId: 'user123'
    });

    expect(result.valid).toBe(true);

    const invalidResult = await adapter.validateCommand('test-command', mockContext, {});
    expect(invalidResult.valid).toBe(false);
    expect(ValidationResultHelper.getErrorMessages(invalidResult)).toContain('User ID is required');
  });
});