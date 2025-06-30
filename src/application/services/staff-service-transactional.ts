import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { RoleUtils, StaffRole as StaffRoleEnum } from '../../domain/entities/staff-role'; // Keep utility functions
import { logger } from '../../infrastructure/logger';
import { PermissionService, PermissionContext } from './permission-service';
import { UnifiedValidationService } from '../validation/unified-validation-service';
import { ValidationMigrationAdapter } from '../validation/migration-adapter';
import { IUnitOfWorkFactory } from '../../infrastructure/unit-of-work/unit-of-work';
import { Staff, StaffRole } from '../../validation';
import { AuditAction } from '../../domain/entities/audit-log';
import { MongoUnitOfWorkFactory } from '../../infrastructure/unit-of-work/mongo-unit-of-work';
import { RollbackService, CompensationActionFactory } from '../../infrastructure/unit-of-work/rollback-service';

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
export class TransactionalStaffService {
  private staffRepository: StaffRepository;
  private _auditLogRepository: AuditLogRepository;
  private permissionService: PermissionService;
  private validationAdapter: ValidationMigrationAdapter;
  private unitOfWorkFactory: IUnitOfWorkFactory;
  private rollbackService: RollbackService;

  constructor(
    staffRepository: StaffRepository,
    auditLogRepository: AuditLogRepository,
    permissionService: PermissionService,
    validationService: UnifiedValidationService,
    unitOfWorkFactory?: IUnitOfWorkFactory,
    rollbackService?: RollbackService
  ) {
    this.staffRepository = staffRepository;
    this._auditLogRepository = auditLogRepository;
    this.permissionService = permissionService;
    this.validationAdapter = new ValidationMigrationAdapter(validationService);
    this.unitOfWorkFactory = unitOfWorkFactory || new MongoUnitOfWorkFactory();
    this.rollbackService = rollbackService || new RollbackService();
    
    // Note: Individual repositories are kept for validation/non-transactional operations
    // Transactional operations use repositories obtained from unitOfWork.getRepository()
    
    // Ensure TypeScript doesn't complain about unused repositories
    void this._auditLogRepository;
  }

  /**
   * Validates a Roblox username according to Roblox's naming rules.
   * This method is identical to the original but included for completeness.
   */
  public async validateRobloxUsername(username: string): Promise<RobloxValidationResult> {
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
    } catch (error) {
      logger.error('Error validating Roblox username:', error);
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
  public async hireStaffTransactional(
    context: PermissionContext, 
    request: StaffHireRequest
  ): Promise<{ success: boolean; staff?: Staff; error?: string }> {
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

      logger.info('Starting staff hire transaction', {
        transactionId,
        guildId,
        userId,
        role,
        hiredBy
      });

      // Register compensation actions for potential rollback
      this.registerHireCompensationActions(transactionId, guildId, userId, role, reason);

      // Get transaction-aware repositories
      const staffRepo = unitOfWork.getRepository(StaffRepository);
      const auditRepo = unitOfWork.getRepository(AuditLogRepository);

      // Validate role limits within transaction (for consistency)
      const roleLimitValidation = await this.validationAdapter.validateRoleLimit(context, role);
      let roleLimitBypassed = false;

      if (!roleLimitValidation.valid) {
        if (context.isGuildOwner && roleLimitValidation.bypassAvailable) {
          // Log role limit bypass within the transaction
          await auditRepo.logRoleLimitBypass(
            guildId,
            context.userId,
            userId,
            role,
            roleLimitValidation.currentCount,
            roleLimitValidation.maxCount,
            reason
          );
          
          roleLimitBypassed = true;
          logger.info('Guild owner bypassing role limit during hire within transaction', {
            transactionId,
            guildId,
            role,
            currentCount: roleLimitValidation.currentCount,
            maxCount: roleLimitValidation.maxCount,
            bypassedBy: context.userId
          });
        } else {
          await unitOfWork.rollback();
          return {
            success: false,
            error: roleLimitValidation.errors.join(', '),
          };
        }
      }

      // Create staff record within transaction
      const staffData: Omit<Staff, '_id' | 'createdAt' | 'updatedAt'> = {
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
        action: AuditAction.STAFF_HIRED,
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

      logger.info('Staff hire transaction completed successfully', {
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

    } catch (error) {
      logger.error('Error in staff hire transaction:', error);

      // Perform rollback with compensation actions
      const rollbackContext = this.rollbackService.createRollbackContext(
        unitOfWork,
        'hireStaffTransactional',
        error as Error,
        {
          guildId: request.guildId,
          userId: request.hiredBy,
          metadata: {
            targetUserId: request.userId,
            role: request.role,
            robloxUsername: request.robloxUsername
          }
        }
      );

      const rollbackResult = await this.rollbackService.performRollback(unitOfWork, rollbackContext);

      logger.error('Staff hire failed with rollback', {
        originalError: (error as Error).message,
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
  public async promoteStaffTransactional(
    context: PermissionContext,
    request: StaffPromotionRequest
  ): Promise<{ success: boolean; staff?: Staff; error?: string }> {
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

      logger.info('Starting staff promotion transaction', {
        transactionId,
        guildId,
        userId,
        newRole,
        promotedBy
      });

      // Get transaction-aware repositories
      const staffRepo = unitOfWork.getRepository(StaffRepository);
      const auditRepo = unitOfWork.getRepository(AuditLogRepository);

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
      if (RoleUtils.getRoleLevel(newRole as StaffRoleEnum) <= RoleUtils.getRoleLevel(currentRole as StaffRoleEnum)) {
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
          await auditRepo.logRoleLimitBypass(
            guildId,
            context.userId,
            userId,
            newRole,
            roleLimitValidation.currentCount,
            roleLimitValidation.maxCount,
            reason
          );
          roleLimitBypassed = true;
        } else {
          await unitOfWork.rollback();
          return {
            success: false,
            error: roleLimitValidation.errors.join(', '),
          };
        }
      }

      // Update staff role within transaction
      const updatedStaff = await staffRepo.updateStaffRole(
        guildId,
        userId,
        newRole,
        promotedBy,
        reason
      );

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
        action: AuditAction.STAFF_PROMOTED,
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

      logger.info('Staff promotion transaction completed successfully', {
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

    } catch (error) {
      const rollbackContext = this.rollbackService.createRollbackContext(
        unitOfWork,
        'promoteStaffTransactional',
        error as Error,
        {
          guildId: request.guildId,
          userId: request.promotedBy,
          metadata: {
            targetUserId: request.userId,
            newRole: request.newRole
          }
        }
      );

      await this.rollbackService.performRollback(unitOfWork, rollbackContext);

      logger.error('Staff promotion failed with rollback:', error);
      return {
        success: false,
        error: 'Failed to promote staff member',
      };
    }
  }

  /**
   * Validates the hire request outside of the transaction for performance.
   */
  private async validateHireRequest(
    context: PermissionContext,
    request: StaffHireRequest
  ): Promise<{ success: boolean; error?: string }> {
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
  private async validatePromotionRequest(
    context: PermissionContext,
    request: StaffPromotionRequest
  ): Promise<{ success: boolean; error?: string }> {
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
  private registerHireCompensationActions(
    transactionId: string,
    guildId: string,
    userId: string,
    role: StaffRole,
    reason?: string
  ): void {
    // Register Discord role removal compensation
    const roleRemovalAction = CompensationActionFactory.createDiscordRoleRemovalAction(
      guildId,
      userId,
      role.toString() // In real implementation, this would be the Discord role ID
    );
    this.rollbackService.registerCompensationAction(transactionId, roleRemovalAction);

    // Register audit log compensation
    const auditCompensation = CompensationActionFactory.createAuditLogCompensationAction(
      guildId,
      userId,
      'STAFF_HIRE_FAILED',
      reason || 'Staff hire transaction failed'
    );
    this.rollbackService.registerCompensationAction(transactionId, auditCompensation);

    // Register notification compensation
    const notificationAction = CompensationActionFactory.createNotificationCompensationAction(
      [userId], // Notify the user who was being hired
      `Staff hiring process failed and has been rolled back. Please contact an administrator.`,
      'error'
    );
    this.rollbackService.registerCompensationAction(transactionId, notificationAction);
  }
}