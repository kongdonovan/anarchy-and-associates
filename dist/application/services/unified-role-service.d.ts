import { Guild, GuildMember, Client } from 'discord.js';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { ChannelPermissionManager } from './channel-permission-manager';
import { PermissionService, PermissionContext } from './permission-service';
import { Staff, StaffRole as StaffRoleType } from '../../validation';
export interface StaffHireRequest {
    guildId: string;
    userId: string;
    robloxUsername: string;
    role: StaffRoleType;
    hiredBy: string;
    reason: string;
}
export interface StaffTerminationRequest {
    guildId: string;
    userId: string;
    terminatedBy: string;
    reason: string;
}
export interface StaffPromotionRequest {
    guildId: string;
    userId: string;
    newRole: StaffRoleType;
    promotedBy: string;
    reason: string;
}
export interface RoleMapping {
    staffRole: StaffRoleType;
    discordRoleId: string;
    discordRoleName: string;
}
export interface RoleChangeEvent {
    member: GuildMember;
    oldRole?: StaffRoleType;
    newRole?: StaffRoleType;
    changeType: 'hire' | 'fire' | 'promotion' | 'demotion';
}
export interface RoleConflict {
    userId: string;
    username: string;
    guildId: string;
    conflictingRoles: Array<{
        roleName: string;
        roleId: string;
        staffRole: StaffRoleType;
        level: number;
    }>;
    highestRole: {
        roleName: string;
        roleId: string;
        staffRole: StaffRoleType;
        level: number;
    };
    severity: ConflictSeverity;
    detectedAt: Date;
}
export interface ConflictResolutionResult {
    userId: string;
    resolved: boolean;
    removedRoles: string[];
    keptRole: string;
    error?: string;
}
export interface RoleValidationResult {
    isValid: boolean;
    conflicts?: string[];
    preventionReason?: string;
}
export interface RoleSyncResult {
    synced: number;
    failed: number;
    errors: string[];
}
export declare enum ConflictSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface RobloxValidationResult {
    isValid: boolean;
    username: string;
    error?: string;
}
/**
 * Unified Role Management Service
 *
 * Consolidates all role-related functionality into a single, comprehensive service:
 * - Staff lifecycle management (hire/fire/promote/demote)
 * - Discord role change tracking and event handling
 * - Bidirectional role synchronization between Discord and database
 * - Role conflict detection and resolution
 * - Cascading effects management (case assignments, permissions)
 *
 * This service implements the strategy pattern for different role operations
 * and provides a unified interface for all role management needs.
 */
export declare class UnifiedRoleService {
    private staffRepository;
    private auditLogRepository;
    private caseRepository;
    private channelPermissionManager;
    private permissionService;
    private roleMappings;
    private conflictHistory;
    private readonly STAFF_ROLE_MAPPING;
    private readonly STAFF_ROLES_HIERARCHY;
    private readonly LAWYER_ROLES;
    private readonly LEAD_ATTORNEY_ROLES;
    constructor(staffRepository: StaffRepository, auditLogRepository: AuditLogRepository, caseRepository: CaseRepository, channelPermissionManager: ChannelPermissionManager, permissionService: PermissionService);
    /**
     * Initialize role tracking for a Discord client
     */
    initializeDiscordTracking(client: Client): void;
    /**
     * Handle Discord role changes for a guild member
     */
    handleDiscordRoleChange(oldMember: GuildMember, newMember: GuildMember): Promise<void>;
    /**
     * Validates a Roblox username according to Roblox's naming rules.
     *
     * This method ensures that usernames meet Roblox's requirements:
     * - 3-20 characters in length
     * - Contains only letters, numbers, and underscores
     * - Does not start or end with an underscore
     */
    validateRobloxUsername(username: string): Promise<RobloxValidationResult>;
    /**
     * Hires a new staff member into the firm.
     *
     * This method performs comprehensive validation before creating a new staff record:
     * - Validates permissions (requires senior-staff permission)
     * - Validates Discord IDs for security
     * - Validates and ensures Roblox username uniqueness
     * - Checks if user is already an active staff member
     * - Validates role limits (with guild owner bypass option)
     * - Creates initial promotion history entry
     * - Logs the action to audit trail
     */
    hireStaff(context: PermissionContext, request: StaffHireRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    /**
     * Promotes a staff member to a higher role in the hierarchy.
     */
    promoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    /**
     * Demotes a staff member to a lower role in the hierarchy.
     */
    demoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    /**
     * Initiates the firing process for a staff member.
     *
     * Important: This method validates and logs the action, but the actual
     * database update is handled when Discord roles are removed.
     */
    fireStaff(context: PermissionContext, request: StaffTerminationRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    /**
     * Retrieves detailed information about a specific staff member.
     */
    getStaffInfo(context: PermissionContext, userId: string): Promise<Staff | null>;
    /**
     * Retrieves a paginated list of staff members with optional role filtering.
     */
    getStaffList(context: PermissionContext, roleFilter?: StaffRoleType, page?: number, limit?: number): Promise<{
        staff: Staff[];
        total: number;
        totalPages: number;
    }>;
    /**
     * Retrieves the complete staff hierarchy sorted by role level.
     */
    getStaffHierarchy(context: PermissionContext): Promise<Staff[]>;
    /**
     * Retrieves the count of active staff members for each role.
     */
    getRoleCounts(context: PermissionContext): Promise<Record<StaffRoleType, number>>;
    /**
     * Initialize guild role mappings for Discord role synchronization
     */
    initializeGuildRoleMappings(guild: Guild): Promise<void>;
    /**
     * Synchronize a staff member's Discord role with their database role
     */
    syncStaffRole(guild: Guild, staff: Staff, actorId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Synchronize all staff roles in a guild
     */
    syncAllStaffRoles(guild: Guild, actorId: string): Promise<RoleSyncResult>;
    /**
     * Detect role conflicts for a specific guild member
     */
    detectMemberConflicts(member: GuildMember): Promise<RoleConflict | null>;
    /**
     * Resolve a role conflict by removing lower-precedence roles
     */
    resolveRoleConflict(member: GuildMember, conflict: RoleConflict, notify?: boolean): Promise<ConflictResolutionResult>;
    /**
     * Check for conflicts when a role change occurs
     */
    checkRoleChangeForConflicts(member: GuildMember, oldRoles: string[], newRoles: string[]): Promise<{
        hasConflict: boolean;
        conflict?: RoleConflict;
        shouldPrevent: boolean;
        preventionReason?: string;
    }>;
    /**
     * Handle cascading effects of role changes
     */
    handleCascadingEffects(event: RoleChangeEvent): Promise<void>;
    /**
     * Handle automatic hiring when Discord role is added
     */
    private handleAutomaticHiring;
    /**
     * Handle automatic firing when Discord role is removed
     */
    private handleAutomaticFiring;
    /**
     * Handle automatic promotion when Discord role is upgraded
     */
    private handleAutomaticPromotion;
    /**
     * Handle automatic demotion when Discord role is downgraded
     */
    private handleAutomaticDemotion;
    /**
     * Handle when a staff member loses all lawyer permissions
     */
    private handleLossOfLawyerPermissions;
    /**
     * Handle when a staff member loses lead attorney permissions but retains lawyer permissions
     */
    private handleLossOfLeadAttorneyPermissions;
    /**
     * Handle cases that have no lawyers assigned
     */
    private handleCaseWithNoLawyers;
    /**
     * Get staff roles from a list of role names
     */
    private getStaffRolesFromMemberNames;
    /**
     * Get staff roles from a guild member with detailed information
     */
    private getStaffRolesFromMember;
    /**
     * Get the highest (most senior) staff role from a list
     */
    private getHighestStaffRole;
    /**
     * Get the hierarchy level of a Discord role (higher = more senior)
     */
    private getRoleLevel;
    /**
     * Map Discord role name to StaffRole enum
     */
    private mapDiscordRoleToStaffRole;
    /**
     * Check if a role has lawyer permissions
     */
    private hasLawyerPermissions;
    /**
     * Check if a role has lead attorney permissions
     */
    private hasLeadAttorneyPermissions;
    /**
     * Calculate conflict severity based on role differences
     */
    private calculateConflictSeverity;
    /**
     * Add to conflict resolution history
     */
    private addToConflictHistory;
    /**
     * Create audit log entry for conflict resolution
     */
    private createConflictResolutionAuditLog;
    /**
     * Send DM notification about conflict resolution
     */
    private sendConflictResolutionNotification;
    /**
     * Notify user via DM about case removal
     */
    private notifyUserOfCaseRemoval;
    /**
     * Notify user via DM about lead attorney removal
     */
    private notifyUserOfLeadAttorneyRemoval;
    /**
     * Notify case channel about staffing changes
     */
    private notifyCaseChannel;
    /**
     * Notify case channel about lead attorney removal
     */
    private notifyCaseChannelLeadAttorneyRemoval;
    /**
     * Log audit event for role changes
     */
    private logRoleChangeAuditEvent;
    /**
     * Log audit event for cascading changes
     */
    private logCascadeAuditEvent;
    /**
     * Log audit event for lead attorney removal
     */
    private logLeadAttorneyRemovalAuditEvent;
}
//# sourceMappingURL=unified-role-service.d.ts.map