"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditDecorators = exports.AuditContextService = void 0;
exports.AuditLog = AuditLog;
const audit_log_1 = require("../../domain/entities/audit-log");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const error_context_service_1 = require("../../application/services/error-context-service");
const logger_1 = require("../../infrastructure/logger");
/**
 * Service for handling audit context extraction and log creation
 */
class AuditContextService {
    /**
     * Extracts audit context from Discord interaction and command arguments
     */
    static async extractAuditContext(interaction, args) {
        const enhanced = await error_context_service_1.ErrorContextService.createFromInteraction(interaction, `audit.${interaction.commandName}`);
        // Extract permission context
        const permissions = this.extractPermissionContext(interaction);
        // Extract comprehensive command metadata
        const commandMetadata = this.extractCommandMetadata(interaction);
        // Create enriched context
        const baseContext = {
            guildId: interaction.guildId,
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
    static extractPermissionContext(interaction) {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        return {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            userRoles: member?.roles.cache.map(role => role.id) || [],
            isGuildOwner: interaction.guild?.ownerId === interaction.user.id,
        };
    }
    /**
     * Extracts comprehensive command metadata from Discord interaction
     */
    static extractCommandMetadata(interaction) {
        const metadata = {
            commandName: interaction.commandName,
            interactionId: interaction.id,
            interactionType: interaction.type,
            createdTimestamp: interaction.createdTimestamp,
            locale: interaction.locale,
            guildLocale: interaction.guildLocale
        };
        // Extract options if available
        const options = interaction.options;
        if (options) {
            try {
                // Get subcommand if present
                metadata.subcommand = options.getSubcommand?.(false);
                metadata.subcommandGroup = options.getSubcommandGroup?.(false);
                // Extract option values (sanitized)
                if (options.data) {
                    metadata.optionCount = options.data.length;
                    metadata.optionNames = options.data.map((opt) => opt.name);
                }
            }
            catch (error) {
                // Ignore extraction errors for metadata
                logger_1.logger.debug('Failed to extract command options metadata:', error);
            }
        }
        return metadata;
    }
    /**
     * Enriches audit context with additional Discord context details
     */
    static enrichAuditContext(context, additionalMetadata) {
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
    static async logAuditEntry(context, config, result, error) {
        try {
            // Get interaction from context
            const interaction = context.args.find(arg => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
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
            logger_1.logger.debug(`Audit logged for ${config.action}`, {
                guildId: context.guildId,
                actorId: context.actorId,
                targetId,
                correlationId: context.enhanced.correlationId,
                success: !error
            });
        }
        catch (auditError) {
            // Never let audit logging failure break the original command
            logger_1.logger.error('Failed to log audit entry:', {
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
    static createStandardizedAuditEntry(params) {
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
                    code: params.error.code || 'UNKNOWN'
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
    static extractBusinessRulesBypassed(action, metadata) {
        const bypassed = [];
        // Map specific actions to potential business rule bypasses
        if (action === audit_log_1.AuditAction.STAFF_HIRED && metadata.bypassRoleLimit) {
            bypassed.push('role-limit');
        }
        if (action === audit_log_1.AuditAction.STAFF_PROMOTED && metadata.bypassHierarchy) {
            bypassed.push('promotion-hierarchy');
        }
        if (metadata.bypassedRules && Array.isArray(metadata.bypassedRules)) {
            bypassed.push(...metadata.bypassedRules);
        }
        return bypassed.length > 0 ? bypassed : undefined;
    }
}
exports.AuditContextService = AuditContextService;
AuditContextService.auditLogRepository = new audit_log_repository_1.AuditLogRepository();
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
function AuditLog(config) {
    return function (_target, _propertyName, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            let auditContext;
            let result;
            let error;
            try {
                // Find the CommandInteraction parameter
                const interaction = args.find(arg => arg && typeof arg === 'object' && 'commandName' in arg && 'reply' in arg);
                if (!interaction) {
                    logger_1.logger.warn(`@AuditLog decorator: No CommandInteraction found in ${_propertyName}`);
                    return await originalMethod.apply(this, args);
                }
                if (!interaction.guildId) {
                    logger_1.logger.warn(`@AuditLog decorator: No guild ID found in ${_propertyName}`);
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
            }
            catch (err) {
                error = err;
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
class AuditDecorators {
    /**
     * Audit decorator for staff hiring commands
     */
    static StaffHired() {
        return AuditLog({
            action: audit_log_1.AuditAction.STAFF_HIRED,
            extractTarget: (_args, interaction) => {
                const user = interaction.options?.getUser('user');
                return user?.id;
            },
            extractMetadata: (_args, interaction, _result, error) => ({
                role: interaction.options?.getString('role'),
                robloxUsername: interaction.options?.getString('roblox_username'),
                reason: interaction.options?.getString('reason'),
                success: !error
            }),
            extractDetails: (_args, interaction) => ({
                after: {
                    role: interaction.options?.getString('role'),
                    status: 'active'
                },
                reason: interaction.options?.getString('reason')
            }),
            severity: 'high',
            requiresTarget: true
        });
    }
    /**
     * Audit decorator for staff firing commands
     */
    static StaffFired() {
        return AuditLog({
            action: audit_log_1.AuditAction.STAFF_FIRED,
            extractTarget: (_args, interaction) => {
                const user = interaction.options?.getUser('user');
                return user?.id;
            },
            extractMetadata: (_args, interaction, _result, error) => ({
                reason: interaction.options?.getString('reason'),
                success: !error
            }),
            extractDetails: (_args, interaction) => ({
                after: {
                    status: 'terminated'
                },
                reason: interaction.options?.getString('reason')
            }),
            severity: 'high',
            requiresTarget: true
        });
    }
    /**
     * Audit decorator for staff promotion commands
     */
    static StaffPromoted() {
        return AuditLog({
            action: audit_log_1.AuditAction.STAFF_PROMOTED,
            extractTarget: (_args, interaction) => {
                const user = interaction.options?.getUser('user');
                return user?.id;
            },
            extractMetadata: (_args, interaction, _result, error) => ({
                newRole: interaction.options?.getString('role'),
                reason: interaction.options?.getString('reason'),
                success: !error
            }),
            extractDetails: (_args, interaction) => ({
                after: {
                    role: interaction.options?.getString('role')
                },
                reason: interaction.options?.getString('reason')
            }),
            severity: 'high',
            requiresTarget: true
        });
    }
    /**
     * Audit decorator for staff demotion commands
     */
    static StaffDemoted() {
        return AuditLog({
            action: audit_log_1.AuditAction.STAFF_DEMOTED,
            extractTarget: (_args, interaction) => {
                const user = interaction.options?.getUser('user');
                return user?.id;
            },
            extractMetadata: (_args, interaction, _result, error) => ({
                newRole: interaction.options?.getString('role'),
                reason: interaction.options?.getString('reason'),
                success: !error
            }),
            extractDetails: (_args, interaction) => ({
                after: {
                    role: interaction.options?.getString('role')
                },
                reason: interaction.options?.getString('reason')
            }),
            severity: 'medium',
            requiresTarget: true
        });
    }
    /**
     * Audit decorator for staff info viewing commands
     */
    static StaffInfoViewed() {
        return AuditLog({
            action: audit_log_1.AuditAction.STAFF_INFO_VIEWED,
            extractTarget: (_args, interaction) => {
                const user = interaction.options?.getUser('user');
                return user?.id;
            },
            extractMetadata: (_args, interaction) => ({
                targetUser: interaction.options?.getUser('user')?.username
            }),
            severity: 'low'
        });
    }
    /**
     * Audit decorator for staff list viewing commands
     */
    static StaffListViewed() {
        return AuditLog({
            action: audit_log_1.AuditAction.STAFF_LIST_VIEWED,
            extractMetadata: (_args, interaction) => ({
                roleFilter: interaction.options?.getString('role'),
                page: interaction.options?.getInteger('page') || 1
            }),
            severity: 'low'
        });
    }
    /**
     * Generic audit decorator for case creation
     */
    static CaseCreated() {
        return AuditLog({
            action: audit_log_1.AuditAction.CASE_CREATED,
            extractMetadata: (_args, interaction, result) => ({
                caseTitle: interaction.options?.getString('title'),
                priority: interaction.options?.getString('priority'),
                caseNumber: result?.caseNumber
            }),
            extractDetails: (_args, interaction) => ({
                after: {
                    title: interaction.options?.getString('title'),
                    priority: interaction.options?.getString('priority'),
                    status: 'pending'
                }
            }),
            severity: 'medium'
        });
    }
    /**
     * Generic audit decorator for case assignment
     */
    static CaseAssigned() {
        return AuditLog({
            action: audit_log_1.AuditAction.CASE_ASSIGNED,
            extractTarget: (_args, interaction) => {
                const assignee = interaction.options?.getUser('assignee');
                return assignee?.id;
            },
            extractMetadata: (_args, interaction) => ({
                caseNumber: interaction.options?.getString('case_number'),
                assigneeUsername: interaction.options?.getUser('assignee')?.username
            }),
            severity: 'medium',
            requiresTarget: true
        });
    }
    /**
     * Generic audit decorator for administrative actions
     */
    static AdminAction(action, severity = 'high') {
        return AuditLog({
            action,
            extractMetadata: (_args, interaction, _result, error) => ({
                subcommand: interaction.options?.getSubcommand(false),
                options: interaction.options?.data?.map((opt) => ({
                    name: opt.name,
                    value: opt.value
                })) || [],
                success: !error
            }),
            severity
        });
    }
}
exports.AuditDecorators = AuditDecorators;
//# sourceMappingURL=audit-decorators.js.map