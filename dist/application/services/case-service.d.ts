import { Case, CaseStatus, CaseCreationRequest, CaseAssignmentRequest, CaseClosureRequest, CaseUpdateRequest } from '../../domain/entities/case';
import { CaseRepository, CaseSearchFilters, CaseSortOptions, CasePaginationOptions } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
export declare class CaseService {
    private caseRepository;
    private caseCounterRepository;
    private guildConfigRepository;
    constructor(caseRepository: CaseRepository, caseCounterRepository: CaseCounterRepository, guildConfigRepository: GuildConfigRepository);
    createCase(request: CaseCreationRequest): Promise<Case>;
    assignLawyer(request: CaseAssignmentRequest): Promise<Case>;
    unassignLawyer(caseId: string, lawyerId: string): Promise<Case>;
    reassignLawyer(fromCaseId: string, toCaseId: string, lawyerId: string): Promise<{
        fromCase: Case | null;
        toCase: Case | null;
    }>;
    updateCaseStatus(caseId: string, status: CaseStatus, updatedBy: string): Promise<Case>;
    closeCase(request: CaseClosureRequest): Promise<Case>;
    updateCase(request: CaseUpdateRequest): Promise<Case>;
    addDocument(caseId: string, title: string, content: string, createdBy: string): Promise<Case>;
    addNote(caseId: string, content: string, createdBy: string, isInternal?: boolean): Promise<Case>;
    searchCases(filters: CaseSearchFilters, sort?: CaseSortOptions, pagination?: CasePaginationOptions): Promise<Case[]>;
    getCaseById(caseId: string): Promise<Case | null>;
    getCaseByCaseNumber(caseNumber: string): Promise<Case | null>;
    getCasesByClient(clientId: string): Promise<Case[]>;
    getCasesByLawyer(lawyerId: string): Promise<Case[]>;
    getActiveCases(guildId: string): Promise<Case[]>;
    getPendingCases(guildId: string): Promise<Case[]>;
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
    getCaseReviewCategoryId(guildId: string): Promise<string | null>;
    getCaseArchiveCategoryId(guildId: string): Promise<string | null>;
    generateChannelName(caseNumber: string): string;
    acceptCase(caseId: string, acceptedBy: string): Promise<Case>;
    declineCase(caseId: string, declinedBy: string, reason?: string): Promise<Case>;
}
//# sourceMappingURL=case-service.d.ts.map