"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossEntityValidationService = void 0;
const logger_1 = require("../../infrastructure/logger");
const audit_log_1 = require("../../domain/entities/audit-log");
const case_1 = require("../../domain/entities/case");
class CrossEntityValidationService {
    constructor(staffRepository, caseRepository, applicationRepository, jobRepository, retainerRepository, feedbackRepository, reminderRepository, auditLogRepository) {
        this.staffRepository = staffRepository;
        this.caseRepository = caseRepository;
        this.applicationRepository = applicationRepository;
        this.jobRepository = jobRepository;
        this.retainerRepository = retainerRepository;
        this.feedbackRepository = feedbackRepository;
        this.reminderRepository = reminderRepository;
        this.auditLogRepository = auditLogRepository;
        this.validationRules = new Map();
        this.validationCache = new Map();
        this.CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
        // Performance optimization
        this.ruleDependencyGraph = new Map();
        // private ruleExecutionOrder: string[] = []; // TODO: Use for ordered rule execution
        this.asyncValidationQueue = new Map();
        this.MAX_CONCURRENT_VALIDATIONS = 10;
        this.initializeValidationRules();
        this.initializeAdvancedRules();
        this.buildRuleDependencyGraph();
    }
    initializeValidationRules() {
        // Staff validation rules
        this.addRule({
            name: 'staff-active-check',
            description: 'Validate staff members are active',
            entityType: 'staff',
            priority: 100,
            validate: async (staff) => {
                const issues = [];
                if (staff.status !== 'active' && staff.status !== 'inactive' && staff.status !== 'terminated') {
                    issues.push({
                        severity: 'critical',
                        entityType: 'staff',
                        entityId: staff._id.toString(),
                        field: 'status',
                        message: `Invalid staff status: ${staff.status}`,
                        canAutoRepair: true,
                        repairAction: async () => {
                            await this.staffRepository.update(staff._id.toString(), { status: 'inactive' });
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
            validate: async (caseEntity) => {
                const issues = [];
                // Check lead attorney
                if (caseEntity.leadAttorneyId) {
                    const leadAttorney = await this.staffRepository.findByUserId(caseEntity.leadAttorneyId, caseEntity.guildId);
                    if (!leadAttorney) {
                        issues.push({
                            severity: 'critical',
                            entityType: 'case',
                            entityId: caseEntity._id.toString(),
                            field: 'leadAttorneyId',
                            message: `Lead attorney ${caseEntity.leadAttorneyId} not found in staff records`,
                            canAutoRepair: true,
                            repairAction: async () => {
                                await this.caseRepository.update(caseEntity._id.toString(), { leadAttorneyId: undefined });
                            }
                        });
                    }
                    else if (leadAttorney.status !== 'active') {
                        issues.push({
                            severity: 'warning',
                            entityType: 'case',
                            entityId: caseEntity._id.toString(),
                            field: 'leadAttorneyId',
                            message: `Lead attorney ${caseEntity.leadAttorneyId} is not active (status: ${leadAttorney.status})`,
                            canAutoRepair: false
                        });
                    }
                }
                // Check assigned lawyers
                for (const lawyerId of caseEntity.assignedLawyerIds) {
                    const lawyer = await this.staffRepository.findByUserId(lawyerId, caseEntity.guildId);
                    if (!lawyer) {
                        issues.push({
                            severity: 'critical',
                            entityType: 'case',
                            entityId: caseEntity._id.toString(),
                            field: 'assignedLawyerIds',
                            message: `Assigned lawyer ${lawyerId} not found in staff records`,
                            canAutoRepair: true,
                            repairAction: async () => {
                                const updatedLawyers = caseEntity.assignedLawyerIds.filter((id) => id !== lawyerId);
                                await this.caseRepository.update(caseEntity._id.toString(), { assignedLawyerIds: updatedLawyers });
                            }
                        });
                    }
                    else if (lawyer.status !== 'active') {
                        issues.push({
                            severity: 'warning',
                            entityType: 'case',
                            entityId: caseEntity._id.toString(),
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
            validate: async (caseEntity, context) => {
                const issues = [];
                if (caseEntity.channelId && context.client) {
                    try {
                        const guild = await context.client.guilds.fetch(caseEntity.guildId);
                        const channel = guild.channels.cache.get(caseEntity.channelId);
                        if (!channel) {
                            issues.push({
                                severity: 'warning',
                                entityType: 'case',
                                entityId: caseEntity._id.toString(),
                                field: 'channelId',
                                message: `Case channel ${caseEntity.channelId} not found in Discord`,
                                canAutoRepair: true,
                                repairAction: async () => {
                                    await this.caseRepository.update(caseEntity._id.toString(), { channelId: undefined });
                                }
                            });
                        }
                    }
                    catch (error) {
                        logger_1.logger.error('Error checking case channel:', error);
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
            validate: async (application) => {
                const issues = [];
                const job = await this.jobRepository.findById(application.jobId);
                if (!job) {
                    issues.push({
                        severity: 'critical',
                        entityType: 'application',
                        entityId: application._id.toString(),
                        field: 'jobId',
                        message: `Referenced job ${application.jobId} not found`,
                        canAutoRepair: false
                    });
                }
                else if (!job.isOpen && application.status === 'pending') {
                    issues.push({
                        severity: 'warning',
                        entityType: 'application',
                        entityId: application._id.toString(),
                        field: 'status',
                        message: `Application is pending for a closed job`,
                        canAutoRepair: true,
                        repairAction: async () => {
                            await this.applicationRepository.update(application._id.toString(), {
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
            validate: async (application) => {
                const issues = [];
                if (application.reviewedBy) {
                    const reviewer = await this.staffRepository.findByUserId(application.reviewedBy, application.guildId);
                    if (!reviewer) {
                        issues.push({
                            severity: 'warning',
                            entityType: 'application',
                            entityId: application._id.toString(),
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
            validate: async (retainer) => {
                const issues = [];
                const lawyer = await this.staffRepository.findByUserId(retainer.lawyerId, retainer.guildId);
                if (!lawyer) {
                    issues.push({
                        severity: 'critical',
                        entityType: 'retainer',
                        entityId: retainer._id.toString(),
                        field: 'lawyerId',
                        message: `Lawyer ${retainer.lawyerId} not found in staff records`,
                        canAutoRepair: false
                    });
                }
                else if (lawyer.status !== 'active') {
                    issues.push({
                        severity: 'warning',
                        entityType: 'retainer',
                        entityId: retainer._id.toString(),
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
            validate: async (feedback) => {
                const issues = [];
                if (feedback.targetStaffId && !feedback.isForFirm) {
                    const staff = await this.staffRepository.findByUserId(feedback.targetStaffId, feedback.guildId);
                    if (!staff) {
                        issues.push({
                            severity: 'warning',
                            entityType: 'feedback',
                            entityId: feedback._id.toString(),
                            field: 'targetStaffId',
                            message: `Target staff member ${feedback.targetStaffId} not found`,
                            canAutoRepair: true,
                            repairAction: async () => {
                                await this.feedbackRepository.update(feedback._id.toString(), {
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
            validate: async (reminder) => {
                const issues = [];
                if (reminder.caseId) {
                    const caseEntity = await this.caseRepository.findById(reminder.caseId);
                    if (!caseEntity) {
                        issues.push({
                            severity: 'warning',
                            entityType: 'reminder',
                            entityId: reminder._id.toString(),
                            field: 'caseId',
                            message: `Referenced case ${reminder.caseId} not found`,
                            canAutoRepair: true,
                            repairAction: async () => {
                                await this.reminderRepository.update(reminder._id.toString(), { caseId: undefined });
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
            validate: async (reminder, context) => {
                const issues = [];
                if (reminder.channelId && context.client && reminder.isActive) {
                    try {
                        const guild = await context.client.guilds.fetch(reminder.guildId);
                        const channel = guild.channels.cache.get(reminder.channelId);
                        if (!channel) {
                            issues.push({
                                severity: 'warning',
                                entityType: 'reminder',
                                entityId: reminder._id.toString(),
                                field: 'channelId',
                                message: `Reminder channel ${reminder.channelId} not found in Discord`,
                                canAutoRepair: true,
                                repairAction: async () => {
                                    await this.reminderRepository.update(reminder._id.toString(), { isActive: false });
                                }
                            });
                        }
                    }
                    catch (error) {
                        logger_1.logger.error('Error checking reminder channel:', error);
                    }
                }
                return issues;
            }
        });
    }
    /**
     * Build dependency graph and determine optimal execution order
     */
    buildRuleDependencyGraph() {
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
    initializeAdvancedRules() {
        // Role consistency validation
        this.addRule({
            name: 'staff-role-consistency',
            description: 'Validate staff roles are consistent with permissions',
            entityType: 'staff',
            priority: 95,
            dependencies: ['staff-active-check'],
            validate: async (staff, _context) => {
                const issues = [];
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
                        entityId: staff._id.toString(),
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
            validate: async (staff, _context) => {
                const issues = [];
                if (staff.status !== 'active')
                    return issues;
                const assignedCases = await this.caseRepository.findAssignedToLawyer(staff.userId);
                const inProgressCases = assignedCases.filter(c => c.guildId === staff.guildId &&
                    c.status === case_1.CaseStatus.IN_PROGRESS);
                // Workload limits by role
                const workloadLimits = {
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
                        entityId: staff._id.toString(),
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
            validate: async (staff, _context) => {
                const issues = [];
                // Check promotion history for circular references
                const promotedByChain = new Set();
                let currentUserId = staff.userId;
                for (const promotion of staff.promotionHistory || []) {
                    if (promotion.promotedBy === currentUserId) {
                        issues.push({
                            severity: 'critical',
                            entityType: 'staff',
                            entityId: staff._id.toString(),
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
                            entityId: staff._id.toString(),
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
            validate: async (caseEntity, _context) => {
                const issues = [];
                // Check if case was created before assigned lawyers were hired
                for (const lawyerId of caseEntity.assignedLawyerIds) {
                    const lawyer = await this.staffRepository.findByUserId(lawyerId, caseEntity.guildId);
                    if (lawyer && lawyer.hiredAt > caseEntity.createdAt) {
                        issues.push({
                            severity: 'critical',
                            entityType: 'case',
                            entityId: caseEntity._id.toString(),
                            field: 'assignedLawyerIds',
                            message: `Lawyer ${lawyerId} was hired after case was created`,
                            canAutoRepair: true,
                            repairAction: async () => {
                                const updatedLawyers = caseEntity.assignedLawyerIds.filter((id) => id !== lawyerId);
                                await this.caseRepository.update(caseEntity._id.toString(), { assignedLawyerIds: updatedLawyers });
                            }
                        });
                    }
                }
                // Check if case was closed before it was created
                if (caseEntity.closedAt && caseEntity.closedAt < caseEntity.createdAt) {
                    issues.push({
                        severity: 'critical',
                        entityType: 'case',
                        entityId: caseEntity._id.toString(),
                        field: 'closedAt',
                        message: 'Case closed date is before creation date',
                        canAutoRepair: true,
                        repairAction: async () => {
                            await this.caseRepository.update(caseEntity._id.toString(), { closedAt: undefined });
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
            validate: async (application, _context) => {
                const issues = [];
                // Check if review date is after creation date
                if (application.reviewedAt && application.createdAt && application.reviewedAt < application.createdAt) {
                    issues.push({
                        severity: 'critical',
                        entityType: 'application',
                        entityId: application._id.toString(),
                        field: 'reviewedAt',
                        message: 'Application reviewed before it was created',
                        canAutoRepair: true,
                        repairAction: async () => {
                            await this.applicationRepository.update(application._id.toString(), { reviewedAt: undefined });
                        }
                    });
                }
                // Check if accepted application has all required fields
                if (application.status === 'accepted' && !application.reviewedBy) {
                    issues.push({
                        severity: 'warning',
                        entityType: 'application',
                        entityId: application._id.toString(),
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
    async queueValidation(key, validationFn) {
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
    async performDeepIntegrityCheck(guildId, context = {}) {
        const startTime = Date.now();
        const report = await this.scanForIntegrityIssues(guildId, context);
        // Additional deep checks
        const deepIssues = [];
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
        logger_1.logger.info(`Deep integrity check completed in ${Date.now() - startTime}ms, found ${deepIssues.length} additional issues`);
        return report;
    }
    /**
     * Check data consistency across entities
     */
    async checkDataConsistency(guildId, _context) {
        const issues = [];
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
                            entityId: caseEntity._id.toString(),
                            field: 'assignedLawyerIds',
                            message: `Assigned lawyer ${lawyerId} not found in staff records`,
                            canAutoRepair: true,
                            repairAction: async () => {
                                const updatedLawyers = caseEntity.assignedLawyerIds.filter((id) => id !== lawyerId);
                                await this.caseRepository.update(caseEntity._id.toString(), { assignedLawyerIds: updatedLawyers });
                            }
                        });
                    }
                }
                // Check if lead attorney is also in assigned lawyers
                if (caseEntity.leadAttorneyId && !caseEntity.assignedLawyerIds.includes(caseEntity.leadAttorneyId)) {
                    issues.push({
                        severity: 'warning',
                        entityType: 'case',
                        entityId: caseEntity._id.toString(),
                        field: 'leadAttorneyId',
                        message: 'Lead attorney is not in assigned lawyers list',
                        canAutoRepair: true,
                        repairAction: async () => {
                            const updatedLawyers = [...caseEntity.assignedLawyerIds, caseEntity.leadAttorneyId];
                            await this.caseRepository.update(caseEntity._id.toString(), { assignedLawyerIds: updatedLawyers });
                        }
                    });
                }
            }
            // Check application consistency
            const applications = await this.applicationRepository.findByGuild(guildId);
            const jobs = await this.jobRepository.findByGuildId(guildId);
            const jobIds = new Set(jobs.map(j => j._id.toString()));
            for (const application of applications) {
                if (!jobIds.has(application.jobId)) {
                    issues.push({
                        severity: 'critical',
                        entityType: 'application',
                        entityId: application._id.toString(),
                        field: 'jobId',
                        message: `Application references non-existent job ${application.jobId}`,
                        canAutoRepair: false
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error checking data consistency:', error);
        }
        return issues;
    }
    /**
     * Check referential integrity
     */
    async checkReferentialIntegrity(guildId, _context) {
        const issues = [];
        try {
            // Check for reminders referencing deleted entities
            const cases = await this.caseRepository.findByFilters({ guildId });
            const caseIds = new Set(cases.map((c) => c._id.toString()));
            const reminders = await this.reminderRepository.findByFilters({ guildId });
            for (const reminder of reminders) {
                if (reminder.caseId && !caseIds.has(reminder.caseId)) {
                    issues.push({
                        severity: 'info',
                        entityType: 'reminder',
                        entityId: reminder._id.toString(),
                        field: 'caseId',
                        message: `Reminder references non-existent case ${reminder.caseId}`,
                        canAutoRepair: true,
                        repairAction: async () => {
                            await this.reminderRepository.update(reminder._id.toString(), {
                                caseId: undefined,
                                isActive: false
                            });
                        }
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error checking referential integrity:', error);
        }
        return issues;
    }
    /**
     * Enhanced batch validation with optimization
     */
    async optimizedBatchValidate(entities, context = {}) {
        const results = new Map();
        // Group entities by type for optimized processing
        const entitiesByType = new Map();
        for (const { entity, type } of entities) {
            if (!entitiesByType.has(type)) {
                entitiesByType.set(type, []);
            }
            entitiesByType.get(type).push(entity);
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
                await Promise.all(batch.map(async (entity) => {
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
                }));
            }
        });
        await Promise.all(typePromises);
        return results;
    }
    /**
     * Smart repair with dependency resolution
     */
    async smartRepair(issues, options = {}) {
        const maxRetries = options.maxRetries || 3;
        const result = {
            totalIssuesFound: issues.length,
            issuesRepaired: 0,
            issuesFailed: 0,
            repairedIssues: [],
            failedRepairs: []
        };
        // Group issues by entity for atomic repairs
        const issuesByEntity = new Map();
        for (const issue of issues) {
            const key = `${issue.entityType}:${issue.entityId}`;
            if (!issuesByEntity.has(key)) {
                issuesByEntity.set(key, []);
            }
            issuesByEntity.get(key).push(issue);
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
                let lastError = null;
                // Retry logic
                for (let retry = 0; retry < maxRetries && !repaired; retry++) {
                    try {
                        if (!options.dryRun) {
                            await issue.repairAction();
                            // Log the repair
                            await this.auditLogRepository.add({
                                guildId: issue.entityType,
                                action: audit_log_1.AuditAction.SystemRepair,
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
                    }
                    catch (error) {
                        lastError = error;
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
    addRule(rule) {
        this.validationRules.set(rule.name, rule);
    }
    async scanForIntegrityIssues(guildId, context = {}) {
        const scanStartedAt = new Date();
        const issues = [];
        let totalEntitiesScanned = 0;
        const issuesByEntityType = new Map();
        const fullContext = {
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
                    const entityIssues = await this.validateEntity(entity, type, fullContext, sortedRules);
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
        }
        catch (error) {
            logger_1.logger.error('Error during integrity scan:', error);
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
    async validateEntity(entity, entityType, context, rules) {
        const issues = [];
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
            }
            catch (error) {
                logger_1.logger.error(`Error running validation rule ${rule.name}:`, error);
            }
        }
        // Cache result
        this.validationCache.set(cacheKey, { result: issues, timestamp: Date.now() });
        return issues;
    }
    async checkForOrphanedRelationships(guildId, context) {
        const issues = [];
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
                                entityId: caseEntity._id.toString(),
                                field: 'clientId',
                                message: `Client ${caseEntity.clientId} not found in Discord server`,
                                canAutoRepair: false
                            });
                        }
                    }
                    catch (error) {
                        logger_1.logger.error('Error checking case client:', error);
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
                        entityId: member._id.toString(),
                        field: 'hiredBy',
                        message: 'Staff member hired by themselves',
                        canAutoRepair: false
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error checking orphaned relationships:', error);
        }
        return issues;
    }
    async repairIntegrityIssues(issues, options = {}) {
        const result = {
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
                        action: audit_log_1.AuditAction.SystemRepair,
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
            }
            catch (error) {
                result.issuesFailed++;
                result.failedRepairs.push({
                    issue,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                logger_1.logger.error(`Failed to repair issue for ${issue.entityType} ${issue.entityId}:`, error);
            }
        }
        // Clear validation cache after repairs
        this.validationCache.clear();
        return result;
    }
    async validateBeforeOperation(entity, entityType, _operation, context = {}) {
        const fullContext = {
            guildId: entity.guildId,
            validationLevel: context.validationLevel || 'strict',
            ...context
        };
        const rules = Array.from(this.validationRules.values())
            .filter(r => r.entityType === entityType)
            .sort((a, b) => b.priority - a.priority);
        return await this.validateEntity(entity, entityType, fullContext, rules);
    }
    async batchValidate(entities, context = {}) {
        const results = new Map();
        // Process in batches to avoid overwhelming the system
        const BATCH_SIZE = 50;
        for (let i = 0; i < entities.length; i += BATCH_SIZE) {
            const batch = entities.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async ({ entity, type }) => {
                const issues = await this.validateBeforeOperation(entity, type, 'update', context);
                if (issues.length > 0) {
                    results.set(entity._id, issues);
                }
            }));
        }
        return results;
    }
    clearValidationCache() {
        this.validationCache.clear();
    }
    getValidationRules() {
        return Array.from(this.validationRules.values());
    }
    addCustomRule(rule) {
        this.addRule(rule);
    }
}
exports.CrossEntityValidationService = CrossEntityValidationService;
//# sourceMappingURL=cross-entity-validation-service.js.map