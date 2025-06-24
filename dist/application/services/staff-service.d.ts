import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { Staff } from '../../domain/entities/staff';
import { StaffRole } from '../../domain/entities/staff-role';
export interface RobloxValidationResult {
    isValid: boolean;
    username: string;
    error?: string;
}
export interface StaffHireRequest {
    guildId: string;
    userId: string;
    robloxUsername: string;
    role: StaffRole;
    hiredBy: string;
    reason?: string;
}
export interface StaffPromotionRequest {
    guildId: string;
    userId: string;
    newRole: StaffRole;
    promotedBy: string;
    reason?: string;
}
export interface StaffTerminationRequest {
    guildId: string;
    userId: string;
    terminatedBy: string;
    reason?: string;
}
export declare class StaffService {
    private staffRepository;
    private auditLogRepository;
    constructor(staffRepository: StaffRepository, auditLogRepository: AuditLogRepository);
    validateRobloxUsername(username: string): Promise<RobloxValidationResult>;
    hireStaff(request: StaffHireRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    promoteStaff(request: StaffPromotionRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    demoteStaff(request: StaffPromotionRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    fireStaff(request: StaffTerminationRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    getStaffInfo(guildId: string, userId: string, requestedBy: string): Promise<Staff | null>;
    getStaffList(guildId: string, requestedBy: string, roleFilter?: StaffRole, page?: number, limit?: number): Promise<{
        staff: Staff[];
        total: number;
        totalPages: number;
    }>;
    getStaffHierarchy(guildId: string): Promise<Staff[]>;
    getRoleCounts(guildId: string): Promise<Record<StaffRole, number>>;
}
//# sourceMappingURL=staff-service.d.ts.map