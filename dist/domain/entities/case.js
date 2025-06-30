"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseResult = exports.CasePriority = exports.CaseStatus = void 0;
exports.generateCaseNumber = generateCaseNumber;
exports.parseCaseNumber = parseCaseNumber;
exports.generateChannelName = generateChannelName;
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
var CaseStatus;
(function (CaseStatus) {
    /**
     * Initial state when a case review is requested.
     * The case is awaiting acceptance by an attorney.
     * In this state:
     * - No attorneys are assigned yet
     * - No Discord channel has been created
     * - Client is waiting for their case to be reviewed
     */
    CaseStatus["PENDING"] = "pending";
    /**
     * Case has been accepted and is actively being worked on.
     * In this state:
     * - At least one attorney is assigned
     * - A dedicated Discord channel has been created
     * - Client and attorneys can communicate about the case
     * - Documents and notes can be added
     */
    CaseStatus["IN_PROGRESS"] = "in-progress";
    /**
     * Case has been completed and closed.
     * In this state:
     * - No further work is being done
     * - Result and resultNotes should be populated
     * - Case channel may be archived
     * - Performance metrics can be calculated
     */
    CaseStatus["CLOSED"] = "closed";
})(CaseStatus || (exports.CaseStatus = CaseStatus = {}));
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
var CasePriority;
(function (CasePriority) {
    /**
     * Low priority cases with flexible deadlines.
     * Examples:
     * - Routine contract reviews
     * - General legal consultations
     * - Non-urgent documentation
     * Response time: Within 1-2 weeks
     */
    CasePriority["LOW"] = "low";
    /**
     * Standard priority for most legal matters.
     * Examples:
     * - Regular litigation matters
     * - Standard business transactions
     * - Typical client disputes
     * Response time: Within 3-5 business days
     */
    CasePriority["MEDIUM"] = "medium";
    /**
     * High priority cases requiring prompt attention.
     * Examples:
     * - Court deadlines approaching
     * - Time-sensitive negotiations
     * - Important client matters
     * Response time: Within 24-48 hours
     */
    CasePriority["HIGH"] = "high";
    /**
     * Critical cases requiring immediate action.
     * Examples:
     * - Emergency injunctions
     * - Same-day court filings
     * - Crisis management situations
     * Response time: Immediate (same day)
     */
    CasePriority["URGENT"] = "urgent";
})(CasePriority || (exports.CasePriority = CasePriority = {}));
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
var CaseResult;
(function (CaseResult) {
    /**
     * Case resolved in favor of the client.
     * Examples:
     * - Favorable court verdict
     * - Successful arbitration
     * - Contract negotiation achieved all client objectives
     * - Opposing party conceded
     */
    CaseResult["WIN"] = "win";
    /**
     * Case resolved against the client.
     * Examples:
     * - Unfavorable court verdict
     * - Lost arbitration
     * - Failed to achieve client objectives
     * Note: Should include lessons learned in resultNotes
     */
    CaseResult["LOSS"] = "loss";
    /**
     * Case resolved through negotiated agreement.
     * Examples:
     * - Out-of-court settlement
     * - Mediated resolution
     * - Compromise agreement reached
     * Note: Settlement terms should be documented in resultNotes
     */
    CaseResult["SETTLEMENT"] = "settlement";
    /**
     * Case dismissed by court or arbitrator.
     * Examples:
     * - Dismissed for lack of standing
     * - Dismissed on procedural grounds
     * - Statute of limitations expired
     * Note: Dismissal reason should be in resultNotes
     */
    CaseResult["DISMISSED"] = "dismissed";
    /**
     * Client voluntarily ended the case.
     * Examples:
     * - Client chose not to pursue
     * - Business reasons for withdrawal
     * - Change in client circumstances
     * Note: Withdrawal reason should be documented
     */
    CaseResult["WITHDRAWN"] = "withdrawn";
})(CaseResult || (exports.CaseResult = CaseResult = {}));
// Helper function to generate case number
function generateCaseNumber(year, count, username) {
    const paddedCount = count.toString().padStart(4, '0');
    return `${year}-${paddedCount}-${username}`;
}
// Helper function to parse case number
function parseCaseNumber(caseNumber) {
    const match = caseNumber.match(/^(\d{4})-(\d{4})-(.+)$/);
    if (!match)
        return null;
    return {
        year: parseInt(match[1] || '0'),
        count: parseInt(match[2] || '0'),
        username: match[3] || ''
    };
}
// Helper function to generate channel name from case number
function generateChannelName(caseNumber) {
    const channelName = `case-${caseNumber}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    // Discord channel names have a 100 character limit
    return channelName.length > 100 ? channelName.substring(0, 100) : channelName;
}
//# sourceMappingURL=case.js.map