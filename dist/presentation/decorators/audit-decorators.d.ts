import { CommandInteraction } from 'discord.js';
import { AuditAction } from '../../domain/entities/audit-log';
import { EnhancedErrorContext } from '../../application/services/error-context-service';
import { PermissionContext } from '../../application/services/permission-service';
/**
 * STANDARDIZED AUDIT LOG FORMAT (v1.0)
 * =====================================
 *
 * This module implements a standardized audit log format that ensures complete compatibility
 * with the existing AuditLog entity and AuditLogRepository. All decorator-generated audit logs
 * follow this consistent structure:
 *
 * ## Required Fields:
 * - guildId: string - Discord guild identifier
 * - action: AuditAction - Standardized action enum value
 * - actorId: string - User who performed the action
 * - timestamp: Date - When the action occurred
 *
 * ## Optional Fields:
 * - targetId?: string - User affected by the action (if applicable)
 * - channelId?: string - Discord channel where action occurred
 * - severity?: 'low' | 'medium' | 'high' | 'critical' - Action severity level
 * - isGuildOwnerBypass?: boolean - Whether action bypassed restrictions via guild owner
 * - businessRulesBypassed?: string[] - List of business rules that were bypassed
 *
 * ## Standardized Metadata Structure:
 * ```typescript
 * details: {
 *   metadata: {
 *     // Core command information
 *     command: {
 *       name: string,
 *       correlationId: string,
 *       operationId: string,
 *       executionTime: number
 *     },
 *
 *     // Permission context
 *     permissions: {
 *       userRoles: string[],
 *       isGuildOwner: boolean,
 *       roleCount: number
 *     },
 *
 *     // System context
 *     system: {
 *       auditVersion: '1.0',
 *       success: boolean,
 *       timestamp: string
 *     },
 *
 *     // Custom metadata from command-specific extractors
 *     custom: Record<string, any>,
 *
 *     // Optional sections based on context
 *     interaction?: object,  // Discord interaction metadata
 *     error?: object,        // Error details if action failed
 *     result?: object        // Result summary if action succeeded
 *   },
 *
 *   // Command-specific before/after state (from extractDetails)
 *   before?: Record<string, any>,
 *   after?: Record<string, any>,
 *   reason?: string
 * }
 * ```
 *
 * ## Compatibility Guarantees:
 * - All existing AuditLogRepository methods work with decorator-generated logs
 * - Queries by action, actor, target, date range are fully supported
 * - Business rule bypass tracking is preserved
 * - Guild owner bypass detection works correctly
 * - Statistics and aggregation queries function properly
 *
 * ## Usage Examples:
 * ```typescript
 * // Simple command audit
 * @AuditLog({ action: AuditAction.STAFF_LIST_VIEWED })
 * async listStaff(interaction: CommandInteraction) { ... }
 *
 * // Complex command with target and metadata extraction
 * @AuditLog({
 *   action: AuditAction.STAFF_HIRED,
 *   extractTarget: (args, interaction) => interaction.options.getUser('user')?.id,
 *   extractMetadata: (args, interaction) => ({
 *     role: interaction.options.getString('role'),
 *     reason: interaction.options.getString('reason')
 *   }),
 *   severity: 'high'
 * })
 * async hireStaff(interaction: CommandInteraction) { ... }
 * ```
 */
/**
 * Configuration options for the @AuditLog decorator
 */
export interface AuditLogConfig {
    action: AuditAction;
    extractTarget?: (args: any[], interaction: CommandInteraction) => string | undefined;
    extractMetadata?: (args: any[], interaction: CommandInteraction, result?: any, error?: Error) => Record<string, any>;
    extractDetails?: (args: any[], interaction: CommandInteraction, result?: any, error?: Error) => {
        before?: Record<string, any>;
        after?: Record<string, any>;
        reason?: string;
    };
    severity?: 'low' | 'medium' | 'high' | 'critical';
    skipOnError?: boolean;
    requiresTarget?: boolean;
}
/**
 * Audit context information extracted from Discord interaction
 */
export interface AuditContext {
    guildId: string;
    actorId: string;
    targetId?: string;
    channelId?: string;
    commandName: string;
    args: any[];
    timestamp: Date;
    enhanced: EnhancedErrorContext;
    permissions: PermissionContext;
}
/**
 * Service for handling audit context extraction and log creation
 */
export declare class AuditContextService {
    private static auditLogRepository;
    /**
     * Extracts audit context from Discord interaction and command arguments
     */
    static extractAuditContext(interaction: CommandInteraction, args: any[]): Promise<AuditContext>;
    /**
     * Extracts permission context from Discord interaction
     */
    private static extractPermissionContext;
    /**
     * Extracts comprehensive command metadata from Discord interaction
     */
    static extractCommandMetadata(interaction: CommandInteraction): Record<string, any>;
    /**
     * Enriches audit context with additional Discord context details
     */
    static enrichAuditContext(context: AuditContext, additionalMetadata?: Record<string, any>): AuditContext;
    /**
     * Creates and logs an audit entry using standardized format
     */
    static logAuditEntry(context: AuditContext, config: AuditLogConfig, result?: any, error?: Error): Promise<void>;
    /**
     * Creates a standardized audit log entry with consistent format
     */
    private static createStandardizedAuditEntry;
    /**
     * Extracts business rules that may have been bypassed based on action and metadata
     */
    private static extractBusinessRulesBypassed;
}
/**
 * @AuditLog decorator for automatic audit logging of Discord commands
 *
 * @param config - Configuration specifying how to extract audit information
 *
 * @example
 * ```typescript
 * @AuditLog({
 *   action: AuditAction.STAFF_HIRED,
 *   extractTarget: (args, interaction) => interaction.options.getUser('user')?.id,
 *   extractMetadata: (args, interaction, result) => ({
 *     role: interaction.options.getString('role'),
 *     robloxUsername: interaction.options.getString('roblox_username')
 *   })
 * })
 * async hireStaff(interaction: CommandInteraction): Promise<void> {
 *   // Command implementation
 * }
 * ```
 */
export declare function AuditLog(config: AuditLogConfig): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Pre-configured audit decorators for common command types
 */
export declare class AuditDecorators {
    /**
     * Audit decorator for staff hiring commands
     */
    static StaffHired(): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Audit decorator for staff firing commands
     */
    static StaffFired(): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Audit decorator for staff promotion commands
     */
    static StaffPromoted(): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Audit decorator for staff demotion commands
     */
    static StaffDemoted(): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Audit decorator for staff info viewing commands
     */
    static StaffInfoViewed(): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Audit decorator for staff list viewing commands
     */
    static StaffListViewed(): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Generic audit decorator for case creation
     */
    static CaseCreated(): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Generic audit decorator for case assignment
     */
    static CaseAssigned(): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Generic audit decorator for administrative actions
     */
    static AdminAction(action: AuditAction, severity?: 'low' | 'medium' | 'high' | 'critical'): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
}
//# sourceMappingURL=audit-decorators.d.ts.map