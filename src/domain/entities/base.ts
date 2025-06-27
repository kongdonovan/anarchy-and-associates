import { ObjectId } from 'mongodb';

/**
 * Base entity interface that all domain entities must extend.
 * Provides common fields for database persistence and audit tracking.
 * 
 * @description This interface ensures all entities in the Anarchy & Associates system
 * have consistent tracking of creation and modification times, as well as a unique
 * identifier for database storage.
 * 
 * @example
 * ```typescript
 * interface Staff extends BaseEntity {
 *   userId: string;
 *   guildId: string;
 *   role: StaffRole;
 *   // ... other staff-specific fields
 * }
 * ```
 * 
 * @see {@link IRepository} - Repository interface for entity persistence
 */
export interface BaseEntity {
  /**
   * MongoDB ObjectId for unique entity identification.
   * Optional as it's generated upon insertion into the database.
   * @property {ObjectId} [_id] - Unique identifier assigned by MongoDB
   */
  _id?: ObjectId;
  
  /**
   * Timestamp indicating when the entity was first created.
   * Automatically set by the repository layer upon insertion.
   * @property {Date} createdAt - UTC timestamp of entity creation
   */
  createdAt: Date;
  
  /**
   * Timestamp indicating when the entity was last modified.
   * Automatically updated by the repository layer on any update operation.
   * @property {Date} updatedAt - UTC timestamp of last modification
   */
  updatedAt: Date;
}

/**
 * Generic repository interface defining standard CRUD operations for all domain entities.
 * 
 * @description Implements the Repository pattern to abstract data persistence logic
 * from business logic. All concrete repositories in the infrastructure layer must
 * implement this interface to ensure consistent data access patterns across the
 * Anarchy & Associates system.
 * 
 * @template T - The entity type that extends BaseEntity
 * 
 * @example
 * ```typescript
 * class StaffRepository extends BaseMongoRepository<Staff> {
 *   constructor() {
 *     super('staff'); // MongoDB collection name
 *   }
 *   
 *   // Additional domain-specific queries
 *   async findByRole(guildId: string, role: StaffRole): Promise<Staff[]> {
 *     return this.findByFilters({ guildId, role });
 *   }
 * }
 * ```
 * 
 * @see {@link BaseEntity} - Base interface for all domain entities
 * @see {@link BaseMongoRepository} - MongoDB implementation of this interface
 */
export interface IRepository<T extends BaseEntity> {
  /**
   * Adds a new entity to the repository.
   * 
   * @description Automatically sets _id, createdAt, and updatedAt fields.
   * The entity should not include these fields as they are managed by the repository.
   * 
   * @param {Omit<T, '_id' | 'createdAt' | 'updatedAt'>} entity - Entity to add without auto-generated fields
   * @returns {Promise<T>} The created entity with all fields populated
   * @throws {Error} If entity validation fails or database operation fails
   * 
   * @example
   * ```typescript
   * const newStaff = await staffRepository.add({
   *   userId: '123456789',
   *   guildId: '987654321',
   *   role: StaffRole.JUNIOR_ASSOCIATE,
   *   hiredAt: new Date()
   * });
   * ```
   */
  add(entity: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  
  /**
   * Finds an entity by its unique identifier.
   * 
   * @param {string} id - MongoDB ObjectId as string
   * @returns {Promise<T | null>} The entity if found, null otherwise
   * @throws {Error} If id format is invalid or database operation fails
   * 
   * @example
   * ```typescript
   * const staff = await staffRepository.findById('507f1f77bcf86cd799439011');
   * if (staff) {
   *   console.log(`Found staff member: ${staff.userId}`);
   * }
   * ```
   */
  findById(id: string): Promise<T | null>;
  
  /**
   * Finds all entities matching the specified filter criteria.
   * 
   * @description Performs a query using MongoDB's query syntax. All provided
   * fields must match exactly (AND operation).
   * 
   * @param {Partial<T>} filters - Object containing field-value pairs to match
   * @returns {Promise<T[]>} Array of matching entities (empty if none found)
   * @throws {Error} If database operation fails
   * 
   * @example
   * ```typescript
   * // Find all Senior Associates in a specific guild
   * const seniorAssociates = await staffRepository.findByFilters({
   *   guildId: '987654321',
   *   role: StaffRole.SENIOR_ASSOCIATE,
   *   status: 'active'
   * });
   * ```
   */
  findByFilters(filters: Partial<T>): Promise<T[]>;
  
  /**
   * Updates an entity with the provided changes.
   * 
   * @description Automatically updates the updatedAt timestamp. Only provided
   * fields are modified; other fields remain unchanged.
   * 
   * @param {string} id - MongoDB ObjectId as string
   * @param {Partial<T>} updates - Object containing fields to update
   * @returns {Promise<T | null>} The updated entity if found, null otherwise
   * @throws {Error} If id format is invalid or database operation fails
   * 
   * @example
   * ```typescript
   * const updatedStaff = await staffRepository.update('507f1f77bcf86cd799439011', {
   *   role: StaffRole.SENIOR_ASSOCIATE,
   *   promotedAt: new Date()
   * });
   * ```
   */
  update(id: string, updates: Partial<T>): Promise<T | null>;
  
  /**
   * Updates an entity only if it matches specified conditions.
   * 
   * @description Provides optimistic concurrency control by ensuring the entity
   * hasn't changed since it was last read. Useful for preventing race conditions
   * in concurrent operations.
   * 
   * @param {string} id - MongoDB ObjectId as string
   * @param {Partial<T>} conditions - Conditions that must be met for update to proceed
   * @param {Partial<T>} updates - Fields to update if conditions are met
   * @returns {Promise<T | null>} Updated entity if conditions matched, null otherwise
   * @throws {Error} If id format is invalid or database operation fails
   * 
   * @example
   * ```typescript
   * // Only promote if still a Junior Associate (prevents double promotion)
   * const promoted = await staffRepository.conditionalUpdate(
   *   staffId,
   *   { role: StaffRole.JUNIOR_ASSOCIATE },
   *   { role: StaffRole.SENIOR_ASSOCIATE, promotedAt: new Date() }
   * );
   * if (!promoted) {
   *   throw new Error('Staff member role has changed');
   * }
   * ```
   */
  conditionalUpdate(id: string, conditions: Partial<T>, updates: Partial<T>): Promise<T | null>;
  
  /**
   * Deletes an entity from the repository.
   * 
   * @description Performs a hard delete, permanently removing the entity from
   * the database. Consider implementing soft deletes for audit trail purposes.
   * 
   * @param {string} id - MongoDB ObjectId as string
   * @returns {Promise<boolean>} True if entity was deleted, false if not found
   * @throws {Error} If id format is invalid or database operation fails
   * 
   * @example
   * ```typescript
   * const deleted = await staffRepository.delete('507f1f77bcf86cd799439011');
   * if (deleted) {
   *   await auditLog.log('STAFF_DELETED', { staffId: id });
   * }
   * ```
   */
  delete(id: string): Promise<boolean>;
}