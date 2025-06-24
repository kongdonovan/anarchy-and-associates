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
export declare class CaseRepository extends BaseMongoRepository<Case> {
    constructor();
    findByCaseNumber(caseNumber: string): Promise<Case | null>;
    findByClient(clientId: string): Promise<Case[]>;
    findByStatus(status: CaseStatus): Promise<Case[]>;
    findByGuildAndStatus(guildId: string, status: CaseStatus): Promise<Case[]>;
    findByLawyer(lawyerId: string): Promise<Case[]>;
    findByLeadAttorney(leadAttorneyId: string): Promise<Case[]>;
    findAssignedToLawyer(lawyerId: string): Promise<Case[]>;
    searchCases(filters: CaseSearchFilters, sort?: CaseSortOptions, pagination?: CasePaginationOptions): Promise<Case[]>;
    getActiveCases(guildId: string): Promise<Case[]>;
    getPendingCases(guildId: string): Promise<Case[]>;
    getClosedCases(guildId: string): Promise<Case[]>;
    getCaseStats(guildId: string): Promise<{
        total: number;
        pending: number;
        open: number;
        inProgress: number;
        closed: number;
        wins: number;
        losses: number;
        settlements: number;
    }>;
    assignLawyer(caseId: string, lawyerId: string): Promise<Case | null>;
    unassignLawyer(caseId: string, lawyerId: string): Promise<Case | null>;
    reassignLawyer(fromCaseId: string, toCaseId: string, lawyerId: string): Promise<{
        fromCase: Case | null;
        toCase: Case | null;
    }>;
    addDocument(caseId: string, document: Case['documents'][0]): Promise<Case | null>;
    addNote(caseId: string, note: Case['notes'][0]): Promise<Case | null>;
}
//# sourceMappingURL=case-repository.d.ts.map