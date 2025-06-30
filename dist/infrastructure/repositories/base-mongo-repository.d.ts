import { Collection, ObjectId, Filter, ClientSession, WithId } from 'mongodb';
import { IRepository } from '../../domain/entities/base';
import { ITransactionAwareRepository } from '../unit-of-work/unit-of-work';
export { IRepository };
type MongoDocument<T> = Omit<T, '_id'> & {
    _id?: ObjectId;
};
type BaseEntityConstraint = {
    _id?: string;
    createdAt: Date;
    updatedAt: Date;
};
export declare abstract class BaseMongoRepository<T extends BaseEntityConstraint> implements ITransactionAwareRepository<T> {
    protected readonly collection: Collection<MongoDocument<T>>;
    protected readonly collectionName: string;
    private session;
    constructor(collectionName: string);
    /**
     * Sets the MongoDB ClientSession for transaction-aware operations.
     * When a session is set, all repository operations will use this session.
     */
    setSession(session: ClientSession | null): void;
    /**
     * Gets the current MongoDB ClientSession.
     */
    getSession(): ClientSession | null;
    /**
     * Gets the session options for MongoDB operations.
     * Returns an object with session if available, empty object otherwise.
     */
    private getSessionOptions;
    /**
     * Converts a string ID to MongoDB ObjectId
     */
    protected toObjectId(id: string): ObjectId;
    /**
     * Converts a MongoDB document to entity with string ID
     */
    protected fromMongoDoc(doc: MongoDocument<T> | WithId<MongoDocument<T>> | null): T | null;
    /**
     * Converts an entity to MongoDB document format
     */
    protected toMongoDoc(entity: Partial<T>): Partial<MongoDocument<T>>;
    add(entity: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T>;
    findById(id: string): Promise<T | null>;
    findByFilters(filters: Partial<T>): Promise<T[]>;
    update(id: string, updates: Partial<T>): Promise<T | null>;
    conditionalUpdate(id: string, conditions: Partial<T>, updates: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
    findOne(filters: Partial<T>): Promise<T | null>;
    findMany(filters: Partial<T>, limit?: number, skip?: number): Promise<T[]>;
    count(filters?: Partial<T>): Promise<number>;
    deleteMany(filters: Partial<T>): Promise<number>;
    protected findWithComplexFilter(filter: Filter<T>, sort?: any, limit?: number, skip?: number): Promise<T[]>;
    protected countWithComplexFilter(filter: Filter<T>): Promise<number>;
}
//# sourceMappingURL=base-mongo-repository.d.ts.map