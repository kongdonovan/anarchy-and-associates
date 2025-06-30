import { BaseError, ErrorContext, ErrorCode } from './base-error';
/**
 * Error class for resource not found scenarios
 */
export declare class NotFoundError extends BaseError {
    readonly resourceType: string;
    readonly resourceId?: string;
    readonly searchCriteria?: Record<string, any>;
    constructor(message: string, errorCode: ErrorCode, resourceType: string, context?: Partial<NotFoundErrorContext>);
    protected getClientMessage(): string;
    /**
     * Creates a not found error with search context
     */
    static createWithSearchContext(resourceType: string, searchCriteria: Record<string, any>, context?: Partial<ErrorContext>): NotFoundError;
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
//# sourceMappingURL=not-found-error.d.ts.map