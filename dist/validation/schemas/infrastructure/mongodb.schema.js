"use strict";
/**
 * @module MongoDBSchemas
 * @description Zod schemas for MongoDB operations and data structures
 * @category Infrastructure/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoSessionOptionsSchema = exports.RepositoryDeleteSchema = exports.RepositoryUpdateSchema = exports.RepositoryFindByFiltersSchema = exports.RepositoryFindByIdSchema = exports.MongoBulkWriteOperationSchema = exports.MongoConnectionOptionsSchema = exports.MongoUpdateOperatorsSchema = exports.MongoFindOptionsSchema = exports.MongoSortOrderSchema = exports.MongoFilterOperatorsSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * MongoDB filter operators schema
 * @description Common MongoDB query operators
 */
exports.MongoFilterOperatorsSchema = zod_1.z.object({
    $eq: zod_1.z.any().optional(),
    $ne: zod_1.z.any().optional(),
    $gt: zod_1.z.any().optional(),
    $gte: zod_1.z.any().optional(),
    $lt: zod_1.z.any().optional(),
    $lte: zod_1.z.any().optional(),
    $in: zod_1.z.array(zod_1.z.any()).optional(),
    $nin: zod_1.z.array(zod_1.z.any()).optional(),
    $exists: zod_1.z.boolean().optional(),
    $regex: zod_1.z.union([zod_1.z.string(), zod_1.z.instanceof(RegExp)]).optional(),
});
/**
 * MongoDB sort order schema
 */
exports.MongoSortOrderSchema = zod_1.z.union([
    zod_1.z.literal(1),
    zod_1.z.literal(-1),
    zod_1.z.literal('asc'),
    zod_1.z.literal('desc'),
    zod_1.z.literal('ascending'),
    zod_1.z.literal('descending'),
]);
/**
 * MongoDB find options schema
 * @description Options for find operations
 */
exports.MongoFindOptionsSchema = zod_1.z.object({
    limit: zod_1.z.number().int().positive().optional(),
    skip: zod_1.z.number().int().nonnegative().optional(),
    sort: zod_1.z.record(zod_1.z.string(), exports.MongoSortOrderSchema).optional(),
    projection: zod_1.z.record(zod_1.z.string(), zod_1.z.union([zod_1.z.literal(0), zod_1.z.literal(1)])).optional(),
});
/**
 * MongoDB update operators schema
 * @description Common MongoDB update operators
 */
exports.MongoUpdateOperatorsSchema = zod_1.z.object({
    $set: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    $unset: zod_1.z.record(zod_1.z.string(), zod_1.z.literal('')).optional(),
    $inc: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
    $push: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    $pull: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    $addToSet: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    $pop: zod_1.z.record(zod_1.z.string(), zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(-1)])).optional(),
});
/**
 * MongoDB connection options schema
 * @description Validates MongoDB connection configuration
 */
exports.MongoConnectionOptionsSchema = zod_1.z.object({
    uri: zod_1.z.string().url().startsWith('mongodb'),
    dbName: zod_1.z.string().min(1),
    options: zod_1.z.object({
        useNewUrlParser: zod_1.z.boolean().optional(),
        useUnifiedTopology: zod_1.z.boolean().optional(),
        maxPoolSize: zod_1.z.number().int().positive().optional(),
        minPoolSize: zod_1.z.number().int().nonnegative().optional(),
        maxIdleTimeMS: zod_1.z.number().int().positive().optional(),
        socketTimeoutMS: zod_1.z.number().int().positive().optional(),
        connectTimeoutMS: zod_1.z.number().int().positive().optional(),
    }).optional(),
});
/**
 * MongoDB bulk write operation schema
 */
exports.MongoBulkWriteOperationSchema = zod_1.z.union([
    zod_1.z.object({
        insertOne: zod_1.z.object({
            document: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
        }),
    }),
    zod_1.z.object({
        updateOne: zod_1.z.object({
            filter: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
            update: exports.MongoUpdateOperatorsSchema,
            upsert: zod_1.z.boolean().optional(),
        }),
    }),
    zod_1.z.object({
        updateMany: zod_1.z.object({
            filter: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
            update: exports.MongoUpdateOperatorsSchema,
        }),
    }),
    zod_1.z.object({
        deleteOne: zod_1.z.object({
            filter: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
        }),
    }),
    zod_1.z.object({
        deleteMany: zod_1.z.object({
            filter: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
        }),
    }),
]);
/**
 * Repository method input schemas
 */
exports.RepositoryFindByIdSchema = zod_1.z.object({
    id: shared_1.MongoIdSchema,
    options: exports.MongoFindOptionsSchema.optional(),
});
exports.RepositoryFindByFiltersSchema = zod_1.z.object({
    filters: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
    options: exports.MongoFindOptionsSchema.optional(),
});
exports.RepositoryUpdateSchema = zod_1.z.object({
    id: shared_1.MongoIdSchema,
    data: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
});
exports.RepositoryDeleteSchema = zod_1.z.object({
    id: shared_1.MongoIdSchema,
});
/**
 * MongoDB session options schema
 * @description Options for transactional operations
 */
exports.MongoSessionOptionsSchema = zod_1.z.object({
    readPreference: zod_1.z.enum(['primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest']).optional(),
    readConcern: zod_1.z.object({
        level: zod_1.z.enum(['local', 'available', 'majority', 'linearizable', 'snapshot']),
    }).optional(),
    writeConcern: zod_1.z.object({
        w: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
        j: zod_1.z.boolean().optional(),
        wtimeout: zod_1.z.number().optional(),
    }).optional(),
});
//# sourceMappingURL=mongodb.schema.js.map