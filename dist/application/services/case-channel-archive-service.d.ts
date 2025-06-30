import { Guild } from 'discord.js';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { UnifiedValidationService } from '../validation/unified-validation-service';
import { Case } from '../../validation';
export interface ChannelArchiveConfig {
    archiveCategoryId?: string;
    retentionDays: number;
    archiveInactiveChannels: boolean;
    deleteOldArchives: boolean;
    maxArchiveAge: number;
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
export declare class CaseChannelArchiveService {
    private caseRepository;
    private guildConfigRepository;
    private auditLogRepository;
    private permissionService;
    private readonly DEFAULT_CONFIG;
    private readonly CASE_CHANNEL_PATTERNS;
    constructor(caseRepository: CaseRepository, guildConfigRepository: GuildConfigRepository, auditLogRepository: AuditLogRepository, permissionService: PermissionService, _validationService: UnifiedValidationService);
    /**
     * Archive a specific case channel when the case is closed
     */
    archiveCaseChannel(guild: Guild, caseData: Case, context: PermissionContext): Promise<ChannelArchiveResult>;
    /**
     * Archive multiple case channels based on closed cases
     */
    archiveClosedCaseChannels(guild: Guild, context: PermissionContext): Promise<ChannelArchiveResult[]>;
    /**
     * Find and handle orphaned case channels (channels without corresponding cases)
     */
    findOrphanedCaseChannels(guild: Guild, context: PermissionContext): Promise<OrphanedChannelInfo[]>;
    /**
     * Archive orphaned case channels
     */
    archiveOrphanedChannels(guild: Guild, orphanedChannels: OrphanedChannelInfo[], context: PermissionContext): Promise<ChannelArchiveResult[]>;
    /**
     * Get archive configuration for a guild
     */
    private getArchiveConfig;
    /**
     * Get or create the archive category
     */
    private getOrCreateArchiveCategory;
    /**
     * Perform the actual channel archiving
     */
    private performChannelArchive;
    /**
     * Get staff role permissions for archive channels
     */
    private getStaffRolePermissions;
    /**
     * Get the last message date in a channel
     */
    private getLastMessageDate;
    /**
     * Update guild config with archive category ID
     */
    private updateGuildArchiveCategory;
    /**
     * Log archive event to audit trail
     */
    private logArchiveEvent;
}
//# sourceMappingURL=case-channel-archive-service.d.ts.map