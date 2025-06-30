import { BaseMongoRepository } from './base-mongo-repository';
import { ObjectId } from 'mongodb';
import { 
  Case,
  CaseStatus,
  CasePriority,
  CaseResult,
  ValidationHelpers,
  DiscordSnowflakeSchema,
  CaseStatusSchema,
  CasePrioritySchema,
  CaseResultSchema,
  z
} from '../../validation';

export interface CaseSearchFilters {
  guildId?: string;
  status?: CaseStatus;
  priority?: CasePriority;
  result?: CaseResult;
  clientId?: string;
  leadAttorneyId?: string;
  assignedLawyerId?: string;
  caseNumber?: string;
  title?: string;
  channelId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  closedDateFrom?: Date;
  closedDateTo?: Date;
}

export interface CaseSortOptions {
  field: 'createdAt' | 'updatedAt' | 'closedAt' | 'caseNumber' | 'priority' | 'status';
  direction: 'asc' | 'desc';
}

export interface CasePaginationOptions {
  limit?: number;
  skip?: number;
}

// Validation schemas for the interfaces
const CaseSearchFiltersSchema = z.object({
  guildId: DiscordSnowflakeSchema.optional(),
  status: CaseStatusSchema.optional(),
  priority: CasePrioritySchema.optional(),
  result: CaseResultSchema.optional(),
  clientId: DiscordSnowflakeSchema.optional(),
  leadAttorneyId: DiscordSnowflakeSchema.optional(),
  assignedLawyerId: DiscordSnowflakeSchema.optional(),
  caseNumber: z.string().optional(),
  title: z.string().optional(),
  channelId: DiscordSnowflakeSchema.optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  closedDateFrom: z.date().optional(),
  closedDateTo: z.date().optional(),
});

const CaseSortOptionsSchema = z.object({
  field: z.enum(['createdAt', 'updatedAt', 'closedAt', 'caseNumber', 'priority', 'status']),
  direction: z.enum(['asc', 'desc']),
});

const CasePaginationOptionsSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  skip: z.number().int().nonnegative().optional(),
});

export class CaseRepository extends BaseMongoRepository<Case> {
  constructor() {
    super('cases');
  }

  public async findByCaseNumber(caseNumber: unknown): Promise<Case | null> {
    const validatedCaseNumber = ValidationHelpers.validateOrThrow(
      z.string().regex(/^\d{4}-\d{4}-.+$/),
      caseNumber,
      'Case number'
    );
    return this.findOne({ caseNumber: validatedCaseNumber });
  }

  public async findByClient(clientId: unknown): Promise<Case[]> {
    const validatedClientId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      clientId,
      'Client ID'
    );
    return this.findByFilters({ clientId: validatedClientId });
  }

  public async findByStatus(status: unknown): Promise<Case[]> {
    const validatedStatus = ValidationHelpers.validateOrThrow(
      CaseStatusSchema,
      status,
      'Case status'
    );
    return this.findByFilters({ status: validatedStatus as CaseStatus });
  }

  public async findByGuildAndStatus(guildId: unknown, status: unknown): Promise<Case[]> {
    const validatedGuildId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      guildId,
      'Guild ID'
    );
    const validatedStatus = ValidationHelpers.validateOrThrow(
      CaseStatusSchema,
      status,
      'Case status'
    );
    return this.findByFilters({ guildId: validatedGuildId, status: validatedStatus as CaseStatus });
  }

  public async findByLawyer(lawyerId: unknown): Promise<Case[]> {
    const validatedLawyerId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      lawyerId,
      'Lawyer ID'
    );
    
    const leadCases = await this.findByFilters({ leadAttorneyId: validatedLawyerId });
    const assignedCases = await this.findByFilters({ assignedLawyerIds: { $in: [validatedLawyerId] } } as any);
    
    // Combine and deduplicate
    const allCases = [...leadCases, ...assignedCases];
    const uniqueCases = allCases.filter((case1, index, self) => 
      index === self.findIndex(case2 => case1._id?.toString() === case2._id?.toString())
    );
    
    return uniqueCases;
  }

  public async findByLeadAttorney(leadAttorneyId: unknown): Promise<Case[]> {
    const validatedLeadAttorneyId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      leadAttorneyId,
      'Lead attorney ID'
    );
    return this.findByFilters({ leadAttorneyId: validatedLeadAttorneyId });
  }

  public async findAssignedToLawyer(lawyerId: unknown): Promise<Case[]> {
    const validatedLawyerId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      lawyerId,
      'Lawyer ID'
    );
    return this.findByFilters({ assignedLawyerIds: { $in: [validatedLawyerId] } } as any);
  }

  public async searchCases(
    filters: unknown,
    sort?: unknown,
    pagination?: unknown
  ): Promise<Case[]> {
    try {
      // Validate inputs
      const validatedFilters = ValidationHelpers.validateOrThrow(
        CaseSearchFiltersSchema,
        filters,
        'Case search filters'
      );
      const validatedSort = sort ? ValidationHelpers.validateOrThrow(
        CaseSortOptionsSchema,
        sort,
        'Case sort options'
      ) : undefined;
      const validatedPagination = pagination ? ValidationHelpers.validateOrThrow(
        CasePaginationOptionsSchema,
        pagination,
        'Case pagination options'
      ) : undefined;

      // Build MongoDB query from filters
      const query: any = {};

      if (validatedFilters.guildId) query.guildId = validatedFilters.guildId;
      if (validatedFilters.status) query.status = validatedFilters.status;
      if (validatedFilters.priority) query.priority = validatedFilters.priority;
      if (validatedFilters.result) query.result = validatedFilters.result;
      if (validatedFilters.clientId) query.clientId = validatedFilters.clientId;
      if (validatedFilters.leadAttorneyId) query.leadAttorneyId = validatedFilters.leadAttorneyId;
      if (validatedFilters.assignedLawyerId) query.assignedLawyerIds = { $in: [validatedFilters.assignedLawyerId] };
      if (validatedFilters.caseNumber) query.caseNumber = { $regex: validatedFilters.caseNumber, $options: 'i' };
      if (validatedFilters.title) query.title = { $regex: validatedFilters.title, $options: 'i' };

      // Date range filters
      if (validatedFilters.dateFrom || validatedFilters.dateTo) {
        query.createdAt = {};
        if (validatedFilters.dateFrom) query.createdAt.$gte = validatedFilters.dateFrom;
        if (validatedFilters.dateTo) query.createdAt.$lte = validatedFilters.dateTo;
      }

      if (validatedFilters.closedDateFrom || validatedFilters.closedDateTo) {
        query.closedAt = {};
        if (validatedFilters.closedDateFrom) query.closedAt.$gte = validatedFilters.closedDateFrom;
        if (validatedFilters.closedDateTo) query.closedAt.$lte = validatedFilters.closedDateTo;
      }

      // Execute query with sorting and pagination
      let cursor = this.collection.find(query);

      // Apply sorting
      if (validatedSort) {
        const sortDirection = validatedSort.direction === 'asc' ? 1 : -1;
        cursor = cursor.sort({ [validatedSort.field]: sortDirection });
      } else {
        // Default sort by creation date, newest first
        cursor = cursor.sort({ createdAt: -1 });
      }

      // Apply pagination
      if (validatedPagination?.skip) {
        cursor = cursor.skip(validatedPagination.skip);
      }
      if (validatedPagination?.limit) {
        cursor = cursor.limit(validatedPagination.limit);
      }

      const results = await cursor.toArray();
      return results.map(doc => this.fromMongoDoc(doc)!).filter(doc => doc !== null);
    } catch (error) {
      throw error;
    }
  }

  public async getActiveCases(guildId: unknown): Promise<Case[]> {
    const validatedGuildId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      guildId,
      'Guild ID'
    );
    return this.findByFilters({ 
      guildId: validatedGuildId, 
      status: 'in-progress'
    });
  }

  public async getPendingCases(guildId: unknown): Promise<Case[]> {
    return this.findByGuildAndStatus(guildId, 'pending');
  }

  public async getClosedCases(guildId: unknown): Promise<Case[]> {
    return this.findByGuildAndStatus(guildId, 'closed');
  }

  public async getCaseStats(guildId: unknown): Promise<{
    total: number;
    pending: number;
    open: number;
    inProgress: number;
    closed: number;
    wins: number;
    losses: number;
    settlements: number;
  }> {
    const validatedGuildId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      guildId,
      'Guild ID'
    );
    
    const allCases = await this.findByFilters({ guildId: validatedGuildId });
    
    return {
      total: allCases.length,
      pending: allCases.filter(c => c.status === 'pending').length,
      open: 0, // OPEN status removed
      inProgress: allCases.filter(c => c.status === 'in-progress').length,
      closed: allCases.filter(c => c.status === 'closed').length,
      wins: allCases.filter(c => c.result === 'win').length,
      losses: allCases.filter(c => c.result === 'loss').length,
      settlements: allCases.filter(c => c.result === 'settlement').length
    };
  }

  public async assignLawyer(caseId: unknown, lawyerId: unknown): Promise<Case | null> {
    const validatedCaseId = ValidationHelpers.validateOrThrow(
      z.string(),
      caseId,
      'Case ID'
    );
    const validatedLawyerId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      lawyerId,
      'Lawyer ID'
    );

    const existingCase = await this.findById(validatedCaseId);
    if (!existingCase) return null;

    // Check if lawyer is already assigned
    if (existingCase.assignedLawyerIds.includes(validatedLawyerId)) {
      return existingCase;
    }

    const updatedLawyers = [...existingCase.assignedLawyerIds, validatedLawyerId];
    
    // If no lead attorney, make this lawyer the lead
    const updates: Partial<Case> = {
      assignedLawyerIds: updatedLawyers
    };
    
    if (!existingCase.leadAttorneyId) {
      updates.leadAttorneyId = validatedLawyerId;
    }

    return this.update(validatedCaseId, updates);
  }

  public async unassignLawyer(caseId: unknown, lawyerId: unknown): Promise<Case | null> {
    const validatedCaseId = ValidationHelpers.validateOrThrow(
      z.string(),
      caseId,
      'Case ID'
    );
    const validatedLawyerId = ValidationHelpers.validateOrThrow(
      DiscordSnowflakeSchema,
      lawyerId,
      'Lawyer ID'
    );

    const existingCase = await this.findById(validatedCaseId);
    if (!existingCase) return null;

    const updatedLawyers = existingCase.assignedLawyerIds.filter(id => id !== validatedLawyerId);
    
    const updates: Partial<Case> = {
      assignedLawyerIds: updatedLawyers
    };

    // If removing the lead attorney, assign new lead from remaining lawyers
    if (existingCase.leadAttorneyId === validatedLawyerId) {
      updates.leadAttorneyId = updatedLawyers.length > 0 ? updatedLawyers[0] : undefined;
    }

    return this.update(validatedCaseId, updates);
  }

  public async reassignLawyer(fromCaseId: unknown, toCaseId: unknown, lawyerId: unknown): Promise<{
    fromCase: Case | null;
    toCase: Case | null;
  }> {
    // Validation is handled by the called methods
    const fromCase = await this.unassignLawyer(fromCaseId, lawyerId);
    const toCase = await this.assignLawyer(toCaseId, lawyerId);
    
    return { fromCase, toCase };
  }

  public async addDocument(caseId: unknown, document: unknown): Promise<Case | null> {
    const validatedCaseId = ValidationHelpers.validateOrThrow(
      z.string(),
      caseId,
      'Case ID'
    );
    // Create a document schema matching CaseDocument interface
    const documentSchema = z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      createdBy: DiscordSnowflakeSchema,
      createdAt: z.date()
    });
    const validatedDocument = ValidationHelpers.validateOrThrow(
      documentSchema,
      document,
      'Document'
    );

    const existingCase = await this.findById(validatedCaseId);
    if (!existingCase) return null;

    const updatedDocuments = [...existingCase.documents, validatedDocument];
    return this.update(validatedCaseId, { documents: updatedDocuments });
  }

  public async addNote(caseId: unknown, note: unknown): Promise<Case | null> {
    const validatedCaseId = ValidationHelpers.validateOrThrow(
      z.string(),
      caseId,
      'Case ID'
    );
    // Create a note schema matching CaseNote interface
    const noteSchema = z.object({
      id: z.string(),
      content: z.string(),
      createdBy: DiscordSnowflakeSchema,
      createdAt: z.date(),
      isInternal: z.boolean()
    });
    const validatedNote = ValidationHelpers.validateOrThrow(
      noteSchema,
      note,
      'Note'
    );

    const existingCase = await this.findById(validatedCaseId);
    if (!existingCase) return null;

    const updatedNotes = [...existingCase.notes, validatedNote];
    return this.update(validatedCaseId, { notes: updatedNotes });
  }

  /**
   * Find all cases where a user is involved (as client, lead attorney, or assigned lawyer)
   */
  public async findCasesByUserId(guildId: unknown, userId: unknown): Promise<Case[]> {
    try {
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedUserId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        userId,
        'User ID'
      );

      const query = {
        guildId: validatedGuildId,
        $or: [
          { clientId: validatedUserId },
          { leadAttorneyId: validatedUserId },
          { assignedLawyerIds: { $in: [validatedUserId] } }
        ]
      };

      return await this.findByFilters(query as any);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Conditionally update a case only if it matches certain criteria
   * This prevents race conditions by checking and updating in a single atomic operation
   */
  public async conditionalUpdate(
    caseId: unknown,
    conditions: unknown,
    updates: unknown
  ): Promise<Case | null> {
    try {
      const validatedCaseId = ValidationHelpers.validateOrThrow(
        z.string(),
        caseId,
        'Case ID'
      );

      if (!ObjectId.isValid(validatedCaseId)) {
        return null;
      }
      
      // Validate conditions and updates as partial Case objects
      const partialCaseSchema = z.object({
        status: CaseStatusSchema.optional(),
        priority: CasePrioritySchema.optional(),
        result: CaseResultSchema.optional(),
        // Add other fields as needed
      }).passthrough(); // Allow additional fields

      const validatedConditions = ValidationHelpers.validateOrThrow(
        partialCaseSchema,
        conditions,
        'Conditions'
      );
      const validatedUpdates = ValidationHelpers.validateOrThrow(
        partialCaseSchema,
        updates,
        'Updates'
      );
      
      const query: any = { _id: new ObjectId(validatedCaseId), ...validatedConditions };
      const updateDoc: any = { $set: { ...validatedUpdates, updatedAt: new Date() } };
      
      const result = await this.collection.findOneAndUpdate(
        query,
        updateDoc,
        { returnDocument: 'after' }
      );
      
      return result ? this.fromMongoDoc(result) : null;
    } catch (error) {
      throw error;
    }
  }
}