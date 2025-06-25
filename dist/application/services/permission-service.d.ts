import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { GuildConfig } from '../../domain/entities/guild-config';
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
    hasHRPermission(guildId: string, userId: string): Promise<boolean>;
    /**
     * Check HR permission with proper context (preferred method)
     */
    hasHRPermissionWithContext(context: PermissionContext): Promise<boolean>;
    hasRetainerPermission(guildId: string, userId: string): Promise<boolean>;
    /**
     * Check retainer permission with proper context (preferred method)
     */
    hasRetainerPermissionWithContext(context: PermissionContext): Promise<boolean>;
    getPermissionSummary(context: PermissionContext): Promise<{
        isAdmin: boolean;
        isGuildOwner: boolean;
        permissions: Record<PermissionAction, boolean>;
    }>;
}
//# sourceMappingURL=permission-service.d.ts.map