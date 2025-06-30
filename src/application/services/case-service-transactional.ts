import { generateCaseNumber, CaseStatus as CaseStatusEnum, CasePriority as CasePriorityEnum } from '../../domain/entities/case'; // Keep utility function and enums
import { 
  Case, 
  CaseCreationRequest, 
  CaseAssignmentRequest,
  CaseUpdateRequest
} from '../../validation';
import { AuditAction } from '../../domain/entities/audit-log';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { UnifiedValidationService } from '../validation/unified-validation-service';
import { ValidationMigrationAdapter } from '../validation/migration-adapter';
import { IUnitOfWorkFactory } from '../../infrastructure/unit-of-work/unit-of-work';
import { MongoUnitOfWorkFactory } from '../../infrastructure/unit-of-work/mongo-unit-of-work';
import { RollbackService, CompensationActionFactory } from '../../infrastructure/unit-of-work/rollback-service';
import { logger } from '../../infrastructure/logger';
import { Client } from 'discord.js';

/**
 * Enhanced CaseService with Unit of Work transaction support.
 * 
 * This service provides transactional case management operations with:
 * - Atomic case creation with sequential case numbering
 * - Atomic case assignment operations
 * - Automatic rollback on failures
 * - Compensation actions for Discord channel operations
 * - Comprehensive audit logging within transactions
 * 
 * ## Key Improvements:
 * - Case creation and case number generation are fully atomic
 * - Case assignment operations include audit logging in the same transaction
 * - Discord channel operations have compensation actions for rollback
 * - Enhanced error handling with transaction context
 */
export class TransactionalCaseService {
  private _caseRepository: CaseRepository;
  private _caseCounterRepository: CaseCounterRepository;
  private _auditLogRepository: AuditLogRepository;
  private _guildConfigRepository: GuildConfigRepository;
  private permissionService: PermissionService;
  private _validationAdapter: ValidationMigrationAdapter;
  private unitOfWorkFactory: IUnitOfWorkFactory;
  private rollbackService: RollbackService;
  private discordClient?: Client;

  constructor(
    caseRepository: CaseRepository,
    caseCounterRepository: CaseCounterRepository,
    auditLogRepository: AuditLogRepository,
    guildConfigRepository: GuildConfigRepository,
    permissionService: PermissionService,
    validationService: UnifiedValidationService,
    discordClient?: Client,
    unitOfWorkFactory?: IUnitOfWorkFactory,
    rollbackService?: RollbackService
  ) {
    this._caseRepository = caseRepository;
    this._caseCounterRepository = caseCounterRepository;
    this._auditLogRepository = auditLogRepository;
    this._guildConfigRepository = guildConfigRepository;
    this.permissionService = permissionService;
    this._validationAdapter = new ValidationMigrationAdapter(validationService);
    this.discordClient = discordClient;
    this.unitOfWorkFactory = unitOfWorkFactory || new MongoUnitOfWorkFactory();
    this.rollbackService = rollbackService || new RollbackService();
    
    // Note: Individual repositories are kept for validation/non-transactional operations
    // Transactional operations use repositories obtained from unitOfWork.getRepository()
    
    // Ensure TypeScript doesn't complain about unused repositories
    void this._caseRepository;
    void this._caseCounterRepository;
    void this._auditLogRepository;
    void this._guildConfigRepository;
    void this._validationAdapter;
  }

  /**
   * Creates a new case using atomic transactions.
   * 
   * This method ensures that case creation and case number generation are atomic,
   * preventing race conditions that could result in duplicate case numbers.
   * 
   * ## Transaction Scope:
   * - Case counter increment
   * - Case record creation
   * - Initial audit log entry
   * 
   * ## Compensation Actions:
   * - Discord channel deletion (if channel was created)
   * - Client notification about failed case creation
   * - Audit log compensation entry
   * 
   * @param context - Permission context for authorization
   * @param request - Case creation request with case details
   * @returns Created case record
   */
  public async createCaseTransactional(
    context: PermissionContext, 
    request: CaseCreationRequest
  ): Promise<Case> {
    const unitOfWork = this.unitOfWorkFactory.create({
      readConcern: 'majority',
      writeConcern: { w: 'majority', j: true }
    });

    try {
      // Perform validation outside transaction for performance
      const validationResult = await this.validateCaseCreationRequest(context, request);
      if (!validationResult.success) {
        throw new Error(validationResult.error);
      }

      // Begin transaction
      await unitOfWork.begin();
      const transactionId = unitOfWork.getSession()?.id?.toString() || 'unknown';

      logger.info('Starting case creation transaction', {
        transactionId,
        guildId: request.guildId,
        clientId: request.clientId,
        title: request.title
      });

      // Register compensation actions
      this.registerCaseCreationCompensationActions(
        transactionId, 
        request.guildId, 
        request.clientId, 
        request.title
      );

      // Get transaction-aware repositories
      const caseRepo = unitOfWork.getRepository(CaseRepository);
      const caseCounterRepo = unitOfWork.getRepository(CaseCounterRepository);
      const auditRepo = unitOfWork.getRepository(AuditLogRepository);

      // Generate sequential case number within transaction (atomic operation)
      const caseCount = await caseCounterRepo.getNextCaseNumber(request.guildId);
      const currentYear = new Date().getFullYear();
      const caseNumber = generateCaseNumber(currentYear, caseCount, request.clientUsername);

      logger.debug('Generated case number within transaction', {
        transactionId,
        caseNumber,
        caseCount,
        year: currentYear
      });

      // Create case record within transaction
      const caseData: Omit<Case, '_id' | 'createdAt' | 'updatedAt'> = {
        guildId: request.guildId,
        caseNumber,
        clientId: request.clientId,
        clientUsername: request.clientUsername,
        title: request.title,
        description: request.description,
        status: CaseStatusEnum.PENDING,
        priority: request.priority || CasePriorityEnum.MEDIUM,
        assignedLawyerIds: [],
        documents: [],
        notes: []
      };

      const createdCase = await caseRepo.add(caseData);

      // Log case creation within transaction
      await auditRepo.logAction({
        guildId: request.guildId,
        action: AuditAction.CASE_CREATED,
        actorId: context.userId,
        targetId: request.clientId,
        details: {
          metadata: {
            caseNumber,
            caseId: createdCase._id?.toString(),
            title: request.title,
            priority: request.priority,
            transactionId
          }
        },
        timestamp: new Date()
      });

      // If Discord client is available, create channel as part of compensation planning
      let channelCreated = false;
      if (this.discordClient) {
        try {
          channelCreated = await this.createCaseChannel(request.guildId, caseNumber, request.title);
          if (channelCreated) {
            // Register channel deletion compensation
            this.registerChannelDeletionCompensation(transactionId, request.guildId, caseNumber);
          }
        } catch (channelError) {
          // Channel creation is not critical for case creation, log but continue
          logger.warn('Failed to create case channel, continuing with case creation', {
            transactionId,
            caseNumber,
            error: (channelError as Error).message
          });
        }
      }

      // Commit transaction
      await unitOfWork.commit();

      // Clear compensation actions on success
      this.rollbackService.clearTransaction(transactionId);

      logger.info('Case creation transaction completed successfully', {
        transactionId,
        caseId: createdCase._id?.toString(),
        caseNumber,
        channelCreated
      });

      return createdCase;

    } catch (error) {
      logger.error('Error in case creation transaction:', error);

      // Perform rollback with compensation actions
      const rollbackContext = this.rollbackService.createRollbackContext(
        unitOfWork,
        'createCaseTransactional',
        error as Error,
        {
          guildId: request.guildId,
          userId: context.userId,
          metadata: {
            clientId: request.clientId,
            clientUsername: request.clientUsername,
            title: request.title,
            priority: request.priority
          }
        }
      );

      const rollbackResult = await this.rollbackService.performRollback(unitOfWork, rollbackContext);

      logger.error('Case creation failed with rollback', {
        originalError: (error as Error).message,
        rollbackSuccess: rollbackResult.success,
        compensationsExecuted: rollbackResult.compensationsExecuted.length,
        compensationsFailed: rollbackResult.compensationsFailed.length
      });

      throw new Error('Failed to create case');
    }
  }

  /**
   * Assigns a lawyer to a case using atomic transactions.
   * 
   * ## Transaction Scope:
   * - Case assignment update
   * - Audit log creation
   * - Lead attorney assignment (if applicable)
   * 
   * @param context - Permission context for authorization
   * @param request - Case assignment request
   * @returns Updated case record
   */
  public async assignLawyerTransactional(
    context: PermissionContext,
    request: CaseAssignmentRequest
  ): Promise<Case> {
    const unitOfWork = this.unitOfWorkFactory.create({
      readConcern: 'majority',
      writeConcern: { w: 'majority', j: true }
    });

    try {
      // Validate outside transaction
      const validationResult = await this.validateLawyerAssignmentRequest(context, request);
      if (!validationResult.success) {
        throw new Error(validationResult.error);
      }

      await unitOfWork.begin();
      const transactionId = unitOfWork.getSession()?.id?.toString() || 'unknown';

      logger.info('Starting lawyer assignment transaction', {
        transactionId,
        caseId: request.caseId,
        lawyerIds: request.lawyerIds,
        assignedBy: request.assignedBy
      });

      // Get transaction-aware repositories
      const caseRepo = unitOfWork.getRepository(CaseRepository);
      const auditRepo = unitOfWork.getRepository(AuditLogRepository);

      // Find case within transaction for consistency
      const existingCase = await caseRepo.findById(request.caseId);
      if (!existingCase) {
        await unitOfWork.rollback();
        throw new Error('Case not found');
      }

      // Assign lawyers within transaction
      let updatedCase: Case | null = existingCase;
      for (const lawyerId of request.lawyerIds) {
        updatedCase = await caseRepo.assignLawyer(request.caseId, lawyerId);
        if (!updatedCase) {
          await unitOfWork.rollback();
          throw new Error('Case assignment failed');
        }
      }

      // Set lead attorney if specified
      if (request.leadAttorneyId) {
        updatedCase = await caseRepo.update(request.caseId, {
          leadAttorneyId: request.leadAttorneyId
        });
        if (!updatedCase) {
          await unitOfWork.rollback();
          throw new Error('Failed to set lead attorney');
        }
      }

      // Log assignment within transaction
      await auditRepo.logAction({
        guildId: context.guildId,
        action: AuditAction.CASE_ASSIGNED,
        actorId: request.assignedBy,
        targetId: request.lawyerIds.join(','),
        details: {
          metadata: {
            caseId: request.caseId,
            caseNumber: existingCase.caseNumber,
            lawyerIds: request.lawyerIds,
            leadAttorneyId: request.leadAttorneyId,
            transactionId
          }
        },
        timestamp: new Date()
      });

      await unitOfWork.commit();

      logger.info('Lawyer assignment transaction completed successfully', {
        transactionId,
        caseId: request.caseId,
        lawyerIds: request.lawyerIds,
        leadAttorneyId: updatedCase.leadAttorneyId
      });

      return updatedCase;

    } catch (error) {
      const rollbackContext = this.rollbackService.createRollbackContext(
        unitOfWork,
        'assignLawyerTransactional',
        error as Error,
        {
          guildId: context.guildId,
          userId: context.userId,
          metadata: {
            caseId: request.caseId,
            lawyerIds: request.lawyerIds,
            assignedBy: request.assignedBy
          }
        }
      );

      await this.rollbackService.performRollback(unitOfWork, rollbackContext);

      logger.error('Lawyer assignment failed with rollback:', error);
      throw new Error('Failed to assign lawyer to case');
    }
  }

  /**
   * Updates a case using atomic transactions.
   * 
   * ## Transaction Scope:
   * - Case update
   * - Audit log creation
   * - Status change notifications (if applicable)
   */
  public async updateCaseTransactional(
    context: PermissionContext,
    caseId: string,
    updates: CaseUpdateRequest
  ): Promise<Case> {
    const unitOfWork = this.unitOfWorkFactory.create({
      readConcern: 'majority',
      writeConcern: { w: 'majority', j: true }
    });

    try {
      // Validate permissions
      const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
      if (!hasPermission) {
        throw new Error('You do not have permission to update cases');
      }

      await unitOfWork.begin();
      const transactionId = unitOfWork.getSession()?.id?.toString() || 'unknown';

      logger.info('Starting case update transaction', {
        transactionId,
        caseId,
        updates: Object.keys(updates)
      });

      // Get transaction-aware repositories
      const caseRepo = unitOfWork.getRepository(CaseRepository);
      const auditRepo = unitOfWork.getRepository(AuditLogRepository);

      // Get current case state for audit logging
      const existingCase = await caseRepo.findById(caseId);
      if (!existingCase) {
        await unitOfWork.rollback();
        throw new Error('Case not found');
      }

      // Update case within transaction
      const updatedCase = await caseRepo.update(caseId, updates);
      if (!updatedCase) {
        await unitOfWork.rollback();
        throw new Error('Case update failed');
      }

      // Log update within transaction (using CASE_ASSIGNED as closest match)
      await auditRepo.logAction({
        guildId: context.guildId,
        action: AuditAction.CASE_ASSIGNED,
        actorId: context.userId,
        details: {
          before: {
            status: existingCase.status
          },
          after: {
            status: updatedCase.status
          },
          metadata: {
            caseId,
            caseNumber: existingCase.caseNumber,
            fieldsUpdated: Object.keys(updates),
            transactionId,
            beforePriority: existingCase.priority,
            afterPriority: updatedCase.priority,
            beforeTitle: existingCase.title,
            afterTitle: updatedCase.title
          }
        },
        timestamp: new Date()
      });

      await unitOfWork.commit();

      logger.info('Case update transaction completed successfully', {
        transactionId,
        caseId,
        fieldsUpdated: Object.keys(updates)
      });

      return updatedCase;

    } catch (error) {
      const rollbackContext = this.rollbackService.createRollbackContext(
        unitOfWork,
        'updateCaseTransactional',
        error as Error,
        {
          guildId: context.guildId,
          userId: context.userId,
          metadata: { caseId, updates }
        }
      );

      await this.rollbackService.performRollback(unitOfWork, rollbackContext);

      logger.error('Case update failed with rollback:', error);
      throw new Error('Failed to update case');
    }
  }

  /**
   * Validates case creation request outside of transaction.
   */
  private async validateCaseCreationRequest(
    context: PermissionContext,
    request: CaseCreationRequest
  ): Promise<{ success: boolean; error?: string }> {
    // Check permissions
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      return { success: false, error: 'You do not have permission to create cases' };
    }

    // Validate client case limits
    const caseLimitValidation = await this.validateClientCaseLimits(
      request.clientId,
      request.guildId
    );

    if (!caseLimitValidation.valid) {
      return { success: false, error: caseLimitValidation.errors.join(', ') };
    }

    return { success: true };
  }

  /**
   * Validates lawyer assignment request outside of transaction.
   */
  private async validateLawyerAssignmentRequest(
    context: PermissionContext,
    request: CaseAssignmentRequest
  ): Promise<{ success: boolean; error?: string }> {
    const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
    if (!hasPermission) {
      return { success: false, error: 'You do not have permission to assign lawyers to cases' };
    }

    // Validate all lawyers
    for (const lawyerId of request.lawyerIds) {
      const lawyerValidation = await this.validateLawyerPermissions(
        context.guildId,
        lawyerId,
        'lawyer'
      );

      if (!lawyerValidation.valid) {
        return { 
          success: false, 
          error: `User ${lawyerId} cannot be assigned to case: ${lawyerValidation.errors.join(', ')}` 
        };
      }
    }

    return { success: true };
  }

  /**
   * Validates client case limits (implementation placeholder).
   */
  private async validateClientCaseLimits(
    _clientId: string,
    _guildId: string
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    // Implementation would check client case limits
    // For now, return valid
    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * Validates lawyer permissions (implementation placeholder).
   */
  private async validateLawyerPermissions(
    _guildId: string,
    _lawyerId: string,
    _requiredRole: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    // Implementation would validate lawyer permissions
    // For now, return valid
    return { valid: true, errors: [] };
  }

  /**
   * Creates a Discord channel for the case (placeholder implementation).
   */
  private async createCaseChannel(
    guildId: string, 
    caseNumber: string, 
    title: string
  ): Promise<boolean> {
    try {
      if (!this.discordClient) {
        return false;
      }

      // Implementation would create Discord channel
      logger.info('Creating Discord channel for case', {
        guildId,
        caseNumber,
        title
      });

      return true; // Placeholder - would return actual channel creation result
    } catch (error) {
      logger.error('Failed to create case channel:', error);
      return false;
    }
  }

  /**
   * Registers compensation actions for case creation.
   */
  private registerCaseCreationCompensationActions(
    transactionId: string,
    guildId: string,
    clientId: string,
    title: string
  ): void {
    // Register audit log compensation
    const auditCompensation = CompensationActionFactory.createAuditLogCompensationAction(
      guildId,
      clientId,
      'CASE_CREATION_FAILED',
      `Case creation failed for: ${title}`
    );
    this.rollbackService.registerCompensationAction(transactionId, auditCompensation);

    // Register notification compensation
    const notificationAction = CompensationActionFactory.createNotificationCompensationAction(
      [clientId],
      `Case creation failed and has been rolled back. Please try again or contact support.`,
      'error'
    );
    this.rollbackService.registerCompensationAction(transactionId, notificationAction);
  }

  /**
   * Registers channel deletion compensation action.
   */
  private registerChannelDeletionCompensation(
    transactionId: string,
    guildId: string,
    caseNumber: string
  ): void {
    const channelDeletionAction = {
      id: `channel-deletion-${caseNumber}`,
      description: `Delete Discord channel for case ${caseNumber}`,
      priority: 10,
      retryable: true,
      maxRetries: 3,
      execute: async () => {
        logger.info('Executing channel deletion compensation', {
          guildId,
          caseNumber
        });
        // Implementation would delete the Discord channel
      }
    };

    this.rollbackService.registerCompensationAction(transactionId, channelDeletionAction);
  }
}