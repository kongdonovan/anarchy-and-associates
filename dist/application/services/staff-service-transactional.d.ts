import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { UnifiedValidationService } from '../validation/unified-validation-service';
import { IUnitOfWorkFactory } from '../../infrastructure/unit-of-work/unit-of-work';
import { Staff, StaffRole } from '../../validation';
import { RollbackService } from '../../infrastructure/unit-of-work/rollback-service';
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
/**
 * Enhanced StaffService with Unit of Work transaction support.
 *
 * This service provides transactional staff management operations with:
 * - Atomic database operations using MongoDB transactions
 * - Automatic rollback on failures
 * - Compensation actions for non-transactional operations
 * - Comprehensive audit logging within transactions
 *
 * ## Key Improvements:
 * - Staff hiring/firing operations are fully atomic
 * - Role limit bypass logging is included in the same transaction
 * - Discord role operations have compensation actions for rollback
 * - Enhanced error handling with transaction context
 */
export declare class TransactionalStaffService {
    private staffRepository;
    private _auditLogRepository;
    private permissionService;
    private validationAdapter;
    private unitOfWorkFactory;
    private rollbackService;
    constructor(staffRepository: StaffRepository, auditLogRepository: AuditLogRepository, permissionService: PermissionService, validationService: UnifiedValidationService, unitOfWorkFactory?: IUnitOfWorkFactory, rollbackService?: RollbackService);
    /**
     * Validates a Roblox username according to Roblox's naming rules.
     * This method is identical to the original but included for completeness.
     */
    validateRobloxUsername(username: string): Promise<RobloxValidationResult>;
    /**
     * Hires a new staff member using atomic transactions.
     *
     * This method performs all validation outside the transaction for performance,
     * then executes the database operations atomically within a transaction.
     *
     * ## Transaction Scope:
     * - Staff record creation
     * - Audit log creation (if role limit bypass occurs)
     *
     * ## Compensation Actions:
     * - Discord role removal (if Discord role was assigned)
     * - Notification to administrators about failed hiring
     *
     * @param context - Permission context containing user and guild information
     * @param request - Staff hire request with user details and role
     * @returns Success status with created staff record or error message
     */
    hireStaffTransactional(context: PermissionContext, request: StaffHireRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    /**
     * Promotes a staff member using atomic transactions.
     *
     * ## Transaction Scope:
     * - Staff role update
     * - Promotion history update
     * - Audit log creation
     * - Role limit bypass logging (if applicable)
     */
    promoteStaffTransactional(context: PermissionContext, request: StaffPromotionRequest): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    /**
     * Validates the hire request outside of the transaction for performance.
     */
    private validateHireRequest;
    /**
     * Validates the promotion request outside of the transaction.
     */
    private validatePromotionRequest;
    /**
     * Registers compensation actions for hire operations.
     */
    private registerHireCompensationActions;
}
//# sourceMappingURL=staff-service-transactional.d.ts.map