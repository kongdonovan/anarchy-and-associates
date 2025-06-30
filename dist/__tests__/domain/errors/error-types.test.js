"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../../../domain/errors");
describe('Custom Error Types', () => {
    describe('BaseError', () => {
        class TestError extends errors_1.BaseError {
            getClientMessage() {
                return 'Test client message';
            }
        }
        it('should maintain proper prototype chain', () => {
            const error = new TestError('Test error', 'TEST_001');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(errors_1.BaseError);
            expect(error).toBeInstanceOf(TestError);
        });
        it('should preserve stack trace', () => {
            const error = new TestError('Test error', 'TEST_001');
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('TestError');
        });
        it('should enrich context', () => {
            const error = new TestError('Test error', 'TEST_001', { userId: '123' });
            error.enrichContext({ guildId: '456', commandName: 'test' });
            expect(error.context.userId).toBe('123');
            expect(error.context.guildId).toBe('456');
            expect(error.context.commandName).toBe('test');
        });
        it('should serialize correctly', () => {
            const error = new TestError('Test error', 'TEST_001', {
                userId: '123',
                guildId: '456'
            });
            const serialized = error.serialize();
            expect(serialized.name).toBe('TestError');
            expect(serialized.message).toBe('Test error');
            expect(serialized.errorCode).toBe('TEST_001');
            expect(serialized.context.userId).toBe('123');
            expect(serialized.context.guildId).toBe('456');
        });
    });
    describe('BusinessRuleError', () => {
        it('should create staff limit exceeded error', () => {
            const error = errors_1.ErrorFactory.staffLimitExceeded('Senior Partner', 3, 3, {
                guildId: '123',
                userId: '456'
            });
            expect(error).toBeInstanceOf(errors_1.BusinessRuleError);
            expect(error.errorCode).toBe(errors_1.ErrorCode.BR_STAFF_LIMIT_EXCEEDED);
            expect(error.rule).toBe('staff-limit');
            expect(error.currentValue).toBe(3);
            expect(error.allowedValue).toBe(3);
        });
        it('should provide appropriate client message', () => {
            const error = new errors_1.BusinessRuleError('Role hierarchy violated', errors_1.ErrorCode.BR_ROLE_HIERARCHY_VIOLATION, 'hierarchy-check');
            const clientError = error.toClientError();
            expect(clientError.message).toBe('This action violates the role hierarchy rules.');
        });
    });
    describe('ValidationError', () => {
        it('should create single field validation error', () => {
            const error = new errors_1.ValidationError('Invalid email format', errors_1.ErrorCode.VAL_INVALID_FORMAT, {
                field: 'email',
                value: 'invalid-email',
                constraints: { format: 'email' }
            });
            expect(error.field).toBe('email');
            expect(error.value).toBe('invalid-email');
            expect(error.constraints?.format).toBe('email');
        });
        it('should create multi-field validation error', () => {
            const failures = [
                { field: 'name', value: '', message: 'Name is required', constraint: 'required' },
                { field: 'age', value: -1, message: 'Age must be positive', constraint: 'min' }
            ];
            const error = errors_1.ValidationError.createMultiFieldError(failures);
            expect(error.message).toContain('name, age');
            expect(error.context.fieldFailures).toHaveLength(2);
        });
    });
    describe('PermissionError', () => {
        it('should create permission error with audit context', () => {
            const error = errors_1.PermissionError.createWithAuditContext('delete', 'case', 'case.delete', { userId: '123', guildId: '456' });
            expect(error.action).toBe('delete');
            expect(error.resource).toBe('case');
            expect(error.requiredPermission).toBe('case.delete');
            expect(error.context.metadata.securityEvent).toBe(true);
        });
    });
    describe('NotFoundError', () => {
        it('should create not found error with search context', () => {
            const error = errors_1.NotFoundError.createWithSearchContext('Staff', { userId: '123', guildId: '456' }, { commandName: 'staff-info' });
            expect(error.resourceType).toBe('Staff');
            expect(error.searchCriteria).toEqual({ userId: '123', guildId: '456' });
        });
    });
    describe('DatabaseError', () => {
        it('should determine retryability correctly', () => {
            const connectionError = new errors_1.DatabaseError('Connection failed', errors_1.ErrorCode.DB_CONNECTION_FAILED, errors_1.DatabaseOperation.CONNECTION);
            expect(connectionError.isRetryable).toBe(true);
            const constraintError = new errors_1.DatabaseError('Constraint violation', errors_1.ErrorCode.DB_CONSTRAINT_VIOLATION, errors_1.DatabaseOperation.INSERT);
            expect(constraintError.isRetryable).toBe(false);
        });
        it('should create from MongoDB error', () => {
            const mongoError = {
                name: 'MongoNetworkError',
                message: 'Connection lost',
                code: undefined
            };
            const error = errors_1.DatabaseError.fromMongoError(mongoError, errors_1.DatabaseOperation.FIND, 'staff');
            expect(error.errorCode).toBe(errors_1.ErrorCode.DB_CONNECTION_FAILED);
            expect(error.isRetryable).toBe(true);
            expect(error.collection).toBe('staff');
        });
    });
    describe('ErrorFactory', () => {
        it('should transform unknown errors', () => {
            const unknownError = new Error('Something went wrong');
            const transformed = errors_1.ErrorFactory.fromUnknown(unknownError);
            expect(transformed).toBeInstanceOf(errors_1.BaseError);
            expect(transformed.errorCode).toBe(errors_1.ErrorCode.SYS_INTERNAL_ERROR);
        });
        it('should handle MongoDB errors specially', () => {
            const mongoError = new Error('MongoDB error');
            mongoError.name = 'MongoTimeoutError';
            const transformed = errors_1.ErrorFactory.fromUnknown(mongoError);
            expect(transformed).toBeInstanceOf(errors_1.DatabaseError);
        });
    });
    describe('ErrorSerializer', () => {
        it('should sanitize sensitive data', () => {
            const error = new errors_1.ValidationError('Invalid input', errors_1.ErrorCode.VAL_INVALID_INPUT, {
                field: 'user',
                metadata: {
                    password: 'secret123',
                    apiKey: 'sk_test_abcdef123456',
                    normalField: 'visible'
                }
            });
            const { error: serialized } = errors_1.ErrorSerializer.serializeForLogging(error);
            expect(serialized.context?.metadata?.password).toBe('[REDACTED]');
            expect(serialized.context?.metadata?.apiKey).toBe('[REDACTED]');
            expect(serialized.context?.metadata?.normalField).toBe('visible');
        });
        it('should determine correct log levels', () => {
            const permissionError = new errors_1.PermissionError('Access denied', errors_1.ErrorCode.PERM_INSUFFICIENT_PERMISSIONS);
            const { level: permLevel } = errors_1.ErrorSerializer.serializeForLogging(permissionError);
            expect(permLevel).toBe('warn');
            const notFoundError = new errors_1.NotFoundError('Not found', errors_1.ErrorCode.NF_ENTITY_NOT_FOUND, 'User');
            const { level: notFoundLevel } = errors_1.ErrorSerializer.serializeForLogging(notFoundError);
            expect(notFoundLevel).toBe('info');
            const dbError = new errors_1.DatabaseError('DB failed', errors_1.ErrorCode.DB_QUERY_FAILED, errors_1.DatabaseOperation.FIND);
            const { level: dbLevel } = errors_1.ErrorSerializer.serializeForLogging(dbError);
            expect(dbLevel).toBe('error');
        });
        it('should generate appropriate tags', () => {
            const error = new errors_1.DatabaseError('Connection failed', errors_1.ErrorCode.DB_CONNECTION_FAILED, errors_1.DatabaseOperation.CONNECTION, {
                commandName: 'test-command',
                userId: '123'
            });
            const { tags } = errors_1.ErrorSerializer.serializeForLogging(error);
            expect(tags).toContain('databaseerror');
            expect(tags).toContain('error-category:db');
            expect(tags).toContain('db-operation:connection');
            expect(tags).toContain('retryable');
            expect(tags).toContain('command:test-command');
            expect(tags).toContain('has-user-context');
        });
    });
    describe('Type Guards', () => {
        it('should identify custom errors', () => {
            const customError = new errors_1.BusinessRuleError('Test', errors_1.ErrorCode.BR_STAFF_LIMIT_EXCEEDED, 'test');
            const normalError = new Error('Normal error');
            expect((0, errors_1.isCustomError)(customError)).toBe(true);
            expect((0, errors_1.isCustomError)(normalError)).toBe(false);
        });
        it('should identify retryable errors', () => {
            const retryableError = new errors_1.DatabaseError('Timeout', errors_1.ErrorCode.DB_TIMEOUT, errors_1.DatabaseOperation.FIND);
            const nonRetryableError = new errors_1.BusinessRuleError('Rule violated', errors_1.ErrorCode.BR_STAFF_LIMIT_EXCEEDED, 'test');
            expect((0, errors_1.isRetryableError)(retryableError)).toBe(true);
            expect((0, errors_1.isRetryableError)(nonRetryableError)).toBe(false);
        });
    });
});
//# sourceMappingURL=error-types.test.js.map