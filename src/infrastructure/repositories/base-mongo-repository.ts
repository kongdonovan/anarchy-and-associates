import { Collection, ObjectId, Filter, UpdateFilter, ClientSession, WithId } from 'mongodb';
import { IRepository } from '../../domain/entities/base'; // Keep IRepository as it's an interface
import { ITransactionAwareRepository } from '../unit-of-work/unit-of-work';
import { MongoDbClient } from '../database/mongo-client';
import { logger } from '../logger';

// Re-export IRepository for use in other modules
export { IRepository };

// MongoDB document type with ObjectId
type MongoDocument<T> = Omit<T, '_id'> & { _id?: ObjectId };

// Base type constraint for entities
type BaseEntityConstraint = {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
};

export abstract class BaseMongoRepository<T extends BaseEntityConstraint> implements ITransactionAwareRepository<T> {
  protected readonly collection: Collection<MongoDocument<T>>;
  protected readonly collectionName: string;
  private session: ClientSession | null = null;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
    const db = MongoDbClient.getInstance().getDatabase();
    this.collection = db.collection<MongoDocument<T>>(collectionName);
  }

  /**
   * Sets the MongoDB ClientSession for transaction-aware operations.
   * When a session is set, all repository operations will use this session.
   */
  public setSession(session: ClientSession | null): void {
    this.session = session;
    logger.debug(`Session ${session ? 'set' : 'cleared'} for repository ${this.collectionName}`, {
      hasSession: !!session,
      transactionActive: session?.inTransaction() || false
    });
  }

  /**
   * Gets the current MongoDB ClientSession.
   */
  public getSession(): ClientSession | null {
    return this.session;
  }

  /**
   * Gets the session options for MongoDB operations.
   * Returns an object with session if available, empty object otherwise.
   */
  private getSessionOptions(): { session?: ClientSession } {
    return this.session ? { session: this.session } : {};
  }

  /**
   * Converts a string ID to MongoDB ObjectId
   */
  protected toObjectId(id: string): ObjectId {
    return new ObjectId(id);
  }

  /**
   * Converts a MongoDB document to entity with string ID
   */
  protected fromMongoDoc(doc: MongoDocument<T> | WithId<MongoDocument<T>> | null): T | null {
    if (!doc) return null;
    
    const { _id, ...rest } = doc;
    return {
      ...rest,
      _id: _id?.toString()
    } as T;
  }

  /**
   * Converts an entity to MongoDB document format
   */
  protected toMongoDoc(entity: Partial<T>): Partial<MongoDocument<T>> {
    const { _id, ...rest } = entity;
    if (_id) {
      return {
        ...rest,
        _id: this.toObjectId(_id as string)
      } as Partial<MongoDocument<T>>;
    }
    return rest as Partial<MongoDocument<T>>;
  }

  public async add(entity: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    try {
      const now = new Date();
      const mongoDoc = {
        ...entity,
        createdAt: now,
        updatedAt: now,
      };

      const sessionOptions = this.getSessionOptions();
      const result = await this.collection.insertOne(mongoDoc as any, sessionOptions);
      
      if (!result.insertedId) {
        throw new Error('Failed to insert entity');
      }

      // Convert back to entity with string ID
      const insertedDoc = {
        ...mongoDoc,
        _id: result.insertedId,
      } as MongoDocument<T>;
      const insertedEntity = this.fromMongoDoc(insertedDoc)!;

      logger.debug(`Entity added to ${this.collectionName}`, { 
        id: result.insertedId,
        hasSession: !!this.session,
        inTransaction: this.session?.inTransaction() || false
      });
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

      const sessionOptions = this.getSessionOptions();
      const doc = await this.collection.findOne({ _id: new ObjectId(id) } as Filter<MongoDocument<T>>, sessionOptions);
      return this.fromMongoDoc(doc);
    } catch (error) {
      logger.error(`Error finding entity by ID in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async findByFilters(filters: Partial<T>): Promise<T[]> {
    try {
      const sessionOptions = this.getSessionOptions();
      const mongoFilters = this.toMongoDoc(filters);
      const docs = await this.collection.find(mongoFilters as Filter<MongoDocument<T>>, sessionOptions).toArray();
      return docs.map(doc => this.fromMongoDoc(doc)!);
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

      const sessionOptions = this.getSessionOptions();
      const mongoUpdates = this.toMongoDoc(updateData);
      delete mongoUpdates._id; // Don't update _id
      
      const result = await this.collection.findOneAndUpdate(
        { _id: new ObjectId(id) } as Filter<MongoDocument<T>>,
        { $set: mongoUpdates } as UpdateFilter<MongoDocument<T>>,
        { returnDocument: 'after', ...sessionOptions }
      );

      if (!result) {
        return null;
      }

      logger.debug(`Entity updated in ${this.collectionName}`, { 
        id,
        hasSession: !!this.session,
        inTransaction: this.session?.inTransaction() || false
      });
      return this.fromMongoDoc(result);
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
      const mongoConditions = this.toMongoDoc(conditions);
      const filter = {
        _id: new ObjectId(id),
        ...mongoConditions
      } as Filter<MongoDocument<T>>;

      const sessionOptions = this.getSessionOptions();
      const mongoUpdates = this.toMongoDoc(updateData);
      delete mongoUpdates._id; // Don't update _id
      
      const result = await this.collection.findOneAndUpdate(
        filter,
        { $set: mongoUpdates } as UpdateFilter<MongoDocument<T>>,
        { returnDocument: 'after', ...sessionOptions }
      );

      if (!result) {
        return null;
      }

      logger.debug(`Entity conditionally updated in ${this.collectionName}`, { 
        id, 
        conditions,
        hasSession: !!this.session,
        inTransaction: this.session?.inTransaction() || false
      });
      return this.fromMongoDoc(result);
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

      const sessionOptions = this.getSessionOptions();
      const result = await this.collection.deleteOne({ _id: new ObjectId(id) } as Filter<MongoDocument<T>>, sessionOptions);
      
      const deleted = result.deletedCount === 1;
      if (deleted) {
        logger.debug(`Entity deleted from ${this.collectionName}`, { 
          id,
          hasSession: !!this.session,
          inTransaction: this.session?.inTransaction() || false
        });
      }
      
      return deleted;
    } catch (error) {
      logger.error(`Error deleting entity from ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async findOne(filters: Partial<T>): Promise<T | null> {
    try {
      const sessionOptions = this.getSessionOptions();
      const mongoFilters = this.toMongoDoc(filters);
      const doc = await this.collection.findOne(mongoFilters as Filter<MongoDocument<T>>, sessionOptions);
      return this.fromMongoDoc(doc);
    } catch (error) {
      logger.error(`Error finding one entity in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async findMany(filters: Partial<T>, limit?: number, skip?: number): Promise<T[]> {
    try {
      const sessionOptions = this.getSessionOptions();
      const mongoFilters = this.toMongoDoc(filters);
      let query = this.collection.find(mongoFilters as Filter<MongoDocument<T>>, sessionOptions);
      
      if (skip) {
        query = query.skip(skip);
      }
      
      if (limit) {
        query = query.limit(limit);
      }

      const docs = await query.toArray();
      return docs.map(doc => this.fromMongoDoc(doc)!);
    } catch (error) {
      logger.error(`Error finding entities in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async count(filters: Partial<T> = {}): Promise<number> {
    try {
      const sessionOptions = this.getSessionOptions();
      const mongoFilters = this.toMongoDoc(filters);
      const count = await this.collection.countDocuments(mongoFilters as Filter<MongoDocument<T>>, sessionOptions);
      return count;
    } catch (error) {
      logger.error(`Error counting entities in ${this.collectionName}:`, error);
      throw error;
    }
  }

  public async deleteMany(filters: Partial<T>): Promise<number> {
    try {
      const sessionOptions = this.getSessionOptions();
      const mongoFilters = this.toMongoDoc(filters);
      const result = await this.collection.deleteMany(mongoFilters as Filter<MongoDocument<T>>, sessionOptions);
      logger.debug(`${result.deletedCount} entities deleted from ${this.collectionName}`, {
        hasSession: !!this.session,
        inTransaction: this.session?.inTransaction() || false
      });
      return result.deletedCount;
    } catch (error) {
      logger.error(`Error deleting multiple entities from ${this.collectionName}:`, error);
      throw error;
    }
  }

  // Advanced query methods for complex filtering
  protected async findWithComplexFilter(filter: Filter<T>, sort?: any, limit?: number, skip?: number): Promise<T[]> {
    try {
      const sessionOptions = this.getSessionOptions();
      let query = this.collection.find(filter as Filter<MongoDocument<T>>, sessionOptions);
      
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
      return docs.map(doc => this.fromMongoDoc(doc)).filter(entity => entity !== null) as T[];
    } catch (error) {
      logger.error(`Error finding entities with complex filter in ${this.collectionName}:`, error);
      throw error;
    }
  }

  protected async countWithComplexFilter(filter: Filter<T>): Promise<number> {
    try {
      const sessionOptions = this.getSessionOptions();
      const count = await this.collection.countDocuments(filter as Filter<MongoDocument<T>>, sessionOptions);
      return count;
    } catch (error) {
      logger.error(`Error counting entities with complex filter in ${this.collectionName}:`, error);
      throw error;
    }
  }
}