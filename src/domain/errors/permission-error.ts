import { BaseError, ErrorContext, ErrorCode } from './base-error';

/**
 * Error class for permission-related failures
 */
export class PermissionError extends BaseError {
  public readonly requiredPermission?: string;
  public readonly action?: string;
  public readonly resource?: string;

  constructor(
    message: string,
    errorCode: ErrorCode,
    context?: Partial<PermissionErrorContext>
  ) {
    super(message, errorCode as string, context);
    this.requiredPermission = context?.requiredPermission;
    this.action = context?.action;
    this.resource = context?.resource;
  }

  protected getClientMessage(): string {
    switch (this.errorCode) {
      case ErrorCode.PERM_INSUFFICIENT_PERMISSIONS:
        return 'You do not have sufficient permissions to perform this action.';
      case ErrorCode.PERM_ACTION_NOT_ALLOWED:
        return this.action
          ? `You are not allowed to ${this.action}.`
          : 'This action is not allowed.';
      case ErrorCode.PERM_ROLE_REQUIRED:
        return this.requiredPermission
          ? `This action requires the '${this.requiredPermission}' permission.`
          : 'You need additional permissions for this action.';
      case ErrorCode.PERM_OWNER_ONLY:
        return 'This action can only be performed by the server owner.';
      default:
        return 'Permission denied.';
    }
  }

  /**
   * Creates a permission error with detailed context for audit logging
   */
  public static createWithAuditContext(
    action: string,
    resource: string,
    requiredPermission: string,
    context: Partial<ErrorContext>
  ): PermissionError {
    const message = `Permission denied: User lacks '${requiredPermission}' to ${action} ${resource}`;
    return new PermissionError(
      message,
      ErrorCode.PERM_INSUFFICIENT_PERMISSIONS,
      {
        ...context,
        action,
        resource,
        requiredPermission,
        metadata: {
          ...context.metadata,
          securityEvent: true,
          timestamp: new Date().toISOString()
        }
      }
    );
  }
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