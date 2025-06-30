/**
 * @module MongoDBSchemas
 * @description Zod schemas for MongoDB operations and data structures
 * @category Infrastructure/Validation
 */

import { z } from 'zod';
import { MongoIdSchema } from '../shared';

/**
 * MongoDB filter operators schema
 * @description Common MongoDB query operators
 */
export const MongoFilterOperatorsSchema = z.object({
  $eq: z.any().optional(),
  $ne: z.any().optional(),
  $gt: z.any().optional(),
  $gte: z.any().optional(),
  $lt: z.any().optional(),
  $lte: z.any().optional(),
  $in: z.array(z.any()).optional(),
  $nin: z.array(z.any()).optional(),
  $exists: z.boolean().optional(),
  $regex: z.union([z.string(), z.instanceof(RegExp)]).optional(),
});

/**
 * MongoDB sort order schema
 */
export const MongoSortOrderSchema = z.union([
  z.literal(1),
  z.literal(-1),
  z.literal('asc'),
  z.literal('desc'),
  z.literal('ascending'),
  z.literal('descending'),
]);

export type MongoSortOrder = z.infer<typeof MongoSortOrderSchema>;

/**
 * MongoDB find options schema
 * @description Options for find operations
 */
export const MongoFindOptionsSchema = z.object({
  limit: z.number().int().positive().optional(),
  skip: z.number().int().nonnegative().optional(),
  sort: z.record(z.string(), MongoSortOrderSchema).optional(),
  projection: z.record(z.string(), z.union([z.literal(0), z.literal(1)])).optional(),
});

export type MongoFindOptions = z.infer<typeof MongoFindOptionsSchema>;

/**
 * MongoDB update operators schema
 * @description Common MongoDB update operators
 */
export const MongoUpdateOperatorsSchema = z.object({
  $set: z.record(z.string(), z.any()).optional(),
  $unset: z.record(z.string(), z.literal('')).optional(),
  $inc: z.record(z.string(), z.number()).optional(),
  $push: z.record(z.string(), z.any()).optional(),
  $pull: z.record(z.string(), z.any()).optional(),
  $addToSet: z.record(z.string(), z.any()).optional(),
  $pop: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
});

export type MongoUpdateOperators = z.infer<typeof MongoUpdateOperatorsSchema>;

/**
 * MongoDB connection options schema
 * @description Validates MongoDB connection configuration
 */
export const MongoConnectionOptionsSchema = z.object({
  uri: z.string().url().startsWith('mongodb'),
  dbName: z.string().min(1),
  options: z.object({
    useNewUrlParser: z.boolean().optional(),
    useUnifiedTopology: z.boolean().optional(),
    maxPoolSize: z.number().int().positive().optional(),
    minPoolSize: z.number().int().nonnegative().optional(),
    maxIdleTimeMS: z.number().int().positive().optional(),
    socketTimeoutMS: z.number().int().positive().optional(),
    connectTimeoutMS: z.number().int().positive().optional(),
  }).optional(),
});

export type MongoConnectionOptions = z.infer<typeof MongoConnectionOptionsSchema>;

/**
 * MongoDB bulk write operation schema
 */
export const MongoBulkWriteOperationSchema = z.union([
  z.object({
    insertOne: z.object({
      document: z.record(z.string(), z.any()),
    }),
  }),
  z.object({
    updateOne: z.object({
      filter: z.record(z.string(), z.any()),
      update: MongoUpdateOperatorsSchema,
      upsert: z.boolean().optional(),
    }),
  }),
  z.object({
    updateMany: z.object({
      filter: z.record(z.string(), z.any()),
      update: MongoUpdateOperatorsSchema,
    }),
  }),
  z.object({
    deleteOne: z.object({
      filter: z.record(z.string(), z.any()),
    }),
  }),
  z.object({
    deleteMany: z.object({
      filter: z.record(z.string(), z.any()),
    }),
  }),
]);

export type MongoBulkWriteOperation = z.infer<typeof MongoBulkWriteOperationSchema>;

/**
 * Repository method input schemas
 */
export const RepositoryFindByIdSchema = z.object({
  id: MongoIdSchema,
  options: MongoFindOptionsSchema.optional(),
});

export const RepositoryFindByFiltersSchema = z.object({
  filters: z.record(z.string(), z.any()),
  options: MongoFindOptionsSchema.optional(),
});

export const RepositoryUpdateSchema = z.object({
  id: MongoIdSchema,
  data: z.record(z.string(), z.any()),
});

export const RepositoryDeleteSchema = z.object({
  id: MongoIdSchema,
});

/**
 * MongoDB session options schema
 * @description Options for transactional operations
 */
export const MongoSessionOptionsSchema = z.object({
  readPreference: z.enum(['primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest']).optional(),
  readConcern: z.object({
    level: z.enum(['local', 'available', 'majority', 'linearizable', 'snapshot']),
  }).optional(),
  writeConcern: z.object({
    w: z.union([z.number(), z.string()]).optional(),
    j: z.boolean().optional(),
    wtimeout: z.number().optional(),
  }).optional(),
});

export type MongoSessionOptions = z.infer<typeof MongoSessionOptionsSchema>;
