import { Case, CaseCreationRequest, CaseAssignmentRequest, CaseUpdateRequest } from '../../validation';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { CaseCounterRepository } from '../../infrastructure/repositories/case-counter-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { PermissionService, PermissionContext } from './permission-service';
import { UnifiedValidationService } from '../validation/unified-validation-service';
import { IUnitOfWorkFactory } from '../../infrastructure/unit-of-work/unit-of-work';
import { RollbackService } from '../../infrastructure/unit-of-work/rollback-service';
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
export declare class TransactionalCaseService {
    private _caseRepository;
    private _caseCounterRepository;
    private _auditLogRepository;
    private _guildConfigRepository;
    private permissionService;
    private _validationAdapter;
    private unitOfWorkFactory;
    private rollbackService;
    private discordClient?;
    constructor(caseRepository: CaseRepository, caseCounterRepository: CaseCounterRepository, auditLogRepository: AuditLogRepository, guildConfigRepository: GuildConfigRepository, permissionService: PermissionService, validationService: UnifiedValidationService, discordClient?: Client, unitOfWorkFactory?: IUnitOfWorkFactory, rollbackService?: RollbackService);
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
    createCaseTransactional(context: PermissionContext, request: CaseCreationRequest): Promise<Case>;
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
    assignLawyerTransactional(context: PermissionContext, request: CaseAssignmentRequest): Promise<Case>;
    /**
     * Updates a case using atomic transactions.
     *
     * ## Transaction Scope:
     * - Case update
     * - Audit log creation
     * - Status change notifications (if applicable)
     */
    updateCaseTransactional(context: PermissionContext, caseId: string, updates: CaseUpdateRequest): Promise<Case>;
    /**
     * Validates case creation request outside of transaction.
     */
    private validateCaseCreationRequest;
    /**
     * Validates lawyer assignment request outside of transaction.
     */
    private validateLawyerAssignmentRequest;
    /**
     * Validates client case limits (implementation placeholder).
     */
    private validateClientCaseLimits;
    /**
     * Validates lawyer permissions (implementation placeholder).
     */
    private validateLawyerPermissions;
    /**
     * Creates a Discord channel for the case (placeholder implementation).
     */
    private createCaseChannel;
    /**
     * Registers compensation actions for case creation.
     */
    private registerCaseCreationCompensationActions;
    /**
     * Registers channel deletion compensation action.
     */
    private registerChannelDeletionCompensation;
}
//# sourceMappingURL=case-service-transactional.d.ts.map