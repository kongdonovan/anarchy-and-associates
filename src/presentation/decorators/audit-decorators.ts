import { CommandInteraction } from 'discord.js';
import { AuditAction, AuditLog as AuditLogEntity } from '../../domain/entities/audit-log';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { ErrorContextService, EnhancedErrorContext } from '../../application/services/error-context-service';
import { PermissionContext } from '../../application/services/permission-service';
import { logger } from '../../infrastructure/logger';

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
  skipOnError?: boolean; // Whether to skip audit logging if the command fails
  requiresTarget?: boolean; // Whether this action requires a target user
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
export class AuditContextService {
  private static auditLogRepository = new AuditLogRepository();

  /**
   * Extracts audit context from Discord interaction and command arguments
   */
  public static async extractAuditContext(
    interaction: CommandInteraction,
    args: any[]
  ): Promise<AuditContext> {
    const enhanced = await ErrorContextService.createFromInteraction(
      interaction,
      `audit.${interaction.commandName}`
    );

    // Extract permission context
    const permissions = this.extractPermissionContext(interaction);
    
    // Extract comprehensive command metadata
    const commandMetadata = this.extractCommandMetadata(interaction);

    // Create enriched context
    const baseContext: AuditContext = {
      guildId: interaction.guildId!,
      actorId: interaction.user.id,
      channelId: interaction.channelId,
      commandName: interaction.commandName,
      args,
      timestamp: new Date(),
      enhanced,
      permissions
    };

    // Return enriched context with command metadata
    return this.enrichAuditContext(baseContext, { commandMetadata });
  }

  /**
   * Extracts permission context from Discord interaction
   */
  private static extractPermissionContext(interaction: CommandInteraction): PermissionContext {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    
    return {
      guildId: interaction.guildId!,
      userId: interaction.user.id,
      userRoles: member?.roles.cache.map(role => role.id) || [],
      isGuildOwner: interaction.guild?.ownerId === interaction.user.id,
    };
  }

  /**
   * Extracts comprehensive command metadata from Discord interaction
   */
  public static extractCommandMetadata(interaction: CommandInteraction): Record<string, any> {
    const metadata: Record<string, any> = {
      commandName: interaction.commandName,
      interactionId: interaction.id,
      interactionType: interaction.type,
      createdTimestamp: interaction.createdTimestamp,
      locale: interaction.locale,
      guildLocale: interaction.guildLocale
    };

    // Extract options if available
    const options = (interaction as any).options;
    if (options) {
      try {
        // Get subcommand if present
        metadata.subcommand = options.getSubcommand?.(false);
        metadata.subcommandGroup = options.getSubcommandGroup?.(false);
        
        // Extract option values (sanitized)
        if (options.data) {
          metadata.optionCount = options.data.length;
          metadata.optionNames = options.data.map((opt: any) => opt.name);
        }
      } catch (error) {
        // Ignore extraction errors for metadata
        logger.debug('Failed to extract command options metadata:', error);
      }
    }

    return metadata;
  }

  /**
   * Enriches audit context with additional Discord context details
   */
  public static enrichAuditContext(
    context: AuditContext, 
    additionalMetadata?: Record<string, any>
  ): AuditContext {
    return {
      ...context,
      enhanced: {
        ...context.enhanced,
        metadata: {
          ...context.enhanced.metadata,
          ...additionalMetadata,
          enrichedAt: Date.now(),
          auditVersion: '1.0'
        }
      }
    };
  }

  /**
   * Creates and logs an audit entry using standardized format
   */
  public static async logAuditEntry(
    context: AuditContext,
    config: AuditLogConfig,
    result?: any,
    error?: Error
  ): Promise<void> {
    try {
      // Get interaction from context
      const interaction = context.args.find(arg => 
        arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
      ) as CommandInteraction;

      // Extract target ID if extractor provided
      const targetId = config.extractTarget 
        ? config.extractTarget(context.args, interaction)
        : context.targetId;

      // Extract metadata using config extractors
      const extractedMetadata = config.extractMetadata
        ? config.extractMetadata(context.args, interaction, result, error)
        : {};

      // Extract before/after details using config extractors
      const extractedDetails = config.extractDetails
        ? config.extractDetails(context.args, interaction, result, error)
        : {};

      // Create standardized audit log entry
      const auditEntry = this.createStandardizedAuditEntry({
        guildId: context.guildId,
        action: config.action,
        actorId: context.actorId,
        targetId,
        extractedMetadata,
        extractedDetails,
        context,
        error,
        result,
        severity: config.severity || 'medium'
      });

      // Log the audit entry
      await this.auditLogRepository.logAction(auditEntry);

      logger.debug(`Audit logged for ${config.action}`, {
        guildId: context.guildId,
        actorId: context.actorId,
        targetId,
        correlationId: context.enhanced.correlationId,
        success: !error
      });

    } catch (auditError) {
      // Never let audit logging failure break the original command
      logger.error('Failed to log audit entry:', {
        error: auditError,
        originalAction: config.action,
        guildId: context.guildId,
        actorId: context.actorId,
        correlationId: context.enhanced.correlationId
      });
    }
  }

  /**
   * Creates a standardized audit log entry with consistent format
   */
  private static createStandardizedAuditEntry(params: {
    guildId: string;
    action: AuditAction;
    actorId: string;
    targetId?: string;
    extractedMetadata: Record<string, any>;
    extractedDetails: any;
    context: AuditContext;
    error?: Error;
    result?: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Omit<AuditLogEntity, '_id' | 'createdAt' | 'updatedAt'> {
    
    // Organize metadata into standardized structure
    const standardizedMetadata = {
      // Core command information
      command: {
        name: params.context.commandName,
        correlationId: params.context.enhanced.correlationId,
        operationId: params.context.enhanced.operationId,
        executionTime: Date.now() - params.context.timestamp.getTime()
      },
      
      // Permission context
      permissions: {
        userRoles: params.context.permissions.userRoles,
        isGuildOwner: params.context.permissions.isGuildOwner,
        roleCount: params.context.permissions.userRoles.length
      },
      
      // System context
      system: {
        auditVersion: '1.0',
        success: !params.error,
        timestamp: params.context.timestamp.toISOString()
      },
      
      // Custom metadata from extractors
      custom: params.extractedMetadata,
      
      // Command metadata if available
      ...(params.context.enhanced.metadata?.commandMetadata && {
        interaction: params.context.enhanced.metadata.commandMetadata
      }),
      
      // Error details if present
      ...(params.error && {
        error: {
          name: params.error.name,
          message: params.error.message,
          code: (params.error as any).code || 'UNKNOWN'
        }
      }),

      // Result summary if present
      ...(params.result && {
        result: {
          type: typeof params.result,
          hasValue: params.result !== null && params.result !== undefined
        }
      })
    };

    // Create the standardized audit entry
    return {
      guildId: params.guildId,
      action: params.action,
      actorId: params.actorId,
      targetId: params.targetId,
      details: {
        ...params.extractedDetails,
        metadata: standardizedMetadata
      },
      timestamp: params.context.timestamp,
      channelId: params.context.channelId,
      severity: params.severity,
      // Standard optional fields for compatibility
      isGuildOwnerBypass: params.context.permissions.isGuildOwner && params.severity === 'high',
      businessRulesBypassed: this.extractBusinessRulesBypassed(params.action, params.extractedMetadata)
    };
  }

  /**
   * Extracts business rules that may have been bypassed based on action and metadata
   */
  private static extractBusinessRulesBypassed(
    action: AuditAction, 
    metadata: Record<string, any>
  ): string[] | undefined {
    const bypassed: string[] = [];
    
    // Map specific actions to potential business rule bypasses
    if (action === AuditAction.STAFF_HIRED && metadata.bypassRoleLimit) {
      bypassed.push('role-limit');
    }
    
    if (action === AuditAction.STAFF_PROMOTED && metadata.bypassHierarchy) {
      bypassed.push('promotion-hierarchy');
    }

    if (metadata.bypassedRules && Array.isArray(metadata.bypassedRules)) {
      bypassed.push(...metadata.bypassedRules);
    }
    
    return bypassed.length > 0 ? bypassed : undefined;
  }
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
export function AuditLog(config: AuditLogConfig) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let auditContext: AuditContext | undefined;
      let result: any;
      let error: Error | undefined;

      try {
        // Find the CommandInteraction parameter
        const interaction = args.find(arg => 
          arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg
        ) as CommandInteraction;

        if (!interaction) {
          logger.warn(`@AuditLog decorator: No CommandInteraction found in ${_propertyName}`);
          return await originalMethod.apply(this, args);
        }

        if (!interaction.guildId) {
          logger.warn(`@AuditLog decorator: No guild ID found in ${_propertyName}`);
          return await originalMethod.apply(this, args);
        }

        // Extract audit context
        auditContext = await AuditContextService.extractAuditContext(interaction, args);

        // Execute the original method
        result = await originalMethod.apply(this, args);

        // Log successful execution
        if (!config.skipOnError) {
          await AuditContextService.logAuditEntry(auditContext, config, result);
        }

        return result;

      } catch (err) {
        error = err as Error;
        
        // Log failed execution (unless configured to skip)
        if (auditContext && !config.skipOnError) {
          await AuditContextService.logAuditEntry(auditContext, config, undefined, error);
        }

        // Re-throw the original error
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Pre-configured audit decorators for common command types
 */
export class AuditDecorators {
  /**
   * Audit decorator for staff hiring commands
   */
  public static StaffHired() {
    return AuditLog({
      action: AuditAction.STAFF_HIRED,
      extractTarget: (_args, interaction) => {
        const user = (interaction as any).options?.getUser('user');
        return user?.id;
      },
      extractMetadata: (_args, interaction, _result, error) => ({
        role: (interaction as any).options?.getString('role'),
        robloxUsername: (interaction as any).options?.getString('roblox_username'),
        reason: (interaction as any).options?.getString('reason'),
        success: !error
      }),
      extractDetails: (_args, interaction) => ({
        after: {
          role: (interaction as any).options?.getString('role'),
          status: 'active'
        },
        reason: (interaction as any).options?.getString('reason')
      }),
      severity: 'high',
      requiresTarget: true
    });
  }

  /**
   * Audit decorator for staff firing commands
   */
  public static StaffFired() {
    return AuditLog({
      action: AuditAction.STAFF_FIRED,
      extractTarget: (_args, interaction) => {
        const user = (interaction as any).options?.getUser('user');
        return user?.id;
      },
      extractMetadata: (_args, interaction, _result, error) => ({
        reason: (interaction as any).options?.getString('reason'),
        success: !error
      }),
      extractDetails: (_args, interaction) => ({
        after: {
          status: 'terminated'
        },
        reason: (interaction as any).options?.getString('reason')
      }),
      severity: 'high',
      requiresTarget: true
    });
  }

  /**
   * Audit decorator for staff promotion commands
   */
  public static StaffPromoted() {
    return AuditLog({
      action: AuditAction.STAFF_PROMOTED,
      extractTarget: (_args, interaction) => {
        const user = (interaction as any).options?.getUser('user');
        return user?.id;
      },
      extractMetadata: (_args, interaction, _result, error) => ({
        newRole: (interaction as any).options?.getString('role'),
        reason: (interaction as any).options?.getString('reason'),
        success: !error
      }),
      extractDetails: (_args, interaction) => ({
        after: {
          role: (interaction as any).options?.getString('role')
        },
        reason: (interaction as any).options?.getString('reason')
      }),
      severity: 'high',
      requiresTarget: true
    });
  }

  /**
   * Audit decorator for staff demotion commands
   */
  public static StaffDemoted() {
    return AuditLog({
      action: AuditAction.STAFF_DEMOTED,
      extractTarget: (_args, interaction) => {
        const user = (interaction as any).options?.getUser('user');
        return user?.id;
      },
      extractMetadata: (_args, interaction, _result, error) => ({
        newRole: (interaction as any).options?.getString('role'),
        reason: (interaction as any).options?.getString('reason'),
        success: !error
      }),
      extractDetails: (_args, interaction) => ({
        after: {
          role: (interaction as any).options?.getString('role')
        },
        reason: (interaction as any).options?.getString('reason')
      }),
      severity: 'medium',
      requiresTarget: true
    });
  }

  /**
   * Audit decorator for staff info viewing commands
   */
  public static StaffInfoViewed() {
    return AuditLog({
      action: AuditAction.STAFF_INFO_VIEWED,
      extractTarget: (_args, interaction) => {
        const user = (interaction as any).options?.getUser('user');
        return user?.id;
      },
      extractMetadata: (_args, interaction) => ({
        targetUser: (interaction as any).options?.getUser('user')?.username
      }),
      severity: 'low'
    });
  }

  /**
   * Audit decorator for staff list viewing commands
   */
  public static StaffListViewed() {
    return AuditLog({
      action: AuditAction.STAFF_LIST_VIEWED,
      extractMetadata: (_args, interaction) => ({
        roleFilter: (interaction as any).options?.getString('role'),
        page: (interaction as any).options?.getInteger('page') || 1
      }),
      severity: 'low'
    });
  }

  /**
   * Generic audit decorator for case creation
   */
  public static CaseCreated() {
    return AuditLog({
      action: AuditAction.CASE_CREATED,
      extractMetadata: (_args, interaction, result) => ({
        caseTitle: (interaction as any).options?.getString('title'),
        priority: (interaction as any).options?.getString('priority'),
        caseNumber: result?.caseNumber
      }),
      extractDetails: (_args, interaction) => ({
        after: {
          title: (interaction as any).options?.getString('title'),
          priority: (interaction as any).options?.getString('priority'),
          status: 'pending'
        }
      }),
      severity: 'medium'
    });
  }

  /**
   * Generic audit decorator for case assignment
   */
  public static CaseAssigned() {
    return AuditLog({
      action: AuditAction.CASE_ASSIGNED,
      extractTarget: (_args, interaction) => {
        const assignee = (interaction as any).options?.getUser('assignee');
        return assignee?.id;
      },
      extractMetadata: (_args, interaction) => ({
        caseNumber: (interaction as any).options?.getString('case_number'),
        assigneeUsername: (interaction as any).options?.getUser('assignee')?.username
      }),
      severity: 'medium',
      requiresTarget: true
    });
  }

  /**
   * Generic audit decorator for administrative actions
   */
  public static AdminAction(action: AuditAction, severity: 'low' | 'medium' | 'high' | 'critical' = 'high') {
    return AuditLog({
      action,
      extractMetadata: (_args, interaction, _result, error) => ({
        subcommand: (interaction as any).options?.getSubcommand(false),
        options: (interaction as any).options?.data?.map((opt: any) => ({ 
          name: opt.name, 
          value: opt.value 
        })) || [],
        success: !error
      }),
      severity
    });
  }
}