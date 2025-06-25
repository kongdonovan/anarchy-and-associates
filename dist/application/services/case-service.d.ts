import { Case, CaseStatus, CaseCreationRequest, CaseAssignmentRequest, CaseClosureRequest, CaseUpdateRequest } from '../../domain/entities/case';
import { CaseRepository, CaseSearchFilters, CaseSortOptions, CasePaginationOptions } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { Client } from 'discord.js';
export declare class CaseService {
    private caseRepository;
    private caseCounterRepository;
    private guildConfigRepository;
    private permissionService;
    private discordClient?;
    constructor(caseRepository: CaseRepository, caseCounterRepository: CaseCounterRepository, guildConfigRepository: GuildConfigRepository, permissionService: PermissionService, discordClient?: Client | undefined);
    createCase(context: PermissionContext, request: CaseCreationRequest): Promise<Case>;
    assignLawyer(context: PermissionContext, request: CaseAssignmentRequest): Promise<Case>;
    unassignLawyer(context: PermissionContext, caseId: string, lawyerId: string): Promise<Case>;
    reassignLawyer(context: PermissionContext, fromCaseId: string, toCaseId: string, lawyerId: string): Promise<{
        fromCase: Case | null;
        toCase: Case | null;
    }>;
    updateCaseStatus(context: PermissionContext, caseId: string, status: CaseStatus): Promise<Case>;
    closeCase(context: PermissionContext, request: CaseClosureRequest): Promise<Case>;
    setLeadAttorney(context: PermissionContext, caseId: string, newLeadAttorneyId: string): Promise<Case>;
    private updateCaseChannelPermissions;
    updateCase(context: PermissionContext, request: CaseUpdateRequest): Promise<Case>;
    addDocument(context: PermissionContext, caseId: string, title: string, content: string): Promise<Case>;
    addNote(context: PermissionContext, caseId: string, content: string, isInternal?: boolean): Promise<Case>;
    searchCases(context: PermissionContext, filters: CaseSearchFilters, sort?: CaseSortOptions, pagination?: CasePaginationOptions): Promise<Case[]>;
    getCaseById(context: PermissionContext, caseId: string): Promise<Case | null>;
    getCaseByCaseNumber(context: PermissionContext, caseNumber: string): Promise<Case | null>;
    getCasesByClient(context: PermissionContext, clientId: string): Promise<Case[]>;
    getCasesByLawyer(context: PermissionContext, lawyerId: string): Promise<Case[]>;
    getActiveCases(context: PermissionContext): Promise<Case[]>;
    getPendingCases(context: PermissionContext): Promise<Case[]>;
    getCaseStats(context: PermissionContext): Promise<{
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
    acceptCase(context: PermissionContext, caseId: string): Promise<Case>;
    private createCaseChannel;
    declineCase(context: PermissionContext, caseId: string, reason?: string): Promise<Case>;
}
//# sourceMappingURL=case-service.d.ts.map