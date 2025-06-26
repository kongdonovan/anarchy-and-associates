import { Guild } from 'discord.js';
export interface RoleChangeEvent {
    type: 'hire' | 'fire' | 'promotion' | 'demotion';
    userId: string;
    guildId: string;
    oldRole?: string;
    newRole?: string;
    changedBy?: string;
    timestamp: Date;
}
export declare class RoleTrackingService {
    private staffRepository;
    private auditLogRepository;
    private channelPermissionManager;
    private roleChangeCascadeService;
    private roleSynchronizationEnhancementService;
    private readonly STAFF_ROLE_MAPPING;
    private readonly STAFF_ROLES_HIERARCHY;
    constructor();
    /**
     * Initialize role tracking for a Discord client
     */
    initializeTracking(client: any): void;
    /**
     * Handle role changes for a guild member
     */
    private handleRoleChange;
    /**
     * Handle hiring a new staff member
     */
    private handleHiring;
    /**
     * Handle firing a staff member
     */
    private handleFiring;
    /**
     * Handle promotion of a staff member
     */
    private handlePromotion;
    /**
     * Handle demotion of a staff member
     */
    private handleDemotion;
    /**
     * Extract staff roles from a list of role names
     */
    private getStaffRoles;
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
     * Find Discord role ID by name
     */
    private findDiscordRoleId;
    /**
     * Log audit event for role changes
     */
    private logAuditEvent;
    /**
     * Manually sync all Discord roles with staff database for a guild
     */
    syncGuildRoles(guild: Guild): Promise<void>;
}
//# sourceMappingURL=role-tracking-service.d.ts.map