import { BaseError, ErrorContext, ErrorCode } from './base-error';

/**
 * Error class for business rule violations
 */
export class BusinessRuleError extends BaseError {
  public readonly rule: string;
  public readonly currentValue?: any;
  public readonly allowedValue?: any;

  constructor(
    message: string,
    errorCode: ErrorCode,
    rule: string,
    context?: Partial<BusinessRuleContext>
  ) {
    super(message, errorCode as string, context);
    this.rule = rule;
    this.currentValue = context?.currentValue;
    this.allowedValue = context?.allowedValue;
  }

  protected getClientMessage(): string {
    // Provide user-friendly messages based on error code
    switch (this.errorCode) {
      case ErrorCode.BR_STAFF_LIMIT_EXCEEDED:
        return `Cannot hire more staff for this role. Maximum limit reached.`;
      case ErrorCode.BR_ROLE_HIERARCHY_VIOLATION:
        return `This action violates the role hierarchy rules.`;
      case ErrorCode.BR_CASE_ASSIGNMENT_INVALID:
        return `Cannot assign this case. The selected staff member is not eligible.`;
      case ErrorCode.BR_JOB_CAPACITY_EXCEEDED:
        return `This job has reached its maximum capacity.`;
      case ErrorCode.BR_PROMOTION_NOT_ALLOWED:
        return `Promotion is not allowed. Check role requirements and limits.`;
      case ErrorCode.BR_MULTIPLE_ROLES_EXCEEDED:
        return `User cannot have more than 2 staff roles.`;
      default:
        return `Business rule violation: ${this.rule}`;
    }
  }
}

/**
 * Extended context for business rule errors
 */
export interface BusinessRuleContext extends ErrorContext {
  rule?: string;
  currentValue?: any;
  allowedValue?: any;
  affectedEntity?: string;
}