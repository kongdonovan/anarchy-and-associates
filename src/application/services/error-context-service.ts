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
export class ErrorContextService {
  private static readonly operationStack: string[] = [];
  private static readonly activeOperations = new Map<string, OperationMetrics>();

  /**
   * Creates enhanced error context from Discord interaction
   */
  public static async createFromInteraction(
    interaction: CommandInteraction,
    operationType: string = 'discord_command'
  ): Promise<EnhancedErrorContext> {
    const correlationId = this.generateCorrelationId();
    const operationId = this.generateOperationId();
    
    // Start tracking this operation
    this.startOperation(operationId, operationType);

    // Collect Discord context
    const discordContext = await this.collectDiscordContext(interaction);
    
    // Collect basic context
    const context: EnhancedErrorContext = {
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
  public static createForService(
    serviceName: string,
    operationName: string,
    parentContext?: Partial<ErrorContext>
  ): EnhancedErrorContext {
    const correlationId = (parentContext as any)?.correlationId || parentContext?.metadata?.correlationId || this.generateCorrelationId();
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
  public static createForDatabase(
    operation: string,
    collection: string,
    query?: Record<string, any>,
    parentContext?: Partial<ErrorContext>
  ): EnhancedErrorContext {
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
  public static startOperation(operationId: string, operationType: string): void {
    const metrics: OperationMetrics = {
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
  public static completeOperation(operationId: string): OperationMetrics | undefined {
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
  public static trackResourceAccess(operationId: string, resource: string): void {
    const metrics = this.activeOperations.get(operationId);
    if (metrics && metrics.resourcesAccessed) {
      metrics.resourcesAccessed.push(resource);
    }
  }

  /**
   * Collects detailed Discord context
   */
  private static async collectDiscordContext(
    interaction: CommandInteraction
  ): Promise<DiscordContextDetails> {
    const context: DiscordContextDetails = {
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
        if (interaction.member.roles && (interaction.member.roles as any).cache) {
          context.memberRoles = (interaction.member.roles as any).cache.map((role: any) => role.name);
        }
        context.memberNickname = (interaction.member as any).nickname || undefined;
        context.memberJoinedAt = (interaction.member as any).joinedAt?.toISOString();
        
        // Get member permissions
        const permissions = (interaction.member as any).permissions;
        if (permissions && permissions.toArray) {
          context.permissions = permissions.toArray();
        }
      } catch (error) {
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
  private static getCurrentOperation(): string | undefined {
    return this.operationStack[this.operationStack.length - 1];
  }

  /**
   * Generates correlation ID for request tracking
   */
  private static generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates operation ID
   */
  private static generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets session ID for user (simplified implementation)
   */
  private static getSessionId(userId: string): string {
    return `sess_${userId}_${Math.floor(Date.now() / (1000 * 60 * 60))}`; // Hour-based sessions
  }

  /**
   * Sanitizes query for logging (removes sensitive data)
   */
  private static sanitizeQuery(query: Record<string, any>): Record<string, any> {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...query };

    for (const [key, value] of Object.entries(sanitized)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...[TRUNCATED]';
      }
    }

    return sanitized;
  }

  /**
   * Creates error correlation chain
   */
  public static createCorrelationChain(
    errors: Error[],
    rootContext: EnhancedErrorContext
  ): ErrorCorrelation[] {
    return errors.map((error, index) => ({
      errorId: `err_${Date.now()}_${index}`,
      correlationId: rootContext.correlationId!,
      operationId: rootContext.operationId!,
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
  public static enrichContext(
    baseContext: Partial<ErrorContext>,
    additionalData: Record<string, any>
  ): EnhancedErrorContext {
    return {
      ...baseContext,
      metadata: {
        ...baseContext.metadata,
        ...additionalData,
        enrichedAt: Date.now()
      }
    } as EnhancedErrorContext;
  }

  /**
   * Creates breadcrumb trail for operation tracking
   */
  public static createBreadcrumbTrail(context: EnhancedErrorContext): string[] {
    const breadcrumbs: string[] = [];
    
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
  public static cleanupOrphanedOperations(): void {
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