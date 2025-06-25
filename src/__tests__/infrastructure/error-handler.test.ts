import { ApplicationErrorHandler, ErrorType } from '../../infrastructure/error-handling/error-handler';

describe('ApplicationErrorHandler', () => {
  let errorHandler: ApplicationErrorHandler;

  beforeEach(() => {
    errorHandler = ApplicationErrorHandler.getInstance();
  });

  describe('Error Creation', () => {
    it('should create application errors with all properties', () => {
      const error = errorHandler.createError(
        ErrorType.VALIDATION_ERROR,
        'Invalid input provided',
        'Please check your input and try again.',
        { field: 'username' },
        new Error('Original error')
      );

      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input provided');
      expect(error.userMessage).toBe('Please check your input and try again.');
      expect(error.details).toEqual({ field: 'username' });
      expect(error.originalError).toBeInstanceOf(Error);
    });

    it('should create minimal application errors', () => {
      const error = errorHandler.createError(
        ErrorType.SYSTEM_ERROR,
        'System error occurred',
        'A system error occurred. Please try again later.'
      );

      expect(error.type).toBe(ErrorType.SYSTEM_ERROR);
      expect(error.message).toBe('System error occurred');
      expect(error.userMessage).toBe('A system error occurred. Please try again later.');
      expect(error.details).toBeUndefined();
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('Error Normalization', () => {
    it('should normalize permission errors', () => {
      const genericError = new Error('Permission denied: Insufficient privileges');
      const result = errorHandler.handleError(genericError);

      expect(result.embed).toBeDefined();
      expect(result.ephemeral).toBe(true);
    });

    it('should normalize validation errors', () => {
      const genericError = new Error('Validation failed: Invalid username format');
      const result = errorHandler.handleError(genericError);

      expect(result.embed).toBeDefined();
      expect(result.ephemeral).toBe(true);
    });

    it('should normalize not found errors', () => {
      const genericError = new Error('User not found in database');
      const result = errorHandler.handleError(genericError);

      expect(result.embed).toBeDefined();
      expect(result.ephemeral).toBe(true);
    });

    it('should normalize timeout errors', () => {
      const genericError = new Error('Operation timed out after 30 seconds');
      const result = errorHandler.handleError(genericError);

      expect(result.embed).toBeDefined();
      expect(result.ephemeral).toBe(true);
    });

    it('should handle unknown errors as system errors', () => {
      const genericError = new Error('Unknown error occurred');
      const result = errorHandler.handleError(genericError);

      expect(result.embed).toBeDefined();
      expect(result.ephemeral).toBe(false); // System errors should not be ephemeral
    });
  });

  describe('Error Handling by Type', () => {
    it('should handle permission denied errors correctly', () => {
      const error = errorHandler.createError(
        ErrorType.PERMISSION_DENIED,
        'User lacks admin privileges',
        'You do not have permission to perform this action.'
      );

      const result = errorHandler.handleError(error);

      expect(result.ephemeral).toBe(true);
      expect(result.embed).toBeDefined();
    });

    it('should handle validation errors correctly', () => {
      const error = errorHandler.createError(
        ErrorType.VALIDATION_ERROR,
        'Invalid username format',
        'The provided information is not valid. Please check your input and try again.'
      );

      const result = errorHandler.handleError(error);

      expect(result.ephemeral).toBe(true);
      expect(result.embed).toBeDefined();
    });

    it('should handle resource not found errors correctly', () => {
      const error = errorHandler.createError(
        ErrorType.RESOURCE_NOT_FOUND,
        'Staff member not found',
        'The requested resource could not be found.'
      );

      const result = errorHandler.handleError(error);

      expect(result.ephemeral).toBe(true);
      expect(result.embed).toBeDefined();
    });

    it('should handle rate limit errors correctly', () => {
      const error = errorHandler.createError(
        ErrorType.RATE_LIMIT_EXCEEDED,
        'Too many requests',
        'You are sending commands too quickly. Please wait a moment.'
      );

      const result = errorHandler.handleError(error);

      expect(result.ephemeral).toBe(true);
      expect(result.embed).toBeDefined();
    });

    it('should handle database errors correctly', () => {
      const error = errorHandler.createError(
        ErrorType.DATABASE_ERROR,
        'Database connection failed',
        'Our services are temporarily unavailable. Please try again in a few moments.'
      );

      const result = errorHandler.handleError(error);

      expect(result.ephemeral).toBe(false); // System errors are not ephemeral
      expect(result.embed).toBeDefined();
    });

    it('should handle Discord API errors correctly', () => {
      const error = errorHandler.createError(
        ErrorType.DISCORD_API_ERROR,
        'Discord API returned 503',
        'There was an issue communicating with Discord. Please try again.'
      );

      const result = errorHandler.handleError(error);

      expect(result.ephemeral).toBe(false);
      expect(result.embed).toBeDefined();
    });

    it('should handle external service errors correctly', () => {
      const error = errorHandler.createError(
        ErrorType.EXTERNAL_SERVICE_ERROR,
        'Roblox API unavailable',
        'An external service is temporarily unavailable. Please try again later.'
      );

      const result = errorHandler.handleError(error);

      expect(result.ephemeral).toBe(false);
      expect(result.embed).toBeDefined();
    });

    it('should handle queue timeout errors correctly', () => {
      const error = errorHandler.createError(
        ErrorType.QUEUE_TIMEOUT,
        'Queue operation timed out',
        'The operation took too long to complete. Please try again.'
      );

      const result = errorHandler.handleError(error);

      expect(result.ephemeral).toBe(true);
      expect(result.embed).toBeDefined();
    });

    it('should handle concurrent modification errors correctly', () => {
      const error = errorHandler.createError(
        ErrorType.CONCURRENT_MODIFICATION,
        'Resource modified by another operation',
        'Another operation is currently in progress. Please try again in a moment.'
      );

      const result = errorHandler.handleError(error);

      expect(result.ephemeral).toBe(true);
      expect(result.embed).toBeDefined();
    });
  });

  describe('Error Context', () => {
    it('should include context in error handling', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user123',
        guildId: 'guild456',
        command: 'test-command'
      };

      const result = errorHandler.handleError(error, context);
      
      expect(result.embed).toBeDefined();
      expect(result.ephemeral).toBeDefined();
    });
  });

  describe('Error Execution Wrapper', () => {
    it('should return success for successful operations', async () => {
      const successOperation = async () => 'success result';
      
      const result = await errorHandler.executeWithErrorHandling(successOperation);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result).toBe('success result');
      }
    });

    it('should return error for failed operations', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };
      
      const result = await errorHandler.executeWithErrorHandling(failingOperation);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe(ErrorType.SYSTEM_ERROR);
        expect(result.error.originalError?.message).toBe('Operation failed');
      }
    });

    it('should add context to errors in wrapper', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };
      
      const context = {
        userId: 'user123',
        guildId: 'guild456',
        command: 'test-command'
      };
      
      const result = await errorHandler.executeWithErrorHandling(failingOperation, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.userId).toBe('user123');
        expect(result.error.guildId).toBe('guild456');
      }
    });

    it('should handle synchronous errors in wrapper', async () => {
      const syncFailingOperation = () => {
        throw new Error('Sync error');
      };
      
      const result = await errorHandler.executeWithErrorHandling(syncFailingOperation as any);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.originalError?.message).toBe('Sync error');
      }
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton instance', () => {
      const instance1 = ApplicationErrorHandler.getInstance();
      const instance2 = ApplicationErrorHandler.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined errors', () => {
      const result1 = errorHandler.handleError(null as any);
      expect(result1.embed).toBeDefined();
      
      const result2 = errorHandler.handleError(undefined as any);
      expect(result2.embed).toBeDefined();
    });

    it('should handle errors with no message', () => {
      const error = new Error();
      const result = errorHandler.handleError(error);
      
      expect(result.embed).toBeDefined();
    });

    it('should handle non-Error objects', () => {
      const notAnError = { message: 'Not actually an error object' };
      const result = errorHandler.handleError(notAnError as any);
      
      expect(result.embed).toBeDefined();
    });

    it('should handle circular reference errors', () => {
      const circularError = new Error('Circular reference');
      (circularError as any).self = circularError;
      
      const result = errorHandler.handleError(circularError);
      expect(result.embed).toBeDefined();
    });
  });
});