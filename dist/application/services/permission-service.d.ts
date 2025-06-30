import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { GuildConfig } from '../../validation';
export type PermissionAction = keyof GuildConfig['permissions'];
export interface PermissionContext {
    guildId: string;
    userId: string;
    userRoles: string[];
    isGuildOwner?: boolean;
}
export declare class PermissionService {
    private guildConfigRepository;
    constructor(guildConfigRepository: GuildConfigRepository);
    hasActionPermission(context: PermissionContext, action: PermissionAction): Promise<boolean>;
    isAdmin(context: PermissionContext): Promise<boolean>;
    canManageAdmins(context: PermissionContext): Promise<boolean>;
    canManageConfig(context: PermissionContext): Promise<boolean>;
    /**
     * @deprecated Use hasSeniorStaffPermissionWithContext instead
     */
    hasHRPermission(guildId: string, userId: string): Promise<boolean>;
    /**
     * @deprecated Use hasSeniorStaffPermissionWithContext instead
     */
    hasHRPermissionWithContext(context: PermissionContext): Promise<boolean>;
    /**
     * Check senior staff permission (replaces HR permission with broader scope)
     */
    hasSeniorStaffPermissionWithContext(context: PermissionContext): Promise<boolean>;
    /**
     * @deprecated Use hasLawyerPermissionWithContext instead
     */
    hasRetainerPermission(guildId: string, userId: string): Promise<boolean>;
    /**
     * @deprecated Use hasLawyerPermissionWithContext instead
     */
    hasRetainerPermissionWithContext(context: PermissionContext): Promise<boolean>;
    /**
     * Check lawyer permission (replaces retainer permission, for legal practice)
     */
    hasLawyerPermissionWithContext(context: PermissionContext): Promise<boolean>;
    /**
     * Check lead attorney permission (for lead attorney assignments)
     */
    hasLeadAttorneyPermissionWithContext(context: PermissionContext): Promise<boolean>;
    getPermissionSummary(context: PermissionContext): Promise<{
        isAdmin: boolean;
        isGuildOwner: boolean;
        permissions: Record<PermissionAction, boolean>;
    }>;
}
//# sourceMappingURL=permission-service.d.ts.map