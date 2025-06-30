import { Client, GuildMember } from 'discord.js';
import { StaffRole } from '../../validation';
export type RoleChangeType = 'hire' | 'fire' | 'promotion' | 'demotion';
export interface RoleChangeEvent {
    member: GuildMember;
    oldRole?: StaffRole;
    newRole?: StaffRole;
    changeType: RoleChangeType;
}
export declare class RoleChangeCascadeService {
    private caseRepository;
    private caseService;
    private channelPermissionManager;
    private auditLogRepository;
    private staffRepository;
    private readonly LAWYER_ROLES;
    private readonly LEAD_ATTORNEY_ROLES;
    constructor();
    /**
     * Initialize the cascade service with Discord client
     */
    initialize(_client: Client): void;
    /**
     * Handle cascading effects of role changes
     */
    handleRoleChange(event: RoleChangeEvent): Promise<void>;
    /**
     * Handle when a staff member loses all lawyer permissions
     */
    private handleLossOfLawyerPermissions;
    /**
     * Handle when a staff member loses lead attorney permissions but retains lawyer permissions
     */
    private handleLossOfLeadAttorneyPermissions;
    /**
     * Process a single case for unassignment
     */
    private processCase;
    /**
     * Remove lead attorney status from a case
     */
    private removeLeadAttorneyStatus;
    /**
     * Handle cases that have no lawyers assigned
     */
    private handleCaseWithNoLawyers;
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
     * Check if a role has lawyer permissions
     */
    private hasLawyerPermissions;
    /**
     * Check if a role has lead attorney permissions
     */
    private hasLeadAttorneyPermissions;
    /**
     * Log audit event for cascading changes
     */
    private logCascadeAuditEvent;
    /**
     * Log audit event for lead attorney removal
     */
    private logLeadAttorneyRemovalAuditEvent;
}
//# sourceMappingURL=role-change-cascade-service.d.ts.map