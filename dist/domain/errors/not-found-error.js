"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = void 0;
const base_error_1 = require("./base-error");
/**
 * Error class for resource not found scenarios
 */
class NotFoundError extends base_error_1.BaseError {
    constructor(message, errorCode, resourceType, context) {
        super(message, errorCode, context);
        this.resourceType = resourceType;
        this.resourceId = context?.resourceId;
        this.searchCriteria = context?.searchCriteria;
    }
    getClientMessage() {
        switch (this.errorCode) {
            case base_error_1.ErrorCode.NF_ENTITY_NOT_FOUND:
                return `${this.resourceType} not found.`;
            case base_error_1.ErrorCode.NF_USER_NOT_FOUND:
                return 'User not found.';
            case base_error_1.ErrorCode.NF_CHANNEL_NOT_FOUND:
                return 'Channel not found or inaccessible.';
            case base_error_1.ErrorCode.NF_ROLE_NOT_FOUND:
                return 'Role not found in this server.';
            case base_error_1.ErrorCode.NF_GUILD_NOT_FOUND:
                return 'Server not found or bot not added to server.';
            default:
                return `The requested ${this.resourceType.toLowerCase()} could not be found.`;
        }
    }
    /**
     * Creates a not found error with search context
     */
    static createWithSearchContext(resourceType, searchCriteria, context) {
        const criteriaStr = Object.entries(searchCriteria)
            .map(([key, value]) => `${key}=${value}`)
            .join(', ');
        const message = `${resourceType} not found with criteria: ${criteriaStr}`;
        return new NotFoundError(message, base_error_1.ErrorCode.NF_ENTITY_NOT_FOUND, resourceType, {
            ...context,
            searchCriteria
        });
    }
}
exports.NotFoundError = NotFoundError;
//# sourceMappingURL=not-found-error.js.map