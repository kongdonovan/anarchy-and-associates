"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseResult = exports.CasePriority = exports.CaseStatus = void 0;
exports.generateCaseNumber = generateCaseNumber;
exports.parseCaseNumber = parseCaseNumber;
exports.generateChannelName = generateChannelName;
var CaseStatus;
(function (CaseStatus) {
    CaseStatus["PENDING"] = "pending";
    CaseStatus["OPEN"] = "open";
    CaseStatus["IN_PROGRESS"] = "in-progress";
    CaseStatus["CLOSED"] = "closed"; // Case has been completed
})(CaseStatus || (exports.CaseStatus = CaseStatus = {}));
var CasePriority;
(function (CasePriority) {
    CasePriority["LOW"] = "low";
    CasePriority["MEDIUM"] = "medium";
    CasePriority["HIGH"] = "high";
    CasePriority["URGENT"] = "urgent";
})(CasePriority || (exports.CasePriority = CasePriority = {}));
var CaseResult;
(function (CaseResult) {
    CaseResult["WIN"] = "win";
    CaseResult["LOSS"] = "loss";
    CaseResult["SETTLEMENT"] = "settlement";
    CaseResult["DISMISSED"] = "dismissed";
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