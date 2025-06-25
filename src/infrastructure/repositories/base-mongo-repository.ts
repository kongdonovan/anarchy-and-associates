import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { BaseEntity, IRepository } from '../../domain/entities/base';
import { MongoDbClient } from '../database/mongo-client';
import { logger } from '../logger';

export abstract class BaseMongoRepository<T extends BaseEntity> implements IRepository<T> {
  protected readonly collection: Collection<T>;
  protected readonly collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
    const db = MongoDbClient.getInstance().getDatabase();
    this.collection = db.collection<T>(collectionName);
  }

  public async add(entity: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    try {
      const now = new Date();
      const newEntity = {
        ...entity,
        createdAt: now,
        updatedAt: now,
      } as T;

      const result = await this.collection.insertOne(newEntity as any);
      
      if (!result.insertedId) {
        throw new Error('Failed to insert entity');
      }

      // Set the _id on the entity and return it directly instead of querying again
      const insertedEntity = {
        ...newEntity,
        _id: result.insertedId,
      } as T;

      logger.debug(`Entity added to ${this.collectionName}`, { id: result.insertedId });
      return insertedEntity;
    } catch (error) {
      logger.error(`Error adding entity to ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async findById(id: string): Promise<T | null> {
    try {
      if (!ObjectId.isValid(id)) {
        return null;
      }

      const entity = await this.collection.findOne({ _id: new ObjectId(id) } as Filter<T>);
      return entity as T || null;
    } catch (error) {
      logger.error(`Error finding entity by ID in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async findByFilters(filters: Partial<T>): Promise<T[]> {
    try {
      const entities = await this.collection.find(filters as Filter<T>).toArray();
      return entities as T[];
    } catch (error) {
      logger.error(`Error finding entities by filters in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async update(id: string, updates: Partial<T>): Promise<T | null> {
    try {
      if (!ObjectId.isValid(id)) {
        return null;
      }

      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      const result = await this.collection.findOneAndUpdate(
        { _id: new ObjectId(id) } as Filter<T>,
        { $set: updateData } as UpdateFilter<T>,
        { returnDocument: 'after' }
      );

      if (!result) {
        return null;
      }

      logger.debug(`Entity updated in ${this.collectionName}`, { id });
      return result as T;
    } catch (error) {
      logger.error(`Error updating entity in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async conditionalUpdate(id: string, conditions: Partial<T>, updates: Partial<T>): Promise<T | null> {
    try {
      if (!ObjectId.isValid(id)) {
        return null;
      }

      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      // Combine ID condition with additional conditions
      const filter = {
        _id: new ObjectId(id),
        ...conditions
      } as Filter<T>;

      const result = await this.collection.findOneAndUpdate(
        filter,
        { $set: updateData } as UpdateFilter<T>,
        { returnDocument: 'after' }
      );

      if (!result) {
        return null;
      }

      logger.debug(`Entity conditionally updated in ${this.collectionName}`, { id, conditions });
      return result as T;
    } catch (error) {
      logger.error(`Error conditionally updating entity in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async delete(id: string): Promise<boolean> {
    try {
      if (!ObjectId.isValid(id)) {
        return false;
      }

      const result = await this.collection.deleteOne({ _id: new ObjectId(id) } as Filter<T>);
      
      const deleted = result.deletedCount === 1;
      if (deleted) {
        logger.debug(`Entity deleted from ${this.collectionName}`, { id });
      }
      
      return deleted;
    } catch (error) {
      logger.error(`Error deleting entity from ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async findOne(filters: Partial<T>): Promise<T | null> {
    try {
      const entity = await this.collection.findOne(filters as Filter<T>);
      return entity as T || null;
    } catch (error) {
      logger.error(`Error finding one entity in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async findMany(filters: Partial<T>, limit?: number, skip?: number): Promise<T[]> {
    try {
      let query = this.collection.find(filters as Filter<T>);
      
      if (skip) {
        query = query.skip(skip);
      }
      
      if (limit) {
        query = query.limit(limit);
      }

      const entities = await query.toArray();
      return entities as T[];
    } catch (error) {
      logger.error(`Error finding entities in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async count(filters: Partial<T> = {}): Promise<number> {
    try {
      const count = await this.collection.countDocuments(filters as Filter<T>);
      return count;
    } catch (error) {
      logger.error(`Error counting entities in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async deleteMany(filters: Partial<T>): Promise<number> {
    try {
      const result = await this.collection.deleteMany(filters as Filter<T>);
      logger.debug(`${result.deletedCount} entities deleted from ${this.collectionName}`);
      return result.deletedCount;
    } catch (error) {
      logger.error(`Error deleting multiple entities from ${this.collectionName}:`, error);
      throw error;
    }
  }

  // Advanced query methods for complex filtering
  protected async findWithComplexFilter(filter: Filter<T>, sort?: any, limit?: number, skip?: number): Promise<T[]> {
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
      return entities as T[];
    } catch (error) {
      logger.error(`Error finding entities with complex filter in ${this.collectionName}:`, error);
      throw error;
    }
  }

  protected async countWithComplexFilter(filter: Filter<T>): Promise<number> {
    try {
      const count = await this.collection.countDocuments(filter);
      return count;
    } catch (error) {
      logger.error(`Error counting entities with complex filter in ${this.collectionName}:`, error);
      throw error;
    }
  }
}