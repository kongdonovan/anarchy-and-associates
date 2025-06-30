import { CommandInteraction } from 'discord.js';
import { ErrorContext } from '../../domain/errors/base-error';
/**
 * Enhanced error context with correlation tracking
 */
export interface EnhancedErrorContext extends ErrorContext {
    correlationId?: string;
    operationId?: string;
    sessionId?: string;
    parentOperationId?: string;
    operationStack?: string[];
    performanceMetrics?: OperationMetrics;
    discordContext?: DiscordContextDetails;
}
/**
 * Discord-specific context details
 */
export interface DiscordContextDetails {
    guildName?: string;
    channelName?: string;
    channelType?: string;
    memberRoles?: string[];
    memberNickname?: string;
    memberJoinedAt?: string;
    interactionType?: string;
    interactionId?: string;
    createdTimestamp?: number;
    permissions?: string[];
}
/**
 * Performance metrics for operations
 */
export interface OperationMetrics {
    startTime: number;
    duration?: number;
    memoryUsage?: NodeJS.MemoryUsage;
    operationType: string;
    resourcesAccessed?: string[];
}
/**
 * Service for collecting and managing error context
 */
export declare class ErrorContextService {
    private static readonly operationStack;
    private static readonly activeOperations;
    /**
     * Creates enhanced error context from Discord interaction
     */
    static createFromInteraction(interaction: CommandInteraction, operationType?: string): Promise<EnhancedErrorContext>;
    /**
     * Creates context for service operations
     */
    static createForService(serviceName: string, operationName: string, parentContext?: Partial<ErrorContext>): EnhancedErrorContext;
    /**
     * Creates context for database operations
     */
    static createForDatabase(operation: string, collection: string, query?: Record<string, any>, parentContext?: Partial<ErrorContext>): EnhancedErrorContext;
    /**
     * Starts tracking an operation
     */
    static startOperation(operationId: string, operationType: string): void;
    /**
     * Completes operation tracking
     */
    static completeOperation(operationId: string): OperationMetrics | undefined;
    /**
     * Adds resource access to current operation
     */
    static trackResourceAccess(operationId: string, resource: string): void;
    /**
     * Collects detailed Discord context
     */
    private static collectDiscordContext;
    /**
     * Gets current operation ID from stack
     */
    private static getCurrentOperation;
    /**
     * Generates correlation ID for request tracking
     */
    private static generateCorrelationId;
    /**
     * Generates operation ID
     */
    private static generateOperationId;
    /**
     * Gets session ID for user (simplified implementation)
     */
    private static getSessionId;
    /**
     * Sanitizes query for logging (removes sensitive data)
     */
    private static sanitizeQuery;
    /**
     * Creates error correlation chain
     */
    static createCorrelationChain(errors: Error[], rootContext: EnhancedErrorContext): ErrorCorrelation[];
    /**
     * Enriches existing context with additional details
     */
    static enrichContext(baseContext: Partial<ErrorContext>, additionalData: Record<string, any>): EnhancedErrorContext;
    /**
     * Creates breadcrumb trail for operation tracking
     */
    static createBreadcrumbTrail(context: EnhancedErrorContext): string[];
    /**
     * Cleans up orphaned operations (older than 5 minutes)
     */
    static cleanupOrphanedOperations(): void;
}
/**
 * Error correlation information
 */
export interface ErrorCorrelation {
    errorId: string;
    correlationId: string;
    operationId: string;
    errorName: string;
    errorMessage: string;
    timestamp: string;
    stackPosition: number;
    isRootCause: boolean;
}
//# sourceMappingURL=error-context-service.d.ts.map