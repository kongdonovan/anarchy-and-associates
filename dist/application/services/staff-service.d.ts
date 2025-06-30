import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { UnifiedValidationService } from '../validation/unified-validation-service';
import { Staff, StaffRole } from '../../validation';
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
 * Service responsible for managing the complete lifecycle of staff members within the legal firm.
 *
 * This service handles all staff-related operations including hiring, firing, promotions, and demotions.
 * It enforces the firm's role hierarchy, validates role limits, and ensures data integrity across
 * all staff management operations.
 *
 * ## Key Responsibilities:
 * - Staff lifecycle management (hire, promote, demote, fire)
 * - Role hierarchy enforcement (6-level system from Paralegal to Managing Partner)
 * - Business rule validation (role limits, promotion restrictions)
 * - Roblox username validation and uniqueness checks
 * - Permission-based access control for all operations
 * - Comprehensive audit logging of all staff changes
 *
 * ## Role Hierarchy:
 * 1. **Managing Partner** (Level 6) - Max: 1
 * 2. **Senior Partner** (Level 5) - Max: 3
 * 3. **Junior Partner** (Level 4) - Max: 5
 * 4. **Senior Associate** (Level 3) - Max: 10
 * 5. **Junior Associate** (Level 2) - Max: 10
 * 6. **Paralegal** (Level 1) - Max: 10
 *
 * ## Dependencies:
 * - **StaffRepository**: Data persistence and retrieval
 * - **AuditLogRepository**: Audit trail for all staff actions
 * - **PermissionService**: Access control and authorization
 * - **BusinessRuleValidationService**: Role limits and business rule enforcement
 *
 * ## Common Usage Patterns:
 * ```typescript
 * // Hiring a new staff member
 * const result = await staffService.hireStaff(context, {
 *   guildId: "123",
 *   userId: "456",
 *   robloxUsername: "JohnDoe123",
 *   role: StaffRole.PARALEGAL,
 *   hiredBy: "789",
 *   reason: "Passed bar exam"
 * });
 *
 * // Promoting a staff member
 * const promotion = await staffService.promoteStaff(context, {
 *   guildId: "123",
 *   userId: "456",
 *   newRole: StaffRole.JUNIOR_ASSOCIATE,
 *   promotedBy: "789",
 *   reason: "Excellent performance"
 * });
 * ```
 *
 * @see {@link RoleTrackingService} - Handles automatic Discord role synchronization
 * @see {@link DiscordRoleSyncService} - Manages bidirectional role updates
 */
export declare class StaffService {
    private staffRepository;
    private auditLogRepository;
    private permissionService;
    private validationAdapter;
    constructor(staffRepository: StaffRepository, auditLogRepository: AuditLogRepository, permissionService: PermissionService, validationService: UnifiedValidationService);
    /**
     * Validates a Roblox username according to Roblox's naming rules.
     *
     * This method ensures that usernames meet Roblox's requirements:
     * - 3-20 characters in length
     * - Contains only letters, numbers, and underscores
     * - Does not start or end with an underscore
     *
     * @param username - The Roblox username to validate
     * @returns Validation result with detailed error message if invalid
     *
     * @example
     * ```typescript
     * const result = await staffService.validateRobloxUsername("JohnDoe123");
     * if (result.isValid) {
     *   console.log("Username is valid:", result.username);
     * } else {
     *   console.error("Invalid username:", result.error);
     * }
     * ```
     */
    validateRobloxUsername(username: string): Promise<RobloxValidationResult>;
    /**
     * Hires a new staff member into the firm.
     *
     * This method performs comprehensive validation before creating a new staff record:
     * - Validates permissions (requires senior-staff permission)
     * - Validates Discord IDs for security
     * - Validates and ensures Roblox username uniqueness
     * - Checks if user is already an active staff member
     * - Validates role limits (with guild owner bypass option)
     * - Creates initial promotion history entry
     * - Logs the action to audit trail
     *
     * ## Business Rules:
     * - Users cannot be hired if they're already active staff
     * - Roblox usernames must be unique within the guild
     * - Role limits are enforced unless guild owner bypasses
     * - All hires are logged with full context
     *
     * ## Side Effects:
     * - Creates new staff record in database
     * - Creates audit log entry
     * - May create role limit bypass log if guild owner bypasses limits
     *
     * @param context - Permission context containing user and guild information
     * @param request - Staff hire request with user details and role
     * @returns Success status with created staff record or error message
     *
     * @throws Error if database operations fail
     *
     * @example
     * ```typescript
     * const result = await staffService.hireStaff(context, {
     *   guildId: "123456789",
     *   userId: "987654321",
     *   robloxUsername: "NewLawyer123",
     *   role: StaffRole.PARALEGAL,
     *   hiredBy: "111222333",
     *   reason: "Passed interview and background check"
     * });
     *
     * if (result.success) {
     *   console.log("Staff hired:", result.staff);
     * } else {
     *   console.error("Failed to hire:", result.error);
     * }
     * ```
     *
     * @see {@link BusinessRuleValidationService.validateRoleLimit} - Role limit validation
     * @see {@link AuditLogRepository.logAction} - Audit logging
     */
    hireStaff(context: PermissionContext, request: unknown): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    /**
     * Promotes a staff member to a higher role in the hierarchy.
     *
     * This method enforces strict promotion rules:
     * - Validates permissions (requires senior-staff permission)
     * - Prevents self-promotion
     * - Ensures new role is higher than current role
     * - Validates role limits for the target role
     * - Updates promotion history
     * - Creates comprehensive audit trail
     *
     * ## Business Rules:
     * - Staff cannot promote themselves
     * - New role must be higher in hierarchy than current role
     * - Role limits are enforced for target role
     * - Guild owners can bypass role limits with logging
     *
     * ## Side Effects:
     * - Updates staff role in database
     * - Adds entry to promotion history
     * - Creates audit log entry
     * - May create role limit bypass log
     *
     * @param context - Permission context for authorization
     * @param request - Promotion request with target role and reason
     * @returns Success status with updated staff record or error message
     *
     * @throws Error if database operations fail
     *
     * @example
     * ```typescript
     * const result = await staffService.promoteStaff(context, {
     *   guildId: "123456789",
     *   userId: "987654321",
     *   newRole: StaffRole.JUNIOR_ASSOCIATE,
     *   promotedBy: "111222333",
     *   reason: "Outstanding performance in Q4"
     * });
     * ```
     *
     * @see {@link RoleUtils.getRoleLevel} - Role hierarchy comparison
     * @see {@link StaffRepository.updateStaffRole} - Database update operation
     */
    promoteStaff(context: PermissionContext, request: unknown): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    /**
     * Demotes a staff member to a lower role in the hierarchy.
     *
     * Similar to promotion but in reverse, this method:
     * - Validates permissions (requires senior-staff permission)
     * - Ensures new role is lower than current role
     * - Updates demotion history
     * - Creates audit trail
     *
     * ## Business Rules:
     * - New role must be lower in hierarchy than current role
     * - No role limit validation needed (demotions always free up slots)
     * - All demotions are logged with reason
     *
     * ## Side Effects:
     * - Updates staff role in database
     * - Adds entry to promotion history (marked as demotion)
     * - Creates audit log entry
     *
     * @param context - Permission context for authorization
     * @param request - Demotion request with target role and reason
     * @returns Success status with updated staff record or error message
     *
     * @throws Error if database operations fail
     *
     * @example
     * ```typescript
     * const result = await staffService.demoteStaff(context, {
     *   guildId: "123456789",
     *   userId: "987654321",
     *   newRole: StaffRole.PARALEGAL,
     *   promotedBy: "111222333",
     *   reason: "Performance improvement needed"
     * });
     * ```
     */
    demoteStaff(context: PermissionContext, request: unknown): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    /**
     * Initiates the firing process for a staff member.
     *
     * Important: This method does NOT directly update the database. It validates
     * the request and logs the action, but the actual database update is handled
     * by the RoleTrackingService when Discord roles are removed.
     *
     * ## Workflow:
     * 1. This method validates and logs the firing intent
     * 2. Discord roles are removed via Discord commands
     * 3. RoleTrackingService detects role removal
     * 4. Database is updated automatically
     *
     * ## Business Rules:
     * - Staff must be active to be fired
     * - Firing reason must be provided
     * - All firings are logged immediately
     *
     * ## Side Effects:
     * - Creates audit log entry
     * - Does NOT modify database (handled by role tracking)
     *
     * @param context - Permission context for authorization
     * @param request - Termination request with reason
     * @returns Success status with staff record or error message
     *
     * @example
     * ```typescript
     * // Step 1: Initiate firing
     * const result = await staffService.fireStaff(context, {
     *   guildId: "123456789",
     *   userId: "987654321",
     *   terminatedBy: "111222333",
     *   reason: "Violation of company policy"
     * });
     *
     * // Step 2: Remove Discord roles (handled separately)
     * // Step 3: RoleTrackingService updates database automatically
     * ```
     *
     * @see {@link RoleTrackingService} - Handles automatic database updates
     */
    fireStaff(context: PermissionContext, request: unknown): Promise<{
        success: boolean;
        staff?: Staff;
        error?: string;
    }>;
    /**
     * Retrieves detailed information about a specific staff member.
     *
     * This method provides complete staff information including:
     * - Current role and status
     * - Roblox username
     * - Hire date and hired by
     * - Complete promotion/demotion history
     * - Termination details (if applicable)
     *
     * ## Permission Requirements:
     * - Senior-staff permission OR
     * - Admin permission
     *
     * ## Side Effects:
     * - Creates audit log entry for information access
     *
     * @param context - Permission context for authorization
     * @param userId - Discord user ID of the staff member
     * @returns Staff record or null if not found
     *
     * @throws Error if user lacks required permissions
     *
     * @example
     * ```typescript
     * const staffInfo = await staffService.getStaffInfo(context, "987654321");
     * if (staffInfo) {
     *   console.log(`${staffInfo.robloxUsername} - ${staffInfo.role}`);
     *   console.log(`Hired on: ${staffInfo.hiredAt}`);
     * }
     * ```
     */
    getStaffInfo(context: PermissionContext, userId: string): Promise<Staff | null>;
    /**
     * Retrieves a paginated list of staff members with optional role filtering.
     *
     * This method provides:
     * - Paginated results for performance
     * - Optional filtering by specific role
     * - Total count for pagination UI
     * - Active staff only (excludes terminated)
     *
     * ## Permission Requirements:
     * - Senior-staff permission OR
     * - Admin permission
     *
     * ## Side Effects:
     * - Creates audit log entry with query parameters
     *
     * @param context - Permission context for authorization
     * @param roleFilter - Optional role to filter by
     * @param page - Page number (1-based, defaults to 1)
     * @param limit - Items per page (defaults to 10)
     * @returns Paginated staff list with total count
     *
     * @throws Error if user lacks required permissions
     *
     * @example
     * ```typescript
     * // Get all Junior Associates, page 1
     * const result = await staffService.getStaffList(
     *   context,
     *   StaffRole.JUNIOR_ASSOCIATE,
     *   1,
     *   10
     * );
     *
     * console.log(`Found ${result.total} Junior Associates`);
     * console.log(`Showing page 1 of ${result.totalPages}`);
     * ```
     */
    getStaffList(context: PermissionContext, roleFilter?: StaffRole, page?: number, limit?: number): Promise<{
        staff: Staff[];
        total: number;
        totalPages: number;
    }>;
    /**
     * Retrieves the complete staff hierarchy sorted by role level.
     *
     * Returns all active staff members organized by their position in the
     * firm hierarchy, from Managing Partner down to Paralegal. This is useful
     * for displaying organizational charts or understanding reporting structures.
     *
     * ## Permission Requirements:
     * - Senior-staff permission OR
     * - Admin permission
     *
     * @param context - Permission context for authorization
     * @returns Array of staff sorted by role hierarchy (highest to lowest)
     *
     * @throws Error if user lacks required permissions
     *
     * @example
     * ```typescript
     * const hierarchy = await staffService.getStaffHierarchy(context);
     * hierarchy.forEach(staff => {
     *   console.log(`${staff.role}: ${staff.robloxUsername}`);
     * });
     * ```
     */
    getStaffHierarchy(context: PermissionContext): Promise<Staff[]>;
    /**
     * Retrieves the count of active staff members for each role.
     *
     * This method provides a summary of staff distribution across all roles,
     * which is useful for:
     * - Checking available slots before hiring/promotion
     * - Understanding organizational structure
     * - Capacity planning
     *
     * ## Permission Requirements:
     * - Senior-staff permission OR
     * - Admin permission
     *
     * @param context - Permission context for authorization
     * @returns Record mapping each role to its active staff count
     *
     * @throws Error if user lacks required permissions
     *
     * @example
     * ```typescript
     * const counts = await staffService.getRoleCounts(context);
     * console.log(`Managing Partners: ${counts[StaffRole.MANAGING_PARTNER]}/1`);
     * console.log(`Senior Partners: ${counts[StaffRole.SENIOR_PARTNER]}/3`);
     * ```
     */
    getRoleCounts(context: PermissionContext): Promise<Record<StaffRole, number>>;
}
//# sourceMappingURL=staff-service.d.ts.map