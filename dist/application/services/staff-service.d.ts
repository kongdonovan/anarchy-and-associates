import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { Staff } from '../../domain/entities/staff';
import { StaffRole } from '../../domain/entities/staff-role';
import { PermissionService, PermissionContext } from './permission-service';
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
    isGuildOwner?: boolean;
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
    private permissionService;
    constructor(staffRepository: StaffRepository, auditLogRepository: AuditLogRepository, permissionService: PermissionService);
    validateRobloxUsername(username: string): Promise<RobloxValidationResult>;
    hireStaff(context: PermissionContext, request: StaffHireRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    promoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    demoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    fireStaff(context: PermissionContext, request: StaffTerminationRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    getStaffInfo(context: PermissionContext, userId: string): Promise<Staff | null>;
    getStaffList(context: PermissionContext, roleFilter?: StaffRole, page?: number, limit?: number): Promise<{
        staff: Staff[];
        total: number;
        totalPages: number;
    }>;
    getStaffHierarchy(context: PermissionContext): Promise<Staff[]>;
    getRoleCounts(context: PermissionContext): Promise<Record<StaffRole, number>>;
}
//# sourceMappingURL=staff-service.d.ts.map