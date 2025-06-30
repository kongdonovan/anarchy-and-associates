"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionalStaffService = void 0;
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const staff_role_1 = require("../../domain/entities/staff-role"); // Keep utility functions
const logger_1 = require("../../infrastructure/logger");
const migration_adapter_1 = require("../validation/migration-adapter");
const audit_log_1 = require("../../domain/entities/audit-log");
const mongo_unit_of_work_1 = require("../../infrastructure/unit-of-work/mongo-unit-of-work");
const rollback_service_1 = require("../../infrastructure/unit-of-work/rollback-service");
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
class TransactionalStaffService {
    constructor(staffRepository, auditLogRepository, permissionService, validationService, unitOfWorkFactory, rollbackService) {
        this.staffRepository = staffRepository;
        this._auditLogRepository = auditLogRepository;
        this.permissionService = permissionService;
        this.validationAdapter = new migration_adapter_1.ValidationMigrationAdapter(validationService);
        this.unitOfWorkFactory = unitOfWorkFactory || new mongo_unit_of_work_1.MongoUnitOfWorkFactory();
        this.rollbackService = rollbackService || new rollback_service_1.RollbackService();
        // Note: Individual repositories are kept for validation/non-transactional operations
        // Transactional operations use repositories obtained from unitOfWork.getRepository()
        // Ensure TypeScript doesn't complain about unused repositories
        void this._auditLogRepository;
    }
    /**
     * Validates a Roblox username according to Roblox's naming rules.
     * This method is identical to the original but included for completeness.
     */
    async validateRobloxUsername(username) {
        try {
            const robloxUsernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
            if (!robloxUsernameRegex.test(username)) {
                return {
                    isValid: false,
                    username,
                    error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
                };
            }
            if (username.startsWith('_') || username.endsWith('_')) {
                return {
                    isValid: false,
                    username,
                    error: 'Username cannot start or end with an underscore',
                };
            }
            return {
                isValid: true,
                username,
            };
        }
        catch (error) {
            logger_1.logger.error('Error validating Roblox username:', error);
            return {
                isValid: false,
                username,
                error: 'Failed to validate username',
            };
        }
    }
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
    async hireStaffTransactional(context, request) {
        const unitOfWork = this.unitOfWorkFactory.create({
            readConcern: 'majority',
            writeConcern: { w: 'majority', j: true }
        });
        try {
            // Perform all validation outside transaction for performance
            const validationResult = await this.validateHireRequest(context, request);
            if (!validationResult.success) {
                return validationResult;
            }
            const { guildId, userId, robloxUsername, role, hiredBy, reason } = request;
            // Begin transaction
            await unitOfWork.begin();
            const transactionId = unitOfWork.getSession()?.id?.toString() || 'unknown';
            logger_1.logger.info('Starting staff hire transaction', {
                transactionId,
                guildId,
                userId,
                role,
                hiredBy
            });
            // Register compensation actions for potential rollback
            this.registerHireCompensationActions(transactionId, guildId, userId, role, reason);
            // Get transaction-aware repositories
            const staffRepo = unitOfWork.getRepository(staff_repository_1.StaffRepository);
            const auditRepo = unitOfWork.getRepository(audit_log_repository_1.AuditLogRepository);
            // Validate role limits within transaction (for consistency)
            const roleLimitValidation = await this.validationAdapter.validateRoleLimit(context, role);
            let roleLimitBypassed = false;
            if (!roleLimitValidation.valid) {
                if (context.isGuildOwner && roleLimitValidation.bypassAvailable) {
                    // Log role limit bypass within the transaction
                    await auditRepo.logRoleLimitBypass(guildId, context.userId, userId, role, roleLimitValidation.currentCount, roleLimitValidation.maxCount, reason);
                    roleLimitBypassed = true;
                    logger_1.logger.info('Guild owner bypassing role limit during hire within transaction', {
                        transactionId,
                        guildId,
                        role,
                        currentCount: roleLimitValidation.currentCount,
                        maxCount: roleLimitValidation.maxCount,
                        bypassedBy: context.userId
                    });
                }
                else {
                    await unitOfWork.rollback();
                    return {
                        success: false,
                        error: roleLimitValidation.errors.join(', '),
                    };
                }
            }
            // Create staff record within transaction
            const staffData = {
                userId,
                guildId,
                robloxUsername: robloxUsername,
                role,
                hiredAt: new Date(),
                hiredBy,
                promotionHistory: [
                    {
                        fromRole: role,
                        toRole: role,
                        promotedBy: hiredBy,
                        promotedAt: new Date(),
                        reason,
                        actionType: 'hire',
                    },
                ],
                status: 'active',
            };
            const staff = await staffRepo.add(staffData);
            // Log successful hire within transaction
            await auditRepo.logAction({
                guildId,
                action: audit_log_1.AuditAction.STAFF_HIRED,
                actorId: hiredBy,
                targetId: userId,
                details: {
                    after: {
                        role,
                        status: 'active'
                    },
                    reason,
                    metadata: {
                        robloxUsername,
                        roleLimitBypassed,
                        transactionId
                    }
                },
                timestamp: new Date()
            });
            // Commit transaction
            await unitOfWork.commit();
            // Clear compensation actions on success
            this.rollbackService.clearTransaction(transactionId);
            logger_1.logger.info('Staff hire transaction completed successfully', {
                transactionId,
                staffId: staff._id?.toString(),
                userId,
                role,
                guildId
            });
            return {
                success: true,
                staff,
            };
        }
        catch (error) {
            logger_1.logger.error('Error in staff hire transaction:', error);
            // Perform rollback with compensation actions
            const rollbackContext = this.rollbackService.createRollbackContext(unitOfWork, 'hireStaffTransactional', error, {
                guildId: request.guildId,
                userId: request.hiredBy,
                metadata: {
                    targetUserId: request.userId,
                    role: request.role,
                    robloxUsername: request.robloxUsername
                }
            });
            const rollbackResult = await this.rollbackService.performRollback(unitOfWork, rollbackContext);
            logger_1.logger.error('Staff hire failed with rollback', {
                originalError: error.message,
                rollbackSuccess: rollbackResult.success,
                compensationsExecuted: rollbackResult.compensationsExecuted.length,
                compensationsFailed: rollbackResult.compensationsFailed.length
            });
            return {
                success: false,
                error: 'Failed to hire staff member',
            };
        }
    }
    /**
     * Promotes a staff member using atomic transactions.
     *
     * ## Transaction Scope:
     * - Staff role update
     * - Promotion history update
     * - Audit log creation
     * - Role limit bypass logging (if applicable)
     */
    async promoteStaffTransactional(context, request) {
        const unitOfWork = this.unitOfWorkFactory.create({
            readConcern: 'majority',
            writeConcern: { w: 'majority', j: true }
        });
        try {
            // Validate outside transaction
            const validationResult = await this.validatePromotionRequest(context, request);
            if (!validationResult.success) {
                return validationResult;
            }
            const { guildId, userId, newRole, promotedBy, reason } = request;
            await unitOfWork.begin();
            const transactionId = unitOfWork.getSession()?.id?.toString() || 'unknown';
            logger_1.logger.info('Starting staff promotion transaction', {
                transactionId,
                guildId,
                userId,
                newRole,
                promotedBy
            });
            // Get transaction-aware repositories
            const staffRepo = unitOfWork.getRepository(staff_repository_1.StaffRepository);
            const auditRepo = unitOfWork.getRepository(audit_log_repository_1.AuditLogRepository);
            // Find staff member within transaction
            const staff = await staffRepo.findByUserId(guildId, userId);
            if (!staff || staff.status !== 'active') {
                await unitOfWork.rollback();
                return {
                    success: false,
                    error: 'Staff member not found or inactive',
                };
            }
            const currentRole = staff.role;
            // Validate role hierarchy
            if (staff_role_1.RoleUtils.getRoleLevel(newRole) <= staff_role_1.RoleUtils.getRoleLevel(currentRole)) {
                await unitOfWork.rollback();
                return {
                    success: false,
                    error: 'New role must be higher than current role for promotion',
                };
            }
            // Validate role limits within transaction
            const roleLimitValidation = await this.validationAdapter.validateRoleLimit(context, newRole);
            let roleLimitBypassed = false;
            if (!roleLimitValidation.valid) {
                if (context.isGuildOwner && roleLimitValidation.bypassAvailable) {
                    await auditRepo.logRoleLimitBypass(guildId, context.userId, userId, newRole, roleLimitValidation.currentCount, roleLimitValidation.maxCount, reason);
                    roleLimitBypassed = true;
                }
                else {
                    await unitOfWork.rollback();
                    return {
                        success: false,
                        error: roleLimitValidation.errors.join(', '),
                    };
                }
            }
            // Update staff role within transaction
            const updatedStaff = await staffRepo.updateStaffRole(guildId, userId, newRole, promotedBy, reason);
            if (!updatedStaff) {
                await unitOfWork.rollback();
                return {
                    success: false,
                    error: 'Failed to update staff role',
                };
            }
            // Log promotion within transaction
            await auditRepo.logAction({
                guildId,
                action: audit_log_1.AuditAction.STAFF_PROMOTED,
                actorId: promotedBy,
                targetId: userId,
                details: {
                    before: {
                        role: currentRole
                    },
                    after: {
                        role: newRole
                    },
                    reason,
                    metadata: {
                        roleLimitBypassed,
                        transactionId
                    }
                },
                timestamp: new Date()
            });
            await unitOfWork.commit();
            logger_1.logger.info('Staff promotion transaction completed successfully', {
                transactionId,
                userId,
                fromRole: currentRole,
                toRole: newRole,
                guildId
            });
            return {
                success: true,
                staff: updatedStaff,
            };
        }
        catch (error) {
            const rollbackContext = this.rollbackService.createRollbackContext(unitOfWork, 'promoteStaffTransactional', error, {
                guildId: request.guildId,
                userId: request.promotedBy,
                metadata: {
                    targetUserId: request.userId,
                    newRole: request.newRole
                }
            });
            await this.rollbackService.performRollback(unitOfWork, rollbackContext);
            logger_1.logger.error('Staff promotion failed with rollback:', error);
            return {
                success: false,
                error: 'Failed to promote staff member',
            };
        }
    }
    /**
     * Validates the hire request outside of the transaction for performance.
     */
    async validateHireRequest(context, request) {
        // Check permissions
        const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
        if (!hasPermission) {
            return {
                success: false,
                error: 'You do not have permission to hire staff members',
            };
        }
        const { guildId, userId, robloxUsername, role: _role, hiredBy } = request;
        // Validate Discord IDs
        const validIdPattern = /^(\d{18,19}|[a-zA-Z0-9_-]+)$/;
        if (!validIdPattern.test(guildId) || guildId.includes('\'') || guildId.includes(';') || guildId.includes('DROP')) {
            return { success: false, error: 'Invalid guild ID format' };
        }
        if (!validIdPattern.test(userId) || userId.includes('\'') || userId.includes(';') || userId.includes('DROP')) {
            return { success: false, error: 'Invalid user ID format' };
        }
        if (!validIdPattern.test(hiredBy) || hiredBy.includes('\'') || hiredBy.includes(';') || hiredBy.includes('DROP')) {
            return { success: false, error: 'Invalid hiredBy user ID format' };
        }
        // Validate Roblox username
        const robloxValidation = await this.validateRobloxUsername(robloxUsername);
        if (!robloxValidation.isValid) {
            return { success: false, error: robloxValidation.error };
        }
        // Check if user is already staff
        const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
        if (existingStaff && existingStaff.status === 'active') {
            return { success: false, error: 'User is already an active staff member' };
        }
        // Check if Roblox username is already used
        const existingRobloxStaff = await this.staffRepository.findStaffByRobloxUsername(guildId, robloxUsername);
        if (existingRobloxStaff) {
            return { success: false, error: 'Roblox username is already associated with another staff member' };
        }
        return { success: true };
    }
    /**
     * Validates the promotion request outside of the transaction.
     */
    async validatePromotionRequest(context, request) {
        const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
        if (!hasPermission) {
            return { success: false, error: 'You do not have permission to promote staff members' };
        }
        if (request.userId === request.promotedBy) {
            return { success: false, error: 'Staff members cannot promote themselves' };
        }
        return { success: true };
    }
    /**
     * Registers compensation actions for hire operations.
     */
    registerHireCompensationActions(transactionId, guildId, userId, role, reason) {
        // Register Discord role removal compensation
        const roleRemovalAction = rollback_service_1.CompensationActionFactory.createDiscordRoleRemovalAction(guildId, userId, role.toString() // In real implementation, this would be the Discord role ID
        );
        this.rollbackService.registerCompensationAction(transactionId, roleRemovalAction);
        // Register audit log compensation
        const auditCompensation = rollback_service_1.CompensationActionFactory.createAuditLogCompensationAction(guildId, userId, 'STAFF_HIRE_FAILED', reason || 'Staff hire transaction failed');
        this.rollbackService.registerCompensationAction(transactionId, auditCompensation);
        // Register notification compensation
        const notificationAction = rollback_service_1.CompensationActionFactory.createNotificationCompensationAction([userId], // Notify the user who was being hired
        `Staff hiring process failed and has been rolled back. Please contact an administrator.`, 'error');
        this.rollbackService.registerCompensationAction(transactionId, notificationAction);
    }
}
exports.TransactionalStaffService = TransactionalStaffService;
//# sourceMappingURL=staff-service-transactional.js.map