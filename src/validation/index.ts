/**
 * @module Validation
 * @description Central export point for all validation schemas and utilities
 * @category Validation
 */

// Export shared schemas and utilities
export * from './schemas/shared';

// Export domain schemas
export * from './schemas/domain';

// Export infrastructure schemas
export * from './schemas/infrastructure/discord.schema';
export * from './schemas/infrastructure/mongodb.schema';

// Export application schemas
export * from './schemas/application/permission.schema';
export * from './schemas/application/service.schema';

// Export command schemas
export * from './schemas/commands/command.schema';

// Re-export zod for convenience
export { z } from 'zod';
export type { ZodError, ZodIssue, ZodSchema, ZodType, ZodTypeAny } from 'zod';
