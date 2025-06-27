import { Guild, GuildMember } from 'discord.js';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { BusinessRuleValidationService } from './business-rule-validation-service';
import { StaffRole } from '../../domain/entities/staff-role';
export interface ChannelPermissionUpdate {
    channelId: string;
    channelName: string;
    updateType: 'role-change' | 'case-assignment' | 'permission-sync';
    affectedUserId: string;
    oldRole?: string;
    newRole?: string;
    permissionsGranted: string[];
    permissionsRevoked: string[];
    timestamp: Date;
}
export interface ChannelPermissionRule {
    channelType: 'case' | 'staff' | 'admin' | 'legal-team';
    requiredRole?: StaffRole;
    requiredPermission?: string;
    permissions: {
        view: boolean;
        send: boolean;
        manage: boolean;
        read_history: boolean;
    };
}
export declare class ChannelPermissionManager {
    private caseRepository;
    private staffRepository;
    private auditLogRepository;
    private businessRuleValidationService;
    private readonly CHANNEL_PATTERNS;
    private readonly PERMISSION_MATRIX;
    constructor(caseRepository: CaseRepository, staffRepository: StaffRepository, auditLogRepository: AuditLogRepository, businessRuleValidationService: BusinessRuleValidationService);
    /**
     * Handle role change and update all relevant channel permissions
     */
    handleRoleChange(guild: Guild, member: GuildMember, oldRole?: StaffRole, newRole?: StaffRole, changeType?: 'hire' | 'fire' | 'promotion' | 'demotion'): Promise<ChannelPermissionUpdate[]>;
    /**
     * Update permissions for a specific channel based on role change
     */
    private updateChannelPermissions;
    /**
     * Get all channels that need permission updates for a user
     */
    private getChannelsForPermissionUpdate;
    /**
     * Detect channel type based on naming patterns
     */
    private detectChannelType;
    /**
     * Calculate permissions for a role in a specific channel type
     */
    private calculateChannelPermissions;
    /**
     * Validate if user should have access to a channel type based on business rules
     */
    private validateChannelAccess;
    /**
     * Sync all channel permissions for a guild (maintenance operation)
     */
    syncGuildChannelPermissions(guild: Guild): Promise<ChannelPermissionUpdate[]>;
    /**
     * Log channel permission updates to audit trail
     */
    private logChannelPermissionUpdates;
}
//# sourceMappingURL=channel-permission-manager.d.ts.map