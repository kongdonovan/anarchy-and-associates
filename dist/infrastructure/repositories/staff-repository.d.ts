import { BaseMongoRepository } from './base-mongo-repository';
import { Staff } from '../../domain/entities/staff';
import { StaffRole } from '../../domain/entities/staff-role';
export declare class StaffRepository extends BaseMongoRepository<Staff> {
    constructor();
    findByGuildId(guildId: string): Promise<Staff[]>;
    findByUserId(guildId: string, userId: string): Promise<Staff | null>;
    findByRole(guildId: string, role: StaffRole): Promise<Staff[]>;
    findByRoles(guildId: string, roles: StaffRole[]): Promise<Staff[]>;
    getStaffCountByRole(guildId: string, role: StaffRole): Promise<number>;
    getAllStaffCountsByRole(guildId: string): Promise<Record<StaffRole, number>>;
    findStaffHierarchy(guildId: string): Promise<Staff[]>;
    findStaffWithPagination(guildId: string, page?: number, limit?: number, roleFilter?: StaffRole): Promise<{
        staff: Staff[];
        total: number;
        totalPages: number;
    }>;
    updateStaffRole(guildId: string, userId: string, newRole: StaffRole, promotedBy: string, reason?: string): Promise<Staff | null>;
    terminateStaff(guildId: string, userId: string, terminatedBy: string, reason?: string): Promise<Staff | null>;
    findSeniorStaff(guildId: string): Promise<Staff[]>;
    canHireRole(guildId: string, role: StaffRole): Promise<boolean>;
    findStaffByRobloxUsername(guildId: string, robloxUsername: string): Promise<Staff | null>;
}
//# sourceMappingURL=staff-repository.d.ts.map