"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMongoRepository = void 0;
const mongodb_1 = require("mongodb");
const mongo_client_1 = require("../database/mongo-client");
const logger_1 = require("../logger");
class BaseMongoRepository {
    constructor(collectionName) {
        this.session = null;
        this.collectionName = collectionName;
        const db = mongo_client_1.MongoDbClient.getInstance().getDatabase();
        this.collection = db.collection(collectionName);
    }
    /**
     * Sets the MongoDB ClientSession for transaction-aware operations.
     * When a session is set, all repository operations will use this session.
     */
    setSession(session) {
        this.session = session;
        logger_1.logger.debug(`Session ${session ? 'set' : 'cleared'} for repository ${this.collectionName}`, {
            hasSession: !!session,
            transactionActive: session?.inTransaction() || false
        });
    }
    /**
     * Gets the current MongoDB ClientSession.
     */
    getSession() {
        return this.session;
    }
    /**
     * Gets the session options for MongoDB operations.
     * Returns an object with session if available, empty object otherwise.
     */
    getSessionOptions() {
        return this.session ? { session: this.session } : {};
    }
    /**
     * Converts a string ID to MongoDB ObjectId
     */
    toObjectId(id) {
        return new mongodb_1.ObjectId(id);
    }
    /**
     * Converts a MongoDB document to entity with string ID
     */
    fromMongoDoc(doc) {
        if (!doc)
            return null;
        const { _id, ...rest } = doc;
        return {
            ...rest,
            _id: _id?.toString()
        };
    }
    /**
     * Converts an entity to MongoDB document format
     */
    toMongoDoc(entity) {
        const { _id, ...rest } = entity;
        if (_id) {
            return {
                ...rest,
                _id: this.toObjectId(_id)
            };
        }
        return rest;
    }
    async add(entity) {
        try {
            const now = new Date();
            const mongoDoc = {
                ...entity,
                createdAt: now,
                updatedAt: now,
            };
            const sessionOptions = this.getSessionOptions();
            const result = await this.collection.insertOne(mongoDoc, sessionOptions);
            if (!result.insertedId) {
                throw new Error('Failed to insert entity');
            }
            // Convert back to entity with string ID
            const insertedDoc = {
                ...mongoDoc,
                _id: result.insertedId,
            };
            const insertedEntity = this.fromMongoDoc(insertedDoc);
            logger_1.logger.debug(`Entity added to ${this.collectionName}`, {
                id: result.insertedId,
                hasSession: !!this.session,
                inTransaction: this.session?.inTransaction() || false
            });
            return insertedEntity;
        }
        catch (error) {
            logger_1.logger.error(`Error adding entity to ${this.collectionName}:`, error);
            throw error;
        }
    }
    async findById(id) {
        try {
            if (!mongodb_1.ObjectId.isValid(id)) {
                return null;
            }
            const sessionOptions = this.getSessionOptions();
            const doc = await this.collection.findOne({ _id: new mongodb_1.ObjectId(id) }, sessionOptions);
            return this.fromMongoDoc(doc);
        }
        catch (error) {
            logger_1.logger.error(`Error finding entity by ID in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async findByFilters(filters) {
        try {
            const sessionOptions = this.getSessionOptions();
            const mongoFilters = this.toMongoDoc(filters);
            const docs = await this.collection.find(mongoFilters, sessionOptions).toArray();
            return docs.map(doc => this.fromMongoDoc(doc));
        }
        catch (error) {
            logger_1.logger.error(`Error finding entities by filters in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            if (!mongodb_1.ObjectId.isValid(id)) {
                return null;
            }
            const updateData = {
                ...updates,
                updatedAt: new Date(),
            };
            const sessionOptions = this.getSessionOptions();
            const mongoUpdates = this.toMongoDoc(updateData);
            delete mongoUpdates._id; // Don't update _id
            const result = await this.collection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(id) }, { $set: mongoUpdates }, { returnDocument: 'after', ...sessionOptions });
            if (!result) {
                return null;
            }
            logger_1.logger.debug(`Entity updated in ${this.collectionName}`, {
                id,
                hasSession: !!this.session,
                inTransaction: this.session?.inTransaction() || false
            });
            return this.fromMongoDoc(result);
        }
        catch (error) {
            logger_1.logger.error(`Error updating entity in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async conditionalUpdate(id, conditions, updates) {
        try {
            if (!mongodb_1.ObjectId.isValid(id)) {
                return null;
            }
            const updateData = {
                ...updates,
                updatedAt: new Date(),
            };
            // Combine ID condition with additional conditions
            const mongoConditions = this.toMongoDoc(conditions);
            const filter = {
                _id: new mongodb_1.ObjectId(id),
                ...mongoConditions
            };
            const sessionOptions = this.getSessionOptions();
            const mongoUpdates = this.toMongoDoc(updateData);
            delete mongoUpdates._id; // Don't update _id
            const result = await this.collection.findOneAndUpdate(filter, { $set: mongoUpdates }, { returnDocument: 'after', ...sessionOptions });
            if (!result) {
                return null;
            }
            logger_1.logger.debug(`Entity conditionally updated in ${this.collectionName}`, {
                id,
                conditions,
                hasSession: !!this.session,
                inTransaction: this.session?.inTransaction() || false
            });
            return this.fromMongoDoc(result);
        }
        catch (error) {
            logger_1.logger.error(`Error conditionally updating entity in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async delete(id) {
        try {
            if (!mongodb_1.ObjectId.isValid(id)) {
                return false;
            }
            const sessionOptions = this.getSessionOptions();
            const result = await this.collection.deleteOne({ _id: new mongodb_1.ObjectId(id) }, sessionOptions);
            const deleted = result.deletedCount === 1;
            if (deleted) {
                logger_1.logger.debug(`Entity deleted from ${this.collectionName}`, {
                    id,
                    hasSession: !!this.session,
                    inTransaction: this.session?.inTransaction() || false
                });
            }
            return deleted;
        }
        catch (error) {
            logger_1.logger.error(`Error deleting entity from ${this.collectionName}:`, error);
            throw error;
        }
    }
    async findOne(filters) {
        try {
            const sessionOptions = this.getSessionOptions();
            const mongoFilters = this.toMongoDoc(filters);
            const doc = await this.collection.findOne(mongoFilters, sessionOptions);
            return this.fromMongoDoc(doc);
        }
        catch (error) {
            logger_1.logger.error(`Error finding one entity in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async findMany(filters, limit, skip) {
        try {
            const sessionOptions = this.getSessionOptions();
            const mongoFilters = this.toMongoDoc(filters);
            let query = this.collection.find(mongoFilters, sessionOptions);
            if (skip) {
                query = query.skip(skip);
            }
            if (limit) {
                query = query.limit(limit);
            }
            const docs = await query.toArray();
            return docs.map(doc => this.fromMongoDoc(doc));
        }
        catch (error) {
            logger_1.logger.error(`Error finding entities in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async count(filters = {}) {
        try {
            const sessionOptions = this.getSessionOptions();
            const mongoFilters = this.toMongoDoc(filters);
            const count = await this.collection.countDocuments(mongoFilters, sessionOptions);
            return count;
        }
        catch (error) {
            logger_1.logger.error(`Error counting entities in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async deleteMany(filters) {
        try {
            const sessionOptions = this.getSessionOptions();
            const mongoFilters = this.toMongoDoc(filters);
            const result = await this.collection.deleteMany(mongoFilters, sessionOptions);
            logger_1.logger.debug(`${result.deletedCount} entities deleted from ${this.collectionName}`, {
                hasSession: !!this.session,
                inTransaction: this.session?.inTransaction() || false
            });
            return result.deletedCount;
        }
        catch (error) {
            logger_1.logger.error(`Error deleting multiple entities from ${this.collectionName}:`, error);
            throw error;
        }
    }
    // Advanced query methods for complex filtering
    async findWithComplexFilter(filter, sort, limit, skip) {
        try {
            const sessionOptions = this.getSessionOptions();
            let query = this.collection.find(filter, sessionOptions);
            if (sort) {
                query = query.sort(sort);
            }
            if (skip) {
                query = query.skip(skip);
            }
            if (limit) {
                query = query.limit(limit);
            }
            const docs = await query.toArray();
            return docs.map(doc => this.fromMongoDoc(doc)).filter(entity => entity !== null);
        }
        catch (error) {
            logger_1.logger.error(`Error finding entities with complex filter in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async countWithComplexFilter(filter) {
        try {
            const sessionOptions = this.getSessionOptions();
            const count = await this.collection.countDocuments(filter, sessionOptions);
            return count;
        }
        catch (error) {
            logger_1.logger.error(`Error counting entities with complex filter in ${this.collectionName}:`, error);
            throw error;
        }
    }
}
exports.BaseMongoRepository = BaseMongoRepository;
//# sourceMappingURL=base-mongo-repository.js.map