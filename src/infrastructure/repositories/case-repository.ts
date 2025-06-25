import { Case, CaseStatus, CasePriority, CaseResult } from '../../domain/entities/case';
import { BaseMongoRepository } from './base-mongo-repository';

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

export class CaseRepository extends BaseMongoRepository<Case> {
  constructor() {
    super('cases');
  }

  public async findByCaseNumber(caseNumber: string): Promise<Case | null> {
    return this.findOne({ caseNumber });
  }

  public async findByClient(clientId: string): Promise<Case[]> {
    return this.findByFilters({ clientId });
  }

  public async findByStatus(status: CaseStatus): Promise<Case[]> {
    return this.findByFilters({ status });
  }

  public async findByGuildAndStatus(guildId: string, status: CaseStatus): Promise<Case[]> {
    return this.findByFilters({ guildId, status });
  }

  public async findByLawyer(lawyerId: string): Promise<Case[]> {
    const leadCases = await this.findByFilters({ leadAttorneyId: lawyerId });
    const assignedCases = await this.findByFilters({ assignedLawyerIds: { $in: [lawyerId] } } as any);
    
    // Combine and deduplicate
    const allCases = [...leadCases, ...assignedCases];
    const uniqueCases = allCases.filter((case1, index, self) => 
      index === self.findIndex(case2 => case1._id?.toString() === case2._id?.toString())
    );
    
    return uniqueCases;
  }

  public async findByLeadAttorney(leadAttorneyId: string): Promise<Case[]> {
    return this.findByFilters({ leadAttorneyId });
  }

  public async findAssignedToLawyer(lawyerId: string): Promise<Case[]> {
    return this.findByFilters({ assignedLawyerIds: { $in: [lawyerId] } } as any);
  }

  public async searchCases(
    filters: CaseSearchFilters,
    sort?: CaseSortOptions,
    pagination?: CasePaginationOptions
  ): Promise<Case[]> {
    try {
      // Build MongoDB query from filters
      const query: any = {};

      if (filters.guildId) query.guildId = filters.guildId;
      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      if (filters.result) query.result = filters.result;
      if (filters.clientId) query.clientId = filters.clientId;
      if (filters.leadAttorneyId) query.leadAttorneyId = filters.leadAttorneyId;
      if (filters.assignedLawyerId) query.assignedLawyerIds = { $in: [filters.assignedLawyerId] };
      if (filters.caseNumber) query.caseNumber = { $regex: filters.caseNumber, $options: 'i' };
      if (filters.title) query.title = { $regex: filters.title, $options: 'i' };

      // Date range filters
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom;
        if (filters.dateTo) query.createdAt.$lte = filters.dateTo;
      }

      if (filters.closedDateFrom || filters.closedDateTo) {
        query.closedAt = {};
        if (filters.closedDateFrom) query.closedAt.$gte = filters.closedDateFrom;
        if (filters.closedDateTo) query.closedAt.$lte = filters.closedDateTo;
      }

      // Execute query with sorting and pagination
      let cursor = this.collection.find(query);

      // Apply sorting
      if (sort) {
        const sortDirection = sort.direction === 'asc' ? 1 : -1;
        cursor = cursor.sort({ [sort.field]: sortDirection });
      } else {
        // Default sort by creation date, newest first
        cursor = cursor.sort({ createdAt: -1 });
      }

      // Apply pagination
      if (pagination?.skip) {
        cursor = cursor.skip(pagination.skip);
      }
      if (pagination?.limit) {
        cursor = cursor.limit(pagination.limit);
      }

      const results = await cursor.toArray();
      return results as Case[];
    } catch (error) {
      throw error;
    }
  }

  public async getActiveCases(guildId: string): Promise<Case[]> {
    return this.findByFilters({ 
      guildId, 
      status: CaseStatus.IN_PROGRESS
    });
  }

  public async getPendingCases(guildId: string): Promise<Case[]> {
    return this.findByGuildAndStatus(guildId, CaseStatus.PENDING);
  }

  public async getClosedCases(guildId: string): Promise<Case[]> {
    return this.findByGuildAndStatus(guildId, CaseStatus.CLOSED);
  }

  public async getCaseStats(guildId: string): Promise<{
    total: number;
    pending: number;
    open: number;
    inProgress: number;
    closed: number;
    wins: number;
    losses: number;
    settlements: number;
  }> {
    const allCases = await this.findByFilters({ guildId });
    
    return {
      total: allCases.length,
      pending: allCases.filter(c => c.status === CaseStatus.PENDING).length,
      open: 0, // OPEN status removed
      inProgress: allCases.filter(c => c.status === CaseStatus.IN_PROGRESS).length,
      closed: allCases.filter(c => c.status === CaseStatus.CLOSED).length,
      wins: allCases.filter(c => c.result === CaseResult.WIN).length,
      losses: allCases.filter(c => c.result === CaseResult.LOSS).length,
      settlements: allCases.filter(c => c.result === CaseResult.SETTLEMENT).length
    };
  }

  public async assignLawyer(caseId: string, lawyerId: string): Promise<Case | null> {
    const existingCase = await this.findById(caseId);
    if (!existingCase) return null;

    // Check if lawyer is already assigned
    if (existingCase.assignedLawyerIds.includes(lawyerId)) {
      return existingCase;
    }

    const updatedLawyers = [...existingCase.assignedLawyerIds, lawyerId];
    
    // If no lead attorney, make this lawyer the lead
    const updates: Partial<Case> = {
      assignedLawyerIds: updatedLawyers
    };
    
    if (!existingCase.leadAttorneyId) {
      updates.leadAttorneyId = lawyerId;
    }

    return this.update(caseId, updates);
  }

  public async unassignLawyer(caseId: string, lawyerId: string): Promise<Case | null> {
    const existingCase = await this.findById(caseId);
    if (!existingCase) return null;

    const updatedLawyers = existingCase.assignedLawyerIds.filter(id => id !== lawyerId);
    
    const updates: Partial<Case> = {
      assignedLawyerIds: updatedLawyers
    };

    // If removing the lead attorney, assign new lead from remaining lawyers
    if (existingCase.leadAttorneyId === lawyerId) {
      updates.leadAttorneyId = updatedLawyers.length > 0 ? updatedLawyers[0] : undefined;
    }

    return this.update(caseId, updates);
  }

  public async reassignLawyer(fromCaseId: string, toCaseId: string, lawyerId: string): Promise<{
    fromCase: Case | null;
    toCase: Case | null;
  }> {
    const fromCase = await this.unassignLawyer(fromCaseId, lawyerId);
    const toCase = await this.assignLawyer(toCaseId, lawyerId);
    
    return { fromCase, toCase };
  }

  public async addDocument(caseId: string, document: Case['documents'][0]): Promise<Case | null> {
    const existingCase = await this.findById(caseId);
    if (!existingCase) return null;

    const updatedDocuments = [...existingCase.documents, document];
    return this.update(caseId, { documents: updatedDocuments });
  }

  public async addNote(caseId: string, note: Case['notes'][0]): Promise<Case | null> {
    const existingCase = await this.findById(caseId);
    if (!existingCase) return null;

    const updatedNotes = [...existingCase.notes, note];
    return this.update(caseId, { notes: updatedNotes });
  }
}