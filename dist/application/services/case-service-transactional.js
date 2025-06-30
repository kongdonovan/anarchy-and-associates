"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionalCaseService = void 0;
const case_1 = require("../../domain/entities/case"); // Keep utility function and enums
const audit_log_1 = require("../../domain/entities/audit-log");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const migration_adapter_1 = require("../validation/migration-adapter");
const mongo_unit_of_work_1 = require("../../infrastructure/unit-of-work/mongo-unit-of-work");
const rollback_service_1 = require("../../infrastructure/unit-of-work/rollback-service");
const logger_1 = require("../../infrastructure/logger");
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
class TransactionalCaseService {
    constructor(caseRepository, caseCounterRepository, auditLogRepository, guildConfigRepository, permissionService, validationService, discordClient, unitOfWorkFactory, rollbackService) {
        this._caseRepository = caseRepository;
        this._caseCounterRepository = caseCounterRepository;
        this._auditLogRepository = auditLogRepository;
        this._guildConfigRepository = guildConfigRepository;
        this.permissionService = permissionService;
        this._validationAdapter = new migration_adapter_1.ValidationMigrationAdapter(validationService);
        this.discordClient = discordClient;
        this.unitOfWorkFactory = unitOfWorkFactory || new mongo_unit_of_work_1.MongoUnitOfWorkFactory();
        this.rollbackService = rollbackService || new rollback_service_1.RollbackService();
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
    async createCaseTransactional(context, request) {
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
            logger_1.logger.info('Starting case creation transaction', {
                transactionId,
                guildId: request.guildId,
                clientId: request.clientId,
                title: request.title
            });
            // Register compensation actions
            this.registerCaseCreationCompensationActions(transactionId, request.guildId, request.clientId, request.title);
            // Get transaction-aware repositories
            const caseRepo = unitOfWork.getRepository(case_repository_1.CaseRepository);
            const caseCounterRepo = unitOfWork.getRepository(case_counter_repository_1.CaseCounterRepository);
            const auditRepo = unitOfWork.getRepository(audit_log_repository_1.AuditLogRepository);
            // Generate sequential case number within transaction (atomic operation)
            const caseCount = await caseCounterRepo.getNextCaseNumber(request.guildId);
            const currentYear = new Date().getFullYear();
            const caseNumber = (0, case_1.generateCaseNumber)(currentYear, caseCount, request.clientUsername);
            logger_1.logger.debug('Generated case number within transaction', {
                transactionId,
                caseNumber,
                caseCount,
                year: currentYear
            });
            // Create case record within transaction
            const caseData = {
                guildId: request.guildId,
                caseNumber,
                clientId: request.clientId,
                clientUsername: request.clientUsername,
                title: request.title,
                description: request.description,
                status: case_1.CaseStatus.PENDING,
                priority: request.priority || case_1.CasePriority.MEDIUM,
                assignedLawyerIds: [],
                documents: [],
                notes: []
            };
            const createdCase = await caseRepo.add(caseData);
            // Log case creation within transaction
            await auditRepo.logAction({
                guildId: request.guildId,
                action: audit_log_1.AuditAction.CASE_CREATED,
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
                }
                catch (channelError) {
                    // Channel creation is not critical for case creation, log but continue
                    logger_1.logger.warn('Failed to create case channel, continuing with case creation', {
                        transactionId,
                        caseNumber,
                        error: channelError.message
                    });
                }
            }
            // Commit transaction
            await unitOfWork.commit();
            // Clear compensation actions on success
            this.rollbackService.clearTransaction(transactionId);
            logger_1.logger.info('Case creation transaction completed successfully', {
                transactionId,
                caseId: createdCase._id?.toString(),
                caseNumber,
                channelCreated
            });
            return createdCase;
        }
        catch (error) {
            logger_1.logger.error('Error in case creation transaction:', error);
            // Perform rollback with compensation actions
            const rollbackContext = this.rollbackService.createRollbackContext(unitOfWork, 'createCaseTransactional', error, {
                guildId: request.guildId,
                userId: context.userId,
                metadata: {
                    clientId: request.clientId,
                    clientUsername: request.clientUsername,
                    title: request.title,
                    priority: request.priority
                }
            });
            const rollbackResult = await this.rollbackService.performRollback(unitOfWork, rollbackContext);
            logger_1.logger.error('Case creation failed with rollback', {
                originalError: error.message,
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
    async assignLawyerTransactional(context, request) {
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
            logger_1.logger.info('Starting lawyer assignment transaction', {
                transactionId,
                caseId: request.caseId,
                lawyerIds: request.lawyerIds,
                assignedBy: request.assignedBy
            });
            // Get transaction-aware repositories
            const caseRepo = unitOfWork.getRepository(case_repository_1.CaseRepository);
            const auditRepo = unitOfWork.getRepository(audit_log_repository_1.AuditLogRepository);
            // Find case within transaction for consistency
            const existingCase = await caseRepo.findById(request.caseId);
            if (!existingCase) {
                await unitOfWork.rollback();
                throw new Error('Case not found');
            }
            // Assign lawyers within transaction
            let updatedCase = existingCase;
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
                action: audit_log_1.AuditAction.CASE_ASSIGNED,
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
            logger_1.logger.info('Lawyer assignment transaction completed successfully', {
                transactionId,
                caseId: request.caseId,
                lawyerIds: request.lawyerIds,
                leadAttorneyId: updatedCase.leadAttorneyId
            });
            return updatedCase;
        }
        catch (error) {
            const rollbackContext = this.rollbackService.createRollbackContext(unitOfWork, 'assignLawyerTransactional', error, {
                guildId: context.guildId,
                userId: context.userId,
                metadata: {
                    caseId: request.caseId,
                    lawyerIds: request.lawyerIds,
                    assignedBy: request.assignedBy
                }
            });
            await this.rollbackService.performRollback(unitOfWork, rollbackContext);
            logger_1.logger.error('Lawyer assignment failed with rollback:', error);
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
    async updateCaseTransactional(context, caseId, updates) {
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
            logger_1.logger.info('Starting case update transaction', {
                transactionId,
                caseId,
                updates: Object.keys(updates)
            });
            // Get transaction-aware repositories
            const caseRepo = unitOfWork.getRepository(case_repository_1.CaseRepository);
            const auditRepo = unitOfWork.getRepository(audit_log_repository_1.AuditLogRepository);
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
                action: audit_log_1.AuditAction.CASE_ASSIGNED,
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
            logger_1.logger.info('Case update transaction completed successfully', {
                transactionId,
                caseId,
                fieldsUpdated: Object.keys(updates)
            });
            return updatedCase;
        }
        catch (error) {
            const rollbackContext = this.rollbackService.createRollbackContext(unitOfWork, 'updateCaseTransactional', error, {
                guildId: context.guildId,
                userId: context.userId,
                metadata: { caseId, updates }
            });
            await this.rollbackService.performRollback(unitOfWork, rollbackContext);
            logger_1.logger.error('Case update failed with rollback:', error);
            throw new Error('Failed to update case');
        }
    }
    /**
     * Validates case creation request outside of transaction.
     */
    async validateCaseCreationRequest(context, request) {
        // Check permissions
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            return { success: false, error: 'You do not have permission to create cases' };
        }
        // Validate client case limits
        const caseLimitValidation = await this.validateClientCaseLimits(request.clientId, request.guildId);
        if (!caseLimitValidation.valid) {
            return { success: false, error: caseLimitValidation.errors.join(', ') };
        }
        return { success: true };
    }
    /**
     * Validates lawyer assignment request outside of transaction.
     */
    async validateLawyerAssignmentRequest(context, request) {
        const hasPermission = await this.permissionService.hasActionPermission(context, 'case');
        if (!hasPermission) {
            return { success: false, error: 'You do not have permission to assign lawyers to cases' };
        }
        // Validate all lawyers
        for (const lawyerId of request.lawyerIds) {
            const lawyerValidation = await this.validateLawyerPermissions(context.guildId, lawyerId, 'lawyer');
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
    async validateClientCaseLimits(_clientId, _guildId) {
        // Implementation would check client case limits
        // For now, return valid
        return { valid: true, errors: [], warnings: [] };
    }
    /**
     * Validates lawyer permissions (implementation placeholder).
     */
    async validateLawyerPermissions(_guildId, _lawyerId, _requiredRole) {
        // Implementation would validate lawyer permissions
        // For now, return valid
        return { valid: true, errors: [] };
    }
    /**
     * Creates a Discord channel for the case (placeholder implementation).
     */
    async createCaseChannel(guildId, caseNumber, title) {
        try {
            if (!this.discordClient) {
                return false;
            }
            // Implementation would create Discord channel
            logger_1.logger.info('Creating Discord channel for case', {
                guildId,
                caseNumber,
                title
            });
            return true; // Placeholder - would return actual channel creation result
        }
        catch (error) {
            logger_1.logger.error('Failed to create case channel:', error);
            return false;
        }
    }
    /**
     * Registers compensation actions for case creation.
     */
    registerCaseCreationCompensationActions(transactionId, guildId, clientId, title) {
        // Register audit log compensation
        const auditCompensation = rollback_service_1.CompensationActionFactory.createAuditLogCompensationAction(guildId, clientId, 'CASE_CREATION_FAILED', `Case creation failed for: ${title}`);
        this.rollbackService.registerCompensationAction(transactionId, auditCompensation);
        // Register notification compensation
        const notificationAction = rollback_service_1.CompensationActionFactory.createNotificationCompensationAction([clientId], `Case creation failed and has been rolled back. Please try again or contact support.`, 'error');
        this.rollbackService.registerCompensationAction(transactionId, notificationAction);
    }
    /**
     * Registers channel deletion compensation action.
     */
    registerChannelDeletionCompensation(transactionId, guildId, caseNumber) {
        const channelDeletionAction = {
            id: `channel-deletion-${caseNumber}`,
            description: `Delete Discord channel for case ${caseNumber}`,
            priority: 10,
            retryable: true,
            maxRetries: 3,
            execute: async () => {
                logger_1.logger.info('Executing channel deletion compensation', {
                    guildId,
                    caseNumber
                });
                // Implementation would delete the Discord channel
            }
        };
        this.rollbackService.registerCompensationAction(transactionId, channelDeletionAction);
    }
}
exports.TransactionalCaseService = TransactionalCaseService;
//# sourceMappingURL=case-service-transactional.js.map