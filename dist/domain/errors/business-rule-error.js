"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessRuleError = void 0;
const base_error_1 = require("./base-error");
/**
 * Error class for business rule violations
 */
class BusinessRuleError extends base_error_1.BaseError {
    constructor(message, errorCode, rule, context) {
        super(message, errorCode, context);
        this.rule = rule;
        this.currentValue = context?.currentValue;
        this.allowedValue = context?.allowedValue;
    }
    getClientMessage() {
        // Provide user-friendly messages based on error code
        switch (this.errorCode) {
            case base_error_1.ErrorCode.BR_STAFF_LIMIT_EXCEEDED:
                return `Cannot hire more staff for this role. Maximum limit reached.`;
            case base_error_1.ErrorCode.BR_ROLE_HIERARCHY_VIOLATION:
                return `This action violates the role hierarchy rules.`;
            case base_error_1.ErrorCode.BR_CASE_ASSIGNMENT_INVALID:
                return `Cannot assign this case. The selected staff member is not eligible.`;
            case base_error_1.ErrorCode.BR_JOB_CAPACITY_EXCEEDED:
                return `This job has reached its maximum capacity.`;
            case base_error_1.ErrorCode.BR_PROMOTION_NOT_ALLOWED:
                return `Promotion is not allowed. Check role requirements and limits.`;
            case base_error_1.ErrorCode.BR_MULTIPLE_ROLES_EXCEEDED:
                return `User cannot have more than 2 staff roles.`;
            default:
                return `Business rule violation: ${this.rule}`;
        }
    }
}
exports.BusinessRuleError = BusinessRuleError;
//# sourceMappingURL=business-rule-error.js.map