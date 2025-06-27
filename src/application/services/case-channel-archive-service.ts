import { 
  Guild, 
  TextChannel, 
  CategoryChannel, 
  ChannelType, 
  PermissionFlagsBits,
  Collection
} from 'discord.js';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { BusinessRuleValidationService } from './business-rule-validation-service';
import { Case, CaseStatus } from '../../domain/entities/case';
import { AuditAction } from '../../domain/entities/audit-log';
import { logger } from '../../infrastructure/logger';

export interface ChannelArchiveConfig {
  archiveCategoryId?: string;
  retentionDays: number;
  archiveInactiveChannels: boolean;
  deleteOldArchives: boolean;
  maxArchiveAge: number; // days
}

export interface ChannelArchiveResult {
  channelId: string;
  channelName: string;
  originalCategoryId?: string;
  archiveCategoryId: string;
  caseId?: string;
  caseNumber?: string;
  archivedAt: Date;
  reason: string;
  success: boolean;
  error?: string;
}

export interface OrphanedChannelInfo {
  channelId: string;
  channelName: string;
  categoryId?: string;
  lastMessageDate?: Date;
  inactiveDays: number;
  shouldArchive: boolean;
  shouldDelete: boolean;
}

export class CaseChannelArchiveService {
  private caseRepository: CaseRepository;
  private guildConfigRepository: GuildConfigRepository;
  private auditLogRepository: AuditLogRepository;
  private permissionService: PermissionService;
  // private _businessRuleValidationService: BusinessRuleValidationService;

  // Default archive configuration
  private readonly DEFAULT_CONFIG: ChannelArchiveConfig = {
    retentionDays: 7, // Keep active case channels for 7 days after case closure
    archiveInactiveChannels: true,
    deleteOldArchives: false, // Don't delete archives by default
    maxArchiveAge: 365 // Keep archives for 1 year
  };

  // Channel name patterns for case channels
  private readonly CASE_CHANNEL_PATTERNS = [
    /^case-aa-\d{4}-\d+-/i, // case-aa-2024-123-clientname
    /^aa-\d{4}-\d+-/i,      // aa-2024-123-clientname
    /^case-\d{4}-\d+-/i     // case-2024-123-clientname
  ];

  constructor(
    caseRepository: CaseRepository,
    guildConfigRepository: GuildConfigRepository,
    auditLogRepository: AuditLogRepository,
    permissionService: PermissionService,
    _businessRuleValidationService: BusinessRuleValidationService
  ) {
    this.caseRepository = caseRepository;
    this.guildConfigRepository = guildConfigRepository;
    this.auditLogRepository = auditLogRepository;
    this.permissionService = permissionService;
    // this._businessRuleValidationService = businessRuleValidationService;
  }

  /**
   * Archive a specific case channel when the case is closed
   */
  public async archiveCaseChannel(
    guild: Guild,
    caseData: Case,
    context: PermissionContext
  ): Promise<ChannelArchiveResult> {
    try {
      logger.info('Archiving case channel', {
        guildId: guild.id,
        caseId: caseData._id,
        caseNumber: caseData.caseNumber,
        channelId: caseData.channelId,
        status: caseData.status
      });

      // Validate permissions
      const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
      if (!hasPermission) {
        throw new Error('Insufficient permissions to archive case channels');
      }

      // Get channel if it exists
      if (!caseData.channelId) {
        return {
          channelId: '',
          channelName: '',
          archiveCategoryId: '',
          caseId: caseData._id?.toString(),
          caseNumber: caseData.caseNumber,
          archivedAt: new Date(),
          reason: 'No channel associated with case',
          success: false,
          error: 'Case has no associated channel'
        };
      }

      const channel = guild.channels.cache.get(caseData.channelId) as TextChannel;
      if (!channel) {
        return {
          channelId: caseData.channelId,
          channelName: 'Unknown',
          archiveCategoryId: '',
          caseId: caseData._id?.toString(),
          caseNumber: caseData.caseNumber,
          archivedAt: new Date(),
          reason: 'Channel not found',
          success: false,
          error: 'Channel not found in guild'
        };
      }

      // Get archive configuration
      const config = await this.getArchiveConfig(guild.id);
      
      // Get or create archive category
      const archiveCategory = await this.getOrCreateArchiveCategory(guild, config);
      if (!archiveCategory) {
        throw new Error('Failed to get or create archive category');
      }

      // Store original category for audit purposes
      // const _originalCategoryId = channel.parentId;

      // Update channel for archiving
      const archiveResult = await this.performChannelArchive(
        channel,
        archiveCategory,
        caseData,
        'Case closed'
      );

      // Log audit event
      await this.logArchiveEvent(guild.id, context.userId, archiveResult, caseData);

      logger.info('Case channel archived successfully', {
        guildId: guild.id,
        channelId: archiveResult.channelId,
        channelName: archiveResult.channelName,
        archiveCategoryId: archiveResult.archiveCategoryId,
        caseNumber: caseData.caseNumber
      });

      return archiveResult;
    } catch (error) {
      logger.error('Error archiving case channel:', error);
      
      return {
        channelId: caseData.channelId || '',
        channelName: 'Unknown',
        archiveCategoryId: '',
        caseId: caseData._id?.toString(),
        caseNumber: caseData.caseNumber,
        archivedAt: new Date(),
        reason: 'Archive failed',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Archive multiple case channels based on closed cases
   */
  public async archiveClosedCaseChannels(
    guild: Guild,
    context: PermissionContext
  ): Promise<ChannelArchiveResult[]> {
    try {
      logger.info('Starting bulk archive of closed case channels', { guildId: guild.id });

      // Validate permissions
      const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
      if (!hasPermission) {
        throw new Error('Insufficient permissions to archive case channels');
      }

      // Get all closed cases with channels
      const closedCases = await this.caseRepository.findByGuildAndStatus(guild.id, CaseStatus.CLOSED);
      const casesWithChannels = closedCases.filter(c => c.channelId);

      const results: ChannelArchiveResult[] = [];
      const config = await this.getArchiveConfig(guild.id);

      // Filter cases that meet archiving criteria
      const casesToArchive = casesWithChannels.filter(caseData => {
        if (!caseData.closedAt) return false;
        
        const daysSinceClosure = Math.floor(
          (Date.now() - new Date(caseData.closedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        return daysSinceClosure >= config.retentionDays;
      });

      logger.info('Found cases eligible for archiving', {
        guildId: guild.id,
        totalClosedCases: closedCases.length,
        casesWithChannels: casesWithChannels.length,
        casesToArchive: casesToArchive.length
      });

      // Archive eligible case channels
      for (const caseData of casesToArchive) {
        try {
          const result = await this.archiveCaseChannel(guild, caseData, context);
          results.push(result);
        } catch (error) {
          logger.error('Failed to archive individual case channel', {
            caseId: caseData._id,
            channelId: caseData.channelId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          results.push({
            channelId: caseData.channelId || '',
            channelName: 'Unknown',
            archiveCategoryId: '',
            caseId: caseData._id?.toString(),
            caseNumber: caseData.caseNumber,
            archivedAt: new Date(),
            reason: 'Archive failed',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Completed bulk archive of closed case channels', {
        guildId: guild.id,
        totalResults: results.length,
        successfulArchives: results.filter(r => r.success).length,
        failedArchives: results.filter(r => !r.success).length
      });

      return results;
    } catch (error) {
      logger.error('Error in bulk archive operation:', error);
      throw error;
    }
  }

  /**
   * Find and handle orphaned case channels (channels without corresponding cases)
   */
  public async findOrphanedCaseChannels(
    guild: Guild,
    context: PermissionContext
  ): Promise<OrphanedChannelInfo[]> {
    try {
      logger.info('Scanning for orphaned case channels', { guildId: guild.id });

      // Validate permissions
      const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
      if (!hasPermission) {
        throw new Error('Insufficient permissions to scan for orphaned channels');
      }

      const orphanedChannels: OrphanedChannelInfo[] = [];
      const config = await this.getArchiveConfig(guild.id);

      // Get all text channels that look like case channels
      const allChannels = guild.channels.cache.filter(
        channel => channel.type === ChannelType.GuildText
      ) as Collection<string, TextChannel>;

      for (const [channelId, channel] of allChannels) {
        // Check if channel name matches case channel patterns
        const isCaseChannel = this.CASE_CHANNEL_PATTERNS.some(pattern => 
          pattern.test(channel.name)
        );

        if (!isCaseChannel) continue;

        // Check if there's a corresponding case in the database
        const correspondingCase = await this.caseRepository.findByFilters({ 
          guildId: guild.id,
          channelId: channelId 
        });

        if (correspondingCase.length === 0) {
          // This is an orphaned channel
          const lastMessage = await this.getLastMessageDate(channel);
          const inactiveDays = lastMessage 
            ? Math.floor((Date.now() - lastMessage.getTime()) / (1000 * 60 * 60 * 24))
            : 999; // Very old if no messages

          const shouldArchive = inactiveDays >= config.retentionDays;
          const shouldDelete = config.deleteOldArchives && inactiveDays >= config.maxArchiveAge;

          orphanedChannels.push({
            channelId,
            channelName: channel.name,
            categoryId: channel.parentId || undefined,
            lastMessageDate: lastMessage || undefined,
            inactiveDays,
            shouldArchive,
            shouldDelete
          });
        }
      }

      logger.info('Orphaned channel scan complete', {
        guildId: guild.id,
        totalChannelsScanned: allChannels.size,
        orphanedChannelsFound: orphanedChannels.length,
        channelsToArchive: orphanedChannels.filter(c => c.shouldArchive).length,
        channelsToDelete: orphanedChannels.filter(c => c.shouldDelete).length
      });

      return orphanedChannels;
    } catch (error) {
      logger.error('Error scanning for orphaned channels:', error);
      throw error;
    }
  }

  /**
   * Archive orphaned case channels
   */
  public async archiveOrphanedChannels(
    guild: Guild,
    orphanedChannels: OrphanedChannelInfo[],
    context: PermissionContext
  ): Promise<ChannelArchiveResult[]> {
    try {
      logger.info('Archiving orphaned case channels', {
        guildId: guild.id,
        channelCount: orphanedChannels.length
      });

      // Validate permissions
      const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
      if (!hasPermission) {
        throw new Error('Insufficient permissions to archive orphaned channels');
      }

      const results: ChannelArchiveResult[] = [];
      const config = await this.getArchiveConfig(guild.id);
      const archiveCategory = await this.getOrCreateArchiveCategory(guild, config);

      if (!archiveCategory) {
        throw new Error('Failed to get or create archive category');
      }

      // Filter to only channels that should be archived
      const channelsToArchive = orphanedChannels.filter(c => c.shouldArchive);

      for (const orphanedInfo of channelsToArchive) {
        try {
          const channel = guild.channels.cache.get(orphanedInfo.channelId) as TextChannel;
          if (!channel) {
            results.push({
              channelId: orphanedInfo.channelId,
              channelName: orphanedInfo.channelName,
              archiveCategoryId: archiveCategory.id,
              archivedAt: new Date(),
              reason: 'Orphaned channel cleanup',
              success: false,
              error: 'Channel not found'
            });
            continue;
          }

          const result = await this.performChannelArchive(
            channel,
            archiveCategory,
            undefined, // No case data for orphaned channels
            `Orphaned channel cleanup (inactive for ${orphanedInfo.inactiveDays} days)`
          );

          // Log audit event for orphaned channel archiving
          await this.logArchiveEvent(guild.id, context.userId, result);

          results.push(result);
        } catch (error) {
          logger.error('Failed to archive orphaned channel', {
            channelId: orphanedInfo.channelId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          results.push({
            channelId: orphanedInfo.channelId,
            channelName: orphanedInfo.channelName,
            archiveCategoryId: archiveCategory.id,
            archivedAt: new Date(),
            reason: 'Orphaned channel cleanup',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Completed orphaned channel archiving', {
        guildId: guild.id,
        totalResults: results.length,
        successfulArchives: results.filter(r => r.success).length,
        failedArchives: results.filter(r => !r.success).length
      });

      return results;
    } catch (error) {
      logger.error('Error archiving orphaned channels:', error);
      throw error;
    }
  }

  /**
   * Get archive configuration for a guild
   */
  private async getArchiveConfig(guildId: string): Promise<ChannelArchiveConfig> {
    try {
      const guildConfig = await this.guildConfigRepository.findByGuildId(guildId);
      
      return {
        ...this.DEFAULT_CONFIG,
        archiveCategoryId: guildConfig?.caseArchiveCategoryId
      };
    } catch (error) {
      logger.warn('Failed to get guild archive config, using defaults', { guildId, error });
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Get or create the archive category
   */
  private async getOrCreateArchiveCategory(
    guild: Guild,
    config: ChannelArchiveConfig
  ): Promise<CategoryChannel | null> {
    try {
      // Try to find existing archive category
      if (config.archiveCategoryId) {
        const existingCategory = guild.channels.cache.get(config.archiveCategoryId);
        if (existingCategory && existingCategory.type === ChannelType.GuildCategory) {
          return existingCategory as CategoryChannel;
        }
      }

      // Look for category by name
      const existingByName = guild.channels.cache.find(
        channel => channel.type === ChannelType.GuildCategory && 
                  channel.name.toLowerCase().includes('archive')
      ) as CategoryChannel;

      if (existingByName) {
        // Update guild config with found category
        await this.updateGuildArchiveCategory(guild.id, existingByName.id);
        return existingByName;
      }

      // Create new archive category
      const archiveCategory = await guild.channels.create({
        name: '🗃️ Case Archives',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.SendMessages], // Read-only for @everyone
          },
          // Staff can still manage archived channels
          ...await this.getStaffRolePermissions(guild)
        ],
      });

      // Update guild config with new category
      await this.updateGuildArchiveCategory(guild.id, archiveCategory.id);

      logger.info('Created new archive category', {
        guildId: guild.id,
        categoryId: archiveCategory.id,
        categoryName: archiveCategory.name
      });

      return archiveCategory;
    } catch (error) {
      logger.error('Error getting or creating archive category:', error);
      return null;
    }
  }

  /**
   * Perform the actual channel archiving
   */
  private async performChannelArchive(
    channel: TextChannel,
    archiveCategory: CategoryChannel,
    caseData?: Case,
    reason: string = 'Case archived'
  ): Promise<ChannelArchiveResult> {
    try {
      const originalCategoryId = channel.parentId;
      const archivedAt = new Date();

      // Update channel name to indicate it's archived
      const archivePrefix = '[ARCHIVED]';
      const newName = channel.name.startsWith(archivePrefix) 
        ? channel.name 
        : `${archivePrefix}-${channel.name}`;

      // Move channel to archive category and update name/topic
      await channel.edit({
        name: newName,
        parent: archiveCategory.id,
        topic: `${channel.topic || ''} | Archived: ${archivedAt.toISOString().split('T')[0]} | ${reason}`,
        // Make channel read-only
        permissionOverwrites: [
          {
            id: channel.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.SendMessages],
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
          },
          // Preserve staff permissions for management
          ...await this.getStaffRolePermissions(channel.guild)
        ]
      });

      return {
        channelId: channel.id,
        channelName: newName,
        originalCategoryId: originalCategoryId || undefined,
        archiveCategoryId: archiveCategory.id,
        caseId: caseData?._id?.toString(),
        caseNumber: caseData?.caseNumber,
        archivedAt,
        reason,
        success: true
      };
    } catch (error) {
      logger.error('Error performing channel archive:', error);
      throw error;
    }
  }

  /**
   * Get staff role permissions for archive channels
   */
  private async getStaffRolePermissions(guild: Guild): Promise<Array<{
    id: string;
    allow: bigint[];
  }>> {
    try {
      const staffRolePermissions: Array<{ id: string; allow: bigint[] }> = [];
      
      // Define staff roles that should have access to archived channels
      const staffRoleNames = [
        'Managing Partner',
        'Senior Partner', 
        'Junior Partner'
      ];

      // Find staff roles in the guild
      for (const roleName of staffRoleNames) {
        const role = guild.roles.cache.find(r => r.name === roleName);
        if (role) {
          staffRolePermissions.push({
            id: role.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.ManageChannels
            ]
          });
        }
      }

      return staffRolePermissions;
    } catch (error) {
      logger.error('Error getting staff role permissions:', error);
      return [];
    }
  }

  /**
   * Get the last message date in a channel
   */
  private async getLastMessageDate(channel: TextChannel): Promise<Date | null> {
    try {
      const messages = await channel.messages.fetch({ limit: 1 });
      const lastMessage = messages.first();
      return lastMessage ? lastMessage.createdAt : null;
    } catch (error) {
      logger.warn('Failed to get last message date', { channelId: channel.id, error });
      return null;
    }
  }

  /**
   * Update guild config with archive category ID
   */
  private async updateGuildArchiveCategory(guildId: string, categoryId: string): Promise<void> {
    try {
      const existingConfig = await this.guildConfigRepository.findByGuildId(guildId);
      
      if (existingConfig) {
        await this.guildConfigRepository.update(existingConfig._id!.toString(), {
          caseArchiveCategoryId: categoryId
        });
      } else {
        // Create new config if it doesn't exist
        await this.guildConfigRepository.add({
          guildId,
          caseArchiveCategoryId: categoryId,
          permissions: {
            admin: [],
            'senior-staff': [],
            case: [],
            config: [],
            lawyer: [],
            'lead-attorney': [],
            repair: []
          },
          adminRoles: [],
          adminUsers: []
        });
      }

      logger.info('Updated guild archive category configuration', { guildId, categoryId });
    } catch (error) {
      logger.error('Failed to update guild archive category configuration:', error);
    }
  }

  /**
   * Log archive event to audit trail
   */
  private async logArchiveEvent(
    guildId: string,
    actorId: string,
    archiveResult: ChannelArchiveResult,
    _caseData?: Case
  ): Promise<void> {
    try {
      await this.auditLogRepository.add({
        guildId,
        action: AuditAction.CHANNEL_ARCHIVED,
        actorId,
        targetId: archiveResult.channelId,
        details: {
          reason: archiveResult.reason,
          metadata: {
            channelName: archiveResult.channelName,
            originalCategoryId: archiveResult.originalCategoryId,
            archiveCategoryId: archiveResult.archiveCategoryId,
            caseId: archiveResult.caseId,
            caseNumber: archiveResult.caseNumber,
            success: archiveResult.success,
            error: archiveResult.error
          }
        },
        timestamp: archiveResult.archivedAt
      });
    } catch (error) {
      logger.error('Error logging archive event:', error);
    }
  }
}