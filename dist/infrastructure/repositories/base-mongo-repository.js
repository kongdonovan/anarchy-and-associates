"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMongoRepository = void 0;
const mongodb_1 = require("mongodb");
const mongo_client_1 = require("../database/mongo-client");
const logger_1 = require("../logger");
class BaseMongoRepository {
    constructor(collectionName) {
        this.collectionName = collectionName;
        const db = mongo_client_1.MongoDbClient.getInstance().getDatabase();
        this.collection = db.collection(collectionName);
    }
    async add(entity) {
        try {
            const now = new Date();
            const newEntity = {
                ...entity,
                createdAt: now,
                updatedAt: now,
            };
            const result = await this.collection.insertOne(newEntity);
            if (!result.insertedId) {
                throw new Error('Failed to insert entity');
            }
            const insertedEntity = await this.findById(result.insertedId.toHexString());
            if (!insertedEntity) {
                throw new Error('Failed to retrieve inserted entity');
            }
            logger_1.logger.debug(`Entity added to ${this.collectionName}`, { id: result.insertedId });
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
            const entity = await this.collection.findOne({ _id: new mongodb_1.ObjectId(id) });
            return entity || null;
        }
        catch (error) {
            logger_1.logger.error(`Error finding entity by ID in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async findByFilters(filters) {
        try {
            const entities = await this.collection.find(filters).toArray();
            return entities;
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
            const result = await this.collection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(id) }, { $set: updateData }, { returnDocument: 'after' });
            if (!result) {
                return null;
            }
            logger_1.logger.debug(`Entity updated in ${this.collectionName}`, { id });
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Error updating entity in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async delete(id) {
        try {
            if (!mongodb_1.ObjectId.isValid(id)) {
                return false;
            }
            const result = await this.collection.deleteOne({ _id: new mongodb_1.ObjectId(id) });
            const deleted = result.deletedCount === 1;
            if (deleted) {
                logger_1.logger.debug(`Entity deleted from ${this.collectionName}`, { id });
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
            const entity = await this.collection.findOne(filters);
            return entity || null;
        }
        catch (error) {
            logger_1.logger.error(`Error finding one entity in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async findMany(filters, limit, skip) {
        try {
            let query = this.collection.find(filters);
            if (skip) {
                query = query.skip(skip);
            }
            if (limit) {
                query = query.limit(limit);
            }
            const entities = await query.toArray();
            return entities;
        }
        catch (error) {
            logger_1.logger.error(`Error finding entities in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async count(filters = {}) {
        try {
            const count = await this.collection.countDocuments(filters);
            return count;
        }
        catch (error) {
            logger_1.logger.error(`Error counting entities in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async deleteMany(filters) {
        try {
            const result = await this.collection.deleteMany(filters);
            logger_1.logger.debug(`${result.deletedCount} entities deleted from ${this.collectionName}`);
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
            let query = this.collection.find(filter);
            if (sort) {
                query = query.sort(sort);
            }
            if (skip) {
                query = query.skip(skip);
            }
            if (limit) {
                query = query.limit(limit);
            }
            const entities = await query.toArray();
            return entities;
        }
        catch (error) {
            logger_1.logger.error(`Error finding entities with complex filter in ${this.collectionName}:`, error);
            throw error;
        }
    }
    async countWithComplexFilter(filter) {
        try {
            const count = await this.collection.countDocuments(filter);
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