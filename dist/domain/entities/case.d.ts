import { BaseEntity } from './base';
export interface Case extends BaseEntity {
    guildId: string;
    caseNumber: string;
    clientId: string;
    clientUsername: string;
    title: string;
    description: string;
    status: CaseStatus;
    priority: CasePriority;
    leadAttorneyId?: string;
    assignedLawyerIds: string[];
    channelId?: string;
    result?: CaseResult;
    resultNotes?: string;
    closedAt?: Date;
    closedBy?: string;
    documents: CaseDocument[];
    notes: CaseNote[];
}
export declare enum CaseStatus {
    PENDING = "pending",// Initial state when case review is requested
    OPEN = "open",// Case has been accepted and is active
    IN_PROGRESS = "in-progress",// Case is actively being worked on
    CLOSED = "closed"
}
export declare enum CasePriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    URGENT = "urgent"
}
export declare enum CaseResult {
    WIN = "win",
    LOSS = "loss",
    SETTLEMENT = "settlement",
    DISMISSED = "dismissed",
    WITHDRAWN = "withdrawn"
}
export interface CaseDocument {
    id: string;
    title: string;
    content: string;
    createdBy: string;
    createdAt: Date;
}
export interface CaseNote {
    id: string;
    content: string;
    createdBy: string;
    createdAt: Date;
    isInternal: boolean;
}
export interface CaseCreationRequest {
    guildId: string;
    clientId: string;
    clientUsername: string;
    title: string;
    description: string;
    priority?: CasePriority;
}
export interface CaseAssignmentRequest {
    caseId: string;
    lawyerId: string;
    assignedBy: string;
}
export interface CaseClosureRequest {
    caseId: string;
    result: CaseResult;
    resultNotes?: string;
    closedBy: string;
}
export interface CaseUpdateRequest {
    caseId: string;
    title?: string;
    description?: string;
    priority?: CasePriority;
    status?: CaseStatus;
    channelId?: string;
}
export interface CaseCounter extends BaseEntity {
    guildId: string;
    year: number;
    count: number;
}
export declare function generateCaseNumber(year: number, count: number, username: string): string;
export declare function parseCaseNumber(caseNumber: string): {
    year: number;
    count: number;
    username: string;
} | null;
export declare function generateChannelName(caseNumber: string): string;
//# sourceMappingURL=case.d.ts.map