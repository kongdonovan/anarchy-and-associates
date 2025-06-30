import { BaseError, ErrorContext, ErrorCode } from './base-error';
/**
 * Error class for permission-related failures
 */
export declare class PermissionError extends BaseError {
    readonly requiredPermission?: string;
    readonly action?: string;
    readonly resource?: string;
    constructor(message: string, errorCode: ErrorCode, context?: Partial<PermissionErrorContext>);
    protected getClientMessage(): string;
    /**
     * Creates a permission error with detailed context for audit logging
     */
    static createWithAuditContext(action: string, resource: string, requiredPermission: string, context: Partial<ErrorContext>): PermissionError;
}
/**
 * Extended context for permission errors
 */
export interface PermissionErrorContext extends ErrorContext {
    requiredPermission?: string;
    userPermissions?: string[];
    action?: string;
    resource?: string;
    resourceId?: string;
}
//# sourceMappingURL=permission-error.d.ts.map