// @ts-nocheck
import { 
  BusinessRuleError, 
  ValidationError, 
  PermissionError, 
  NotFoundError, 
  DatabaseError,
  ErrorCode 
} from '../../domain/errors';
import { ErrorHandlerMiddleware } from '../../infrastructure/middleware/error-handler-middleware';
import { ErrorContextService } from '../../application/services/error-context-service';
import { EnhancedLogger } from '../../infrastructure/logger/enhanced-logger';
import { CommandInteraction, Guild, GuildMember, User, TextChannel } from 'discord.js';

// Mock Discord.js classes
jest.mock('discord.js', () => ({
  ...jest.requireActual('discord.js'),
  GuildMember: class MockGuildMember {},
  User: class MockUser {},
  Guild: class MockGuild {},
  TextChannel: class MockTextChannel {}
}));

// Mock Discord.js objects
const mockUser: Partial<User> = {
  id: 'test-user-123',
  username: 'testuser',
  discriminator: '1234'
};

const mockGuildMember: Partial<GuildMember> = {
  id: 'test-user-123',
  nickname: 'Test User',
  roles: {
    cache: new Map([
      ['role1', { id: 'role1', name: 'Admin' } as any],
      ['role2', { id: 'role2', name: 'Moderator' } as any]
    ])
  } as any,
  permissions: {
    toArray: () => ['ADMINISTRATOR', 'MANAGE_GUILD'],
    has: () => true
  } as any,
  joinedAt: new Date('2023-01-01')
};

const mockChannel: Partial<TextChannel> = {
  id: 'test-channel-123',
  name: 'test-channel',
  type: 0
};

const mockGuild: Partial<Guild> = {
  id: 'test-guild-123',
  name: 'Test Guild',
  ownerId: 'owner-123'
};

const mockInteraction: Partial<CommandInteraction> = {
  id: 'test-interaction-123',
  commandName: 'test-command',
  guildId: 'test-guild-123',
  channelId: 'test-channel-123',
  user: mockUser as User,
  member: mockGuildMember as GuildMember,
  guild: mockGuild as Guild,
  channel: mockChannel as TextChannel,
  type: 2,
  createdTimestamp: Date.now(),
  replied: false,
  deferred: false,
  reply: jest.fn(),
  editReply: jest.fn()
};

describe('Global Error Handling Integration Tests', () => {
  let logger: any;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    // Initialize enhanced logger
    logger = EnhancedLogger.initialize();
    logSpy = jest.spyOn(logger, 'log').mockImplementation(() => {});
    
    // Clear any existing correlations
    (ErrorContextService as any).operationStack = [];
    (ErrorContextService as any).activeOperations.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Context Service', () => {
    it('should create enhanced context from Discord interaction', async () => {
      const context = await ErrorContextService.createFromInteraction(
        mockInteraction as CommandInteraction,
        'test_operation'
      );

      expect(context.correlationId).toMatch(/^corr_\d+_[a-z0-9]+$/);
      expect(context.operationId).toMatch(/^op_\d+_[a-z0-9]+$/);
      expect(context.guildId).toBe('test-guild-123');
      expect(context.userId).toBe('test-user-123');
      expect(context.commandName).toBe('test-command');
      expect(context.discordContext).toBeDefined();
      expect(context.discordContext!.guildName).toBe('Test Guild');
      expect(context.discordContext!.memberRoles).toEqual([]);
    });

    it('should create context for service operations', () => {
      const context = ErrorContextService.createForService(
        'TestService',
        'testMethod',
        { guildId: 'test-guild-123' }
      );

      expect(context.correlationId).toMatch(/^corr_\d+_[a-z0-9]+$/);
      expect(context.operationId).toMatch(/^op_\d+_[a-z0-9]+$/);
      expect(context.metadata?.serviceName).toBe('TestService');
      expect(context.metadata?.operationName).toBe('testMethod');
    });

    it('should track and complete operations', () => {
      const operationId = 'test-op-123';
      ErrorContextService.startOperation(operationId, 'test_operation');
      
      const metrics = ErrorContextService.completeOperation(operationId);
      
      expect(metrics).toBeDefined();
      expect(metrics!.operationType).toBe('test_operation');
      expect(metrics!.duration).toBeGreaterThanOrEqual(0);
    });

    it('should create breadcrumb trails', async () => {
      const context = await ErrorContextService.createFromInteraction(
        mockInteraction as CommandInteraction,
        'test_operation'
      );
      
      context.metadata!.serviceName = 'TestService';
      context.metadata!.operation = 'testOperation';
      
      const breadcrumbs = ErrorContextService.createBreadcrumbTrail(context);
      
      expect(breadcrumbs).toContain('Guild: Test Guild');
      expect(breadcrumbs).toContain('Command: test-command');
      expect(breadcrumbs).toContain('Service: TestService');
      expect(breadcrumbs).toContain('Operation: testOperation');
    });
  });

  describe('Error Handler Middleware', () => {
    it('should handle BusinessRuleError correctly', async () => {
      const error = new BusinessRuleError(
        'Staff limit exceeded',
        ErrorCode.BR_STAFF_LIMIT_EXCEEDED,
        'MAX_STAFF_PER_ROLE',
        5,
        3,
        { guildId: 'test-guild-123' }
      );

      await ErrorHandlerMiddleware.handleError(
        error,
        mockInteraction as CommandInteraction
      );

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'warn',
        'Operational error occurred',
        expect.objectContaining({
          errorCode: ErrorCode.BR_STAFF_LIMIT_EXCEEDED,
          correlationId: expect.stringMatching(/^corr_\d+_[a-z0-9]+$/),
          isOperational: true
        })
      );
    });

    it('should handle ValidationError correctly', async () => {
      const error = new ValidationError(
        'Invalid input provided',
        ErrorCode.VAL_INVALID_INPUT,
        'username',
        'invalid-chars',
        { guildId: 'test-guild-123' },
        { minLength: 3, maxLength: 20 }
      );

      await ErrorHandlerMiddleware.handleError(
        error,
        mockInteraction as CommandInteraction
      );

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'warn',
        'Operational error occurred',
        expect.objectContaining({
          errorCode: ErrorCode.VAL_INVALID_INPUT,
          isOperational: true
        })
      );
    });

    it('should handle PermissionError and log security event', async () => {
      const error = new PermissionError(
        'Insufficient permissions',
        ErrorCode.PERM_INSUFFICIENT_PERMISSIONS,
        'admin',
        'staff_management',
        'hire_staff',
        { guildId: 'test-guild-123', userId: 'test-user-123' }
      );

      const securityLogSpy = jest.spyOn(EnhancedLogger, 'logSecurityEvent');

      await ErrorHandlerMiddleware.handleError(
        error,
        mockInteraction as CommandInteraction
      );

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(securityLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission error'),
        'medium',
        expect.objectContaining({
          guildId: 'test-guild-123',
          userId: 'test-user-123'
        }),
        expect.any(Object)
      );

      securityLogSpy.mockRestore();
    });

    it('should handle NotFoundError correctly', async () => {
      const error = new NotFoundError(
        'Staff member not found',
        ErrorCode.NF_ENTITY_NOT_FOUND,
        'staff',
        'user-123',
        { guildId: 'test-guild-123' },
        { username: 'testuser', role: 'admin' }
      );

      await ErrorHandlerMiddleware.handleError(
        error,
        mockInteraction as CommandInteraction
      );

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'warn',
        'Operational error occurred',
        expect.objectContaining({
          errorCode: ErrorCode.NF_ENTITY_NOT_FOUND,
          isOperational: true
        })
      );
    });

    it('should handle DatabaseError correctly', async () => {
      const originalError = new Error('Connection timeout');
      const error = DatabaseError.fromMongoError(
        originalError,
        'FIND' as any,
        'staff',
        { guildId: 'test-guild-123' }
      );

      await ErrorHandlerMiddleware.handleError(
        error,
        mockInteraction as CommandInteraction
      );

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'System error occurred',
        expect.objectContaining({
          errorCode: expect.stringMatching(/^DB_/),
          isOperational: false
        })
      );
    });

    it('should handle generic JavaScript errors', async () => {
      const error = new Error('Unexpected error occurred');

      await ErrorHandlerMiddleware.handleError(
        error,
        mockInteraction as CommandInteraction
      );

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'System error occurred',
        expect.objectContaining({
          errorCode: 'SYS_001', // Generic errors get wrapped with SYS_001
          isOperational: false
        })
      );
    });

    it('should handle middleware failures gracefully', async () => {
      const error = new Error('Test error');
      
      // Mock the enrichErrorContext to throw an error
      const originalMethod = (ErrorHandlerMiddleware as any).enrichErrorContext;
      (ErrorHandlerMiddleware as any).enrichErrorContext = jest.fn().mockRejectedValue(
        new Error('Context enrichment failed')
      );

      await ErrorHandlerMiddleware.handleError(
        error,
        mockInteraction as CommandInteraction
      );

      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'Error handler middleware failed:',
        expect.any(Error)
      );

      // Restore original method
      (ErrorHandlerMiddleware as any).enrichErrorContext = originalMethod;
    });
  });

  describe('Enhanced Logger Integration', () => {
    it('should log errors with correlation tracking', () => {
      const error = new BusinessRuleError(
        'Test error',
        ErrorCode.BR_STAFF_LIMIT_EXCEEDED,
        'TEST_RULE',
        5,
        3
      );

      const context = {
        correlationId: 'test-corr-123',
        operationId: 'test-op-123',
        guildId: 'test-guild-123',
        userId: 'test-user-123',
        metadata: {}
      };

      EnhancedLogger.logError(error, context as any);

      expect(logSpy).toHaveBeenCalledWith(
        'warn',
        'Operational error occurred',
        expect.objectContaining({
          correlationId: 'test-corr-123',
          operationId: 'test-op-123',
          errorCode: ErrorCode.BR_STAFF_LIMIT_EXCEEDED
        })
      );
    });

    it('should log security events for permission errors', () => {
      const securityLogSpy = jest.spyOn(EnhancedLogger, 'logSecurityEvent');
      
      EnhancedLogger.logSecurityEvent(
        'Unauthorized access attempt',
        'high',
        {
          correlationId: 'test-corr-123',
          guildId: 'test-guild-123',
          userId: 'test-user-123',
          metadata: {}
        } as any,
        { attemptedAction: 'admin_command' }
      );

      expect(securityLogSpy).toHaveBeenCalledWith(
        'Unauthorized access attempt',
        'high',
        expect.objectContaining({
          correlationId: 'test-corr-123',
          guildId: 'test-guild-123'
        }),
        { attemptedAction: 'admin_command' }
      );

      securityLogSpy.mockRestore();
    });

    it('should log performance metrics', () => {
      const performanceLogSpy = jest.spyOn(EnhancedLogger, 'logPerformanceMetrics');
      
      EnhancedLogger.logPerformanceMetrics(
        'Test Operation',
        {
          duration: 150,
          operationType: 'command_execution',
          resourcesAccessed: ['database', 'discord_api']
        },
        {
          correlationId: 'test-corr-123',
          metadata: {}
        } as any
      );

      expect(performanceLogSpy).toHaveBeenCalledWith(
        'Test Operation',
        expect.objectContaining({
          duration: 150,
          operationType: 'command_execution'
        }),
        expect.objectContaining({
          correlationId: 'test-corr-123'
        })
      );

      performanceLogSpy.mockRestore();
    });
  });

  describe('Error Serialization and Client Safety', () => {
    it('should serialize errors correctly', () => {
      const error = new ValidationError(
        'Invalid input',
        ErrorCode.VAL_INVALID_INPUT,
        { 
          guildId: 'test-guild-123', 
          userId: 'test-user', 
          commandName: 'test-command',
          field: 'username',
          value: 'test@value'
        }
      );

      const serialized = error.serialize();

      expect(serialized).toEqual({
        name: 'ValidationError',
        message: 'Invalid input',
        errorCode: ErrorCode.VAL_INVALID_INPUT,
        timestamp: expect.any(String),
        context: expect.objectContaining({
          guildId: 'test-guild-123',
          userId: 'test-user',
          commandName: 'test-command'
        }),
        stack: expect.any(String),
        isOperational: true
      });
    });

    it('should create client-safe error representations', () => {
      const error = new DatabaseError(
        'Internal database connection failed',
        ErrorCode.DB_CONNECTION_FAILED,
        'CONNECTION' as any,
        { guildId: 'test-guild-123' }
      );

      const clientError = error.toClientError();

      expect(clientError.message).toBe('Unable to connect to the database. Please try again later.');
      expect(clientError.errorCode).toBe(ErrorCode.DB_CONNECTION_FAILED);
      expect(clientError.timestamp).toBeDefined();
      expect(clientError.message).not.toContain('Internal database');
    });
  });

  describe('Command Category Error Handling Simulation', () => {
    const commandCategories = [
      'staff',
      'case',
      'job',
      'admin',
      'retainer',
      'feedback',
      'reminder',
      'role',
      'repair',
      'metrics'
    ];

    commandCategories.forEach(category => {
      it(`should handle errors in ${category} commands`, async () => {
        const testInteraction = {
          ...mockInteraction,
          commandName: `${category}-test-command`
        };

        // Test different error types for each category
        const errors = [
          new BusinessRuleError(
            `${category} business rule violation`,
            ErrorCode.BR_STAFF_LIMIT_EXCEEDED,
            'TEST_RULE',
            5,
            3,
            { guildId: 'test-guild-123' }
          ),
          new ValidationError(
            `${category} validation error`,
            ErrorCode.VAL_INVALID_INPUT,
            'testField',
            'invalidValue',
            { guildId: 'test-guild-123' }
          ),
          new PermissionError(
            `${category} permission error`,
            ErrorCode.PERM_INSUFFICIENT_PERMISSIONS,
            'admin',
            category,
            'test_action',
            { guildId: 'test-guild-123', userId: 'test-user-123' }
          )
        ];

        for (const error of errors) {
          await ErrorHandlerMiddleware.handleError(
            error,
            testInteraction as CommandInteraction
          );

          expect(testInteraction.reply).toHaveBeenCalled();
          expect(logSpy).toHaveBeenCalledWith(
            error.isOperational ? 'warn' : 'error',
            expect.stringContaining('error occurred'),
            expect.objectContaining({
              correlationId: expect.stringMatching(/^corr_\d+_[a-z0-9]+$/),
              commandName: `${category}-test-command`,
              errorCode: error.errorCode
            })
          );
        }
      });
    });
  });

  describe('Error Recovery and Cleanup', () => {
    it('should clean up orphaned operations', () => {
      // Create some old operations
      const oldOperationId = 'old-op-123';
      ErrorContextService.startOperation(oldOperationId, 'old_operation');
      
      // Mock old timestamp
      const activeOperations = (ErrorContextService as any).activeOperations;
      const oldMetrics = activeOperations.get(oldOperationId);
      oldMetrics.startTime = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      
      // Run cleanup
      ErrorContextService.cleanupOrphanedOperations();
      
      // Verify cleanup
      expect(activeOperations.has(oldOperationId)).toBe(false);
    });

    it('should handle error correlation chain creation', async () => {
      const errors = [
        new Error('Root cause error'),
        new ValidationError(
          'Validation failed',
          ErrorCode.VAL_INVALID_INPUT,
          'field1',
          'value1'
        ),
        new BusinessRuleError(
          'Business rule violated',
          ErrorCode.BR_STAFF_LIMIT_EXCEEDED,
          'RULE1',
          5,
          3
        )
      ];

      const context = await ErrorContextService.createFromInteraction(
        mockInteraction as CommandInteraction,
        'test_operation'
      );

      const correlationChain = ErrorContextService.createCorrelationChain(errors, context);

      expect(correlationChain).toHaveLength(3);
      expect(correlationChain[0].isRootCause).toBe(true);
      expect(correlationChain[0].correlationId).toBe(context.correlationId);
      expect(correlationChain[2].stackPosition).toBe(2);
    });
  });

  describe('Integration with Existing Error Handling', () => {
    it('should work with existing try-catch patterns', async () => {
      const simulateServiceOperation = async () => {
        try {
          throw new DatabaseError(
            'Database operation failed',
            ErrorCode.DB_QUERY_FAILED,
            'FIND' as any,
            { guildId: 'test-guild-123' }
          );
        } catch (error) {
          await ErrorHandlerMiddleware.handleError(
            error as Error,
            mockInteraction as CommandInteraction
          );
        }
      };

      await simulateServiceOperation();

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'System error occurred',
        expect.objectContaining({
          errorCode: ErrorCode.DB_QUERY_FAILED
        })
      );
    });

    it('should maintain context through nested operations', async () => {
      const parentContext = await ErrorContextService.createFromInteraction(
        mockInteraction as CommandInteraction,
        'parent_operation'
      );

      const childContext = ErrorContextService.createForService(
        'ChildService',
        'childMethod',
        parentContext
      );

      expect(childContext.correlationId).toBe(parentContext.correlationId);
      expect(childContext.parentOperationId).toBeDefined();
      expect(childContext.operationStack).toBeDefined();
    });
  });
});