import { BaseMongoRepository } from './base-mongo-repository';
import { Staff, StaffRole } from '../../validation';
export declare class StaffRepository extends BaseMongoRepository<Staff> {
    constructor();
    findByGuildId(guildId: unknown): Promise<Staff[]>;
    findByUserId(guildId: unknown, userId: unknown): Promise<Staff | null>;
    findByRole(guildId: unknown, role: unknown): Promise<Staff[]>;
    findByRoles(guildId: unknown, roles: unknown): Promise<Staff[]>;
    getStaffCountByRole(guildId: unknown, role: unknown): Promise<number>;
    getAllStaffCountsByRole(guildId: unknown): Promise<Record<StaffRole, number>>;
    findStaffHierarchy(guildId: unknown): Promise<Staff[]>;
    findStaffWithPagination(guildId: unknown, page?: unknown, limit?: unknown, roleFilter?: unknown): Promise<{
        staff: Staff[];
        total: number;
        totalPages: number;
    }>;
    updateStaffRole(guildId: unknown, userId: unknown, newRole: unknown, promotedBy: unknown, reason?: unknown): Promise<Staff | null>;
    terminateStaff(guildId: unknown, userId: unknown, terminatedBy: unknown, reason?: unknown): Promise<Staff | null>;
    findSeniorStaff(guildId: unknown): Promise<Staff[]>;
    canHireRole(guildId: unknown, role: unknown): Promise<boolean>;
    findStaffByRobloxUsername(guildId: unknown, robloxUsername: unknown): Promise<Staff | null>;
}
//# sourceMappingURL=staff-repository.d.ts.map