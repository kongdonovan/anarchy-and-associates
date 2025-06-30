import { BaseEntity } from './base';
/**
 * Represents a legal case managed by the law firm.
 * Cases are the core business entity, tracking client matters from creation to resolution.
 * Each case has an associated Discord channel for communication and document management.
 *
 * @interface Case
 * @extends {BaseEntity}
 *
 * @example
 * ```typescript
 * const newCase: Case = {
 *   guildId: '123456789',
 *   caseNumber: 'AA-2024-001-johndoe',
 *   clientId: '987654321',
 *   clientUsername: 'johndoe',
 *   title: 'Contract Dispute - ABC Corp',
 *   description: 'Client seeks legal representation for breach of contract...',
 *   status: CaseStatus.PENDING,
 *   priority: CasePriority.HIGH,
 *   assignedLawyerIds: [],
 *   documents: [],
 *   notes: [],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * };
 * ```
 *
 * @see {@link CaseStatus} - Available case statuses
 * @see {@link CasePriority} - Priority levels for cases
 * @see {@link CaseResult} - Possible case outcomes
 */
export interface Case extends BaseEntity {
    /**
     * Discord guild ID where this case is managed.
     * Enables multi-server support for law firms operating across multiple Discord servers.
     * @property {string} guildId - Discord guild snowflake ID
     */
    guildId: string;
    /**
     * Unique case identifier following the format: AA-YYYY-NNNN-username.
     * - AA: Firm prefix (Anarchy & Associates)
     * - YYYY: Year of case creation
     * - NNNN: Sequential number within the year
     * - username: Client's Discord username (sanitized)
     * @property {string} caseNumber - Formatted case identifier
     * @example "AA-2024-001-johndoe"
     */
    caseNumber: string;
    /**
     * Discord user ID of the client who opened the case.
     * Used for permission checks and client-specific operations.
     * @property {string} clientId - Discord user snowflake ID
     */
    clientId: string;
    /**
     * Discord username of the client at case creation time.
     * Cached for case number generation and display purposes.
     * @property {string} clientUsername - Client's Discord username
     */
    clientUsername: string;
    /**
     * Brief, descriptive title of the legal matter.
     * Should summarize the case type and key parties involved.
     * @property {string} title - Case title for quick identification
     */
    title: string;
    /**
     * Detailed description of the legal matter and client's needs.
     * Should include relevant facts, desired outcomes, and any special considerations.
     * @property {string} description - Full case description
     */
    description: string;
    /**
     * Current status in the case lifecycle.
     * Transitions: PENDING → IN_PROGRESS → CLOSED
     * @property {CaseStatus} status - Current case status
     */
    status: CaseStatus;
    /**
     * Urgency level of the case, used for workload prioritization.
     * Affects case assignment and resource allocation decisions.
     * @property {CasePriority} priority - Case priority level
     */
    priority: CasePriority;
    /**
     * Discord user ID of the attorney leading this case.
     * The lead attorney has primary responsibility and can manage case assignments.
     * Must be one of the assignedLawyerIds.
     * @property {string} [leadAttorneyId] - Lead attorney's Discord ID
     */
    leadAttorneyId?: string;
    /**
     * Array of Discord user IDs for all attorneys assigned to this case.
     * Includes the lead attorney. Attorneys must have appropriate roles and permissions.
     * @property {string[]} assignedLawyerIds - Assigned attorneys' Discord IDs
     */
    assignedLawyerIds: string[];
    /**
     * Discord channel ID dedicated to this case.
     * Created automatically when case is accepted. Used for secure client-attorney communication.
     * @property {string} [channelId] - Associated Discord channel ID
     */
    channelId?: string;
    /**
     * Final outcome of the case, set when status changes to CLOSED.
     * Helps track firm performance and case success rates.
     * @property {CaseResult} [result] - Case outcome
     */
    result?: CaseResult;
    /**
     * Additional details about the case outcome.
     * May include settlement amounts, court decisions, or other relevant closure information.
     * @property {string} [resultNotes] - Detailed outcome notes
     */
    resultNotes?: string;
    /**
     * Timestamp when the case was closed.
     * Used for performance metrics and historical reporting.
     * @property {Date} [closedAt] - Case closure timestamp
     */
    closedAt?: Date;
    /**
     * Discord user ID of the staff member who closed the case.
     * Provides audit trail for case closures.
     * @property {string} [closedBy] - Closing staff member's Discord ID
     */
    closedBy?: string;
    /**
     * Collection of documents attached to this case.
     * May include contracts, evidence, correspondence, etc.
     * @property {CaseDocument[]} documents - Case-related documents
     */
    documents: CaseDocument[];
    /**
     * Collection of notes and updates about the case.
     * Includes both internal notes and client-visible updates.
     * @property {CaseNote[]} notes - Case notes and updates
     */
    notes: CaseNote[];
}
/**
 * Represents the lifecycle status of a legal case.
 * Cases progress through these statuses as they move from initial review to completion.
 *
 * @enum {string}
 *
 * @example
 * ```typescript
 * // Check if a case is active
 * if (case.status === CaseStatus.IN_PROGRESS) {
 *   console.log('Case is being actively worked on');
 * }
 *
 * // Update case status
 * case.status = CaseStatus.CLOSED;
 * ```
 */
export declare enum CaseStatus {
    /**
     * Initial state when a case review is requested.
     * The case is awaiting acceptance by an attorney.
     * In this state:
     * - No attorneys are assigned yet
     * - No Discord channel has been created
     * - Client is waiting for their case to be reviewed
     */
    PENDING = "pending",
    /**
     * Case has been accepted and is actively being worked on.
     * In this state:
     * - At least one attorney is assigned
     * - A dedicated Discord channel has been created
     * - Client and attorneys can communicate about the case
     * - Documents and notes can be added
     */
    IN_PROGRESS = "in-progress",
    /**
     * Case has been completed and closed.
     * In this state:
     * - No further work is being done
     * - Result and resultNotes should be populated
     * - Case channel may be archived
     * - Performance metrics can be calculated
     */
    CLOSED = "closed"
}
/**
 * Defines the urgency levels for legal cases.
 * Priority affects case assignment, resource allocation, and attorney workload decisions.
 * Higher priority cases should receive more immediate attention and resources.
 *
 * @enum {string}
 *
 * @example
 * ```typescript
 * // Set high priority for time-sensitive matter
 * const urgentCase: Case = {
 *   ...caseData,
 *   priority: CasePriority.URGENT,
 *   title: 'Emergency Injunction Required'
 * };
 *
 * // Filter cases by priority
 * const urgentCases = cases.filter(c =>
 *   c.priority === CasePriority.URGENT ||
 *   c.priority === CasePriority.HIGH
 * );
 * ```
 */
export declare enum CasePriority {
    /**
     * Low priority cases with flexible deadlines.
     * Examples:
     * - Routine contract reviews
     * - General legal consultations
     * - Non-urgent documentation
     * Response time: Within 1-2 weeks
     */
    LOW = "low",
    /**
     * Standard priority for most legal matters.
     * Examples:
     * - Regular litigation matters
     * - Standard business transactions
     * - Typical client disputes
     * Response time: Within 3-5 business days
     */
    MEDIUM = "medium",
    /**
     * High priority cases requiring prompt attention.
     * Examples:
     * - Court deadlines approaching
     * - Time-sensitive negotiations
     * - Important client matters
     * Response time: Within 24-48 hours
     */
    HIGH = "high",
    /**
     * Critical cases requiring immediate action.
     * Examples:
     * - Emergency injunctions
     * - Same-day court filings
     * - Crisis management situations
     * Response time: Immediate (same day)
     */
    URGENT = "urgent"
}
/**
 * Represents the final outcome of a legal case.
 * Used for performance tracking, success rate calculations, and historical reporting.
 * Set when a case transitions to CLOSED status.
 *
 * @enum {string}
 *
 * @example
 * ```typescript
 * // Close a case with successful outcome
 * await caseService.closeCase(context, caseId, {
 *   result: CaseResult.WIN,
 *   resultNotes: 'Jury verdict in favor of client. Awarded $50,000 in damages.'
 * });
 *
 * // Calculate firm success rate
 * const wins = cases.filter(c => c.result === CaseResult.WIN).length;
 * const settlements = cases.filter(c => c.result === CaseResult.SETTLEMENT).length;
 * const successRate = (wins + settlements) / totalCases * 100;
 * ```
 *
 * @see {@link Case.result} - Where this enum is used
 * @see {@link Case.resultNotes} - Additional context for the outcome
 */
export declare enum CaseResult {
    /**
     * Case resolved in favor of the client.
     * Examples:
     * - Favorable court verdict
     * - Successful arbitration
     * - Contract negotiation achieved all client objectives
     * - Opposing party conceded
     */
    WIN = "win",
    /**
     * Case resolved against the client.
     * Examples:
     * - Unfavorable court verdict
     * - Lost arbitration
     * - Failed to achieve client objectives
     * Note: Should include lessons learned in resultNotes
     */
    LOSS = "loss",
    /**
     * Case resolved through negotiated agreement.
     * Examples:
     * - Out-of-court settlement
     * - Mediated resolution
     * - Compromise agreement reached
     * Note: Settlement terms should be documented in resultNotes
     */
    SETTLEMENT = "settlement",
    /**
     * Case dismissed by court or arbitrator.
     * Examples:
     * - Dismissed for lack of standing
     * - Dismissed on procedural grounds
     * - Statute of limitations expired
     * Note: Dismissal reason should be in resultNotes
     */
    DISMISSED = "dismissed",
    /**
     * Client voluntarily ended the case.
     * Examples:
     * - Client chose not to pursue
     * - Business reasons for withdrawal
     * - Change in client circumstances
     * Note: Withdrawal reason should be documented
     */
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