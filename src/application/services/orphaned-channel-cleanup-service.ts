import { 
  Guild, 
  TextChannel, 
  ChannelType, 
  Collection
} from 'discord.js';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { BusinessRuleValidationService } from './business-rule-validation-service';
import { CaseChannelArchiveService } from './case-channel-archive-service';
import { AuditAction } from '../../domain/entities/audit-log';
import { logger } from '../../infrastructure/logger';

export interface ChannelCleanupConfig {
  scanInterval: number; // Minutes between scans
  inactivityThreshold: number; // Days of inactivity before considering channel orphaned
  archiveThreshold: number; // Days before archiving orphaned channels
  deleteThreshold: number; // Days before deleting archived orphaned channels
  batchSize: number; // Number of channels to process at once
  enableAutoCleanup: boolean;
  notificationChannelId?: string;
  excludedCategories: string[]; // Category IDs to exclude from scanning
  excludedChannels: string[]; // Channel IDs to exclude from scanning
}

export interface OrphanedChannelDetails {
  channelId: string;
  channelName: string;
  categoryId?: string;
  categoryName?: string;
  createdAt: Date;
  lastActivity?: Date;
  inactiveDays: number;
  messageCount: number;
  channelType: 'case' | 'staff' | 'admin' | 'legal-team' | 'unknown';
  recommendedAction: 'archive' | 'delete' | 'keep' | 'review';
  reasons: string[];
  metadata?: {
    possibleCaseNumber?: string;
    lastActiveUserId?: string;
    lastActiveUserName?: string;
    relatedChannels?: string[];
  };
}

export interface CleanupResult {
  channelId: string;
  channelName: string;
  action: 'archived' | 'deleted' | 'skipped' | 'error';
  reason: string;
  timestamp: Date;
  error?: string;
}

export interface CleanupReport {
  scanStarted: Date;
  scanCompleted: Date;
  totalChannelsScanned: number;
  orphanedChannelsFound: number;
  channelsArchived: number;
  channelsDeleted: number;
  channelsSkipped: number;
  errors: number;
  results: CleanupResult[];
  nextScheduledScan?: Date;
}

export class OrphanedChannelCleanupService {
  private caseRepository: CaseRepository;
  private guildConfigRepository: GuildConfigRepository;
  private auditLogRepository: AuditLogRepository;
  private staffRepository: StaffRepository;
  private permissionService: PermissionService;
  private caseChannelArchiveService: CaseChannelArchiveService;

  // Default cleanup configuration
  private readonly DEFAULT_CONFIG: ChannelCleanupConfig = {
    scanInterval: 1440, // 24 hours
    inactivityThreshold: 30, // 30 days
    archiveThreshold: 7, // Archive after 7 days of being orphaned
    deleteThreshold: 90, // Delete after 90 days in archive
    batchSize: 10,
    enableAutoCleanup: false,
    excludedCategories: [],
    excludedChannels: []
  };

  // Channel patterns to identify different types
  private readonly CHANNEL_PATTERNS = {
    case: [
      /^case-aa-\d{4}-\d+-/i,
      /^aa-\d{4}-\d+-/i,
      /^case-\d{4}-\d+-/i,
      /^legal-case-/i
    ],
    staff: [
      /^staff-/i,
      /^team-/i,
      /^department-/i,
      /^hr-/i
    ],
    admin: [
      /^admin-/i,
      /^management-/i,
      /^executive-/i,
      /^partners-/i
    ],
    legalTeam: [
      /^legal-team/i,
      /^lawyer-/i,
      /^attorney-/i,
      /^paralegal-/i
    ]
  };

  // Scheduled cleanup intervals (guild ID -> timeout)
  private cleanupIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    caseRepository: CaseRepository,
    guildConfigRepository: GuildConfigRepository,
    auditLogRepository: AuditLogRepository,
    staffRepository: StaffRepository,
    permissionService: PermissionService,
    _businessRuleValidationService: BusinessRuleValidationService,
    caseChannelArchiveService: CaseChannelArchiveService
  ) {
    this.caseRepository = caseRepository;
    this.guildConfigRepository = guildConfigRepository;
    this.auditLogRepository = auditLogRepository;
    this.staffRepository = staffRepository;
    this.permissionService = permissionService;
    this.caseChannelArchiveService = caseChannelArchiveService;
  }

  /**
   * Perform a comprehensive scan for orphaned channels
   */
  public async scanForOrphanedChannels(
    guild: Guild,
    context: PermissionContext
  ): Promise<OrphanedChannelDetails[]> {
    try {
      logger.info('Starting comprehensive orphaned channel scan', { guildId: guild.id });

      // Validate permissions
      const hasPermission = await this.permissionService.hasActionPermission(context, 'admin');
      if (!hasPermission) {
        throw new Error('Insufficient permissions to scan for orphaned channels');
      }

      const config = await this.getCleanupConfig(guild.id);
      const orphanedChannels: OrphanedChannelDetails[] = [];

      // Get all text channels
      const allChannels = guild.channels.cache.filter(
        channel => channel.type === ChannelType.GuildText
      ) as Collection<string, TextChannel>;

      logger.info(`Scanning ${allChannels.size} text channels for orphaned status`);

      // Process channels in batches
      const channelArray = Array.from(allChannels.values());
      for (let i = 0; i < channelArray.length; i += config.batchSize) {
        const batch = channelArray.slice(i, i + config.batchSize);
        const batchResults = await Promise.all(
          batch.map(channel => this.analyzeChannel(guild, channel, config))
        );

        // Filter out channels that are not orphaned
        const orphanedInBatch = batchResults.filter(
          result => result !== null && result.recommendedAction !== 'keep'
        ) as OrphanedChannelDetails[];

        orphanedChannels.push(...orphanedInBatch);
      }

      // Sort by inactivity days (most inactive first)
      orphanedChannels.sort((a, b) => b.inactiveDays - a.inactiveDays);

      logger.info('Orphaned channel scan complete', {
        guildId: guild.id,
        totalScanned: allChannels.size,
        orphanedFound: orphanedChannels.length,
        toArchive: orphanedChannels.filter(c => c.recommendedAction === 'archive').length,
        toDelete: orphanedChannels.filter(c => c.recommendedAction === 'delete').length,
        toReview: orphanedChannels.filter(c => c.recommendedAction === 'review').length
      });

      return orphanedChannels;
    } catch (error) {
      logger.error('Error scanning for orphaned channels:', error);
      throw error;
    }
  }

  /**
   * Analyze a single channel to determine if it's orphaned
   */
  private async analyzeChannel(
    guild: Guild,
    channel: TextChannel,
    config: ChannelCleanupConfig
  ): Promise<OrphanedChannelDetails | null> {
    try {
      // Skip excluded channels and categories
      if (config.excludedChannels.includes(channel.id)) {
        return null;
      }

      if (channel.parentId && config.excludedCategories.includes(channel.parentId)) {
        return null;
      }

      // Skip channels in archive categories
      if (channel.parent?.name.toLowerCase().includes('archive')) {
        return null;
      }

      // Determine channel type
      const channelType = this.identifyChannelType(channel);
      
      // Get channel activity
      const activity = await this.getChannelActivity(channel);
      const inactiveDays = activity.lastActivity 
        ? Math.floor((Date.now() - activity.lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        : Math.floor((Date.now() - channel.createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Check if channel meets orphaned criteria based on type
      const orphanedCheck = await this.checkIfOrphaned(guild, channel, channelType);
      
      if (!orphanedCheck.isOrphaned && inactiveDays < config.inactivityThreshold) {
        return null;
      }

      // Determine recommended action
      const recommendedAction = this.determineRecommendedAction(
        inactiveDays,
        channelType,
        orphanedCheck.isOrphaned,
        config
      );

      // Extract possible case number if it's a case channel
      const possibleCaseNumber = channelType === 'case' 
        ? this.extractCaseNumber(channel.name)
        : undefined;

      return {
        channelId: channel.id,
        channelName: channel.name,
        categoryId: channel.parentId || undefined,
        categoryName: channel.parent?.name,
        createdAt: channel.createdAt,
        lastActivity: activity.lastActivity,
        inactiveDays,
        messageCount: activity.messageCount,
        channelType,
        recommendedAction,
        reasons: orphanedCheck.reasons,
        metadata: {
          possibleCaseNumber,
          lastActiveUserId: activity.lastActiveUserId,
          lastActiveUserName: activity.lastActiveUserName,
          relatedChannels: await this.findRelatedChannels(guild, channel, channelType)
        }
      };
    } catch (error) {
      logger.warn('Error analyzing channel', { 
        channelId: channel.id, 
        channelName: channel.name, 
        error 
      });
      return null;
    }
  }

  /**
   * Identify the type of channel based on naming patterns
   */
  private identifyChannelType(channel: TextChannel): OrphanedChannelDetails['channelType'] {
    const name = channel.name.toLowerCase();

    for (const [type, patterns] of Object.entries(this.CHANNEL_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(name))) {
        return type as OrphanedChannelDetails['channelType'];
      }
    }

    return 'unknown';
  }

  /**
   * Get channel activity information
   */
  private async getChannelActivity(channel: TextChannel): Promise<{
    lastActivity?: Date;
    messageCount: number;
    lastActiveUserId?: string;
    lastActiveUserName?: string;
  }> {
    try {
      // Fetch recent messages
      const messages = await channel.messages.fetch({ limit: 100 });
      
      if (messages.size === 0) {
        return { messageCount: 0 };
      }

      // Get the most recent message
      const lastMessage = messages.first();
      
      // Count total messages (approximation)
      let totalMessages = messages.size;
      if (messages.size === 100) {
        // If we hit the limit, estimate total messages
        const oldestMessage = messages.last();
        if (oldestMessage) {
          const channelAge = Date.now() - channel.createdAt.getTime();
          const sampleAge = Date.now() - oldestMessage.createdAt.getTime();
          totalMessages = Math.round((channelAge / sampleAge) * 100);
        }
      }

      return {
        lastActivity: lastMessage?.createdAt,
        messageCount: totalMessages,
        lastActiveUserId: lastMessage?.author.id,
        lastActiveUserName: lastMessage?.author.username
      };
    } catch (error) {
      logger.warn('Failed to get channel activity', { channelId: channel.id, error });
      return { messageCount: 0 };
    }
  }

  /**
   * Check if a channel is orphaned based on its type
   */
  private async checkIfOrphaned(
    guild: Guild,
    channel: TextChannel,
    channelType: OrphanedChannelDetails['channelType']
  ): Promise<{ isOrphaned: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    let isOrphaned = false;

    switch (channelType) {
      case 'case':
        // Check if there's a corresponding case in the database
        const cases = await this.caseRepository.findByFilters({
          guildId: guild.id,
          channelId: channel.id
        });

        if (cases.length === 0) {
          isOrphaned = true;
          reasons.push('No corresponding case found in database');
        } else if (cases.length > 0 && cases[0]) {
          const caseData = cases[0];
          if (caseData.status === 'closed' && caseData.closedAt) {
            const daysSinceClosure = Math.floor(
              (Date.now() - new Date(caseData.closedAt).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceClosure > 7) {
              reasons.push(`Case closed ${daysSinceClosure} days ago`);
            }
          }
        }
        break;

      case 'staff':
        // Check if associated with active staff
        const staffMembers = await this.staffRepository.findByGuildId(guild.id);
        const activeStaff = staffMembers.filter(s => s.status === 'active');
        
        // Check if channel name matches any staff member
        const hasActiveStaffConnection = activeStaff.some(staff => {
          const member = guild.members.cache.get(staff.userId);
          return member && channel.name.toLowerCase().includes(member.user.username.toLowerCase());
        });

        if (!hasActiveStaffConnection) {
          isOrphaned = true;
          reasons.push('No active staff member associated with channel');
        }
        break;

      case 'admin':
      case 'legal-team':
        // These channels might be legitimate even if inactive
        // Only mark as orphaned if very old and inactive
        const channelAge = Math.floor(
          (Date.now() - channel.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (channelAge > 180) { // 6 months
          reasons.push(`Channel is ${channelAge} days old`);
        }
        break;

      case 'unknown':
        // For unknown channels, check general activity patterns
        if (channel.topic && channel.topic.includes('[ARCHIVED]')) {
          isOrphaned = true;
          reasons.push('Channel appears to be archived but not in archive category');
        }
        break;
    }

    // Additional checks for all channel types
    if (channel.name.includes('temp-') || channel.name.includes('tmp-')) {
      isOrphaned = true;
      reasons.push('Channel appears to be temporary');
    }

    return { isOrphaned, reasons };
  }

  /**
   * Determine the recommended action for an orphaned channel
   */
  private determineRecommendedAction(
    inactiveDays: number,
    channelType: OrphanedChannelDetails['channelType'],
    isOrphaned: boolean,
    config: ChannelCleanupConfig
  ): OrphanedChannelDetails['recommendedAction'] {
    // If not orphaned but inactive, might still need review
    if (!isOrphaned && inactiveDays > config.inactivityThreshold * 2) {
      return 'review';
    }

    if (!isOrphaned) {
      return 'keep';
    }

    // Orphaned channels
    if (inactiveDays > config.deleteThreshold) {
      return 'delete';
    }

    if (inactiveDays > config.archiveThreshold) {
      return 'archive';
    }

    // Special handling for different channel types
    switch (channelType) {
      case 'case':
        // Case channels should be archived quickly after being orphaned
        return inactiveDays > 3 ? 'archive' : 'review';
      
      case 'staff':
        // Staff channels might need manual review
        return 'review';
      
      case 'admin':
      case 'legal-team':
        // These are more sensitive, require review
        return 'review';
      
      default:
        return inactiveDays > config.archiveThreshold ? 'archive' : 'review';
    }
  }

  /**
   * Extract case number from channel name
   */
  private extractCaseNumber(channelName: string): string | undefined {
    const match = channelName.match(/(\d{4}-\d+)/);
    return match ? match[1] : undefined;
  }

  /**
   * Find related channels (e.g., other channels for the same case or client)
   */
  private async findRelatedChannels(
    guild: Guild,
    channel: TextChannel,
    channelType: OrphanedChannelDetails['channelType']
  ): Promise<string[]> {
    const relatedChannels: string[] = [];

    try {
      if (channelType === 'case') {
        const caseNumber = this.extractCaseNumber(channel.name);
        if (caseNumber) {
          // Find other channels with the same case number
          guild.channels.cache.forEach(otherChannel => {
            if (
              otherChannel.id !== channel.id &&
              otherChannel.type === ChannelType.GuildText &&
              otherChannel.name.includes(caseNumber)
            ) {
              relatedChannels.push(otherChannel.id);
            }
          });
        }
      }

      // Find channels in the same category
      if (channel.parentId) {
        guild.channels.cache.forEach(otherChannel => {
          if (
            otherChannel.id !== channel.id &&
            otherChannel.parentId === channel.parentId &&
            otherChannel.type === ChannelType.GuildText
          ) {
            relatedChannels.push(otherChannel.id);
          }
        });
      }
    } catch (error) {
      logger.warn('Error finding related channels', { channelId: channel.id, error });
    }

    return relatedChannels;
  }

  /**
   * Perform cleanup on orphaned channels
   */
  public async performCleanup(
    guild: Guild,
    orphanedChannels: OrphanedChannelDetails[],
    context: PermissionContext,
    options: {
      dryRun?: boolean;
      confirmationRequired?: boolean;
      actionsToPerform?: ('archive' | 'delete' | 'review')[];
    } = {}
  ): Promise<CleanupReport> {
    try {
      logger.info('Starting orphaned channel cleanup', {
        guildId: guild.id,
        channelCount: orphanedChannels.length,
        dryRun: options.dryRun || false
      });

      // Validate permissions
      const hasPermission = await this.permissionService.hasActionPermission(context, 'admin');
      if (!hasPermission) {
        throw new Error('Insufficient permissions to perform channel cleanup');
      }

      const report: CleanupReport = {
        scanStarted: new Date(),
        scanCompleted: new Date(),
        totalChannelsScanned: orphanedChannels.length,
        orphanedChannelsFound: orphanedChannels.length,
        channelsArchived: 0,
        channelsDeleted: 0,
        channelsSkipped: 0,
        errors: 0,
        results: []
      };

      const actionsToPerform = options.actionsToPerform || ['archive', 'delete'];
      const config = await this.getCleanupConfig(guild.id);

      // Process channels based on recommended actions
      for (const orphanedChannel of orphanedChannels) {
        if (!actionsToPerform.includes(orphanedChannel.recommendedAction as any)) {
          report.results.push({
            channelId: orphanedChannel.channelId,
            channelName: orphanedChannel.channelName,
            action: 'skipped',
            reason: `Action '${orphanedChannel.recommendedAction}' not included in cleanup`,
            timestamp: new Date()
          });
          report.channelsSkipped++;
          continue;
        }

        try {
          const result = await this.processOrphanedChannel(
            guild,
            orphanedChannel,
            context,
            options.dryRun || false
          );

          report.results.push(result);

          switch (result.action) {
            case 'archived':
              report.channelsArchived++;
              break;
            case 'deleted':
              report.channelsDeleted++;
              break;
            case 'skipped':
              report.channelsSkipped++;
              break;
            case 'error':
              report.errors++;
              break;
          }
        } catch (error) {
          logger.error('Error processing orphaned channel', {
            channelId: orphanedChannel.channelId,
            error
          });

          report.results.push({
            channelId: orphanedChannel.channelId,
            channelName: orphanedChannel.channelName,
            action: 'error',
            reason: 'Failed to process channel',
            timestamp: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          report.errors++;
        }
      }

      report.scanCompleted = new Date();

      // Log cleanup report
      await this.logCleanupReport(guild.id, context.userId, report);

      // Send notification if configured
      if (config.notificationChannelId && !options.dryRun) {
        await this.sendCleanupNotification(guild, config.notificationChannelId, report);
      }

      logger.info('Orphaned channel cleanup complete', {
        guildId: guild.id,
        archived: report.channelsArchived,
        deleted: report.channelsDeleted,
        skipped: report.channelsSkipped,
        errors: report.errors
      });

      return report;
    } catch (error) {
      logger.error('Error performing channel cleanup:', error);
      throw error;
    }
  }

  /**
   * Process a single orphaned channel
   */
  private async processOrphanedChannel(
    guild: Guild,
    orphanedChannel: OrphanedChannelDetails,
    context: PermissionContext,
    dryRun: boolean
  ): Promise<CleanupResult> {
    const channel = guild.channels.cache.get(orphanedChannel.channelId) as TextChannel;
    
    if (!channel) {
      return {
        channelId: orphanedChannel.channelId,
        channelName: orphanedChannel.channelName,
        action: 'error',
        reason: 'Channel no longer exists',
        timestamp: new Date()
      };
    }

    switch (orphanedChannel.recommendedAction) {
      case 'archive':
        if (dryRun) {
          return {
            channelId: channel.id,
            channelName: channel.name,
            action: 'skipped',
            reason: 'Dry run - would archive channel',
            timestamp: new Date()
          };
        }

        try {
          // Use the case channel archive service for archiving
          const orphanedChannelInfo: any = {
            channelId: orphanedChannel.channelId,
            channelName: orphanedChannel.channelName,
            categoryId: orphanedChannel.categoryId,
            lastMessageDate: orphanedChannel.lastActivity,
            inactiveDays: orphanedChannel.inactiveDays,
            shouldArchive: true,
            shouldDelete: false
          };
          
          const archiveResult = await this.caseChannelArchiveService.archiveOrphanedChannels(
            guild,
            [orphanedChannelInfo],
            context
          );

          if (archiveResult[0]?.success) {
            return {
              channelId: channel.id,
              channelName: channel.name,
              action: 'archived',
              reason: `Archived: ${orphanedChannel.reasons.join(', ')}`,
              timestamp: new Date()
            };
          } else {
            return {
              channelId: channel.id,
              channelName: channel.name,
              action: 'error',
              reason: 'Archive operation failed',
              timestamp: new Date(),
              error: archiveResult[0]?.error
            };
          }
        } catch (error) {
          throw error;
        }

      case 'delete':
        if (dryRun) {
          return {
            channelId: channel.id,
            channelName: channel.name,
            action: 'skipped',
            reason: 'Dry run - would delete channel',
            timestamp: new Date()
          };
        }

        try {
          await channel.delete(`Orphaned channel cleanup: ${orphanedChannel.reasons.join(', ')}`);
          
          return {
            channelId: orphanedChannel.channelId,
            channelName: orphanedChannel.channelName,
            action: 'deleted',
            reason: `Deleted: ${orphanedChannel.reasons.join(', ')}`,
            timestamp: new Date()
          };
        } catch (error) {
          throw error;
        }

      case 'review':
        return {
          channelId: channel.id,
          channelName: channel.name,
          action: 'skipped',
          reason: `Requires manual review: ${orphanedChannel.reasons.join(', ')}`,
          timestamp: new Date()
        };

      default:
        return {
          channelId: channel.id,
          channelName: channel.name,
          action: 'skipped',
          reason: 'No action recommended',
          timestamp: new Date()
        };
    }
  }

  /**
   * Enable or disable automatic cleanup for a guild
   */
  public async setAutoCleanup(
    guildId: string,
    enabled: boolean,
    context: PermissionContext
  ): Promise<void> {
    try {
      // Validate permissions
      const hasPermission = await this.permissionService.hasActionPermission(context, 'admin');
      if (!hasPermission) {
        throw new Error('Insufficient permissions to configure auto cleanup');
      }

      const config = await this.getCleanupConfig(guildId);
      config.enableAutoCleanup = enabled;

      // Update configuration
      await this.updateCleanupConfig(guildId, config);

      if (enabled) {
        this.startAutoCleanup(guildId);
      } else {
        this.stopAutoCleanup(guildId);
      }

      logger.info('Auto cleanup configuration updated', { guildId, enabled });
    } catch (error) {
      logger.error('Error setting auto cleanup:', error);
      throw error;
    }
  }

  /**
   * Start automatic cleanup interval for a guild
   */
  private startAutoCleanup(guildId: string): void {
    // Clear existing interval if any
    this.stopAutoCleanup(guildId);

    const performAutoCleanup = async () => {
      try {
        logger.info('Running automatic orphaned channel cleanup', { guildId });
        
        // This would need access to the guild and a system context
        // In a real implementation, this would be handled by the bot's ready event
        // or a separate scheduled job system
      } catch (error) {
        logger.error('Error in automatic cleanup:', error);
      }
    };

    // Set up interval
    const config = this.DEFAULT_CONFIG; // Would get actual config in real implementation
    const interval = setInterval(performAutoCleanup, config.scanInterval * 60 * 1000);
    this.cleanupIntervals.set(guildId, interval);
  }

  /**
   * Stop automatic cleanup interval for a guild
   */
  private stopAutoCleanup(guildId: string): void {
    const interval = this.cleanupIntervals.get(guildId);
    if (interval) {
      clearInterval(interval);
      this.cleanupIntervals.delete(guildId);
    }
  }

  /**
   * Get cleanup configuration for a guild
   */
  private async getCleanupConfig(guildId: string): Promise<ChannelCleanupConfig> {
    try {
      const guildConfig = await this.guildConfigRepository.findByGuildId(guildId);
      
      return {
        ...this.DEFAULT_CONFIG,
        ...(guildConfig?.channelCleanupConfig || {})
      };
    } catch (error) {
      logger.warn('Failed to get cleanup config, using defaults', { guildId, error });
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update cleanup configuration for a guild
   */
  private async updateCleanupConfig(
    guildId: string,
    config: Partial<ChannelCleanupConfig>
  ): Promise<void> {
    try {
      const existingConfig = await this.guildConfigRepository.findByGuildId(guildId);
      
      if (existingConfig) {
        await this.guildConfigRepository.update(existingConfig._id!.toString(), {
          channelCleanupConfig: {
            ...this.DEFAULT_CONFIG,
            ...config
          }
        });
      }
    } catch (error) {
      logger.error('Failed to update cleanup configuration:', error);
      throw error;
    }
  }

  /**
   * Log cleanup report to audit trail
   */
  private async logCleanupReport(
    guildId: string,
    actorId: string,
    report: CleanupReport
  ): Promise<void> {
    try {
      await this.auditLogRepository.add({
        guildId,
        action: AuditAction.CHANNEL_ARCHIVED, // Could add a new audit action for cleanup
        actorId,
        details: {
          reason: 'Orphaned channel cleanup',
          metadata: {
            scanStarted: report.scanStarted,
            scanCompleted: report.scanCompleted,
            totalScanned: report.totalChannelsScanned,
            orphanedFound: report.orphanedChannelsFound,
            archived: report.channelsArchived,
            deleted: report.channelsDeleted,
            skipped: report.channelsSkipped,
            errors: report.errors
          }
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error logging cleanup report:', error);
    }
  }

  /**
   * Send cleanup notification to configured channel
   */
  private async sendCleanupNotification(
    guild: Guild,
    notificationChannelId: string,
    report: CleanupReport
  ): Promise<void> {
    try {
      const channel = guild.channels.cache.get(notificationChannelId) as TextChannel;
      if (!channel) {
        logger.warn('Notification channel not found', { channelId: notificationChannelId });
        return;
      }

      const embed = {
        title: '🧹 Orphaned Channel Cleanup Report',
        color: 0x0099ff,
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: 'Scan Duration',
            value: `${Math.round((report.scanCompleted.getTime() - report.scanStarted.getTime()) / 1000)}s`,
            inline: true
          },
          {
            name: 'Channels Scanned',
            value: report.totalChannelsScanned.toString(),
            inline: true
          },
          {
            name: 'Orphaned Found',
            value: report.orphanedChannelsFound.toString(),
            inline: true
          },
          {
            name: 'Actions Taken',
            value: `📁 Archived: ${report.channelsArchived}\n🗑️ Deleted: ${report.channelsDeleted}\n⏭️ Skipped: ${report.channelsSkipped}\n❌ Errors: ${report.errors}`,
            inline: false
          }
        ]
      };

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Error sending cleanup notification:', error);
    }
  }

  /**
   * Get cleanup status and next scheduled run
   */
  public async getCleanupStatus(guildId: string): Promise<{
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
    config: ChannelCleanupConfig;
  }> {
    const config = await this.getCleanupConfig(guildId);
    const hasInterval = this.cleanupIntervals.has(guildId);

    // In a real implementation, we would track last run times
    return {
      enabled: config.enableAutoCleanup && hasInterval,
      config
    };
  }

  /**
   * Clean up resources when service is destroyed
   */
  public destroy(): void {
    // Clear all intervals
    for (const [, interval] of this.cleanupIntervals) {
      clearInterval(interval);
    }
    this.cleanupIntervals.clear();
  }
}