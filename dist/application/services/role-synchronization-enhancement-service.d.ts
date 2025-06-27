import { GuildMember, Guild } from 'discord.js';
import { StaffRole } from '../../domain/entities/staff-role';
export declare enum ConflictSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface RoleConflict {
    userId: string;
    username: string;
    guildId: string;
    conflictingRoles: Array<{
        roleName: string;
        roleId: string;
        staffRole: StaffRole;
        level: number;
    }>;
    highestRole: {
        roleName: string;
        roleId: string;
        staffRole: StaffRole;
        level: number;
    };
    severity: ConflictSeverity;
    detectedAt: Date;
}
export interface RoleValidationResult {
    isValid: boolean;
    conflicts?: string[];
    preventionReason?: string;
}
export interface ConflictResolutionResult {
    userId: string;
    resolved: boolean;
    removedRoles: string[];
    keptRole: string;
    error?: string;
}
export interface BulkSyncProgress {
    total: number;
    processed: number;
    conflictsFound: number;
    conflictsResolved: number;
    errors: number;
    currentUser?: string;
}
export interface ConflictReport {
    guildId: string;
    generatedAt: Date;
    totalMembers: number;
    membersWithRoles: number;
    conflictsFound: number;
    conflictsByRole: Record<string, number>;
    conflictsBySeverity: Record<ConflictSeverity, number>;
    resolutionHistory: Array<{
        userId: string;
        username: string;
        resolvedAt: Date;
        removedRoles: string[];
        keptRole: string;
    }>;
}
export declare class RoleSynchronizationEnhancementService {
    private auditLogRepository;
    private readonly STAFF_ROLE_MAPPING;
    private readonly STAFF_ROLES_HIERARCHY;
    private conflictHistory;
    constructor();
    /**
     * Detect role conflicts for a specific guild member
     */
    detectMemberConflicts(member: GuildMember): Promise<RoleConflict | null>;
    /**
     * Scan entire guild for role conflicts
     */
    scanGuildForConflicts(guild: Guild, progressCallback?: (progress: BulkSyncProgress) => void): Promise<RoleConflict[]>;
    /**
     * Resolve a role conflict by removing lower-precedence roles
     */
    resolveConflict(member: GuildMember, conflict: RoleConflict, notify?: boolean): Promise<ConflictResolutionResult>;
    /**
     * Bulk resolve all conflicts in a guild
     */
    bulkResolveConflicts(guild: Guild, conflicts: RoleConflict[], progressCallback?: (progress: BulkSyncProgress) => void): Promise<ConflictResolutionResult[]>;
    /**
     * Validate a role assignment before it happens
     */
    validateRoleAssignment(member: GuildMember, newRoleName: string): Promise<RoleValidationResult>;
    /**
     * Generate a detailed conflict report for a guild
     */
    generateConflictReport(guild: Guild): Promise<ConflictReport>;
    /**
     * Get staff roles from a guild member
     */
    private getStaffRolesFromMember;
    /**
     * Calculate conflict severity based on role differences
     */
    private calculateConflictSeverity;
    /**
     * Create audit log entry for conflict resolution
     */
    private createConflictResolutionAuditLog;
    /**
     * Send DM notification about conflict resolution
     */
    private sendConflictResolutionNotification;
    /**
     * Add to conflict resolution history
     */
    private addToConflictHistory;
    /**
     * Utility delay function for rate limiting
     */
    private delay;
    /**
     * Clear conflict history for a guild
     */
    clearConflictHistory(guildId: string): void;
    /**
     * Get conflict statistics for a guild
     */
    getConflictStatistics(guildId: string): {
        totalResolutions: number;
        successfulResolutions: number;
        failedResolutions: number;
        mostCommonConflicts: Record<string, number>;
    };
    /**
     * Perform incremental sync for specific members or changes since last sync
     */
    incrementalSync(guild: Guild, options?: {
        memberIds?: string[];
        sinceTimestamp?: Date;
        autoResolve?: boolean;
    }): Promise<{
        conflicts: RoleConflict[];
        resolved: ConflictResolutionResult[];
        errors: string[];
    }>;
    /**
     * Create interactive modal for manual conflict resolution
     */
    createConflictResolutionModal(conflict: RoleConflict): {
        customId: string;
        title: string;
        components: any[];
    };
    /**
     * Handle manual conflict resolution from modal submission
     */
    handleManualConflictResolution(interaction: any, // ModalSubmitInteraction
    conflict: RoleConflict): Promise<ConflictResolutionResult>;
    /**
     * Check for conflicts when a role change occurs (for RoleTrackingService integration)
     */
    checkRoleChangeForConflicts(member: GuildMember, oldRoles: string[], newRoles: string[]): Promise<{
        hasConflict: boolean;
        conflict?: RoleConflict;
        shouldPrevent: boolean;
        preventionReason?: string;
    }>;
    /**
     * Get last sync timestamp for a guild
     */
    private lastSyncTimestamps;
    getLastSyncTimestamp(guildId: string): Date | null;
    updateLastSyncTimestamp(guildId: string): void;
}
//# sourceMappingURL=role-synchronization-enhancement-service.d.ts.map