import { logger } from '../../infrastructure/logger';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { FeedbackRepository } from '../../infrastructure/repositories/feedback-repository';
import { ReminderRepository } from '../../infrastructure/repositories/reminder-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { Client } from 'discord.js';
import { 
  Staff,
  Case,
  Application,
  Retainer,
  Feedback,
  Reminder
} from '../../validation';
import { CaseStatus } from '../../domain/entities/case';
import { AuditAction } from '../../domain/entities/audit-log';

export interface ValidationRule {
  name: string;
  description: string;
  entityType: 'staff' | 'case' | 'application' | 'job' | 'retainer' | 'feedback' | 'reminder';
  priority: number; // Higher priority rules are checked first
  dependencies?: string[]; // Names of other rules that must pass first
  validate: (entity: any, context: ValidationContext) => Promise<ValidationIssue[]>;
}

export interface ValidationContext {
  guildId: string;
  client?: Client;
  relatedEntities?: Map<string, any[]>; // Cache of related entities
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
  failedRepairs: Array<{ issue: ValidationIssue; error: string }>;
}

export class CrossEntityValidationService {
  private validationRules: Map<string, ValidationRule> = new Map();
  private validationCache: Map<string, { result: ValidationIssue[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  // Performance optimization
  private ruleDependencyGraph: Map<string, Set<string>> = new Map();
  // private ruleExecutionOrder: string[] = []; // TODO: Use for ordered rule execution
  private asyncValidationQueue: Map<string, Promise<ValidationIssue[]>> = new Map();
  private readonly MAX_CONCURRENT_VALIDATIONS = 10;

  constructor(
    private readonly staffRepository: StaffRepository,
    private readonly caseRepository: CaseRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly jobRepository: JobRepository,
    private readonly retainerRepository: RetainerRepository,
    private readonly feedbackRepository: FeedbackRepository,
    private readonly reminderRepository: ReminderRepository,
    private readonly auditLogRepository: AuditLogRepository
  ) {
    this.initializeValidationRules();
    this.initializeAdvancedRules();
    this.buildRuleDependencyGraph();
  }

  private initializeValidationRules(): void {
    // Staff validation rules
    this.addRule({
      name: 'staff-active-check',
      description: 'Validate staff members are active',
      entityType: 'staff',
      priority: 100,
      validate: async (staff: Staff): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        if (staff.status !== 'active' && staff.status !== 'inactive' && staff.status !== 'terminated') {
          issues.push({
            severity: 'critical',
            entityType: 'staff',
            entityId: staff._id!.toString(),
            field: 'status',
            message: `Invalid staff status: ${staff.status}`,
            canAutoRepair: true,
            repairAction: async () => {
              await this.staffRepository.update(staff._id!.toString(), { status: 'inactive' });
            }
          });
        }

        return issues;
      }
    });

    // Case validation rules
    this.addRule({
      name: 'case-staff-assignments',
      description: 'Validate case staff assignments reference active staff',
      entityType: 'case',
      priority: 90,
      validate: async (caseEntity: Case): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        // Check lead attorney
        if (caseEntity.leadAttorneyId) {
          const leadAttorney = await this.staffRepository.findByUserId(caseEntity.guildId, caseEntity.leadAttorneyId);
          if (!leadAttorney) {
            issues.push({
              severity: 'critical',
              entityType: 'case',
              entityId: caseEntity._id!.toString(),
              field: 'leadAttorneyId',
              message: `Lead attorney ${caseEntity.leadAttorneyId} not found in staff records`,
              canAutoRepair: true,
              repairAction: async () => {
                await this.caseRepository.update(caseEntity._id!.toString(), { leadAttorneyId: undefined });
              }
            });
          } else if (leadAttorney.status !== 'active') {
            issues.push({
              severity: 'warning',
              entityType: 'case',
              entityId: caseEntity._id!.toString(),
              field: 'leadAttorneyId',
              message: `Lead attorney ${caseEntity.leadAttorneyId} is not active (status: ${leadAttorney.status})`,
              canAutoRepair: false
            });
          }
        }

        // Check assigned lawyers
        for (const lawyerId of caseEntity.assignedLawyerIds) {
          const lawyer = await this.staffRepository.findByUserId(caseEntity.guildId, lawyerId);
          if (!lawyer) {
            issues.push({
              severity: 'critical',
              entityType: 'case',
              entityId: caseEntity._id!.toString(),
              field: 'assignedLawyerIds',
              message: `Assigned lawyer ${lawyerId} not found in staff records`,
              canAutoRepair: true,
              repairAction: async () => {
                const updatedLawyers = caseEntity.assignedLawyerIds.filter((id: string) => id !== lawyerId);
                await this.caseRepository.update(caseEntity._id!.toString(), { assignedLawyerIds: updatedLawyers });
              }
            });
          } else if (lawyer.status !== 'active') {
            issues.push({
              severity: 'warning',
              entityType: 'case',
              entityId: caseEntity._id!.toString(),
              field: 'assignedLawyerIds',
              message: `Assigned lawyer ${lawyerId} is not active (status: ${lawyer.status})`,
              canAutoRepair: false
            });
          }
        }

        return issues;
      }
    });

    this.addRule({
      name: 'case-channel-existence',
      description: 'Validate case channels exist in Discord',
      entityType: 'case',
      priority: 85,
      validate: async (caseEntity: Case, context: ValidationContext): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        if (caseEntity.channelId && context.client) {
          try {
            const guild = await context.client.guilds.fetch(caseEntity.guildId);
            const channel = guild.channels.cache.get(caseEntity.channelId);
            
            if (!channel) {
              issues.push({
                severity: 'warning',
                entityType: 'case',
                entityId: caseEntity._id!.toString(),
                field: 'channelId',
                message: `Case channel ${caseEntity.channelId} not found in Discord`,
                canAutoRepair: true,
                repairAction: async () => {
                  await this.caseRepository.update(caseEntity._id!.toString(), { channelId: undefined });
                }
              });
            }
          } catch (error) {
            logger.error('Error checking case channel:', error);
          }
        }

        return issues;
      }
    });

    // Application validation rules
    this.addRule({
      name: 'application-job-reference',
      description: 'Validate applications reference existing jobs',
      entityType: 'application',
      priority: 80,
      validate: async (application: Application): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        const job = await this.jobRepository.findById(application.jobId);
        if (!job) {
          issues.push({
            severity: 'critical',
            entityType: 'application',
            entityId: application._id!.toString(),
            field: 'jobId',
            message: `Referenced job ${application.jobId} not found`,
            canAutoRepair: false
          });
        } else if (!job.isOpen && application.status === 'pending') {
          issues.push({
            severity: 'warning',
            entityType: 'application',
            entityId: application._id!.toString(),
            field: 'status',
            message: `Application is pending for a closed job`,
            canAutoRepair: true,
            repairAction: async () => {
              await this.applicationRepository.update(application._id!.toString(), { 
                status: 'rejected',
                reviewReason: 'Job closed before review'
              });
            }
          });
        }

        return issues;
      }
    });

    this.addRule({
      name: 'application-reviewer-reference',
      description: 'Validate application reviewers are staff members',
      entityType: 'application',
      priority: 75,
      validate: async (application: Application): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        if (application.reviewedBy) {
          const reviewer = await this.staffRepository.findByUserId(application.guildId, application.reviewedBy);
          if (!reviewer) {
            issues.push({
              severity: 'warning',
              entityType: 'application',
              entityId: application._id!.toString(),
              field: 'reviewedBy',
              message: `Reviewer ${application.reviewedBy} not found in staff records`,
              canAutoRepair: false
            });
          }
        }

        return issues;
      }
    });

    // Retainer validation rules
    this.addRule({
      name: 'retainer-lawyer-reference',
      description: 'Validate retainers reference existing staff lawyers',
      entityType: 'retainer',
      priority: 70,
      validate: async (retainer: Retainer): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        const lawyer = await this.staffRepository.findByUserId(retainer.guildId, retainer.lawyerId);
        if (!lawyer) {
          issues.push({
            severity: 'critical',
            entityType: 'retainer',
            entityId: retainer._id!.toString(),
            field: 'lawyerId',
            message: `Lawyer ${retainer.lawyerId} not found in staff records`,
            canAutoRepair: false
          });
        } else if (lawyer.status !== 'active') {
          issues.push({
            severity: 'warning',
            entityType: 'retainer',
            entityId: retainer._id!.toString(),
            field: 'lawyerId',
            message: `Lawyer ${retainer.lawyerId} is not active (status: ${lawyer.status})`,
            canAutoRepair: false
          });
        }

        return issues;
      }
    });

    // Feedback validation rules
    this.addRule({
      name: 'feedback-staff-reference',
      description: 'Validate feedback references existing staff members',
      entityType: 'feedback',
      priority: 65,
      validate: async (feedback: Feedback): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        if (feedback.targetStaffId && !feedback.isForFirm) {
          const staff = await this.staffRepository.findByUserId(feedback.guildId, feedback.targetStaffId);
          if (!staff) {
            issues.push({
              severity: 'warning',
              entityType: 'feedback',
              entityId: feedback._id!.toString(),
              field: 'targetStaffId',
              message: `Target staff member ${feedback.targetStaffId} not found`,
              canAutoRepair: true,
              repairAction: async () => {
                await this.feedbackRepository.update(feedback._id!.toString(), { 
                  targetStaffId: undefined,
                  targetStaffUsername: undefined,
                  isForFirm: true
                });
              }
            });
          }
        }

        return issues;
      }
    });

    // Reminder validation rules
    this.addRule({
      name: 'reminder-case-reference',
      description: 'Validate reminders reference existing cases',
      entityType: 'reminder',
      priority: 60,
      validate: async (reminder: Reminder): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        if (reminder.caseId) {
          const caseEntity = await this.caseRepository.findById(reminder.caseId);
          if (!caseEntity) {
            issues.push({
              severity: 'warning',
              entityType: 'reminder',
              entityId: reminder._id!.toString(),
              field: 'caseId',
              message: `Referenced case ${reminder.caseId} not found`,
              canAutoRepair: true,
              repairAction: async () => {
                await this.reminderRepository.update(reminder._id!.toString(), { caseId: undefined });
              }
            });
          }
        }

        return issues;
      }
    });

    this.addRule({
      name: 'reminder-channel-existence',
      description: 'Validate reminder channels exist in Discord',
      entityType: 'reminder',
      priority: 55,
      validate: async (reminder: Reminder, context: ValidationContext): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        if (reminder.channelId && context.client && reminder.isActive) {
          try {
            const guild = await context.client.guilds.fetch(reminder.guildId);
            const channel = guild.channels.cache.get(reminder.channelId);
            
            if (!channel) {
              issues.push({
                severity: 'warning',
                entityType: 'reminder',
                entityId: reminder._id!.toString(),
                field: 'channelId',
                message: `Reminder channel ${reminder.channelId} not found in Discord`,
                canAutoRepair: true,
                repairAction: async () => {
                  await this.reminderRepository.update(reminder._id!.toString(), { isActive: false });
                }
              });
            }
          } catch (error) {
            logger.error('Error checking reminder channel:', error);
          }
        }

        return issues;
      }
    });
  }

  
  /**
   * Build dependency graph and determine optimal execution order
   */
  private buildRuleDependencyGraph(): void {
    // Clear existing graph
    this.ruleDependencyGraph.clear();
    
    // Build dependency graph
    for (const [name, rule] of this.validationRules) {
      const dependencies = new Set(rule.dependencies || []);
      this.ruleDependencyGraph.set(name, dependencies);
    }
    
    // Topological sort to determine execution order
    // this.ruleExecutionOrder = this.topologicalSort(); // TODO: Use for ordered rule execution
  }

  // TODO: Implement ordered rule execution
  // /**
  //  * Topological sort for rule dependencies
  //  */
  // private topologicalSort(): string[] {
  //   const visited = new Set<string>();
  //   const result: string[] = [];
  //   
  //   const visit = (ruleName: string) => {
  //     if (visited.has(ruleName)) return;
  //     visited.add(ruleName);
  //     
  //     const dependencies = this.ruleDependencyGraph.get(ruleName) || new Set();
  //     for (const dep of dependencies) {
  //       visit(dep);
  //     }
  //     
  //     result.push(ruleName);
  //   };
  //   
  //   for (const ruleName of this.validationRules.keys()) {
  //     visit(ruleName);
  //   }
  //   
  //   return result;
  // }

  /**
   * Initialize advanced cross-entity validation rules
   */
  private initializeAdvancedRules(): void {
    // Role consistency validation
    this.addRule({
      name: 'staff-role-consistency',
      description: 'Validate staff roles are consistent with permissions',
      entityType: 'staff',
      priority: 95,
      dependencies: ['staff-active-check'],
      validate: async (staff: Staff, _context: ValidationContext): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        // Check if staff member has appropriate role for their assigned cases
        
        const leadCases = await this.caseRepository.findByFilters({
          guildId: staff.guildId,
          leadAttorneyId: staff.userId
        });
        
        // Only Senior Associates and above can be lead attorneys
        if (leadCases.length > 0 && ['paralegal', 'junior_associate'].includes(staff.role.toLowerCase())) {
          issues.push({
            severity: 'critical',
            entityType: 'staff',
            entityId: staff._id!.toString(),
            field: 'role',
            message: `Staff member with role ${staff.role} cannot be lead attorney on ${leadCases.length} cases`,
            canAutoRepair: false
          });
        }
        
        return issues;
      }
    });

    // Case workload validation
    this.addRule({
      name: 'case-workload-balance',
      description: 'Validate case assignments are balanced',
      entityType: 'staff',
      priority: 85,
      validate: async (staff: Staff, _context: ValidationContext): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        if (staff.status !== 'active') return issues;
        
        const assignedCases = await this.caseRepository.findAssignedToLawyer(staff.userId);
        const inProgressCases = assignedCases.filter(c => 
          c.guildId === staff.guildId && 
          c.status === CaseStatus.IN_PROGRESS
        );
        
        // Workload limits by role
        const workloadLimits: Record<string, number> = {
          'managing partner': 20,
          'senior partner': 15,
          'junior partner': 12,
          'senior associate': 10,
          'junior associate': 8,
          'paralegal': 5
        };
        
        const limit = workloadLimits[staff.role.toLowerCase()] || 10;
        
        if (inProgressCases.length > limit) {
          issues.push({
            severity: 'warning',
            entityType: 'staff',
            entityId: staff._id!.toString(),
            field: 'caseLoad',
            message: `Staff member has ${inProgressCases.length} active cases, exceeding recommended limit of ${limit}`,
            canAutoRepair: false
          });
        }
        
        return issues;
      }
    });

    // Circular reference detection
    this.addRule({
      name: 'circular-reference-detection',
      description: 'Detect circular references in entity relationships',
      entityType: 'staff',
      priority: 100,
      validate: async (staff: Staff, _context: ValidationContext): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        // Check promotion history for circular references
        const promotedByChain = new Set<string>();
        let currentUserId = staff.userId;
        
        for (const promotion of staff.promotionHistory || []) {
          if (promotion.promotedBy === currentUserId) {
            issues.push({
              severity: 'critical',
              entityType: 'staff',
              entityId: staff._id!.toString(),
              field: 'promotionHistory',
              message: 'Circular reference detected in promotion history',
              canAutoRepair: false
            });
            break;
          }
          
          if (promotedByChain.has(promotion.promotedBy)) {
            issues.push({
              severity: 'warning',
              entityType: 'staff',
              entityId: staff._id!.toString(),
              field: 'promotionHistory',
              message: 'Duplicate promoter detected in promotion history',
              canAutoRepair: false
            });
          }
          
          promotedByChain.add(promotion.promotedBy);
        }
        
        return issues;
      }
    });

    // Temporal consistency validation
    this.addRule({
      name: 'temporal-consistency',
      description: 'Validate temporal consistency across entities',
      entityType: 'case',
      priority: 92,
      validate: async (caseEntity: Case, _context: ValidationContext): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        // Check if case was created before assigned lawyers were hired
        for (const lawyerId of caseEntity.assignedLawyerIds) {
          const lawyer = await this.staffRepository.findByUserId(caseEntity.guildId, lawyerId);
          if (lawyer && lawyer.hiredAt > caseEntity.createdAt) {
            issues.push({
              severity: 'critical',
              entityType: 'case',
              entityId: caseEntity._id!.toString(),
              field: 'assignedLawyerIds',
              message: `Lawyer ${lawyerId} was hired after case was created`,
              canAutoRepair: true,
              repairAction: async () => {
                const updatedLawyers = caseEntity.assignedLawyerIds.filter((id: string) => id !== lawyerId);
                await this.caseRepository.update(caseEntity._id!.toString(), { assignedLawyerIds: updatedLawyers });
              }
            });
          }
        }
        
        // Check if case was closed before it was created
        if (caseEntity.closedAt && caseEntity.closedAt < caseEntity.createdAt) {
          issues.push({
            severity: 'critical',
            entityType: 'case',
            entityId: caseEntity._id!.toString(),
            field: 'closedAt',
            message: 'Case closed date is before creation date',
            canAutoRepair: true,
            repairAction: async () => {
              await this.caseRepository.update(caseEntity._id!.toString(), { closedAt: undefined });
            }
          });
        }
        
        return issues;
      }
    });

    // Application integrity validation
    this.addRule({
      name: 'application-integrity',
      description: 'Validate application data integrity',
      entityType: 'application',
      priority: 88,
      dependencies: ['application-job-reference'],
      validate: async (application: Application, _context: ValidationContext): Promise<ValidationIssue[]> => {
        const issues: ValidationIssue[] = [];
        
        // Check if review date is after creation date
        if (application.reviewedAt && application.createdAt && application.reviewedAt < application.createdAt) {
          issues.push({
            severity: 'critical',
            entityType: 'application',
            entityId: application._id!.toString(),
            field: 'reviewedAt',
            message: 'Application reviewed before it was created',
            canAutoRepair: true,
            repairAction: async () => {
              await this.applicationRepository.update(application._id!.toString(), { reviewedAt: undefined });
            }
          });
        }
        
        // Check if accepted application has all required fields
        if (application.status === 'accepted' && !application.reviewedBy) {
          issues.push({
            severity: 'warning',
            entityType: 'application',
            entityId: application._id!.toString(),
            field: 'reviewedBy',
            message: 'Accepted application has no reviewer',
            canAutoRepair: false
          });
        }
        
        return issues;
      }
    });
  }

  // TODO: Implement memoized validation for performance optimization
  // /**
  //  * Perform validation with memoization
  //  */
  // private async memoizedValidation(
  //   key: string,
  //   validationFn: () => Promise<ValidationIssue[]>
  // ): Promise<ValidationIssue[]> {
  //   const cached = this.validationCache.get(key);
  //   if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
  //     return cached.result;
  //   }
  //   
  //   const result = await validationFn();
  //   this.validationCache.set(key, { result, timestamp: Date.now() });
  //   return result;
  // }

  /**
   * Async validation with queue management
   */
  private async queueValidation(
    key: string,
    validationFn: () => Promise<ValidationIssue[]>
  ): Promise<ValidationIssue[]> {
    // Check if validation is already in progress
    const existing = this.asyncValidationQueue.get(key);
    if (existing) {
      return existing;
    }
    
    // Wait if queue is full
    while (this.asyncValidationQueue.size >= this.MAX_CONCURRENT_VALIDATIONS) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Add to queue
    const promise = validationFn().finally(() => {
      this.asyncValidationQueue.delete(key);
    });
    
    this.asyncValidationQueue.set(key, promise);
    return promise;
  }

  /**
   * Perform deep referential integrity check
   */
  public async performDeepIntegrityCheck(
    guildId: string,
    context: Partial<ValidationContext> = {}
  ): Promise<IntegrityReport> {
    const startTime = Date.now();
    const report = await this.scanForIntegrityIssues(guildId, context);
    
    // Additional deep checks
    const deepIssues: ValidationIssue[] = [];
    
    // Check for data consistency across related entities
    const consistencyIssues = await this.checkDataConsistency(guildId, context);
    deepIssues.push(...consistencyIssues);
    
    // Check for referential integrity violations
    const referentialIssues = await this.checkReferentialIntegrity(guildId, context);
    deepIssues.push(...referentialIssues);
    
    // Merge with existing report
    report.issues.push(...deepIssues);
    report.issuesBySeverity.critical += deepIssues.filter(i => i.severity === 'critical').length;
    report.issuesBySeverity.warning += deepIssues.filter(i => i.severity === 'warning').length;
    report.issuesBySeverity.info += deepIssues.filter(i => i.severity === 'info').length;
    
    logger.info(`Deep integrity check completed in ${Date.now() - startTime}ms, found ${deepIssues.length} additional issues`);
    
    return report;
  }

  /**
   * Check data consistency across entities
   */
  private async checkDataConsistency(
    guildId: string,
    _context: Partial<ValidationContext>
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Check case assignment consistency
      const cases = await this.caseRepository.findByFilters({ guildId });
      const staff = await this.staffRepository.findByGuildId(guildId);
      const staffIds = new Set(staff.map(s => s.userId));
      
      for (const caseEntity of cases) {
        // Check if all assigned lawyers are in staff records
        for (const lawyerId of caseEntity.assignedLawyerIds) {
          if (!staffIds.has(lawyerId)) {
            issues.push({
              severity: 'critical',
              entityType: 'case',
              entityId: caseEntity._id!.toString(),
              field: 'assignedLawyerIds',
              message: `Assigned lawyer ${lawyerId} not found in staff records`,
              canAutoRepair: true,
              repairAction: async () => {
                const updatedLawyers = caseEntity.assignedLawyerIds.filter((id: string) => id !== lawyerId);
                await this.caseRepository.update(caseEntity._id!.toString(), { assignedLawyerIds: updatedLawyers });
              }
            });
          }
        }
        
        // Check if lead attorney is also in assigned lawyers
        if (caseEntity.leadAttorneyId && !caseEntity.assignedLawyerIds.includes(caseEntity.leadAttorneyId)) {
          issues.push({
            severity: 'warning',
            entityType: 'case',
            entityId: caseEntity._id!.toString(),
            field: 'leadAttorneyId',
            message: 'Lead attorney is not in assigned lawyers list',
            canAutoRepair: true,
            repairAction: async () => {
              const updatedLawyers = [...caseEntity.assignedLawyerIds, caseEntity.leadAttorneyId!];
              await this.caseRepository.update(caseEntity._id!.toString(), { assignedLawyerIds: updatedLawyers });
            }
          });
        }
      }
      
      // Check application consistency
      const applications = await this.applicationRepository.findByGuild(guildId);
      const jobs = await this.jobRepository.findByGuildId(guildId);
      const jobIds = new Set(jobs.map(j => j._id!.toString()));
      
      for (const application of applications) {
        if (!jobIds.has(application.jobId)) {
          issues.push({
            severity: 'critical',
            entityType: 'application',
            entityId: application._id!.toString(),
            field: 'jobId',
            message: `Application references non-existent job ${application.jobId}`,
            canAutoRepair: false
          });
        }
      }
      
    } catch (error) {
      logger.error('Error checking data consistency:', error);
    }
    
    return issues;
  }

  /**
   * Check referential integrity
   */
  private async checkReferentialIntegrity(
    guildId: string,
    _context: Partial<ValidationContext>
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Check for reminders referencing deleted entities
      const cases = await this.caseRepository.findByFilters({ guildId });
      const caseIds = new Set(cases.map((c: Case) => c._id!.toString()));
      const reminders = await this.reminderRepository.findByFilters({ guildId });
      
      for (const reminder of reminders) {
        if (reminder.caseId && !caseIds.has(reminder.caseId)) {
          issues.push({
            severity: 'info',
            entityType: 'reminder',
            entityId: reminder._id!.toString(),
            field: 'caseId',
            message: `Reminder references non-existent case ${reminder.caseId}`,
            canAutoRepair: true,
            repairAction: async () => {
              await this.reminderRepository.update(reminder._id!.toString(), { 
                caseId: undefined,
                isActive: false
              });
            }
          });
        }
      }
      
    } catch (error) {
      logger.error('Error checking referential integrity:', error);
    }
    
    return issues;
  }

  /**
   * Enhanced batch validation with optimization
   */
  public async optimizedBatchValidate(
    entities: Array<{ entity: any; type: string }>,
    context: Partial<ValidationContext> = {}
  ): Promise<Map<string, ValidationIssue[]>> {
    const results = new Map<string, ValidationIssue[]>();
    
    // Group entities by type for optimized processing
    const entitiesByType = new Map<string, any[]>();
    for (const { entity, type } of entities) {
      if (!entitiesByType.has(type)) {
        entitiesByType.set(type, []);
      }
      entitiesByType.get(type)!.push(entity);
    }
    
    // Process each type in parallel
    const typePromises = Array.from(entitiesByType.entries()).map(async ([type, typeEntities]) => {
      // Get rules for this type
      const rules = Array.from(this.validationRules.values())
        .filter(r => r.entityType === type)
        .sort((a, b) => b.priority - a.priority);
      
      // Process entities of this type in batches
      const BATCH_SIZE = 20;
      for (let i = 0; i < typeEntities.length; i += BATCH_SIZE) {
        const batch = typeEntities.slice(i, i + BATCH_SIZE);
        
        await Promise.all(
          batch.map(async entity => {
            const key = `${type}:${entity._id}`;
            const issues = await this.queueValidation(key, async () => {
              return this.validateEntity(entity, type, {
                guildId: entity.guildId,
                validationLevel: context.validationLevel || 'strict',
                ...context
              }, rules);
            });
            
            if (issues.length > 0) {
              results.set(entity._id, issues);
            }
          })
        );
      }
    });
    
    await Promise.all(typePromises);
    
    return results;
  }

  /**
   * Smart repair with dependency resolution
   */
  public async smartRepair(
    issues: ValidationIssue[],
    options: { 
      dryRun?: boolean;
      maxRetries?: number;
      repairDependencies?: boolean;
    } = {}
  ): Promise<RepairResult> {
    const maxRetries = options.maxRetries || 3;
    const result: RepairResult = {
      totalIssuesFound: issues.length,
      issuesRepaired: 0,
      issuesFailed: 0,
      repairedIssues: [],
      failedRepairs: []
    };
    
    // Group issues by entity for atomic repairs
    const issuesByEntity = new Map<string, ValidationIssue[]>();
    for (const issue of issues) {
      const key = `${issue.entityType}:${issue.entityId}`;
      if (!issuesByEntity.has(key)) {
        issuesByEntity.set(key, []);
      }
      issuesByEntity.get(key)!.push(issue);
    }
    
    // Sort entities by dependency order
    const sortedEntities = Array.from(issuesByEntity.entries())
      .sort(([, aIssues], [, bIssues]) => {
        // Critical issues first
        const aCritical = aIssues.filter(i => i.severity === 'critical').length;
        const bCritical = bIssues.filter(i => i.severity === 'critical').length;
        return bCritical - aCritical;
      });
    
    // Process repairs
    for (const [_entityKey, entityIssues] of sortedEntities) {
      const repairableIssues = entityIssues.filter(i => i.canAutoRepair && i.repairAction);
      
      for (const issue of repairableIssues) {
        let repaired = false;
        let lastError: Error | null = null;
        
        // Retry logic
        for (let retry = 0; retry < maxRetries && !repaired; retry++) {
          try {
            if (!options.dryRun) {
              await issue.repairAction!();
              
              // Log the repair
              await this.auditLogRepository.add({
                guildId: issue.entityType,
                action: AuditAction.SYSTEM_REPAIR,
                actorId: 'SYSTEM',
                targetId: issue.entityId,
                timestamp: new Date(),
                details: {
                  reason: `Auto-repaired integrity issue: ${issue.message}`,
                  metadata: {
                    severity: issue.severity,
                    field: issue.field,
                    retry: retry
                  }
                }
              });
            }
            
            repaired = true;
            result.issuesRepaired++;
            result.repairedIssues.push(issue);
          } catch (error) {
            lastError = error as Error;
            if (retry < maxRetries - 1) {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
            }
          }
        }
        
        if (!repaired && lastError) {
          result.issuesFailed++;
          result.failedRepairs.push({
            issue,
            error: lastError.message
          });
        }
      }
    }
    
    // Clear cache after repairs
    this.validationCache.clear();
    
    return result;
  }

  private addRule(rule: ValidationRule): void {
    this.validationRules.set(rule.name, rule);
  }

  public async scanForIntegrityIssues(
    guildId: string, 
    context: Partial<ValidationContext> = {}
  ): Promise<IntegrityReport> {
    const scanStartedAt = new Date();
    const issues: ValidationIssue[] = [];
    let totalEntitiesScanned = 0;
    const issuesByEntityType = new Map<string, number>();

    const fullContext: ValidationContext = {
      guildId,
      validationLevel: context.validationLevel || 'strict',
      client: context.client,
      relatedEntities: new Map(),
      ...context
    };

    try {
      // Get all rules sorted by priority
      const sortedRules = Array.from(this.validationRules.values())
        .sort((a, b) => b.priority - a.priority);

      // Scan each entity type
      const entityScans = [
        { type: 'staff', getEntities: () => this.staffRepository.findByGuildId(guildId) },
        { type: 'case', getEntities: () => this.caseRepository.findByFilters({ guildId }) },
        { type: 'application', getEntities: () => this.applicationRepository.findByGuild(guildId) },
        { type: 'job', getEntities: () => this.jobRepository.findByGuildId(guildId) },
        { type: 'retainer', getEntities: () => this.retainerRepository.findByGuild(guildId) },
        { type: 'feedback', getEntities: () => this.feedbackRepository.findByFilters({ guildId }) },
        { type: 'reminder', getEntities: () => this.reminderRepository.findByFilters({ guildId }) }
      ];

      for (const { type, getEntities } of entityScans) {
        const entities = await getEntities();
        totalEntitiesScanned += entities.length;

        for (const entity of entities) {
          const entityIssues = await this.validateEntity(entity, type as any, fullContext, sortedRules);
          issues.push(...entityIssues);
          
          // Track issues by entity type
          if (entityIssues.length > 0) {
            issuesByEntityType.set(type, (issuesByEntityType.get(type) || 0) + entityIssues.length);
          }
        }
      }

      // Check for orphaned relationships
      const orphanedIssues = await this.checkForOrphanedRelationships(guildId, fullContext);
      issues.push(...orphanedIssues);

    } catch (error) {
      logger.error('Error during integrity scan:', error);
    }

    const scanCompletedAt = new Date();

    // Calculate issue statistics
    const issuesBySeverity = {
      critical: issues.filter(i => i.severity === 'critical').length,
      warning: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length
    };

    const repairableIssues = issues.filter(i => i.canAutoRepair).length;

    return {
      guildId,
      scanStartedAt,
      scanCompletedAt,
      totalEntitiesScanned,
      issues,
      issuesBySeverity,
      issuesByEntityType,
      repairableIssues
    };
  }

  private async validateEntity(
    entity: any, 
    entityType: string,
    context: ValidationContext,
    rules: ValidationRule[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const cacheKey = `${entityType}:${entity._id}`;

    // Check cache
    const cached = this.validationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
      return cached.result;
    }

    // Run applicable rules
    const applicableRules = rules.filter(r => r.entityType === entityType);
    
    for (const rule of applicableRules) {
      try {
        const ruleIssues = await rule.validate(entity, context);
        issues.push(...ruleIssues);
      } catch (error) {
        logger.error(`Error running validation rule ${rule.name}:`, error);
      }
    }

    // Cache result
    this.validationCache.set(cacheKey, { result: issues, timestamp: Date.now() });

    return issues;
  }

  private async checkForOrphanedRelationships(
    guildId: string,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // Check for cases with non-existent clients
      const cases = await this.caseRepository.findByFilters({ guildId });
      for (const caseEntity of cases) {
        if (context.client) {
          try {
            const guild = await context.client.guilds.fetch(guildId);
            const member = guild.members.cache.get(caseEntity.clientId);
            
            if (!member) {
              issues.push({
                severity: 'info',
                entityType: 'case',
                entityId: caseEntity._id!.toString(),
                field: 'clientId',
                message: `Client ${caseEntity.clientId} not found in Discord server`,
                canAutoRepair: false
              });
            }
          } catch (error) {
            logger.error('Error checking case client:', error);
          }
        }
      }

      // Check for circular dependencies (e.g., staff managed by themselves)
      const staff = await this.staffRepository.findByGuildId(guildId);
      for (const member of staff) {
        if (member.hiredBy === member.userId) {
          issues.push({
            severity: 'warning',
            entityType: 'staff',
            entityId: member._id!.toString(),
            field: 'hiredBy',
            message: 'Staff member hired by themselves',
            canAutoRepair: false
          });
        }
      }

    } catch (error) {
      logger.error('Error checking orphaned relationships:', error);
    }

    return issues;
  }

  public async repairIntegrityIssues(
    issues: ValidationIssue[],
    options: { dryRun?: boolean } = {}
  ): Promise<RepairResult> {
    const result: RepairResult = {
      totalIssuesFound: issues.length,
      issuesRepaired: 0,
      issuesFailed: 0,
      repairedIssues: [],
      failedRepairs: []
    };

    // Sort issues by severity (critical first)
    const sortedIssues = issues.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    for (const issue of sortedIssues) {
      if (!issue.canAutoRepair || !issue.repairAction) {
        continue;
      }

      try {
        if (!options.dryRun) {
          await issue.repairAction();
          
          // Log the repair
          await this.auditLogRepository.add({
            guildId: issue.entityType,
            action: AuditAction.SYSTEM_REPAIR,
            actorId: 'SYSTEM',
            targetId: issue.entityId,
            timestamp: new Date(),
            details: {
              reason: `Auto-repaired integrity issue: ${issue.message}`,
              metadata: {
                severity: issue.severity,
                field: issue.field
              }
            }
          });
        }

        result.issuesRepaired++;
        result.repairedIssues.push(issue);
      } catch (error) {
        result.issuesFailed++;
        result.failedRepairs.push({
          issue,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        logger.error(`Failed to repair issue for ${issue.entityType} ${issue.entityId}:`, error);
      }
    }

    // Clear validation cache after repairs
    this.validationCache.clear();

    return result;
  }

  public async validateBeforeOperation(
    entity: any,
    entityType: string,
    _operation: 'create' | 'update' | 'delete',
    context: Partial<ValidationContext> = {}
  ): Promise<ValidationIssue[]> {
    const fullContext: ValidationContext = {
      guildId: entity.guildId,
      validationLevel: context.validationLevel || 'strict',
      ...context
    };

    const rules = Array.from(this.validationRules.values())
      .filter(r => r.entityType === entityType)
      .sort((a, b) => b.priority - a.priority);

    return await this.validateEntity(entity, entityType, fullContext, rules);
  }

  public async batchValidate(
    entities: Array<{ entity: any; type: string }>,
    context: Partial<ValidationContext> = {}
  ): Promise<Map<string, ValidationIssue[]>> {
    const results = new Map<string, ValidationIssue[]>();
    
    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 50;
    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
      const batch = entities.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async ({ entity, type }) => {
          const issues = await this.validateBeforeOperation(entity, type, 'update', context);
          if (issues.length > 0) {
            results.set(entity._id?.toString() || entity.id || JSON.stringify(entity), issues);
          }
        })
      );
    }

    return results;
  }

  public clearValidationCache(): void {
    this.validationCache.clear();
  }

  public getValidationRules(): ValidationRule[] {
    return Array.from(this.validationRules.values());
  }

  public addCustomRule(rule: ValidationRule): void {
    this.addRule(rule);
  }
}