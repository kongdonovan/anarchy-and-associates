import { BaseMongoRepository } from './base-mongo-repository';
import { Case, CaseStatus, CasePriority, CaseResult } from '../../validation';
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
export declare class CaseRepository extends BaseMongoRepository<Case> {
    constructor();
    findByCaseNumber(caseNumber: unknown): Promise<Case | null>;
    findByClient(clientId: unknown): Promise<Case[]>;
    findByStatus(status: unknown): Promise<Case[]>;
    findByGuildAndStatus(guildId: unknown, status: unknown): Promise<Case[]>;
    findByLawyer(lawyerId: unknown): Promise<Case[]>;
    findByLeadAttorney(leadAttorneyId: unknown): Promise<Case[]>;
    findAssignedToLawyer(lawyerId: unknown): Promise<Case[]>;
    searchCases(filters: unknown, sort?: unknown, pagination?: unknown): Promise<Case[]>;
    getActiveCases(guildId: unknown): Promise<Case[]>;
    getPendingCases(guildId: unknown): Promise<Case[]>;
    getClosedCases(guildId: unknown): Promise<Case[]>;
    getCaseStats(guildId: unknown): Promise<{
        total: number;
        pending: number;
        open: number;
        inProgress: number;
        closed: number;
        wins: number;
        losses: number;
        settlements: number;
    }>;
    assignLawyer(caseId: unknown, lawyerId: unknown): Promise<Case | null>;
    unassignLawyer(caseId: unknown, lawyerId: unknown): Promise<Case | null>;
    reassignLawyer(fromCaseId: unknown, toCaseId: unknown, lawyerId: unknown): Promise<{
        fromCase: Case | null;
        toCase: Case | null;
    }>;
    addDocument(caseId: unknown, document: unknown): Promise<Case | null>;
    addNote(caseId: unknown, note: unknown): Promise<Case | null>;
    /**
     * Find all cases where a user is involved (as client, lead attorney, or assigned lawyer)
     */
    findCasesByUserId(guildId: unknown, userId: unknown): Promise<Case[]>;
    /**
     * Conditionally update a case only if it matches certain criteria
     * This prevents race conditions by checking and updating in a single atomic operation
     */
    conditionalUpdate(caseId: unknown, conditions: unknown, updates: unknown): Promise<Case | null>;
}
//# sourceMappingURL=case-repository.d.ts.map