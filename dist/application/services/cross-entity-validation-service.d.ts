import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { ReminderRepository } from '../../infrastructure/repositories/reminder-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { Client } from 'discord.js';
export interface ValidationRule {
    name: string;
    description: string;
    entityType: 'staff' | 'case' | 'application' | 'job' | 'retainer' | 'feedback' | 'reminder';
    priority: number;
    dependencies?: string[];
    validate: (entity: any, context: ValidationContext) => Promise<ValidationIssue[]>;
}
export interface ValidationContext {
    guildId: string;
    client?: Client;
    relatedEntities?: Map<string, any[]>;
    validationLevel: 'strict' | 'lenient';
    repairMode?: boolean;
}
export interface ValidationIssue {
    severity: 'critical' | 'warning' | 'info';
    entityType: string;
    entityId: string;
    field?: string;
    message: string;
    canAutoRepair: boolean;
    repairAction?: () => Promise<void>;
}
export interface IntegrityReport {
    guildId: string;
    scanStartedAt: Date;
    scanCompletedAt: Date;
    totalEntitiesScanned: number;
    issues: ValidationIssue[];
    issuesBySeverity: {
        critical: number;
        warning: number;
        info: number;
    };
    issuesByEntityType: Map<string, number>;
    repairableIssues: number;
}
export interface RepairResult {
    totalIssuesFound: number;
    issuesRepaired: number;
    issuesFailed: number;
    repairedIssues: ValidationIssue[];
    failedRepairs: Array<{
        issue: ValidationIssue;
        error: string;
    }>;
}
export declare class CrossEntityValidationService {
    private readonly staffRepository;
    private readonly caseRepository;
    private readonly applicationRepository;
    private readonly jobRepository;
    private readonly retainerRepository;
    private readonly feedbackRepository;
    private readonly reminderRepository;
    private readonly auditLogRepository;
    private validationRules;
    private validationCache;
    private readonly CACHE_TTL_MS;
    private ruleDependencyGraph;
    private asyncValidationQueue;
    private readonly MAX_CONCURRENT_VALIDATIONS;
    constructor(staffRepository: StaffRepository, caseRepository: CaseRepository, applicationRepository: ApplicationRepository, jobRepository: JobRepository, retainerRepository: RetainerRepository, feedbackRepository: FeedbackRepository, reminderRepository: ReminderRepository, auditLogRepository: AuditLogRepository);
    private initializeValidationRules;
    /**
     * Build dependency graph and determine optimal execution order
     */
    private buildRuleDependencyGraph;
    /**
     * Initialize advanced cross-entity validation rules
     */
    private initializeAdvancedRules;
    /**
     * Async validation with queue management
     */
    private queueValidation;
    /**
     * Perform deep referential integrity check
     */
    performDeepIntegrityCheck(guildId: string, context?: Partial<ValidationContext>): Promise<IntegrityReport>;
    /**
     * Check data consistency across entities
     */
    private checkDataConsistency;
    /**
     * Check referential integrity
     */
    private checkReferentialIntegrity;
    /**
     * Enhanced batch validation with optimization
     */
    optimizedBatchValidate(entities: Array<{
        entity: any;
        type: string;
    }>, context?: Partial<ValidationContext>): Promise<Map<string, ValidationIssue[]>>;
    /**
     * Smart repair with dependency resolution
     */
    smartRepair(issues: ValidationIssue[], options?: {
        dryRun?: boolean;
        maxRetries?: number;
        repairDependencies?: boolean;
    }): Promise<RepairResult>;
    private addRule;
    scanForIntegrityIssues(guildId: string, context?: Partial<ValidationContext>): Promise<IntegrityReport>;
    private validateEntity;
    private checkForOrphanedRelationships;
    repairIntegrityIssues(issues: ValidationIssue[], options?: {
        dryRun?: boolean;
    }): Promise<RepairResult>;
    validateBeforeOperation(entity: any, entityType: string, _operation: 'create' | 'update' | 'delete', context?: Partial<ValidationContext>): Promise<ValidationIssue[]>;
    batchValidate(entities: Array<{
        entity: any;
        type: string;
    }>, context?: Partial<ValidationContext>): Promise<Map<string, ValidationIssue[]>>;
    clearValidationCache(): void;
    getValidationRules(): ValidationRule[];
    addCustomRule(rule: ValidationRule): void;
}
//# sourceMappingURL=cross-entity-validation-service.d.ts.map