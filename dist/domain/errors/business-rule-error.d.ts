import { BaseError, ErrorContext, ErrorCode } from './base-error';
/**
 * Error class for business rule violations
 */
export declare class BusinessRuleError extends BaseError {
    readonly rule: string;
    readonly currentValue?: any;
    readonly allowedValue?: any;
    constructor(message: string, errorCode: ErrorCode, rule: string, context?: Partial<BusinessRuleContext>);
    protected getClientMessage(): string;
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
//# sourceMappingURL=business-rule-error.d.ts.map