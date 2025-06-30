import { Guild } from 'discord.js';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { UnifiedValidationService } from '../validation/unified-validation-service';
import { CaseChannelArchiveService } from './case-channel-archive-service';
export interface ChannelCleanupConfig {
    scanInterval: number;
    inactivityThreshold: number;
    archiveThreshold: number;
    deleteThreshold: number;
    batchSize: number;
    enableAutoCleanup: boolean;
    notificationChannelId?: string;
    excludedCategories: string[];
    excludedChannels: string[];
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
export declare class OrphanedChannelCleanupService {
    private caseRepository;
    private guildConfigRepository;
    private auditLogRepository;
    private staffRepository;
    private permissionService;
    private caseChannelArchiveService;
    private readonly DEFAULT_CONFIG;
    private readonly CHANNEL_PATTERNS;
    private cleanupIntervals;
    constructor(caseRepository: CaseRepository, guildConfigRepository: GuildConfigRepository, auditLogRepository: AuditLogRepository, staffRepository: StaffRepository, permissionService: PermissionService, _validationService: UnifiedValidationService, caseChannelArchiveService: CaseChannelArchiveService);
    /**
     * Perform a comprehensive scan for orphaned channels
     */
    scanForOrphanedChannels(guild: Guild, context: PermissionContext): Promise<OrphanedChannelDetails[]>;
    /**
     * Analyze a single channel to determine if it's orphaned
     */
    private analyzeChannel;
    /**
     * Identify the type of channel based on naming patterns
     */
    private identifyChannelType;
    /**
     * Get channel activity information
     */
    private getChannelActivity;
    /**
     * Check if a channel is orphaned based on its type
     */
    private checkIfOrphaned;
    /**
     * Determine the recommended action for an orphaned channel
     */
    private determineRecommendedAction;
    /**
     * Extract case number from channel name
     */
    private extractCaseNumber;
    /**
     * Find related channels (e.g., other channels for the same case or client)
     */
    private findRelatedChannels;
    /**
     * Perform cleanup on orphaned channels
     */
    performCleanup(guild: Guild, orphanedChannels: OrphanedChannelDetails[], context: PermissionContext, options?: {
        dryRun?: boolean;
        confirmationRequired?: boolean;
        actionsToPerform?: ('archive' | 'delete' | 'review')[];
    }): Promise<CleanupReport>;
    /**
     * Process a single orphaned channel
     */
    private processOrphanedChannel;
    /**
     * Enable or disable automatic cleanup for a guild
     */
    setAutoCleanup(guildId: string, enabled: boolean, context: PermissionContext): Promise<void>;
    /**
     * Start automatic cleanup interval for a guild
     */
    private startAutoCleanup;
    /**
     * Stop automatic cleanup interval for a guild
     */
    private stopAutoCleanup;
    /**
     * Get cleanup configuration for a guild
     */
    private getCleanupConfig;
    /**
     * Update cleanup configuration for a guild
     */
    private updateCleanupConfig;
    /**
     * Log cleanup report to audit trail
     */
    private logCleanupReport;
    /**
     * Send cleanup notification to configured channel
     */
    private sendCleanupNotification;
    /**
     * Get cleanup status and next scheduled run
     */
    getCleanupStatus(guildId: string): Promise<{
        enabled: boolean;
        lastRun?: Date;
        nextRun?: Date;
        config: ChannelCleanupConfig;
    }>;
    /**
     * Clean up resources when service is destroyed
     */
    destroy(): void;
}
//# sourceMappingURL=orphaned-channel-cleanup-service.d.ts.map