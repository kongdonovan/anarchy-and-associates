import { Guild } from 'discord.js';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { Staff, StaffRole } from '../../validation';
export interface RoleMapping {
    staffRole: StaffRole;
    discordRoleId: string;
    discordRoleName: string;
}
export declare class DiscordRoleSyncService {
    private staffRepository;
    private auditLogRepository;
    private roleMappings;
    constructor(staffRepository: StaffRepository, auditLogRepository: AuditLogRepository);
    initializeGuildRoleMappings(guild: Guild): Promise<void>;
    syncStaffRole(guild: Guild, staff: Staff, actorId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    syncAllStaffRoles(guild: Guild, actorId: string): Promise<{
        synced: number;
        failed: number;
        errors: string[];
    }>;
    removeStaffRoles(guild: Guild, userId: string, actorId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getRoleMappings(guildId: string): RoleMapping[];
    createMissingRoles(guild: Guild): Promise<{
        created: number;
        errors: string[];
    }>;
    private getRoleColor;
}
//# sourceMappingURL=discord-role-sync-service.d.ts.map