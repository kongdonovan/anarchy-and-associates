import {
  ValidationStrategy,
  ValidationContext,
  ValidationResult,
  ValidationResultHelper,
  ValidationSeverity
} from '../types';
import { StaffRepository } from '../../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../../infrastructure/repositories/case-repository';
import { JobRepository } from '../../../infrastructure/repositories/job-repository';
import { ApplicationRepository } from '../../../infrastructure/repositories/application-repository';
import { StaffRole as StaffRoleEnum, RoleUtils } from '../../../domain/entities/staff-role';
import { CaseStatus } from '../../../domain/entities/case';
import { logger } from '../../../infrastructure/logger';
import { StaffRole } from '../../../validation';

/**
 * Strategy for validating cross-entity consistency and relationships
 */
export class CrossEntityValidationStrategy implements ValidationStrategy {
  readonly name = 'CrossEntityValidation';

  constructor(
    private staffRepository: StaffRepository,
    private caseRepository: CaseRepository,
    private jobRepository: JobRepository,
    private applicationRepository: ApplicationRepository
  ) {}

  canHandle(context: ValidationContext): boolean {
    const supportedOperations = [
      'validateStaffRoleConsistency',
      'validateCaseIntegrity',
      'validateJobApplicationConsistency',
      'validateCascadingUpdate',
      'validateEntityRelationships',
      'validateOrphanedEntities'
    ];

    return supportedOperations.includes(context.operation) ||
           context.metadata?.requiresCrossEntityValidation === true;
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    logger.debug(`CrossEntityValidation: ${context.entityType}:${context.operation}`);

    switch (context.operation) {
      case 'validateStaffRoleConsistency':
        return this.validateStaffRoleConsistency(context);
      case 'validateCaseIntegrity':
        return this.validateCaseIntegrity(context);
      case 'validateJobApplicationConsistency':
        return this.validateJobApplicationConsistency(context);
      case 'validateCascadingUpdate':
        return this.validateCascadingUpdate(context);
      case 'validateEntityRelationships':
        return this.validateEntityRelationships(context);
      case 'validateOrphanedEntities':
        return this.validateOrphanedEntities(context);
      default:
        // Check for specific entity operations that need cross-validation
        return this.validateBasedOnEntityType(context);
    }
  }

  /**
   * Validates based on entity type for standard operations
   */
  private async validateBasedOnEntityType(context: ValidationContext): Promise<ValidationResult> {
    switch (context.entityType) {
      case 'staff':
        if (context.operation === 'fire' || context.operation === 'demote') {
          return this.validateStaffRemovalImpact(context);
        }
        break;
      case 'case':
        if (context.operation === 'close' || context.operation === 'delete') {
          return this.validateCaseClosureImpact(context);
        }
        break;
      case 'job':
        if (context.operation === 'close' || context.operation === 'delete') {
          return this.validateJobClosureImpact(context);
        }
        break;
    }

    return ValidationResultHelper.success();
  }

  /**
   * Validates staff role consistency across the system
   */
  private async validateStaffRoleConsistency(context: ValidationContext): Promise<ValidationResult> {
    const { guildId } = context.permissionContext;
    const issues: any[] = [];

    try {
      // Get all active staff
      const allStaff = await this.staffRepository.findByGuildId(guildId);
      const activeStaff = allStaff.filter(s => s.status === 'active');

      // Check for role hierarchy violations
      const roleHierarchy = this.checkRoleHierarchy(activeStaff);
      if (!roleHierarchy.valid) {
        issues.push(...roleHierarchy.issues);
      }

      // Check for duplicate roles where only one is allowed
      const duplicateCheck = this.checkDuplicateUniqueRoles(activeStaff);
      if (!duplicateCheck.valid) {
        issues.push(...duplicateCheck.issues);
      }

      // Check for orphaned management relationships
      const managementCheck = await this.checkManagementConsistency(guildId, activeStaff);
      if (!managementCheck.valid) {
        issues.push(...managementCheck.issues);
      }

      return {
        valid: issues.filter(i => i.severity === ValidationSeverity.ERROR).length === 0,
        issues,
        metadata: {
          totalStaff: activeStaff.length,
          checkedAspects: ['hierarchy', 'duplicates', 'management']
        }
      };
    } catch (error) {
      logger.error('Error validating staff role consistency:', error);
      return ValidationResultHelper.error(
        'VALIDATION_ERROR',
        'Failed to validate staff role consistency'
      );
    }
  }

  /**
   * Validates case integrity and relationships
   */
  private async validateCaseIntegrity(context: ValidationContext): Promise<ValidationResult> {
    const { guildId } = context.permissionContext;
    const caseId = context.data.caseId || context.entityId;
    const issues: any[] = [];

    try {
      if (caseId) {
        // Validate specific case
        const caseEntity = await this.caseRepository.findById(caseId);
        if (!caseEntity) {
          return ValidationResultHelper.error('CASE_NOT_FOUND', 'Case not found');
        }

        // Check assignee validity
        if (caseEntity.assignedLawyerIds && caseEntity.assignedLawyerIds.length > 0) {
          for (const lawyerId of caseEntity.assignedLawyerIds) {
            const assignee = await this.staffRepository.findByUserId(guildId, lawyerId);
            if (!assignee || assignee.status !== 'active') {
              issues.push({
                severity: ValidationSeverity.ERROR,
                code: 'INVALID_ASSIGNEE',
                message: `Case assigned to inactive or non-existent staff member: ${lawyerId}`,
                field: 'assignedLawyerIds'
              });
            }
          }
        }

        // Check lead attorney validity
        if (caseEntity.leadAttorneyId) {
          const lead = await this.staffRepository.findByUserId(guildId, caseEntity.leadAttorneyId);
          if (!lead || lead.status !== 'active') {
            issues.push({
              severity: ValidationSeverity.ERROR,
              code: 'INVALID_LEAD_ATTORNEY',
              message: 'Lead attorney is inactive or non-existent',
              field: 'leadAttorneyId'
            });
          } else if (!this.isManagementRole(lead.role as StaffRoleEnum)) {
            issues.push({
              severity: ValidationSeverity.WARNING,
              code: 'NON_MANAGEMENT_LEAD',
              message: 'Lead attorney should have a management role',
              field: 'leadAttorneyId'
            });
          }
        }
      } else {
        // Validate all cases
        const allCases = await this.caseRepository.getActiveCases(guildId);
        const activeCases = allCases.filter((c: any) => c.status !== CaseStatus.CLOSED);

        for (const caseEntity of activeCases) {
          const caseIssues = await this.validateSingleCase(guildId, caseEntity);
          issues.push(...caseIssues);
        }
      }

      return {
        valid: issues.filter(i => i.severity === ValidationSeverity.ERROR).length === 0,
        issues
      };
    } catch (error) {
      logger.error('Error validating case integrity:', error);
      return ValidationResultHelper.error(
        'VALIDATION_ERROR',
        'Failed to validate case integrity'
      );
    }
  }

  /**
   * Validates job and application consistency
   */
  private async validateJobApplicationConsistency(context: ValidationContext): Promise<ValidationResult> {
    const { guildId } = context.permissionContext;
    const jobId = context.data.jobId;
    const issues: any[] = [];

    try {
      if (jobId) {
        // Validate specific job
        const job = await this.jobRepository.findById(jobId);
        if (!job) {
          return ValidationResultHelper.error('JOB_NOT_FOUND', 'Job not found');
        }

        // Check posted by validity
        const poster = await this.staffRepository.findByUserId(guildId, job.postedBy);
        if (!poster || poster.status !== 'active') {
          issues.push({
            severity: ValidationSeverity.WARNING,
            code: 'INACTIVE_POSTER',
            message: 'Job posted by inactive staff member',
            field: 'postedBy'
          });
        }

        // Check applications
        const applications = await this.applicationRepository.findByJob(jobId);
        for (const app of applications) {
          if (app.status === 'pending' && !job.isOpen) {
            issues.push({
              severity: ValidationSeverity.ERROR,
              code: 'PENDING_APP_CLOSED_JOB',
              message: `Application ${app._id} is pending but job is closed`,
              context: { applicationId: app._id }
            });
          }
        }
      } else {
        // Validate all jobs
        const allJobs = await this.jobRepository.findByGuildId(guildId);
        
        for (const job of allJobs) {
          if (job.isOpen) {
            const jobIssues = await this.validateSingleJob(guildId, job);
            issues.push(...jobIssues);
          }
        }
      }

      return {
        valid: issues.filter(i => i.severity === ValidationSeverity.ERROR).length === 0,
        issues
      };
    } catch (error) {
      logger.error('Error validating job application consistency:', error);
      return ValidationResultHelper.error(
        'VALIDATION_ERROR',
        'Failed to validate job application consistency'
      );
    }
  }

  /**
   * Validates cascading updates
   */
  private async validateCascadingUpdate(context: ValidationContext): Promise<ValidationResult> {
    const updateType = context.data.updateType;
    const entityId = context.data.entityId;
    const issues: any[] = [];

    switch (updateType) {
      case 'staffRoleChange':
        const roleChangeImpact = await this.assessRoleChangeImpact(
          context.permissionContext.guildId,
          entityId,
          context.data.oldRole,
          context.data.newRole
        );
        issues.push(...roleChangeImpact);
        break;

      case 'staffRemoval':
        const removalImpact = await this.assessStaffRemovalImpact(
          context.permissionContext.guildId,
          entityId
        );
        issues.push(...removalImpact);
        break;

      case 'caseStatusChange':
        const caseImpact = await this.assessCaseStatusChangeImpact(
          context.permissionContext.guildId,
          entityId,
          context.data.newStatus
        );
        issues.push(...caseImpact);
        break;
    }

    return {
      valid: issues.filter(i => i.severity === ValidationSeverity.ERROR).length === 0,
      issues,
      metadata: {
        cascadeType: updateType,
        affectedEntities: issues.length
      }
    };
  }

  /**
   * Validates entity relationships
   */
  private async validateEntityRelationships(context: ValidationContext): Promise<ValidationResult> {
    const { guildId } = context.permissionContext;
    const issues: any[] = [];

    try {
      // Check for circular dependencies
      const circularCheck = await this.checkCircularDependencies(guildId);
      issues.push(...circularCheck);

      // Check for broken references
      const brokenRefCheck = await this.checkBrokenReferences(guildId);
      issues.push(...brokenRefCheck);

      return {
        valid: issues.filter(i => i.severity === ValidationSeverity.ERROR).length === 0,
        issues
      };
    } catch (error) {
      logger.error('Error validating entity relationships:', error);
      return ValidationResultHelper.error(
        'VALIDATION_ERROR',
        'Failed to validate entity relationships'
      );
    }
  }

  /**
   * Validates and identifies orphaned entities
   */
  private async validateOrphanedEntities(context: ValidationContext): Promise<ValidationResult> {
    const { guildId } = context.permissionContext;
    const issues: any[] = [];

    try {
      // Check for cases without assignees
      const allCases = await this.caseRepository.getActiveCases(guildId);
      const unassignedCases = allCases.filter((c: any) => (!c.assignedLawyerIds || c.assignedLawyerIds.length === 0) && c.status !== CaseStatus.CLOSED);
      if (unassignedCases.length > 0) {
        issues.push({
          severity: ValidationSeverity.WARNING,
          code: 'UNASSIGNED_CASES',
          message: `Found ${unassignedCases.length} cases without assignees`,
          context: { caseNumbers: unassignedCases.map((c: any) => c.caseNumber) }
        });
      }

      // Check for applications without jobs
      const orphanedApps = await this.checkOrphanedApplications(guildId);
      if (orphanedApps.length > 0) {
        issues.push({
          severity: ValidationSeverity.ERROR,
          code: 'ORPHANED_APPLICATIONS',
          message: `Found ${orphanedApps.length} applications without valid jobs`,
          context: { applicationIds: orphanedApps }
        });
      }

      return {
        valid: issues.filter(i => i.severity === ValidationSeverity.ERROR).length === 0,
        issues
      };
    } catch (error) {
      logger.error('Error validating orphaned entities:', error);
      return ValidationResultHelper.error(
        'VALIDATION_ERROR',
        'Failed to validate orphaned entities'
      );
    }
  }

  // Helper methods

  private checkRoleHierarchy(staff: any[]): ValidationResult {
    const issues: any[] = [];
    
    // Group by role level
    const byLevel = new Map<number, any[]>();
    staff.forEach(s => {
      const level = RoleUtils.getRoleLevel(s.role);
      if (!byLevel.has(level)) {
        byLevel.set(level, []);
      }
      byLevel.get(level)!.push(s);
    });

    // Check for gaps in hierarchy
    const levels = Array.from(byLevel.keys()).sort((a, b) => b - a);
    for (let i = 0; i < levels.length - 1; i++) {
      if ((levels[i] ?? 0) - (levels[i + 1] ?? 0) > 1) {
        issues.push({
          severity: ValidationSeverity.WARNING,
          code: 'HIERARCHY_GAP',
          message: `Gap in role hierarchy between levels ${levels[i]} and ${levels[i + 1]}`
        });
      }
    }

    return {
      valid: true,
      issues
    };
  }

  private checkDuplicateUniqueRoles(staff: any[]): ValidationResult {
    const issues: any[] = [];
    
    const managingPartners = staff.filter(s => s.role === 'Managing Partner');
    if (managingPartners.length > 1) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        code: 'MULTIPLE_MANAGING_PARTNERS',
        message: `Found ${managingPartners.length} Managing Partners, only 1 allowed`,
        context: { userIds: managingPartners.map(s => s.userId) }
      });
    }

    return {
      valid: issues.filter(i => i.severity === ValidationSeverity.ERROR).length === 0,
      issues
    };
  }

  private async checkManagementConsistency(_guildId: string, staff: any[]): Promise<ValidationResult> {
    const issues: any[] = [];
    
    // Check if there are staff but no management
    const managementStaff = staff.filter(s => this.isManagementRole(s.role));
    if (staff.length > 0 && managementStaff.length === 0) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        code: 'NO_MANAGEMENT',
        message: 'Organization has staff but no management roles'
      });
    }

    return {
      valid: issues.filter(i => i.severity === ValidationSeverity.ERROR).length === 0,
      issues
    };
  }

  private async validateSingleCase(guildId: string, caseEntity: any): Promise<any[]> {
    const issues: any[] = [];

    if (caseEntity.assignedLawyerIds && caseEntity.assignedLawyerIds.length > 0) {
      for (const lawyerId of caseEntity.assignedLawyerIds) {
        const assignee = await this.staffRepository.findByUserId(guildId, lawyerId);
        if (!assignee || assignee.status !== 'active') {
          issues.push({
            severity: ValidationSeverity.ERROR,
            code: 'INVALID_CASE_ASSIGNEE',
            message: `Case ${caseEntity.caseNumber} assigned to invalid staff: ${lawyerId}`,
            context: { caseNumber: caseEntity.caseNumber, lawyerId }
          });
        }
      }
    }

    return issues;
  }

  private async validateSingleJob(_guildId: string, job: any): Promise<any[]> {
    const issues: any[] = [];

    // Check if job has been open too long
    const openDuration = Date.now() - job.createdAt.getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    if (openDuration > thirtyDays) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        code: 'STALE_JOB',
        message: `Job "${job.title}" has been open for over 30 days`,
        context: { jobId: job._id, title: job.title }
      });
    }

    return issues;
  }

  private async assessRoleChangeImpact(
    guildId: string,
    userId: string,
    oldRole: StaffRole,
    newRole: StaffRole
  ): Promise<any[]> {
    const issues: any[] = [];

    // Check if demoting from management with active cases
    if (this.isManagementRole(oldRole as StaffRoleEnum) && !this.isManagementRole(newRole as StaffRoleEnum)) {
      const allCases = await this.caseRepository.findByLawyer(userId);
      const activeCases = allCases.filter((c: any) => c.guildId === guildId && c.status !== 'closed');
      if (activeCases.length > 0) {
        issues.push({
          severity: ValidationSeverity.WARNING,
          code: 'MANAGEMENT_WITH_CASES',
          message: `Demoting from management role with ${activeCases.length} active cases`,
          context: { caseCount: activeCases.length }
        });
      }
    }

    return issues;
  }

  private async assessStaffRemovalImpact(guildId: string, userId: string): Promise<any[]> {
    const issues: any[] = [];

    // Check active cases
    const allCases = await this.caseRepository.findByLawyer(userId);
    const activeCases = allCases.filter((c: any) => c.guildId === guildId && c.status !== 'closed');
    if (activeCases.length > 0) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        code: 'HAS_ACTIVE_CASES',
        message: `Cannot remove staff with ${activeCases.length} active cases`,
        context: { caseNumbers: activeCases.map((c: any) => c.caseNumber) }
      });
    }

    // Check if lead attorney on any cases
    const leadCases = await this.caseRepository.findByLeadAttorney(userId);
    if (leadCases.length > 0) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        code: 'IS_LEAD_ATTORNEY',
        message: `Staff is lead attorney on ${leadCases.length} cases`,
        context: { caseNumbers: leadCases.map((c: any) => c.caseNumber) }
      });
    }

    return issues;
  }

  private async assessCaseStatusChangeImpact(
    _guildId: string,
    _caseId: string,
    newStatus: CaseStatus
  ): Promise<any[]> {
    const issues: any[] = [];

    if (newStatus === CaseStatus.CLOSED) {
      // Check for pending tasks or reminders
      // This would require access to reminder repository
      issues.push({
        severity: ValidationSeverity.INFO,
        code: 'CASE_CLOSING',
        message: 'Closing case - ensure all tasks are completed'
      });
    }

    return issues;
  }

  private async checkCircularDependencies(_guildId: string): Promise<any[]> {
    // Implementation would check for circular references in entity relationships
    return [];
  }

  private async checkBrokenReferences(guildId: string): Promise<any[]> {
    const issues: any[] = [];

    // Check cases referencing non-existent staff
    const cases = await this.caseRepository.getActiveCases(guildId);
    const staffIds = new Set((await this.staffRepository.findByGuildId(guildId)).map(s => s.userId));

    for (const caseEntity of cases) {
      if (caseEntity.assignedLawyerIds && caseEntity.assignedLawyerIds.length > 0) {
        for (const lawyerId of caseEntity.assignedLawyerIds) {
          if (!staffIds.has(lawyerId)) {
            issues.push({
              severity: ValidationSeverity.ERROR,
              code: 'BROKEN_CASE_ASSIGNEE',
              message: `Case ${caseEntity.caseNumber} references non-existent staff: ${lawyerId}`,
              context: { caseNumber: caseEntity.caseNumber, lawyerId }
            });
          }
        }
      }
    }

    return issues;
  }

  private async checkOrphanedApplications(guildId: string): Promise<string[]> {
    const orphaned: string[] = [];
    const applications = await this.applicationRepository.findByGuild(guildId);
    
    for (const app of applications) {
      const job = await this.jobRepository.findById(app.jobId);
      if (!job) {
        orphaned.push(app._id!.toString());
      }
    }

    return orphaned;
  }

  private async validateStaffRemovalImpact(context: ValidationContext): Promise<ValidationResult> {
    context.data.updateType = 'staffRemoval';
    context.data.entityId = context.data.userId || context.data.staffId;
    return this.validateCascadingUpdate(context);
  }

  private async validateCaseClosureImpact(context: ValidationContext): Promise<ValidationResult> {
    context.data.updateType = 'caseStatusChange';
    context.data.entityId = context.data.caseId || context.entityId;
    context.data.newStatus = CaseStatus.CLOSED;
    return this.validateCascadingUpdate(context);
  }

  private async validateJobClosureImpact(context: ValidationContext): Promise<ValidationResult> {
    const jobId = context.data.jobId || context.entityId;
    const issues: any[] = [];

    const pendingApps = await this.applicationRepository.findApplicationsByJobAndStatus(jobId, 'pending');
    if (pendingApps.length > 0) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        code: 'PENDING_APPLICATIONS',
        message: `Job has ${pendingApps.length} pending applications`,
        context: { applicationCount: pendingApps.length }
      });
    }

    return {
      valid: true,
      issues
    };
  }

  private isManagementRole(role: StaffRoleEnum): boolean {
    return [
      StaffRoleEnum.MANAGING_PARTNER,
      StaffRoleEnum.SENIOR_PARTNER,
      StaffRoleEnum.JUNIOR_PARTNER
    ].includes(role);
  }
}