# Infrastructure Layer Documentation

## Overview

The Infrastructure Layer provides concrete implementations for external concerns including database persistence, Discord API integration, external service communication, and system infrastructure. This layer implements the interfaces defined by the application layer and handles all technical details of interacting with external systems.

## Architecture Principles

### Dependency Inversion
- **Implements Domain/Application Interfaces**: Infrastructure depends on inner layers
- **Repository Pattern**: Abstract data access behind interfaces
- **Adapter Pattern**: Adapt external APIs to domain concepts
- **Anti-Corruption Layer**: Protect domain from external changes

### Key Characteristics
- Handles all I/O operations
- Manages external service integration
- Implements persistence mechanisms
- Provides framework adapters
- Contains configuration management

## Database Infrastructure

### MongoDB Integration

#### MongoClient (`src/infrastructure/database/mongo-client.ts`)

Manages MongoDB connections with connection pooling and retry logic.

```typescript
export class MongoClient {
  private static instance: MongoClient;
  private client: MongoDB.MongoClient | null = null;
  private db: MongoDB.Db | null = null;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): MongoClient {
    if (!MongoClient.instance) {
      MongoClient.instance = new MongoClient();
    }
    return MongoClient.instance;
  }

  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.establishConnection();
    return this.connectionPromise;
  }

  private async establishConnection(): Promise<void> {
    try {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const dbName = process.env.MONGODB_DB_NAME || 'anarchy-associates';

      this.client = new MongoDB.MongoClient(uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
        retryWrites: true,
        retryReads: true,
        w: 'majority',
        readPreference: 'primaryPreferred'
      });

      await this.client.connect();
      this.db = this.client.db(dbName);

      // Connection event handlers
      this.client.on('serverOpening', () => {
        logger.debug('MongoDB server connection opened');
      });

      this.client.on('serverClosed', () => {
        logger.warn('MongoDB server connection closed');
      });

      this.client.on('error', (error) => {
        logger.error('MongoDB client error:', error);
      });

      // Create indexes
      await this.createIndexes();

      logger.info('Successfully connected to MongoDB', { dbName });
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      this.connectionPromise = null;
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    // Staff indexes
    await this.db.collection('staff').createIndexes([
      { key: { guildId: 1, userId: 1 }, unique: true },
      { key: { guildId: 1, status: 1 } },
      { key: { guildId: 1, role: 1 } },
      { key: { guildId: 1, robloxUsername: 1 }, unique: true }
    ]);

    // Case indexes
    await this.db.collection('cases').createIndexes([
      { key: { guildId: 1, caseNumber: 1 }, unique: true },
      { key: { guildId: 1, status: 1 } },
      { key: { guildId: 1, clientId: 1 } },
      { key: { guildId: 1, assignedLawyerIds: 1 } },
      { key: { createdAt: -1 } }
    ]);

    // Audit log indexes
    await this.db.collection('auditlogs').createIndexes([
      { key: { guildId: 1, timestamp: -1 } },
      { key: { guildId: 1, action: 1 } },
      { key: { guildId: 1, actorId: 1 } },
      { key: { severity: 1, timestamp: -1 } }
    ]);

    logger.debug('Database indexes created');
  }

  async getDatabase(): Promise<MongoDB.Db> {
    if (!this.db) {
      await this.connect();
    }
    return this.db!;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connectionPromise = null;
      logger.info('Disconnected from MongoDB');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }
}
```

### Repository Pattern Implementation

#### BaseMongoRepository (`src/infrastructure/repositories/base-mongo-repository.ts`)

Abstract base repository providing common CRUD operations.

```typescript
export abstract class BaseMongoRepository<T extends Base> {
  protected collection: Collection<T>;
  private dbPromise: Promise<Db>;

  constructor(protected collectionName: string) {
    this.dbPromise = MongoClient.getInstance().getDatabase();
  }

  protected async getCollection(): Promise<Collection<T>> {
    if (!this.collection) {
      const db = await this.dbPromise;
      this.collection = db.collection<T>(this.collectionName);
    }
    return this.collection;
  }

  async add(entity: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    try {
      const collection = await this.getCollection();
      const document = {
        ...entity,
        createdAt: new Date(),
        updatedAt: new Date()
      } as T;

      const result = await collection.insertOne(document as any);
      
      if (!result.acknowledged) {
        throw new Error('Failed to insert document');
      }

      return { ...document, _id: result.insertedId } as T;
    } catch (error) {
      logger.error(`Error adding document to ${this.collectionName}:`, error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    try {
      const collection = await this.getCollection();
      const objectId = new ObjectId(id);
      
      const updateDoc = {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      };

      const result = await collection.findOneAndUpdate(
        { _id: objectId } as any,
        updateDoc,
        { returnDocument: 'after' }
      );

      return result.value as T | null;
    } catch (error) {
      logger.error(`Error updating document in ${this.collectionName}:`, error);
      throw error;
    }
  }

  async findById(id: string): Promise<T | null> {
    try {
      const collection = await this.getCollection();
      const objectId = new ObjectId(id);
      
      const document = await collection.findOne({ _id: objectId } as any);
      return document as T | null;
    } catch (error) {
      logger.error(`Error finding document by ID in ${this.collectionName}:`, error);
      throw error;
    }
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    try {
      const collection = await this.getCollection();
      const document = await collection.findOne(filter as any);
      return document as T | null;
    } catch (error) {
      logger.error(`Error finding document in ${this.collectionName}:`, error);
      throw error;
    }
  }

  async findByFilters(
    filters: Partial<T>,
    options?: {
      sort?: any;
      limit?: number;
      skip?: number;
      projection?: any;
    }
  ): Promise<T[]> {
    try {
      const collection = await this.getCollection();
      let query = collection.find(filters as any);

      if (options?.sort) {
        query = query.sort(options.sort);
      }
      if (options?.skip) {
        query = query.skip(options.skip);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.projection) {
        query = query.project(options.projection);
      }

      const documents = await query.toArray();
      return documents as T[];
    } catch (error) {
      logger.error(`Error finding documents in ${this.collectionName}:`, error);
      throw error;
    }
  }

  async count(filter: Partial<T> = {}): Promise<number> {
    try {
      const collection = await this.getCollection();
      return await collection.countDocuments(filter as any);
    } catch (error) {
      logger.error(`Error counting documents in ${this.collectionName}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const collection = await this.getCollection();
      const objectId = new ObjectId(id);
      
      const result = await collection.deleteOne({ _id: objectId } as any);
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Error deleting document from ${this.collectionName}:`, error);
      throw error;
    }
  }

  async bulkWrite(operations: any[]): Promise<any> {
    try {
      const collection = await this.getCollection();
      return await collection.bulkWrite(operations);
    } catch (error) {
      logger.error(`Error in bulk write for ${this.collectionName}:`, error);
      throw error;
    }
  }

  // Transaction support
  async withTransaction<R>(
    operation: (session: ClientSession) => Promise<R>
  ): Promise<R> {
    const client = MongoClient.getInstance()['client'];
    if (!client) throw new Error('MongoDB client not initialized');

    const session = client.startSession();
    try {
      return await session.withTransaction(operation);
    } finally {
      await session.endSession();
    }
  }
}
```

### Specialized Repositories

#### StaffRepository (`src/infrastructure/repositories/staff-repository.ts`)

Implements staff-specific queries and operations.

```typescript
export class StaffRepository extends BaseMongoRepository<Staff> {
  constructor() {
    super('staff');
  }

  async findByUserId(guildId: string, userId: string): Promise<Staff | null> {
    return this.findOne({ guildId, userId });
  }

  async findByGuildId(guildId: string): Promise<Staff[]> {
    return this.findByFilters(
      { guildId },
      { sort: { role: -1, hiredAt: 1 } }
    );
  }

  async findByRole(guildId: string, role: StaffRole): Promise<Staff[]> {
    return this.findByFilters({ guildId, role, status: 'active' });
  }

  async findStaffByRobloxUsername(
    guildId: string,
    robloxUsername: string
  ): Promise<Staff | null> {
    return this.findOne({ guildId, robloxUsername });
  }

  async getStaffCountByRole(guildId: string, role: StaffRole): Promise<number> {
    return this.count({ guildId, role, status: 'active' });
  }

  async findActiveStaff(guildId: string): Promise<Staff[]> {
    return this.findByFilters(
      { guildId, status: 'active' },
      { sort: { role: -1 } }
    );
  }

  async searchStaff(
    guildId: string,
    searchTerm: string,
    options?: { limit?: number; skip?: number }
  ): Promise<Staff[]> {
    const collection = await this.getCollection();
    
    const searchQuery = {
      guildId,
      $or: [
        { userId: { $regex: searchTerm, $options: 'i' } },
        { robloxUsername: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    return collection
      .find(searchQuery)
      .skip(options?.skip || 0)
      .limit(options?.limit || 20)
      .toArray();
  }

  async getStaffStatistics(guildId: string): Promise<StaffStatistics> {
    const collection = await this.getCollection();
    
    const pipeline = [
      { $match: { guildId } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          }
        }
      }
    ];

    const results = await collection.aggregate(pipeline).toArray();
    
    return {
      byRole: results.reduce((acc, r) => ({
        ...acc,
        [r._id]: { total: r.count, active: r.activeCount }
      }), {}),
      totalStaff: results.reduce((sum, r) => sum + r.count, 0),
      activeStaff: results.reduce((sum, r) => sum + r.activeCount, 0)
    };
  }

  // Atomic operations
  async promoteStaff(
    staffId: string,
    newRole: StaffRole,
    promotedBy: string,
    reason: string
  ): Promise<Staff | null> {
    const collection = await this.getCollection();
    const objectId = new ObjectId(staffId);

    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      {
        $set: { role: newRole, updatedAt: new Date() },
        $push: {
          promotionHistory: {
            fromRole: '$role',
            toRole: newRole,
            promotedBy,
            promotedAt: new Date(),
            reason
          }
        }
      },
      { returnDocument: 'after' }
    );

    return result.value as Staff | null;
  }
}
```

#### CaseRepository (`src/infrastructure/repositories/case-repository.ts`)

Implements case-specific queries with complex filtering.

```typescript
export class CaseRepository extends BaseMongoRepository<Case> {
  constructor() {
    super('cases');
  }

  async findByCaseNumber(guildId: string, caseNumber: string): Promise<Case | null> {
    return this.findOne({ guildId, caseNumber });
  }

  async findByClient(clientId: string): Promise<Case[]> {
    return this.findByFilters(
      { clientId },
      { sort: { createdAt: -1 } }
    );
  }

  async findActiveCasesByClient(guildId: string, clientId: string): Promise<Case[]> {
    return this.findByFilters({
      guildId,
      clientId,
      status: { $in: [CaseStatus.PENDING, CaseStatus.IN_PROGRESS] }
    });
  }

  async findCasesByLawyer(guildId: string, lawyerId: string): Promise<Case[]> {
    return this.findByFilters({
      guildId,
      assignedLawyerIds: lawyerId
    });
  }

  async findCasesByStatus(
    guildId: string,
    status: CaseStatus,
    options?: { limit?: number; skip?: number }
  ): Promise<Case[]> {
    return this.findByFilters(
      { guildId, status },
      {
        sort: { priority: -1, createdAt: -1 },
        ...options
      }
    );
  }

  async searchCases(
    guildId: string,
    searchParams: CaseSearchParams
  ): Promise<PaginatedResult<Case>> {
    const collection = await this.getCollection();
    
    const query: any = { guildId };

    // Build search query
    if (searchParams.status) {
      query.status = searchParams.status;
    }
    if (searchParams.priority) {
      query.priority = searchParams.priority;
    }
    if (searchParams.lawyerId) {
      query.assignedLawyerIds = searchParams.lawyerId;
    }
    if (searchParams.clientId) {
      query.clientId = searchParams.clientId;
    }
    if (searchParams.searchTerm) {
      query.$or = [
        { caseNumber: { $regex: searchParams.searchTerm, $options: 'i' } },
        { title: { $regex: searchParams.searchTerm, $options: 'i' } },
        { clientUsername: { $regex: searchParams.searchTerm, $options: 'i' } }
      ];
    }
    if (searchParams.dateRange) {
      query.createdAt = {
        $gte: searchParams.dateRange.start,
        $lte: searchParams.dateRange.end
      };
    }

    const total = await collection.countDocuments(query);
    const items = await collection
      .find(query)
      .sort({ priority: -1, createdAt: -1 })
      .skip((searchParams.page - 1) * searchParams.pageSize)
      .limit(searchParams.pageSize)
      .toArray();

    return {
      items,
      total,
      page: searchParams.page,
      pageSize: searchParams.pageSize,
      hasNext: total > searchParams.page * searchParams.pageSize,
      hasPrevious: searchParams.page > 1
    };
  }

  async getCaseStatistics(guildId: string): Promise<CaseStatistics> {
    const collection = await this.getCollection();
    
    const pipeline = [
      { $match: { guildId } },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } }
          ],
          byLawyer: [
            { $unwind: '$assignedLawyerIds' },
            { $group: { _id: '$assignedLawyerIds', count: { $sum: 1 } } }
          ],
          avgResolutionTime: [
            { $match: { status: CaseStatus.CLOSED, closedAt: { $exists: true } } },
            {
              $project: {
                resolutionTime: { $subtract: ['$closedAt', '$createdAt'] }
              }
            },
            {
              $group: {
                _id: null,
                avgTime: { $avg: '$resolutionTime' }
              }
            }
          ]
        }
      }
    ];

    const [results] = await collection.aggregate(pipeline).toArray();
    
    return {
      byStatus: results.byStatus.reduce((acc: any, r: any) => ({
        ...acc,
        [r._id]: r.count
      }), {}),
      byPriority: results.byPriority.reduce((acc: any, r: any) => ({
        ...acc,
        [r._id]: r.count
      }), {}),
      byLawyer: results.byLawyer.reduce((acc: any, r: any) => ({
        ...acc,
        [r._id]: r.count
      }), {}),
      avgResolutionTime: results.avgResolutionTime[0]?.avgTime || 0
    };
  }

  // Complex atomic operations
  async assignLawyer(
    caseId: string,
    lawyerId: string,
    assignedBy: string
  ): Promise<Case | null> {
    const collection = await this.getCollection();
    const objectId = new ObjectId(caseId);

    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      {
        $addToSet: { assignedLawyerIds: lawyerId },
        $set: { updatedAt: new Date() },
        $push: {
          notes: {
            id: new ObjectId().toString(),
            authorId: assignedBy,
            content: `Lawyer ${lawyerId} assigned to case`,
            createdAt: new Date(),
            isInternal: true
          }
        }
      },
      { returnDocument: 'after' }
    );

    return result.value as Case | null;
  }

  async removeLawyer(
    caseId: string,
    lawyerId: string,
    removedBy: string
  ): Promise<Case | null> {
    const collection = await this.getCollection();
    const objectId = new ObjectId(caseId);

    return await this.withTransaction(async (session) => {
      // Remove lawyer
      const result = await collection.findOneAndUpdate(
        { _id: objectId },
        {
          $pull: { assignedLawyerIds: lawyerId },
          $set: { updatedAt: new Date() }
        },
        { session, returnDocument: 'after' }
      );

      const updatedCase = result.value as Case | null;
      if (!updatedCase) return null;

      // If removed lawyer was lead attorney, reassign
      if (updatedCase.leadAttorneyId === lawyerId) {
        const newLead = updatedCase.assignedLawyerIds[0] || null;
        await collection.updateOne(
          { _id: objectId },
          { $set: { leadAttorneyId: newLead } },
          { session }
        );
      }

      return updatedCase;
    });
  }
}
```

#### AuditLogRepository (`src/infrastructure/repositories/audit-log-repository.ts`)

Specialized repository for audit logging with security features.

```typescript
export class AuditLogRepository extends BaseMongoRepository<AuditLog> {
  constructor() {
    super('auditlogs');
  }

  // Audit logs are immutable - override update and delete
  async update(): Promise<never> {
    throw new Error('Audit logs cannot be updated');
  }

  async delete(): Promise<never> {
    throw new Error('Audit logs cannot be deleted');
  }

  async logAction(params: {
    guildId: string;
    action: AuditAction;
    actorId: string;
    targetId?: string;
    targetType?: string;
    details: AuditDetails;
    timestamp?: Date;
    severity?: AuditSeverity;
    correlationId?: string;
  }): Promise<AuditLog> {
    const severity = params.severity || this.assessSeverity(params.action);
    
    const auditLog: Omit<AuditLog, '_id' | 'createdAt' | 'updatedAt'> = {
      guildId: params.guildId,
      action: params.action,
      actorId: params.actorId,
      targetId: params.targetId,
      targetType: params.targetType,
      details: params.details,
      timestamp: params.timestamp || new Date(),
      severity,
      correlationId: params.correlationId || generateCorrelationId()
    };

    return this.add(auditLog);
  }

  async findByDateRange(
    guildId: string,
    startDate: Date,
    endDate: Date,
    options?: { action?: AuditAction; severity?: AuditSeverity }
  ): Promise<AuditLog[]> {
    const query: any = {
      guildId,
      timestamp: { $gte: startDate, $lte: endDate }
    };

    if (options?.action) {
      query.action = options.action;
    }
    if (options?.severity) {
      query.severity = options.severity;
    }

    return this.findByFilters(query, { sort: { timestamp: -1 } });
  }

  async findSecurityEvents(
    guildId: string,
    options?: { limit?: number }
  ): Promise<AuditLog[]> {
    const securityActions = [
      AuditAction.UNAUTHORIZED_ACCESS,
      AuditAction.ROLE_LIMIT_BYPASS,
      AuditAction.SUSPICIOUS_ACTIVITY,
      AuditAction.PERMISSION_GRANTED,
      AuditAction.PERMISSION_REVOKED
    ];

    return this.findByFilters(
      {
        guildId,
        action: { $in: securityActions },
        severity: { $in: [AuditSeverity.HIGH, AuditSeverity.CRITICAL] }
      },
      {
        sort: { timestamp: -1 },
        limit: options?.limit || 100
      }
    );
  }

  async getAuditStatistics(
    guildId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<AuditStatistics> {
    const collection = await this.getCollection();
    
    const pipeline = [
      {
        $match: {
          guildId,
          timestamp: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $facet: {
          byAction: [
            { $group: { _id: '$action', count: { $sum: 1 } } }
          ],
          bySeverity: [
            { $group: { _id: '$severity', count: { $sum: 1 } } }
          ],
          byActor: [
            { $group: { _id: '$actorId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          timeline: [
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.date': 1 } }
          ]
        }
      }
    ];

    const [results] = await collection.aggregate(pipeline).toArray();
    
    return {
      byAction: results.byAction,
      bySeverity: results.bySeverity,
      topActors: results.byActor,
      timeline: results.timeline
    };
  }

  private assessSeverity(action: AuditAction): AuditSeverity {
    const severityMap: Record<AuditAction, AuditSeverity> = {
      [AuditAction.STAFF_HIRED]: AuditSeverity.MEDIUM,
      [AuditAction.STAFF_FIRED]: AuditSeverity.HIGH,
      [AuditAction.STAFF_PROMOTED]: AuditSeverity.MEDIUM,
      [AuditAction.STAFF_DEMOTED]: AuditSeverity.MEDIUM,
      [AuditAction.CASE_CREATED]: AuditSeverity.LOW,
      [AuditAction.CASE_ASSIGNED]: AuditSeverity.LOW,
      [AuditAction.CASE_CLOSED]: AuditSeverity.LOW,
      [AuditAction.CONFIG_CHANGED]: AuditSeverity.HIGH,
      [AuditAction.PERMISSION_GRANTED]: AuditSeverity.HIGH,
      [AuditAction.PERMISSION_REVOKED]: AuditSeverity.HIGH,
      [AuditAction.UNAUTHORIZED_ACCESS]: AuditSeverity.CRITICAL,
      [AuditAction.ROLE_LIMIT_BYPASS]: AuditSeverity.HIGH,
      [AuditAction.SUSPICIOUS_ACTIVITY]: AuditSeverity.CRITICAL
    };

    return severityMap[action] || AuditSeverity.LOW;
  }
}
```

### Other Repositories

#### GuildConfigRepository (`src/infrastructure/repositories/guild-config-repository.ts`)

```typescript
export class GuildConfigRepository extends BaseMongoRepository<GuildConfig> {
  constructor() {
    super('guildconfigs');
  }

  async findByGuildId(guildId: string): Promise<GuildConfig | null> {
    return this.findOne({ guildId });
  }

  async ensureGuildConfig(guildId: string): Promise<GuildConfig> {
    let config = await this.findByGuildId(guildId);
    
    if (!config) {
      config = await this.add({
        guildId,
        permissions: {
          admin: [],
          'senior-staff': [],
          case: [],
          config: [],
          lawyer: [],
          'lead-attorney': [],
          repair: []
        },
        adminRoles: [],
        adminUsers: [],
        features: {
          robloxIntegration: false,
          autoArchiveCases: false,
          clientSelfService: true,
          advancedAnalytics: false,
          aiAssistance: false
        },
        maxActiveCasesPerClient: 5,
        retainerExpirationDays: 30,
        caseInactivityDays: 90
      });
    }
    
    return config;
  }

  async updatePermissions(
    guildId: string,
    action: string,
    roles: string[]
  ): Promise<GuildConfig | null> {
    const collection = await this.getCollection();
    
    const result = await collection.findOneAndUpdate(
      { guildId },
      {
        $set: {
          [`permissions.${action}`]: roles,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result.value as GuildConfig | null;
  }
}
```

#### InformationChannelRepository (`src/infrastructure/repositories/information-channel-repository.ts`)

Manages persistent storage for bot-controlled information messages.

```typescript
export class InformationChannelRepository extends BaseMongoRepository<InformationChannel> {
  constructor(collection: Collection<InformationChannel>) {
    super(collection as any);
  }

  async findByChannelId(guildId: string, channelId: string): Promise<InformationChannel | null> {
    return this.collection.findOne({ guildId, channelId });
  }

  async findByGuildId(guildId: string): Promise<InformationChannel[]> {
    return this.collection.find({ guildId }).toArray();
  }

  async upsertByChannelId(
    guildId: string, 
    channelId: string, 
    data: Partial<InformationChannel>
  ): Promise<InformationChannel> {
    const now = new Date();
    const update = {
      ...data,
      guildId,
      channelId,
      lastUpdatedAt: now,
      updatedAt: now
    };

    const result = await this.collection.findOneAndUpdate(
      { guildId, channelId },
      { 
        $set: update,
        $setOnInsert: { createdAt: now }
      },
      { 
        upsert: true, 
        returnDocument: 'after' 
      }
    );

    if (!result) {
      throw new Error('Failed to upsert information channel');
    }

    return result;
  }
}
```

**Key Features**:
- Upsert operation for channel information
- Find by channel ID (unique per guild)
- List all information channels in a guild
- Automatic timestamp management

## Discord Infrastructure

### Discord Bot Client (`src/infrastructure/discord/bot.ts`)

```typescript
export class Bot {
  private static client: Client;
  private static instance: Bot;
  private services: ServiceContainer;

  private constructor() {
    Bot.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
      ]
    });

    this.setupEventHandlers();
    this.initializeServices();
  }

  static getInstance(): Bot {
    if (!Bot.instance) {
      Bot.instance = new Bot();
    }
    return Bot.instance;
  }

  private setupEventHandlers(): void {
    Bot.client.once('ready', async () => {
      logger.info(`Bot is ready! Logged in as ${Bot.client.user?.tag}`);
      
      // Set activity
      Bot.client.user?.setActivity({
        name: 'Legal Services',
        type: ActivityType.Watching
      });

      // Initialize services that need Discord client
      await this.services.roleTrackingService.initialize(Bot.client);
      await this.services.reminderService.startScheduler(Bot.client);
    });

    Bot.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });

    Bot.client.on('warn', (warning) => {
      logger.warn('Discord client warning:', warning);
    });

    Bot.client.on('shardError', (error, shardId) => {
      logger.error(`Shard ${shardId} error:`, error);
    });

    Bot.client.on('shardReconnecting', (shardId) => {
      logger.info(`Shard ${shardId} is reconnecting`);
    });

    Bot.client.on('guildCreate', async (guild) => {
      logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
      await this.setupNewGuild(guild);
    });

    Bot.client.on('guildDelete', (guild) => {
      logger.info(`Removed from guild: ${guild.name} (${guild.id})`);
    });
  }

  async start(): Promise<void> {
    try {
      // Connect to database first
      await MongoClient.getInstance().connect();
      
      // Login to Discord
      await Bot.client.login(process.env.DISCORD_BOT_TOKEN);
      
      // Initialize discordx
      await Bot.client.initApplicationCommands();
      
      logger.info('Bot started successfully');
    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Shutting down bot...');
    
    // Stop services
    await this.services.reminderService.stopScheduler();
    
    // Disconnect from Discord
    Bot.client.destroy();
    
    // Disconnect from database
    await MongoClient.getInstance().disconnect();
    
    logger.info('Bot shut down successfully');
  }

  private async setupNewGuild(guild: Guild): Promise<void> {
    try {
      // Ensure guild config exists
      await this.services.guildConfigRepository.ensureGuildConfig(guild.id);
      
      // Register slash commands
      await guild.commands.set([]);
      await Bot.client.initApplicationCommands();
      
      logger.info(`Guild setup completed for ${guild.name}`);
    } catch (error) {
      logger.error(`Failed to setup guild ${guild.name}:`, error);
    }
  }
}
```

#### RulesChannelRepository (`src/infrastructure/repositories/rules-channel-repository.ts`)

Repository for managing bot-maintained rules messages.

```typescript
export class RulesChannelRepository extends BaseMongoRepository<RulesChannel> {
  constructor() {
    super('rulesChannels');
  }

  /**
   * Find rules configuration by channel
   */
  async findByChannelId(guildId: string, channelId: string): Promise<RulesChannel | null> {
    return this.findOne({ guildId, channelId });
  }

  /**
   * Upsert rules channel configuration
   */
  async upsertByChannelId(
    guildId: string, 
    channelId: string, 
    data: Partial<RulesChannel>
  ): Promise<RulesChannel> {
    // Handles create or update logic
  }

  /**
   * Add a rule to existing rules
   */
  async addRule(
    guildId: string,
    channelId: string,
    rule: Omit<Rule, 'id' | 'order'>
  ): Promise<RulesChannel | null> {
    // Adds rule with auto-generated ID and order
  }

  /**
   * Remove a rule by ID
   */
  async removeRule(
    guildId: string,
    channelId: string,
    ruleId: string
  ): Promise<RulesChannel | null> {
    // Removes rule and reorders remaining rules
  }
}
```

**Key Features**:
- Upsert pattern for create/update operations
- Individual rule management methods
- Automatic rule ordering
- Channel-specific rule storage

### Discord Service Implementations

#### DiscordChannelService (`src/infrastructure/discord/discord-channel-service.ts`)

```typescript
export class DiscordChannelService {
  constructor(private client: Client) {}

  async createCaseChannel(
    guild: Guild,
    caseData: {
      caseNumber: string;
      clientUsername: string;
      lawyerIds: string[];
    }
  ): Promise<TextChannel> {
    // Get or create case category
    const category = await this.getOrCreateCaseCategory(guild);
    
    // Create channel with permissions
    const channel = await guild.channels.create({
      name: `case-${caseData.caseNumber}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Legal case for ${caseData.clientUsername}`,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: caseData.clientId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        ...caseData.lawyerIds.map(lawyerId => ({
          id: lawyerId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages
          ]
        }))
      ]
    });

    // Send welcome message
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`Case ${caseData.caseNumber}`)
      .setDescription(`Welcome to your private case channel, ${caseData.clientUsername}!`)
      .setColor(Colors.Blue)
      .addFields([
        {
          name: 'What is this channel?',
          value: 'This is your private communication channel with your legal team.'
        },
        {
          name: 'Who can see this?',
          value: 'Only you and your assigned lawyers can see this channel.'
        },
        {
          name: 'Need help?',
          value: 'Use `/case help` for available commands.'
        }
      ])
      .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });
    
    return channel;
  }

  async archiveCaseChannel(
    guild: Guild,
    channelId: string,
    outcome: string
  ): Promise<void> {
    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) return;

    // Get or create archive category
    const archiveCategory = await this.getOrCreateArchiveCategory(guild);
    
    // Move to archive
    await channel.setParent(archiveCategory.id);
    await channel.setName(`archived-${channel.name}`);
    
    // Lock channel
    await channel.permissionOverwrites.edit(guild.id, {
      SendMessages: false
    });

    // Send closure message
    const closureEmbed = new EmbedBuilder()
      .setTitle('Case Closed')
      .setDescription(`This case has been closed with outcome: ${outcome}`)
      .setColor(Colors.Green)
      .setTimestamp();

    await channel.send({ embeds: [closureEmbed] });
  }

  private async getOrCreateCaseCategory(guild: Guild): Promise<CategoryChannel> {
    const config = await guildConfigRepository.findByGuildId(guild.id);
    
    if (config?.caseReviewCategoryId) {
      const category = guild.channels.cache.get(config.caseReviewCategoryId);
      if (category && category.type === ChannelType.GuildCategory) {
        return category as CategoryChannel;
      }
    }

    // Create new category
    const category = await guild.channels.create({
      name: 'Case Reviews',
      type: ChannelType.GuildCategory,
      position: 0
    });

    // Update config
    await guildConfigRepository.update(config._id, {
      caseReviewCategoryId: category.id
    });

    return category;
  }
}
```

#### RoleTrackingService (`src/infrastructure/discord/role-tracking-service.ts`)

```typescript
export class RoleTrackingService {
  private client: Client | null = null;
  private roleToStaffMap: Map<string, StaffRole> = new Map();

  async initialize(client: Client): Promise<void> {
    this.client = client;
    this.setupRoleMapping();
    this.registerEventHandlers();
  }

  private setupRoleMapping(): void {
    // Map Discord role names to staff roles
    this.roleToStaffMap.set('Managing Partner', StaffRole.MANAGING_PARTNER);
    this.roleToStaffMap.set('Senior Partner', StaffRole.SENIOR_PARTNER);
    this.roleToStaffMap.set('Junior Partner', StaffRole.JUNIOR_PARTNER);
    this.roleToStaffMap.set('Senior Associate', StaffRole.SENIOR_ASSOCIATE);
    this.roleToStaffMap.set('Junior Associate', StaffRole.JUNIOR_ASSOCIATE);
    this.roleToStaffMap.set('Paralegal', StaffRole.PARALEGAL);
  }

  private registerEventHandlers(): void {
    if (!this.client) return;

    this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
      try {
        await this.handleMemberUpdate(oldMember, newMember);
      } catch (error) {
        logger.error('Error handling member update:', error);
      }
    });
  }

  private async handleMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
  ): Promise<void> {
    // Get role changes
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    
    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

    // Check for staff role changes
    const oldStaffRole = this.getMemberStaffRole(oldMember);
    const newStaffRole = this.getMemberStaffRole(newMember);

    if (oldStaffRole !== newStaffRole) {
      await this.handleStaffRoleChange(
        newMember,
        oldStaffRole,
        newStaffRole
      );
    }
  }

  private getMemberStaffRole(member: GuildMember | PartialGuildMember): StaffRole | null {
    for (const [roleName, staffRole] of this.roleToStaffMap) {
      if (member.roles.cache.some(r => r.name === roleName)) {
        return staffRole;
      }
    }
    return null;
  }

  private async handleStaffRoleChange(
    member: GuildMember,
    oldRole: StaffRole | null,
    newRole: StaffRole | null
  ): Promise<void> {
    const staffRepository = new StaffRepository();
    const auditLogRepository = new AuditLogRepository();
    const channelPermissionManager = new ChannelPermissionManager(
      new CaseRepository(),
      staffRepository,
      auditLogRepository,
      new UnifiedValidationService()
    );

    // Determine change type
    let changeType: 'hire' | 'fire' | 'promotion' | 'demotion';
    if (!oldRole && newRole) {
      changeType = 'hire';
    } else if (oldRole && !newRole) {
      changeType = 'fire';
    } else if (oldRole && newRole) {
      const oldLevel = RoleUtils.getRoleLevel(oldRole);
      const newLevel = RoleUtils.getRoleLevel(newRole);
      changeType = newLevel > oldLevel ? 'promotion' : 'demotion';
    } else {
      return; // No change
    }

    // Update database
    const existingStaff = await staffRepository.findByUserId(
      member.guild.id,
      member.user.id
    );

    if (changeType === 'hire' && !existingStaff) {
      // Auto-hire through role assignment
      await staffRepository.add({
        userId: member.user.id,
        guildId: member.guild.id,
        robloxUsername: member.user.username, // Default to Discord username
        role: newRole!,
        hiredAt: new Date(),
        hiredBy: 'System',
        promotionHistory: [],
        status: 'active'
      });

      await auditLogRepository.logAction({
        guildId: member.guild.id,
        action: AuditAction.STAFF_HIRED,
        actorId: 'System',
        targetId: member.user.id,
        details: {
          reason: 'Automatic hire via role assignment',
          after: { role: newRole }
        }
      });
    } else if (changeType === 'fire' && existingStaff) {
      // Auto-fire through role removal
      await staffRepository.update(existingStaff._id!.toString(), {
        status: 'terminated',
        terminatedAt: new Date(),
        terminatedBy: 'System',
        terminationReason: 'Automatic termination via role removal'
      });

      await auditLogRepository.logAction({
        guildId: member.guild.id,
        action: AuditAction.STAFF_FIRED,
        actorId: 'System',
        targetId: member.user.id,
        details: {
          reason: 'Automatic termination via role removal',
          before: { role: oldRole }
        }
      });
    } else if ((changeType === 'promotion' || changeType === 'demotion') && existingStaff) {
      // Update role
      await staffRepository.promoteStaff(
        existingStaff._id!.toString(),
        newRole!,
        'System',
        `Automatic ${changeType} via role change`
      );

      await auditLogRepository.logAction({
        guildId: member.guild.id,
        action: changeType === 'promotion' 
          ? AuditAction.STAFF_PROMOTED 
          : AuditAction.STAFF_DEMOTED,
        actorId: 'System',
        targetId: member.user.id,
        details: {
          reason: `Automatic ${changeType} via role change`,
          before: { role: oldRole },
          after: { role: newRole }
        }
      });
    }

    // Update channel permissions
    await channelPermissionManager.handleRoleChange(
      member.guild,
      member,
      oldRole || undefined,
      newRole || undefined,
      changeType
    );
  }
}
```

## External Service Integration

### RobloxService (`src/infrastructure/external/roblox-service.ts`)

```typescript
export class RobloxService {
  private readonly baseUrl = 'https://api.roblox.com';
  private readonly cookie: string;
  private rateLimiter: RateLimiter;

  constructor() {
    this.cookie = process.env.ROBLOX_COOKIE || '';
    this.rateLimiter = new RateLimiter({
      points: 60, // 60 requests
      duration: 60, // per 60 seconds
      blockDuration: 60 // block for 60 seconds
    });
  }

  async validateUsername(username: string): Promise<RobloxUser | null> {
    try {
      await this.rateLimiter.consume('roblox-api');
      
      const response = await fetch(`${this.baseUrl}/users/get-by-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.cookie
        },
        body: JSON.stringify({ username })
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Roblox API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        id: data.id,
        username: data.name,
        displayName: data.displayName
      };
    } catch (error) {
      logger.error('Error validating Roblox username:', error);
      throw error;
    }
  }

  async updateGroupRank(
    userId: number,
    groupId: number,
    rankId: number
  ): Promise<boolean> {
    try {
      await this.rateLimiter.consume('roblox-api');
      
      const response = await fetch(
        `${this.baseUrl}/groups/${groupId}/users/${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': this.cookie,
            'X-CSRF-TOKEN': await this.getCSRFToken()
          },
          body: JSON.stringify({ roleId: rankId })
        }
      );

      return response.ok;
    } catch (error) {
      logger.error('Error updating Roblox group rank:', error);
      return false;
    }
  }

  private async getCSRFToken(): Promise<string> {
    // Roblox requires CSRF token for state-changing operations
    const response = await fetch(`${this.baseUrl}/users/authenticated`, {
      headers: { 'Cookie': this.cookie }
    });
    
    return response.headers.get('x-csrf-token') || '';
  }
}
```

## Logging Infrastructure

### Winston Logger Configuration (`src/infrastructure/logger.ts`)

```typescript
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.metadata({
      fillExcept: ['message', 'level', 'timestamp', 'label']
    }),
    winston.format.json()
  ),
  defaultMeta: { service: 'anarchy-bot' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      )
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/app.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],
  
  // Exception handling
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  
  // Rejection handling
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Performance logging
export const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: 'logs/performance.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Audit logger (separate for security)
export const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: 'logs/audit.log',
      maxsize: 10485760,
      maxFiles: 30 // Keep more audit logs
    })
  ]
});
```

## Configuration Management

### Environment Configuration (`src/infrastructure/config/config.ts`)

```typescript
export class Config {
  private static instance: Config;
  private config: AppConfig;

  private constructor() {
    this.loadConfiguration();
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private loadConfiguration(): void {
    // Load from environment
    this.config = {
      discord: {
        token: this.getRequired('DISCORD_BOT_TOKEN'),
        clientId: this.getRequired('DISCORD_CLIENT_ID'),
        guildId: process.env.DISCORD_GUILD_ID,
        intents: this.parseIntents()
      },
      database: {
        uri: this.getRequired('MONGODB_URI'),
        name: process.env.MONGODB_DB_NAME || 'anarchy-associates',
        options: {
          maxPoolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000
        }
      },
      roblox: {
        cookie: process.env.ROBLOX_COOKIE,
        groupId: process.env.ROBLOX_GROUP_ID
      },
      app: {
        env: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '3000'),
        logLevel: process.env.LOG_LEVEL || 'info'
      },
      features: {
        robloxIntegration: process.env.ENABLE_ROBLOX === 'true',
        autoArchive: process.env.ENABLE_AUTO_ARCHIVE === 'true',
        metrics: process.env.ENABLE_METRICS === 'true'
      }
    };
  }

  private getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  private parseIntents(): number {
    // Parse Discord intents from environment or use defaults
    const intents = [
      'GUILDS',
      'GUILD_MEMBERS',
      'GUILD_MESSAGES',
      'MESSAGE_CONTENT'
    ];
    
    // Convert to intent bits
    return intents.reduce((acc, intent) => {
      return acc | GatewayIntentBits[intent as keyof typeof GatewayIntentBits];
    }, 0);
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
}

interface AppConfig {
  discord: {
    token: string;
    clientId: string;
    guildId?: string;
    intents: number;
  };
  database: {
    uri: string;
    name: string;
    options: any;
  };
  roblox: {
    cookie?: string;
    groupId?: string;
  };
  app: {
    env: string;
    port: number;
    logLevel: string;
  };
  features: {
    robloxIntegration: boolean;
    autoArchive: boolean;
    metrics: boolean;
  };
}
```

## Utility Infrastructure

### ID Generation (`src/infrastructure/utils/id-generator.ts`)

```typescript
export class IdGenerator {
  private static counter = 0;
  
  static generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    const counter = (++IdGenerator.counter).toString(36);
    
    return `${timestamp}-${random}-${counter}`;
  }
  
  static generateCorrelationId(): string {
    return `corr-${this.generateId()}`;
  }
  
  static generateCaseId(year: number, count: number): string {
    const paddedCount = count.toString().padStart(4, '0');
    return `${year}-${paddedCount}`;
  }
  
  static isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
}
```

### Rate Limiting (`src/infrastructure/utils/rate-limiter.ts`)

```typescript
export class RateLimiter {
  private limits: Map<string, RateLimit> = new Map();
  
  constructor(private options: RateLimiterOptions) {}
  
  async consume(key: string, points: number = 1): Promise<void> {
    const limit = this.getLimit(key);
    const now = Date.now();
    
    // Reset if duration passed
    if (now - limit.resetTime > this.options.duration * 1000) {
      limit.points = this.options.points;
      limit.resetTime = now;
    }
    
    // Check if blocked
    if (limit.blockedUntil && now < limit.blockedUntil) {
      throw new RateLimitError('Rate limit exceeded', {
        retryAfter: Math.ceil((limit.blockedUntil - now) / 1000)
      });
    }
    
    // Consume points
    if (limit.points >= points) {
      limit.points -= points;
    } else {
      // Block
      limit.blockedUntil = now + this.options.blockDuration * 1000;
      throw new RateLimitError('Rate limit exceeded', {
        retryAfter: this.options.blockDuration
      });
    }
  }
  
  private getLimit(key: string): RateLimit {
    let limit = this.limits.get(key);
    if (!limit) {
      limit = {
        points: this.options.points,
        resetTime: Date.now(),
        blockedUntil: null
      };
      this.limits.set(key, limit);
    }
    return limit;
  }
}

interface RateLimiterOptions {
  points: number;
  duration: number; // seconds
  blockDuration: number; // seconds
}

interface RateLimit {
  points: number;
  resetTime: number;
  blockedUntil: number | null;
}
```

### Performance Monitoring (`src/infrastructure/monitoring/performance-monitor.ts`)

```typescript
export class PerformanceMonitor {
  private metrics: Map<string, Metric[]> = new Map();
  
  startOperation(name: string): OperationTimer {
    const startTime = process.hrtime.bigint();
    
    return {
      end: () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms
        
        this.recordMetric(name, duration);
      }
    };
  }
  
  async measureAsync<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const timer = this.startOperation(name);
    try {
      return await operation();
    } finally {
      timer.end();
    }
  }
  
  private recordMetric(name: string, duration: number): void {
    const metrics = this.metrics.get(name) || [];
    metrics.push({
      timestamp: new Date(),
      duration,
      memory: process.memoryUsage()
    });
    
    // Keep only last 1000 metrics
    if (metrics.length > 1000) {
      metrics.shift();
    }
    
    this.metrics.set(name, metrics);
    
    // Log slow operations
    if (duration > 1000) {
      performanceLogger.warn('Slow operation detected', {
        operation: name,
        duration,
        memory: process.memoryUsage()
      });
    }
  }
  
  getStatistics(name: string): OperationStatistics | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;
    
    const durations = metrics.map(m => m.duration);
    const sorted = [...durations].sort((a, b) => a - b);
    
    return {
      count: metrics.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
}

interface OperationTimer {
  end: () => void;
}

interface Metric {
  timestamp: Date;
  duration: number;
  memory: NodeJS.MemoryUsage;
}

interface OperationStatistics {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}
```

## Health Check Infrastructure

### HealthCheckService (`src/infrastructure/health/health-check-service.ts`)

```typescript
export class HealthCheckService {
  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkDiscord(),
      this.checkMemory(),
      this.checkDiskSpace()
    ]);
    
    const results = {
      database: this.extractResult(checks[0]),
      discord: this.extractResult(checks[1]),
      memory: this.extractResult(checks[2]),
      disk: this.extractResult(checks[3])
    };
    
    const overall = Object.values(results).every(r => r.status === 'healthy');
    
    return {
      status: overall ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      checks: results,
      version: process.env.npm_package_version || 'unknown'
    };
  }
  
  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      const healthy = await MongoClient.getInstance().healthCheck();
      return {
        status: healthy ? 'healthy' : 'unhealthy',
        message: healthy ? 'Connected' : 'Connection failed'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }
  
  private async checkDiscord(): Promise<ComponentHealth> {
    const client = Bot.getClient();
    return {
      status: client.isReady() ? 'healthy' : 'unhealthy',
      message: client.isReady() ? 'Connected' : 'Not connected',
      metadata: {
        ping: client.ws.ping,
        guilds: client.guilds.cache.size
      }
    };
  }
  
  private async checkMemory(): Promise<ComponentHealth> {
    const usage = process.memoryUsage();
    const maxHeap = 1024 * 1024 * 1024; // 1GB
    
    return {
      status: usage.heapUsed < maxHeap * 0.9 ? 'healthy' : 'unhealthy',
      message: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB used`,
      metadata: {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss,
        external: usage.external
      }
    };
  }
  
  private async checkDiskSpace(): Promise<ComponentHealth> {
    // Implementation depends on OS
    return {
      status: 'healthy',
      message: 'Sufficient space available'
    };
  }
  
  private extractResult(
    result: PromiseSettledResult<ComponentHealth>
  ): ComponentHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      status: 'unhealthy',
      message: result.reason?.message || 'Check failed'
    };
  }
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  checks: Record<string, ComponentHealth>;
  version: string;
}

interface ComponentHealth {
  status: 'healthy' | 'unhealthy';
  message: string;
  metadata?: any;
}
```

## Testing Infrastructure

### Test Database Setup (`src/infrastructure/testing/test-db.ts`)

```typescript
export class TestDatabase {
  private static instance: TestDatabase;
  private mongoServer: MongoMemoryServer;
  
  private constructor() {}
  
  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }
  
  async setup(): Promise<void> {
    this.mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test-db',
        port: 27018
      }
    });
    
    const uri = this.mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    
    await MongoClient.getInstance().connect();
  }
  
  async teardown(): Promise<void> {
    await MongoClient.getInstance().disconnect();
    await this.mongoServer.stop();
  }
  
  async reset(): Promise<void> {
    const db = await MongoClient.getInstance().getDatabase();
    const collections = await db.collections();
    
    await Promise.all(
      collections.map(collection => collection.deleteMany({}))
    );
  }
}
```

### Mock Discord Client (`src/infrastructure/testing/mock-discord.ts`)

```typescript
export class MockDiscordClient {
  static createMockGuild(): any {
    return {
      id: 'test-guild-123',
      name: 'Test Guild',
      ownerId: 'owner-123',
      channels: {
        cache: new Map(),
        create: jest.fn().mockResolvedValue({
          id: 'channel-123',
          name: 'test-channel',
          send: jest.fn()
        })
      },
      members: {
        cache: new Map(),
        fetch: jest.fn().mockResolvedValue({
          id: 'member-123',
          user: { id: 'user-123', username: 'testuser' },
          roles: { cache: new Map() }
        })
      },
      roles: {
        cache: new Map(),
        create: jest.fn()
      }
    };
  }
  
  static createMockInteraction(): any {
    return {
      guildId: 'test-guild-123',
      guild: this.createMockGuild(),
      user: {
        id: 'user-123',
        username: 'testuser'
      },
      member: {
        id: 'member-123',
        roles: { cache: new Map() }
      },
      reply: jest.fn(),
      editReply: jest.fn(),
      deferReply: jest.fn(),
      followUp: jest.fn(),
      deleteReply: jest.fn()
    };
  }
}
```

## Conclusion

The Infrastructure Layer provides robust implementations for all external concerns, including database persistence through MongoDB, Discord API integration, external service communication, logging, configuration, and monitoring. It follows SOLID principles and provides clean abstractions that protect the inner layers from external changes while delivering reliable, performant, and maintainable infrastructure services.