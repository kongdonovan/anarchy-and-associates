/**
 * @module MongoDBSchemas
 * @description Zod schemas for MongoDB operations and data structures
 * @category Infrastructure/Validation
 */
import { z } from 'zod';
/**
 * MongoDB filter operators schema
 * @description Common MongoDB query operators
 */
export declare const MongoFilterOperatorsSchema: z.ZodObject<{
    $eq: z.ZodOptional<z.ZodAny>;
    $ne: z.ZodOptional<z.ZodAny>;
    $gt: z.ZodOptional<z.ZodAny>;
    $gte: z.ZodOptional<z.ZodAny>;
    $lt: z.ZodOptional<z.ZodAny>;
    $lte: z.ZodOptional<z.ZodAny>;
    $in: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    $nin: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    $exists: z.ZodOptional<z.ZodBoolean>;
    $regex: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodType<RegExp, z.ZodTypeDef, RegExp>]>>;
}, "strip", z.ZodTypeAny, {
    $eq?: any;
    $ne?: any;
    $gt?: any;
    $gte?: any;
    $lt?: any;
    $lte?: any;
    $in?: any[] | undefined;
    $nin?: any[] | undefined;
    $exists?: boolean | undefined;
    $regex?: string | RegExp | undefined;
}, {
    $eq?: any;
    $ne?: any;
    $gt?: any;
    $gte?: any;
    $lt?: any;
    $lte?: any;
    $in?: any[] | undefined;
    $nin?: any[] | undefined;
    $exists?: boolean | undefined;
    $regex?: string | RegExp | undefined;
}>;
/**
 * MongoDB sort order schema
 */
export declare const MongoSortOrderSchema: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>, z.ZodLiteral<"asc">, z.ZodLiteral<"desc">, z.ZodLiteral<"ascending">, z.ZodLiteral<"descending">]>;
export type MongoSortOrder = z.infer<typeof MongoSortOrderSchema>;
/**
 * MongoDB find options schema
 * @description Options for find operations
 */
export declare const MongoFindOptionsSchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNumber>;
    skip: z.ZodOptional<z.ZodNumber>;
    sort: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>, z.ZodLiteral<"asc">, z.ZodLiteral<"desc">, z.ZodLiteral<"ascending">, z.ZodLiteral<"descending">]>>>;
    projection: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>]>>>;
}, "strip", z.ZodTypeAny, {
    sort?: Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending"> | undefined;
    limit?: number | undefined;
    skip?: number | undefined;
    projection?: Record<string, 0 | 1> | undefined;
}, {
    sort?: Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending"> | undefined;
    limit?: number | undefined;
    skip?: number | undefined;
    projection?: Record<string, 0 | 1> | undefined;
}>;
export type MongoFindOptions = z.infer<typeof MongoFindOptionsSchema>;
/**
 * MongoDB update operators schema
 * @description Common MongoDB update operators
 */
export declare const MongoUpdateOperatorsSchema: z.ZodObject<{
    $set: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    $unset: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodLiteral<"">>>;
    $inc: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    $push: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    $pull: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    $addToSet: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    $pop: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>]>>>;
}, "strip", z.ZodTypeAny, {
    $set?: Record<string, any> | undefined;
    $unset?: Record<string, ""> | undefined;
    $inc?: Record<string, number> | undefined;
    $push?: Record<string, any> | undefined;
    $pull?: Record<string, any> | undefined;
    $addToSet?: Record<string, any> | undefined;
    $pop?: Record<string, 1 | -1> | undefined;
}, {
    $set?: Record<string, any> | undefined;
    $unset?: Record<string, ""> | undefined;
    $inc?: Record<string, number> | undefined;
    $push?: Record<string, any> | undefined;
    $pull?: Record<string, any> | undefined;
    $addToSet?: Record<string, any> | undefined;
    $pop?: Record<string, 1 | -1> | undefined;
}>;
export type MongoUpdateOperators = z.infer<typeof MongoUpdateOperatorsSchema>;
/**
 * MongoDB connection options schema
 * @description Validates MongoDB connection configuration
 */
export declare const MongoConnectionOptionsSchema: z.ZodObject<{
    uri: z.ZodString;
    dbName: z.ZodString;
    options: z.ZodOptional<z.ZodObject<{
        useNewUrlParser: z.ZodOptional<z.ZodBoolean>;
        useUnifiedTopology: z.ZodOptional<z.ZodBoolean>;
        maxPoolSize: z.ZodOptional<z.ZodNumber>;
        minPoolSize: z.ZodOptional<z.ZodNumber>;
        maxIdleTimeMS: z.ZodOptional<z.ZodNumber>;
        socketTimeoutMS: z.ZodOptional<z.ZodNumber>;
        connectTimeoutMS: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        useNewUrlParser?: boolean | undefined;
        useUnifiedTopology?: boolean | undefined;
        maxPoolSize?: number | undefined;
        minPoolSize?: number | undefined;
        maxIdleTimeMS?: number | undefined;
        socketTimeoutMS?: number | undefined;
        connectTimeoutMS?: number | undefined;
    }, {
        useNewUrlParser?: boolean | undefined;
        useUnifiedTopology?: boolean | undefined;
        maxPoolSize?: number | undefined;
        minPoolSize?: number | undefined;
        maxIdleTimeMS?: number | undefined;
        socketTimeoutMS?: number | undefined;
        connectTimeoutMS?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    uri: string;
    dbName: string;
    options?: {
        useNewUrlParser?: boolean | undefined;
        useUnifiedTopology?: boolean | undefined;
        maxPoolSize?: number | undefined;
        minPoolSize?: number | undefined;
        maxIdleTimeMS?: number | undefined;
        socketTimeoutMS?: number | undefined;
        connectTimeoutMS?: number | undefined;
    } | undefined;
}, {
    uri: string;
    dbName: string;
    options?: {
        useNewUrlParser?: boolean | undefined;
        useUnifiedTopology?: boolean | undefined;
        maxPoolSize?: number | undefined;
        minPoolSize?: number | undefined;
        maxIdleTimeMS?: number | undefined;
        socketTimeoutMS?: number | undefined;
        connectTimeoutMS?: number | undefined;
    } | undefined;
}>;
export type MongoConnectionOptions = z.infer<typeof MongoConnectionOptionsSchema>;
/**
 * MongoDB bulk write operation schema
 */
export declare const MongoBulkWriteOperationSchema: z.ZodUnion<[z.ZodObject<{
    insertOne: z.ZodObject<{
        document: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        document: Record<string, any>;
    }, {
        document: Record<string, any>;
    }>;
}, "strip", z.ZodTypeAny, {
    insertOne: {
        document: Record<string, any>;
    };
}, {
    insertOne: {
        document: Record<string, any>;
    };
}>, z.ZodObject<{
    updateOne: z.ZodObject<{
        filter: z.ZodRecord<z.ZodString, z.ZodAny>;
        update: z.ZodObject<{
            $set: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            $unset: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodLiteral<"">>>;
            $inc: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
            $push: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            $pull: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            $addToSet: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            $pop: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>]>>>;
        }, "strip", z.ZodTypeAny, {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        }, {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        }>;
        upsert: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        filter: Record<string, any>;
        update: {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        };
        upsert?: boolean | undefined;
    }, {
        filter: Record<string, any>;
        update: {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        };
        upsert?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    updateOne: {
        filter: Record<string, any>;
        update: {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        };
        upsert?: boolean | undefined;
    };
}, {
    updateOne: {
        filter: Record<string, any>;
        update: {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        };
        upsert?: boolean | undefined;
    };
}>, z.ZodObject<{
    updateMany: z.ZodObject<{
        filter: z.ZodRecord<z.ZodString, z.ZodAny>;
        update: z.ZodObject<{
            $set: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            $unset: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodLiteral<"">>>;
            $inc: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
            $push: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            $pull: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            $addToSet: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            $pop: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>]>>>;
        }, "strip", z.ZodTypeAny, {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        }, {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        filter: Record<string, any>;
        update: {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        };
    }, {
        filter: Record<string, any>;
        update: {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    updateMany: {
        filter: Record<string, any>;
        update: {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        };
    };
}, {
    updateMany: {
        filter: Record<string, any>;
        update: {
            $set?: Record<string, any> | undefined;
            $unset?: Record<string, ""> | undefined;
            $inc?: Record<string, number> | undefined;
            $push?: Record<string, any> | undefined;
            $pull?: Record<string, any> | undefined;
            $addToSet?: Record<string, any> | undefined;
            $pop?: Record<string, 1 | -1> | undefined;
        };
    };
}>, z.ZodObject<{
    deleteOne: z.ZodObject<{
        filter: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        filter: Record<string, any>;
    }, {
        filter: Record<string, any>;
    }>;
}, "strip", z.ZodTypeAny, {
    deleteOne: {
        filter: Record<string, any>;
    };
}, {
    deleteOne: {
        filter: Record<string, any>;
    };
}>, z.ZodObject<{
    deleteMany: z.ZodObject<{
        filter: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        filter: Record<string, any>;
    }, {
        filter: Record<string, any>;
    }>;
}, "strip", z.ZodTypeAny, {
    deleteMany: {
        filter: Record<string, any>;
    };
}, {
    deleteMany: {
        filter: Record<string, any>;
    };
}>]>;
export type MongoBulkWriteOperation = z.infer<typeof MongoBulkWriteOperationSchema>;
/**
 * Repository method input schemas
 */
export declare const RepositoryFindByIdSchema: z.ZodObject<{
    id: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
    options: z.ZodOptional<z.ZodObject<{
        limit: z.ZodOptional<z.ZodNumber>;
        skip: z.ZodOptional<z.ZodNumber>;
        sort: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>, z.ZodLiteral<"asc">, z.ZodLiteral<"desc">, z.ZodLiteral<"ascending">, z.ZodLiteral<"descending">]>>>;
        projection: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>]>>>;
    }, "strip", z.ZodTypeAny, {
        sort?: Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending"> | undefined;
        limit?: number | undefined;
        skip?: number | undefined;
        projection?: Record<string, 0 | 1> | undefined;
    }, {
        sort?: Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending"> | undefined;
        limit?: number | undefined;
        skip?: number | undefined;
        projection?: Record<string, 0 | 1> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    options?: {
        sort?: Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending"> | undefined;
        limit?: number | undefined;
        skip?: number | undefined;
        projection?: Record<string, 0 | 1> | undefined;
    } | undefined;
}, {
    id: string | import("bson").ObjectId;
    options?: {
        sort?: Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending"> | undefined;
        limit?: number | undefined;
        skip?: number | undefined;
        projection?: Record<string, 0 | 1> | undefined;
    } | undefined;
}>;
export declare const RepositoryFindByFiltersSchema: z.ZodObject<{
    filters: z.ZodRecord<z.ZodString, z.ZodAny>;
    options: z.ZodOptional<z.ZodObject<{
        limit: z.ZodOptional<z.ZodNumber>;
        skip: z.ZodOptional<z.ZodNumber>;
        sort: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>, z.ZodLiteral<"asc">, z.ZodLiteral<"desc">, z.ZodLiteral<"ascending">, z.ZodLiteral<"descending">]>>>;
        projection: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>]>>>;
    }, "strip", z.ZodTypeAny, {
        sort?: Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending"> | undefined;
        limit?: number | undefined;
        skip?: number | undefined;
        projection?: Record<string, 0 | 1> | undefined;
    }, {
        sort?: Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending"> | undefined;
        limit?: number | undefined;
        skip?: number | undefined;
        projection?: Record<string, 0 | 1> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    filters: Record<string, any>;
    options?: {
        sort?: Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending"> | undefined;
        limit?: number | undefined;
        skip?: number | undefined;
        projection?: Record<string, 0 | 1> | undefined;
    } | undefined;
}, {
    filters: Record<string, any>;
    options?: {
        sort?: Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending"> | undefined;
        limit?: number | undefined;
        skip?: number | undefined;
        projection?: Record<string, 0 | 1> | undefined;
    } | undefined;
}>;
export declare const RepositoryUpdateSchema: z.ZodObject<{
    id: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
    data: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    id: string;
    data: Record<string, any>;
}, {
    id: string | import("bson").ObjectId;
    data: Record<string, any>;
}>;
export declare const RepositoryDeleteSchema: z.ZodObject<{
    id: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string | import("bson").ObjectId;
}>;
/**
 * MongoDB session options schema
 * @description Options for transactional operations
 */
export declare const MongoSessionOptionsSchema: z.ZodObject<{
    readPreference: z.ZodOptional<z.ZodEnum<["primary", "primaryPreferred", "secondary", "secondaryPreferred", "nearest"]>>;
    readConcern: z.ZodOptional<z.ZodObject<{
        level: z.ZodEnum<["local", "available", "majority", "linearizable", "snapshot"]>;
    }, "strip", z.ZodTypeAny, {
        level: "local" | "available" | "majority" | "linearizable" | "snapshot";
    }, {
        level: "local" | "available" | "majority" | "linearizable" | "snapshot";
    }>>;
    writeConcern: z.ZodOptional<z.ZodObject<{
        w: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
        j: z.ZodOptional<z.ZodBoolean>;
        wtimeout: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        w?: string | number | undefined;
        j?: boolean | undefined;
        wtimeout?: number | undefined;
    }, {
        w?: string | number | undefined;
        j?: boolean | undefined;
        wtimeout?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    readPreference?: "primary" | "primaryPreferred" | "secondary" | "secondaryPreferred" | "nearest" | undefined;
    readConcern?: {
        level: "local" | "available" | "majority" | "linearizable" | "snapshot";
    } | undefined;
    writeConcern?: {
        w?: string | number | undefined;
        j?: boolean | undefined;
        wtimeout?: number | undefined;
    } | undefined;
}, {
    readPreference?: "primary" | "primaryPreferred" | "secondary" | "secondaryPreferred" | "nearest" | undefined;
    readConcern?: {
        level: "local" | "available" | "majority" | "linearizable" | "snapshot";
    } | undefined;
    writeConcern?: {
        w?: string | number | undefined;
        j?: boolean | undefined;
        wtimeout?: number | undefined;
    } | undefined;
}>;
export type MongoSessionOptions = z.infer<typeof MongoSessionOptionsSchema>;
//# sourceMappingURL=mongodb.schema.d.ts.map