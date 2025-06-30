"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorContextService = void 0;
/**
 * Service for collecting and managing error context
 */
class ErrorContextService {
    /**
     * Creates enhanced error context from Discord interaction
     */
    static async createFromInteraction(interaction, operationType = 'discord_command') {
        const correlationId = this.generateCorrelationId();
        const operationId = this.generateOperationId();
        // Start tracking this operation
        this.startOperation(operationId, operationType);
        // Collect Discord context
        const discordContext = await this.collectDiscordContext(interaction);
        // Collect basic context
        const context = {
            guildId: interaction.guildId || undefined,
            userId: interaction.user.id,
            commandName: interaction.commandName,
            correlationId,
            operationId,
            sessionId: this.getSessionId(interaction.user.id),
            parentOperationId: this.getCurrentOperation(),
            operationStack: [...this.operationStack],
            performanceMetrics: this.activeOperations.get(operationId),
            discordContext,
            metadata: {
                timestamp: Date.now(),
                userAgent: 'discord-bot',
                environment: process.env.NODE_ENV || 'development'
            }
        };
        return context;
    }
    /**
     * Creates context for service operations
     */
    static createForService(serviceName, operationName, parentContext) {
        const correlationId = parentContext?.correlationId || parentContext?.metadata?.correlationId || this.generateCorrelationId();
        const operationId = this.generateOperationId();
        const operationType = `${serviceName}.${operationName}`;
        // Start tracking this operation
        this.startOperation(operationId, operationType);
        return {
            ...parentContext,
            correlationId,
            operationId,
            parentOperationId: this.getCurrentOperation(),
            operationStack: [...this.operationStack],
            performanceMetrics: this.activeOperations.get(operationId),
            metadata: {
                ...parentContext?.metadata,
                serviceName,
                operationName,
                timestamp: Date.now(),
                correlationId
            }
        };
    }
    /**
     * Creates context for database operations
     */
    static createForDatabase(operation, collection, query, parentContext) {
        const correlationId = parentContext?.metadata?.correlationId || this.generateCorrelationId();
        const operationId = this.generateOperationId();
        const operationType = `database.${operation}`;
        this.startOperation(operationId, operationType);
        return {
            ...parentContext,
            correlationId,
            operationId,
            parentOperationId: this.getCurrentOperation(),
            operationStack: [...this.operationStack],
            performanceMetrics: this.activeOperations.get(operationId),
            metadata: {
                ...parentContext?.metadata,
                operation,
                collection,
                query: query ? this.sanitizeQuery(query) : undefined,
                timestamp: Date.now(),
                correlationId
            }
        };
    }
    /**
     * Starts tracking an operation
     */
    static startOperation(operationId, operationType) {
        const metrics = {
            startTime: Date.now(),
            memoryUsage: process.memoryUsage(),
            operationType,
            resourcesAccessed: []
        };
        this.activeOperations.set(operationId, metrics);
        this.operationStack.push(operationId);
    }
    /**
     * Completes operation tracking
     */
    static completeOperation(operationId) {
        const metrics = this.activeOperations.get(operationId);
        if (metrics) {
            metrics.duration = Date.now() - metrics.startTime;
            this.activeOperations.delete(operationId);
            // Remove from operation stack
            const index = this.operationStack.indexOf(operationId);
            if (index > -1) {
                this.operationStack.splice(index, 1);
            }
        }
        return metrics;
    }
    /**
     * Adds resource access to current operation
     */
    static trackResourceAccess(operationId, resource) {
        const metrics = this.activeOperations.get(operationId);
        if (metrics && metrics.resourcesAccessed) {
            metrics.resourcesAccessed.push(resource);
        }
    }
    /**
     * Collects detailed Discord context
     */
    static async collectDiscordContext(interaction) {
        const context = {
            interactionType: interaction.type.toString(),
            interactionId: interaction.id,
            createdTimestamp: interaction.createdTimestamp
        };
        // Guild context
        if (interaction.guild) {
            context.guildName = interaction.guild.name;
        }
        // Channel context
        if (interaction.channel) {
            context.channelName = interaction.channel.type === 0 ? interaction.channel.name : 'DM';
            context.channelType = interaction.channel.type.toString();
        }
        // Member context
        if (interaction.member) {
            try {
                // Check if it's a real GuildMember or mock object
                if (interaction.member.roles && interaction.member.roles.cache) {
                    context.memberRoles = interaction.member.roles.cache.map((role) => role.name);
                }
                context.memberNickname = interaction.member.nickname || undefined;
                context.memberJoinedAt = interaction.member.joinedAt?.toISOString();
                // Get member permissions
                const permissions = interaction.member.permissions;
                if (permissions && permissions.toArray) {
                    context.permissions = permissions.toArray();
                }
            }
            catch (error) {
                // Handle mock objects or incomplete implementations
                context.memberRoles = [];
                context.permissions = [];
            }
        }
        return context;
    }
    /**
     * Gets current operation ID from stack
     */
    static getCurrentOperation() {
        return this.operationStack[this.operationStack.length - 1];
    }
    /**
     * Generates correlation ID for request tracking
     */
    static generateCorrelationId() {
        return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Generates operation ID
     */
    static generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Gets session ID for user (simplified implementation)
     */
    static getSessionId(userId) {
        return `sess_${userId}_${Math.floor(Date.now() / (1000 * 60 * 60))}`; // Hour-based sessions
    }
    /**
     * Sanitizes query for logging (removes sensitive data)
     */
    static sanitizeQuery(query) {
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        const sanitized = { ...query };
        for (const [key, value] of Object.entries(sanitized)) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                sanitized[key] = '[REDACTED]';
            }
            else if (typeof value === 'string' && value.length > 100) {
                sanitized[key] = value.substring(0, 100) + '...[TRUNCATED]';
            }
        }
        return sanitized;
    }
    /**
     * Creates error correlation chain
     */
    static createCorrelationChain(errors, rootContext) {
        return errors.map((error, index) => ({
            errorId: `err_${Date.now()}_${index}`,
            correlationId: rootContext.correlationId,
            operationId: rootContext.operationId,
            errorName: error.name,
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
            stackPosition: index,
            isRootCause: index === 0
        }));
    }
    /**
     * Enriches existing context with additional details
     */
    static enrichContext(baseContext, additionalData) {
        return {
            ...baseContext,
            metadata: {
                ...baseContext.metadata,
                ...additionalData,
                enrichedAt: Date.now()
            }
        };
    }
    /**
     * Creates breadcrumb trail for operation tracking
     */
    static createBreadcrumbTrail(context) {
        const breadcrumbs = [];
        if (context.discordContext?.guildName) {
            breadcrumbs.push(`Guild: ${context.discordContext.guildName}`);
        }
        if (context.commandName) {
            breadcrumbs.push(`Command: ${context.commandName}`);
        }
        if (context.metadata?.serviceName) {
            breadcrumbs.push(`Service: ${context.metadata.serviceName}`);
        }
        if (context.metadata?.operation) {
            breadcrumbs.push(`Operation: ${context.metadata.operation}`);
        }
        if (context.operationStack && context.operationStack.length > 0) {
            breadcrumbs.push(`Stack Depth: ${context.operationStack.length}`);
        }
        return breadcrumbs;
    }
    /**
     * Cleans up orphaned operations (older than 5 minutes)
     */
    static cleanupOrphanedOperations() {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        for (const [operationId, metrics] of this.activeOperations.entries()) {
            if (metrics.startTime < fiveMinutesAgo) {
                this.activeOperations.delete(operationId);
                // Remove from operation stack
                const index = this.operationStack.indexOf(operationId);
                if (index > -1) {
                    this.operationStack.splice(index, 1);
                }
            }
        }
    }
}
exports.ErrorContextService = ErrorContextService;
ErrorContextService.operationStack = [];
ErrorContextService.activeOperations = new Map();
//# sourceMappingURL=error-context-service.js.map