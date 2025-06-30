import { BaseError, ErrorContext, ErrorCode } from './base-error';

/**
 * Error class for resource not found scenarios
 */
export class NotFoundError extends BaseError {
  public readonly resourceType: string;
  public readonly resourceId?: string;
  public readonly searchCriteria?: Record<string, any>;

  constructor(
    message: string,
    errorCode: ErrorCode,
    resourceType: string,
    context?: Partial<NotFoundErrorContext>
  ) {
    super(message, errorCode as string, context);
    this.resourceType = resourceType;
    this.resourceId = context?.resourceId;
    this.searchCriteria = context?.searchCriteria;
  }

  protected getClientMessage(): string {
    switch (this.errorCode) {
      case ErrorCode.NF_ENTITY_NOT_FOUND:
        return `${this.resourceType} not found.`;
      case ErrorCode.NF_USER_NOT_FOUND:
        return 'User not found.';
      case ErrorCode.NF_CHANNEL_NOT_FOUND:
        return 'Channel not found or inaccessible.';
      case ErrorCode.NF_ROLE_NOT_FOUND:
        return 'Role not found in this server.';
      case ErrorCode.NF_GUILD_NOT_FOUND:
        return 'Server not found or bot not added to server.';
      default:
        return `The requested ${this.resourceType.toLowerCase()} could not be found.`;
    }
  }

  /**
   * Creates a not found error with search context
   */
  public static createWithSearchContext(
    resourceType: string,
    searchCriteria: Record<string, any>,
    context?: Partial<ErrorContext>
  ): NotFoundError {
    const criteriaStr = Object.entries(searchCriteria)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
    
    const message = `${resourceType} not found with criteria: ${criteriaStr}`;
    
    return new NotFoundError(
      message,
      ErrorCode.NF_ENTITY_NOT_FOUND,
      resourceType,
      {
        ...context,
        searchCriteria
      }
    );
  }
}

/**
 * Extended context for not found errors
 */
export interface NotFoundErrorContext extends ErrorContext {
  resourceType?: string;
  resourceId?: string;
  searchCriteria?: Record<string, any>;
  alternativeResources?: string[];
}