import { ValidationStrategy, ValidationContext, ValidationResult } from '../types';
import { StaffRepository } from '../../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../../infrastructure/repositories/case-repository';
import { JobRepository } from '../../../infrastructure/repositories/job-repository';
import { ApplicationRepository } from '../../../infrastructure/repositories/application-repository';
/**
 * Strategy for validating cross-entity consistency and relationships
 */
export declare class CrossEntityValidationStrategy implements ValidationStrategy {
    private staffRepository;
    private caseRepository;
    private jobRepository;
    private applicationRepository;
    readonly name = "CrossEntityValidation";
    constructor(staffRepository: StaffRepository, caseRepository: CaseRepository, jobRepository: JobRepository, applicationRepository: ApplicationRepository);
    canHandle(context: ValidationContext): boolean;
    validate(context: ValidationContext): Promise<ValidationResult>;
    /**
     * Validates based on entity type for standard operations
     */
    private validateBasedOnEntityType;
    /**
     * Validates staff role consistency across the system
     */
    private validateStaffRoleConsistency;
    /**
     * Validates case integrity and relationships
     */
    private validateCaseIntegrity;
    /**
     * Validates job and application consistency
     */
    private validateJobApplicationConsistency;
    /**
     * Validates cascading updates
     */
    private validateCascadingUpdate;
    /**
     * Validates entity relationships
     */
    private validateEntityRelationships;
    /**
     * Validates and identifies orphaned entities
     */
    private validateOrphanedEntities;
    private checkRoleHierarchy;
    private checkDuplicateUniqueRoles;
    private checkManagementConsistency;
    private validateSingleCase;
    private validateSingleJob;
    private assessRoleChangeImpact;
    private assessStaffRemovalImpact;
    private assessCaseStatusChangeImpact;
    private checkCircularDependencies;
    private checkBrokenReferences;
    private checkOrphanedApplications;
    private validateStaffRemovalImpact;
    private validateCaseClosureImpact;
    private validateJobClosureImpact;
    private isManagementRole;
}
//# sourceMappingURL=cross-entity-validation-strategy.d.ts.map