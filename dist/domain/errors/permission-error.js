"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionError = void 0;
const base_error_1 = require("./base-error");
/**
 * Error class for permission-related failures
 */
class PermissionError extends base_error_1.BaseError {
    constructor(message, errorCode, context) {
        super(message, errorCode, context);
        this.requiredPermission = context?.requiredPermission;
        this.action = context?.action;
        this.resource = context?.resource;
    }
    getClientMessage() {
        switch (this.errorCode) {
            case base_error_1.ErrorCode.PERM_INSUFFICIENT_PERMISSIONS:
                return 'You do not have sufficient permissions to perform this action.';
            case base_error_1.ErrorCode.PERM_ACTION_NOT_ALLOWED:
                return this.action
                    ? `You are not allowed to ${this.action}.`
                    : 'This action is not allowed.';
            case base_error_1.ErrorCode.PERM_ROLE_REQUIRED:
                return this.requiredPermission
                    ? `This action requires the '${this.requiredPermission}' permission.`
                    : 'You need additional permissions for this action.';
            case base_error_1.ErrorCode.PERM_OWNER_ONLY:
                return 'This action can only be performed by the server owner.';
            default:
                return 'Permission denied.';
        }
    }
    /**
     * Creates a permission error with detailed context for audit logging
     */
    static createWithAuditContext(action, resource, requiredPermission, context) {
        const message = `Permission denied: User lacks '${requiredPermission}' to ${action} ${resource}`;
        return new PermissionError(message, base_error_1.ErrorCode.PERM_INSUFFICIENT_PERMISSIONS, {
            ...context,
            action,
            resource,
            requiredPermission,
            metadata: {
                ...context.metadata,
                securityEvent: true,
                timestamp: new Date().toISOString()
            }
        });
    }
}
exports.PermissionError = PermissionError;
//# sourceMappingURL=permission-error.js.map