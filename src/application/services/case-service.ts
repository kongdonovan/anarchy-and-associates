import { 
  Case, 
  CaseStatus, 
  CasePriority,
  CaseResult,
  CaseCreationRequest, 
  CaseAssignmentRequest,
  CaseClosureRequest,
  CaseUpdateRequest,
  CaseDocument,
  CaseNote,
  generateCaseNumber,
  generateChannelName
} from '../../domain/entities/case';
import { CaseRepository, CaseSearchFilters, CaseSortOptions, CasePaginationOptions } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { logger } from '../../infrastructure/logger';
import { randomUUID } from 'crypto';

export class CaseService {
  constructor(
    private caseRepository: CaseRepository,
    private caseCounterRepository: CaseCounterRepository,
    private guildConfigRepository: GuildConfigRepository
  ) {}

  public async createCase(request: CaseCreationRequest): Promise<Case> {
    logger.info('Creating new case', {
      guildId: request.guildId,
      clientId: request.clientId,
      title: request.title
    });

    // Generate sequential case number
    const caseCount = await this.caseCounterRepository.getNextCaseNumber(request.guildId);
    const currentYear = new Date().getFullYear();
    const caseNumber = generateCaseNumber(currentYear, caseCount, request.clientUsername);

    const caseData: Omit<Case, '_id' | 'createdAt' | 'updatedAt'> = {
      guildId: request.guildId,
      caseNumber,
      clientId: request.clientId,
      clientUsername: request.clientUsername,
      title: request.title,
      description: request.description,
      status: CaseStatus.PENDING,
      priority: request.priority || CasePriority.MEDIUM,
      assignedLawyerIds: [],
      documents: [],
      notes: []
    };

    const createdCase = await this.caseRepository.add(caseData);
    
    logger.info('Case created successfully', {
      caseId: createdCase._id,
      caseNumber: createdCase.caseNumber,
      clientId: request.clientId
    });

    return createdCase;
  }

  public async assignLawyer(request: CaseAssignmentRequest): Promise<Case> {
    logger.info('Assigning lawyer to case', {
      caseId: request.caseId,
      lawyerId: request.lawyerId,
      assignedBy: request.assignedBy
    });

    const updatedCase = await this.caseRepository.assignLawyer(request.caseId, request.lawyerId);
    
    if (!updatedCase) {
      throw new Error('Case not found or assignment failed');
    }

    logger.info('Lawyer assigned successfully', {
      caseId: request.caseId,
      lawyerId: request.lawyerId,
      isLeadAttorney: updatedCase.leadAttorneyId === request.lawyerId
    });

    return updatedCase;
  }

  public async unassignLawyer(caseId: string, lawyerId: string): Promise<Case> {
    logger.info('Unassigning lawyer from case', { caseId, lawyerId });

    const updatedCase = await this.caseRepository.unassignLawyer(caseId, lawyerId);
    
    if (!updatedCase) {
      throw new Error('Case not found or unassignment failed');
    }

    logger.info('Lawyer unassigned successfully', { caseId, lawyerId });
    return updatedCase;
  }

  public async reassignLawyer(fromCaseId: string, toCaseId: string, lawyerId: string): Promise<{
    fromCase: Case | null;
    toCase: Case | null;
  }> {
    logger.info('Reassigning lawyer between cases', { fromCaseId, toCaseId, lawyerId });

    const result = await this.caseRepository.reassignLawyer(fromCaseId, toCaseId, lawyerId);
    
    if (!result.fromCase || !result.toCase) {
      throw new Error('One or both cases not found, or reassignment failed');
    }

    logger.info('Lawyer reassigned successfully', { fromCaseId, toCaseId, lawyerId });
    return result;
  }

  public async updateCaseStatus(caseId: string, status: CaseStatus, updatedBy: string): Promise<Case> {
    logger.info('Updating case status', { caseId, status, updatedBy });

    const updatedCase = await this.caseRepository.update(caseId, { status });
    
    if (!updatedCase) {
      throw new Error('Case not found or status update failed');
    }

    logger.info('Case status updated successfully', { caseId, status });
    return updatedCase;
  }

  public async closeCase(request: CaseClosureRequest): Promise<Case> {
    logger.info('Closing case', {
      caseId: request.caseId,
      result: request.result,
      closedBy: request.closedBy
    });

    const updatedCase = await this.caseRepository.update(request.caseId, {
      status: CaseStatus.CLOSED,
      result: request.result,
      resultNotes: request.resultNotes,
      closedAt: new Date(),
      closedBy: request.closedBy
    });

    if (!updatedCase) {
      throw new Error('Case not found or closure failed');
    }

    logger.info('Case closed successfully', {
      caseId: request.caseId,
      result: request.result
    });

    return updatedCase;
  }

  public async updateCase(request: CaseUpdateRequest): Promise<Case> {
    const updates: Partial<Case> = {};
    
    if (request.title !== undefined) updates.title = request.title;
    if (request.description !== undefined) updates.description = request.description;
    if (request.priority !== undefined) updates.priority = request.priority;
    if (request.status !== undefined) updates.status = request.status;

    const updatedCase = await this.caseRepository.update(request.caseId, updates);
    
    if (!updatedCase) {
      throw new Error('Case not found or update failed');
    }

    return updatedCase;
  }

  public async addDocument(caseId: string, title: string, content: string, createdBy: string): Promise<Case> {
    const document: CaseDocument = {
      id: randomUUID(),
      title,
      content,
      createdBy,
      createdAt: new Date()
    };

    const updatedCase = await this.caseRepository.addDocument(caseId, document);
    
    if (!updatedCase) {
      throw new Error('Case not found or document addition failed');
    }

    logger.info('Document added to case', { caseId, documentId: document.id, title });
    return updatedCase;
  }

  public async addNote(caseId: string, content: string, createdBy: string, isInternal = false): Promise<Case> {
    const note: CaseNote = {
      id: randomUUID(),
      content,
      createdBy,
      createdAt: new Date(),
      isInternal
    };

    const updatedCase = await this.caseRepository.addNote(caseId, note);
    
    if (!updatedCase) {
      throw new Error('Case not found or note addition failed');
    }

    logger.info('Note added to case', { caseId, noteId: note.id, isInternal });
    return updatedCase;
  }

  public async searchCases(
    filters: CaseSearchFilters,
    sort?: CaseSortOptions,
    pagination?: CasePaginationOptions
  ): Promise<Case[]> {
    return this.caseRepository.searchCases(filters, sort, pagination);
  }

  public async getCaseById(caseId: string): Promise<Case | null> {
    return this.caseRepository.findById(caseId);
  }

  public async getCaseByCaseNumber(caseNumber: string): Promise<Case | null> {
    return this.caseRepository.findByCaseNumber(caseNumber);
  }

  public async getCasesByClient(clientId: string): Promise<Case[]> {
    return this.caseRepository.findByClient(clientId);
  }

  public async getCasesByLawyer(lawyerId: string): Promise<Case[]> {
    return this.caseRepository.findByLawyer(lawyerId);
  }

  public async getActiveCases(guildId: string): Promise<Case[]> {
    return this.caseRepository.getActiveCases(guildId);
  }

  public async getPendingCases(guildId: string): Promise<Case[]> {
    return this.caseRepository.getPendingCases(guildId);
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
    return this.caseRepository.getCaseStats(guildId);
  }

  public async getCaseReviewCategoryId(guildId: string): Promise<string | null> {
    const config = await this.guildConfigRepository.findByGuildId(guildId);
    return config?.caseReviewCategoryId || null;
  }

  public async getCaseArchiveCategoryId(guildId: string): Promise<string | null> {
    const config = await this.guildConfigRepository.findByGuildId(guildId);
    return config?.caseArchiveCategoryId || null;
  }

  public generateChannelName(caseNumber: string): string {
    return generateChannelName(caseNumber);
  }

  public async acceptCase(caseId: string, acceptedBy: string): Promise<Case> {
    logger.info('Accepting case', { caseId, acceptedBy });

    // Update status to open and assign the accepting lawyer as lead attorney
    const updatedCase = await this.caseRepository.update(caseId, {
      status: CaseStatus.OPEN,
      leadAttorneyId: acceptedBy,
      assignedLawyerIds: [acceptedBy]
    });

    if (!updatedCase) {
      throw new Error('Case not found or acceptance failed');
    }

    logger.info('Case accepted successfully', {
      caseId,
      acceptedBy,
      leadAttorney: acceptedBy
    });

    return updatedCase;
  }

  public async declineCase(caseId: string, declinedBy: string, reason?: string): Promise<Case> {
    logger.info('Declining case', { caseId, declinedBy, reason });

    // For now, we'll set status to closed with a specific result
    // In a more complex system, you might want a separate "declined" status
    const updatedCase = await this.caseRepository.update(caseId, {
      status: CaseStatus.CLOSED,
      result: CaseResult.DISMISSED,
      resultNotes: reason || 'Case declined by staff',
      closedAt: new Date(),
      closedBy: declinedBy
    });

    if (!updatedCase) {
      throw new Error('Case not found or decline failed');
    }

    logger.info('Case declined successfully', { caseId, declinedBy });
    return updatedCase;
  }
}