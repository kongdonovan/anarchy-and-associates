import { Collection, Filter } from 'mongodb';
import { BaseEntity, IRepository } from '../../domain/entities/base';
export declare abstract class BaseMongoRepository<T extends BaseEntity> implements IRepository<T> {
    protected readonly collection: Collection<T>;
    protected readonly collectionName: string;
    constructor(collectionName: string);
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