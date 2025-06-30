# Application Layer Documentation

## Overview

The Application Layer orchestrates the flow of data and coordinates activities between the Domain Layer and external layers. It implements use cases, enforces business workflows, and provides transaction boundaries. This layer contains no business logic itself but orchestrates domain objects to perform business operations.

## Architecture Principles

### Clean Architecture
- **Use Case Implementation**: Each service method represents a use case
- **Transaction Management**: Ensures data consistency across operations
- **Domain Model Protection**: Shields domain from external concerns
- **Dependency Injection**: All dependencies injected via constructor

### Key Characteristics
- Orchestrates domain entities and services
- Implements application workflows
- Manages transactions and consistency
- Provides DTOs for data transfer
- No UI or infrastructure concerns

## Core Services

### 1. StaffService (`src/application/services/staff-service.ts`)

Manages the complete staff lifecycle including hiring, promotion, demotion, and termination.

```typescript
export class StaffService {
  constructor(
    private staffRepository: StaffRepository,
    private auditLogRepository: AuditLogRepository,
    private permissionService: PermissionService,
    private validationService: UnifiedValidationService
  ) {}

  /**
   * Hires a new staff member with comprehensive validation
   */
  async hireStaff(
    context: PermissionContext, 
    request: StaffHireRequest
  ): Promise<StaffOperationResult> {
    // 1. Permission validation
    const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // 2. Input validation
    const validationResult = await this.validationAdapter.validateHiring(context, {
      userId: request.userId,
      robloxUsername: request.robloxUsername,
      role: request.role
    });
    if (!validationResult.valid) {
      return { success: false, error: validationResult.errors.join(', ') };
    }

    // 3. Business rule validation (role limits)
    const roleLimitValidation = await this.validationAdapter.validateRoleLimit(
      context, 
      request.role
    );
    if (!roleLimitValidation.valid && !roleLimitValidation.bypassAvailable) {
      return { success: false, error: 'Role limit exceeded' };
    }

    // 4. Create domain entity
    const staff = new Staff({
      userId: request.userId,
      guildId: request.guildId,
      robloxUsername: request.robloxUsername,
      role: request.role,
      hiredAt: new Date(),
      hiredBy: request.hiredBy,
      status: 'active'
    });

    // 5. Persist with transaction
    const savedStaff = await this.staffRepository.add(staff);

    // 6. Audit logging
    await this.auditLogRepository.logAction({
      guildId: request.guildId,
      action: AuditAction.STAFF_HIRED,
      actorId: request.hiredBy,
      targetId: request.userId,
      details: {
        after: { role: request.role, status: 'active' },
        reason: request.reason
      }
    });

    return { success: true, staff: savedStaff };
  }

  /**
   * Promotes staff member with hierarchy validation
   */
  async promoteStaff(
    context: PermissionContext,
    request: StaffPromotionRequest
  ): Promise<StaffOperationResult> {
    // Similar workflow with promotion-specific validations
    // Validates promotion path, target role availability
    // Updates promotion history
    // Triggers role change events
  }

  /**
   * Retrieves staff members with filtering and pagination
   */
  async getStaffMembers(
    context: PermissionContext,
    options: StaffQueryOptions
  ): Promise<PaginatedResult<Staff>> {
    // Permission check for viewing staff
    // Apply filters (role, status, search)
    // Sort and paginate results
    // Transform to DTOs if needed
  }

  /**
   * Generates staff hierarchy overview
   */
  async getStaffHierarchy(
    context: PermissionContext
  ): Promise<StaffHierarchyResult> {
    const allStaff = await this.staffRepository.findByGuildId(context.guildId);
    
    return {
      hierarchy: this.buildHierarchyTree(allStaff),
      statistics: this.calculateStatistics(allStaff),
      roleCounts: this.getRoleCounts(allStaff),
      availableSlots: this.calculateAvailableSlots(allStaff)
    };
  }
}
```

**Key Workflows**:
- **Hiring**: Permission → Validation → Role Limits → Create → Audit
- **Promotion**: Permission → Current Role → Path Validation → Update → Audit
- **Termination**: Permission → Active Check → Update Status → Audit
- **Query**: Permission → Filter → Sort → Paginate → Transform

### 2. CaseService (`src/application/services/case-service.ts`)

Manages legal cases from creation through closure with channel integration.

```typescript
export class CaseService {
  constructor(
    private caseRepository: CaseRepository,
    private caseCounterRepository: CaseCounterRepository,
    private guildConfigRepository: GuildConfigRepository,
    private permissionService: PermissionService,
    private validationService: UnifiedValidationService
  ) {}

  /**
   * Creates a new case with Discord channel
   */
  async createCase(
    context: PermissionContext,
    request: CaseCreateRequest
  ): Promise<CaseOperationResult> {
    // 1. Permission validation
    const hasPermission = await this.permissionService.hasCasePermissionWithContext(context);
    
    // 2. Client case limit validation
    const caseLimitValidation = await this.validationAdapter.validateClientCaseLimit(
      context,
      request.clientId
    );
    
    // 3. Generate sequential case number
    const caseNumber = await this.generateCaseNumber(
      request.guildId,
      request.clientUsername
    );
    
    // 4. Create case entity
    const newCase = new Case({
      guildId: request.guildId,
      caseNumber,
      clientId: request.clientId,
      clientUsername: request.clientUsername,
      title: request.title,
      description: request.description,
      priority: request.priority,
      status: CaseStatus.PENDING,
      assignedLawyerIds: []
    });
    
    // 5. Create Discord channel
    const channel = await this.createCaseChannel(newCase);
    newCase.channelId = channel.id;
    
    // 6. Persist case
    const savedCase = await this.caseRepository.add(newCase);
    
    // 7. Audit log
    await this.auditLogRepository.logAction({
      guildId: request.guildId,
      action: AuditAction.CASE_CREATED,
      actorId: context.userId,
      targetId: savedCase._id,
      details: { caseNumber, clientId: request.clientId }
    });
    
    return { success: true, case: savedCase };
  }

  /**
   * Assigns lawyer to case with validation
   */
  async assignLawyer(
    context: PermissionContext,
    caseId: string,
    lawyerId: string
  ): Promise<OperationResult> {
    // Validate lawyer is qualified staff
    // Check case exists and is active
    // Add to assigned lawyers
    // Update channel permissions
    // Send notifications
  }

  /**
   * Sets lead attorney with qualification check
   */
  async setLeadAttorney(
    context: PermissionContext,
    caseId: string,
    attorneyId: string
  ): Promise<OperationResult> {
    // Validate lead attorney permissions
    // Ensure attorney is assigned to case
    // Update lead attorney
    // Notify team members
  }

  /**
   * Closes case with outcome tracking
   */
  async closeCase(
    context: PermissionContext,
    caseId: string,
    outcome: string
  ): Promise<OperationResult> {
    // Validate case ownership
    // Update status and outcome
    // Archive Discord channel
    // Generate closure report
    // Update client metrics
  }

  /**
   * Complex case reassignment workflow
   */
  async reassignLawyer(
    context: PermissionContext,
    request: CaseReassignmentRequest
  ): Promise<OperationResult> {
    // Begin transaction
    // Remove from source case
    // Add to target case
    // Update channel permissions
    // Handle lead attorney changes
    // Audit trail
    // Commit transaction
  }

  private async generateCaseNumber(
    guildId: string, 
    clientUsername: string
  ): Promise<string> {
    const counter = await this.caseCounterRepository.getNextCaseNumber(guildId);
    const year = new Date().getFullYear();
    return generateCaseNumber(year, counter, clientUsername);
  }
}
```

**Key Workflows**:
- **Creation**: Validate → Generate Number → Create Channel → Persist
- **Assignment**: Validate Staff → Update Case → Update Permissions
- **Lead Attorney**: Validate Qualifications → Assign → Notify
- **Closure**: Validate → Archive → Report → Metrics

### 3. RetainerService (`src/application/services/retainer-service.ts`)

Manages retainer agreements with digital signature workflow.

```typescript
export class RetainerService {
  constructor(
    private retainerRepository: RetainerRepository,
    private guildConfigRepository: GuildConfigRepository,
    private robloxService: RobloxService,
    private permissionService: PermissionService
  ) {}

  /**
   * Creates retainer agreement for client
   */
  async createRetainer(
    context: PermissionContext,
    request: RetainerCreateRequest
  ): Promise<RetainerOperationResult> {
    // Validate lawyer permissions
    // Check existing retainers
    // Validate Roblox username if provided
    // Create retainer entity
    // Send to Discord channel
    // Wait for signature interaction
  }

  /**
   * Processes digital signature
   */
  async signRetainer(
    clientId: string,
    retainerId: string,
    messageId: string
  ): Promise<OperationResult> {
    // Verify signature message
    // Update retainer status
    // Log signature timestamp
    // Send confirmation
    // Update client role
  }

  /**
   * Handles retainer expiration
   */
  async processExpiredRetainers(): Promise<void> {
    const expired = await this.retainerRepository.findExpired();
    
    for (const retainer of expired) {
      // Update status
      // Notify client
      // Notify assigned lawyer
      // Create renewal opportunity
    }
  }
}
```

**Key Workflows**:
- **Creation**: Permission → Validation → Create → Send for Signature
- **Signature**: Verify → Update → Confirm → Apply Benefits
- **Expiration**: Find Expired → Update → Notify → Renewal

### 4. JobService (`src/application/services/job-service.ts`)

Manages job postings and recruitment workflow.

```typescript
export class JobService {
  constructor(
    private jobRepository: JobRepository,
    private staffRepository: StaffRepository,
    private permissionService: PermissionService,
    private discordService: DiscordService
  ) {}

  /**
   * Creates job posting with role validation
   */
  async createJobPosting(
    context: PermissionContext,
    request: JobPostingRequest
  ): Promise<JobOperationResult> {
    // Validate HR permissions
    // Check role has available slots
    // Create job entity with questions
    // Post to Discord channel
    // Set up application collector
  }

  /**
   * Manages custom application questions
   */
  async updateJobQuestions(
    context: PermissionContext,
    jobId: string,
    questions: JobQuestion[]
  ): Promise<OperationResult> {
    // Validate job ownership
    // Validate question format
    // Update questions
    // Refresh Discord posting
  }

  /**
   * Closes job posting with cleanup
   */
  async closeJobPosting(
    context: PermissionContext,
    jobId: string
  ): Promise<OperationResult> {
    // Validate permissions
    // Update job status
    // Remove Discord collector
    // Notify pending applicants
    // Generate recruitment report
  }
}
```

**Key Workflows**:
- **Posting**: Permission → Slot Check → Create → Post → Collect
- **Questions**: Validate → Update → Refresh Display
- **Closure**: Permission → Update → Cleanup → Report

### 5. ApplicationService (`src/application/services/application-service.ts`)

Processes job applications with validation and review workflow.

```typescript
export class ApplicationService {
  constructor(
    private applicationRepository: ApplicationRepository,
    private jobRepository: JobRepository,
    private robloxService: RobloxService,
    private notificationService: NotificationService
  ) {}

  /**
   * Submits job application with validation
   */
  async submitApplication(
    applicantId: string,
    request: ApplicationSubmitRequest
  ): Promise<ApplicationOperationResult> {
    // Validate job is open
    // Check duplicate applications
    // Validate Roblox username
    // Validate required answers
    // Create application
    // Notify HR team
  }

  /**
   * Reviews application with workflow
   */
  async reviewApplication(
    context: PermissionContext,
    applicationId: string,
    decision: ApplicationDecision
  ): Promise<OperationResult> {
    // Validate reviewer permissions
    // Update application status
    // Add review notes
    // Send decision notification
    // Schedule interview if accepted
  }

  /**
   * Bulk application processing
   */
  async processApplicationBatch(
    context: PermissionContext,
    applicationIds: string[],
    action: BatchAction
  ): Promise<BatchOperationResult> {
    const results = [];
    
    for (const id of applicationIds) {
      try {
        // Process individual application
        // Track success/failure
        // Continue on error
      } catch (error) {
        results.push({ id, success: false, error });
      }
    }
    
    return { 
      processed: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}
```

**Key Workflows**:
- **Submission**: Validate → Check Duplicates → Create → Notify
- **Review**: Permission → Update → Notify → Schedule
- **Batch**: Validate → Process Each → Aggregate Results

### 6. FeedbackService (`src/application/services/feedback-service.ts`)

Collects and manages client feedback for quality assurance.

```typescript
export class FeedbackService {
  constructor(
    private feedbackRepository: FeedbackRepository,
    private caseRepository: CaseRepository,
    private metricsService: MetricsService
  ) {}

  /**
   * Submits client feedback
   */
  async submitFeedback(
    clientId: string,
    request: FeedbackSubmitRequest
  ): Promise<FeedbackOperationResult> {
    // Validate case ownership
    // Check duplicate feedback
    // Create feedback entity
    // Update staff metrics
    // Trigger follow-up if requested
  }

  /**
   * Generates performance metrics
   */
  async getStaffPerformanceMetrics(
    staffId: string,
    dateRange: DateRange
  ): Promise<PerformanceMetrics> {
    const feedback = await this.feedbackRepository.findByStaffId(
      staffId,
      dateRange
    );
    
    return {
      averageRating: this.calculateAverageRating(feedback),
      totalFeedback: feedback.length,
      ratingDistribution: this.getRatingDistribution(feedback),
      trends: this.calculateTrends(feedback),
      strengths: this.identifyStrengths(feedback),
      improvements: this.identifyImprovements(feedback)
    };
  }

  /**
   * Responds to client feedback
   */
  async respondToFeedback(
    context: PermissionContext,
    feedbackId: string,
    response: string
  ): Promise<OperationResult> {
    // Validate responder is involved staff
    // Update feedback with response
    // Notify client of response
    // Update resolution metrics
  }
}
```

**Key Workflows**:
- **Submission**: Validate → Create → Update Metrics → Trigger Actions
- **Metrics**: Query → Calculate → Analyze → Report
- **Response**: Validate → Update → Notify → Track

### 7. InformationChannelService (`src/application/services/information-channel-service.ts`)

Manages bot-controlled information messages in Discord channels with persistent storage.

**Key Features**:
- Create/update rich embed information messages
- Persistent storage of message configuration
- Automatic message recreation if deleted
- Support for custom fields, images, and formatting
- One information message per channel

**Core Methods**:
```typescript
async updateInformationChannel(request: UpdateInformationChannelRequest): Promise<InformationChannel>
async getInformationChannel(guildId: string, channelId: string): Promise<InformationChannel | null>
async listInformationChannels(guildId: string): Promise<InformationChannel[]>
async deleteInformationChannel(guildId: string, channelId: string): Promise<boolean>
async syncInformationMessage(guildId: string, channelId: string): Promise<boolean>
```

**Business Logic**:
- Validates channel is a text channel
- Manages Discord message lifecycle
- Handles message not found scenarios gracefully
- Cleans up old bot messages before creating new ones
- Tracks last updated user and timestamp

**Integration Points**:
- Uses Discord.js Client for message management
- Persists data via InformationChannelRepository
- Permission checks via PermissionService

### 8. RulesChannelService (`src/application/services/rules-channel-service.ts`)

Manages bot-maintained rules messages with structured rule management.

```typescript
export class RulesChannelService {
  constructor(
    private readonly rulesChannelRepository: RulesChannelRepository,
    private readonly discordClient: Client
  ) {}

  /**
   * Generates default rules templates
   */
  static generateDefaultRules(
    context: 'anarchy' | 'general' = 'general'
  ): Partial<UpdateRulesChannelRequest> {
    // Returns appropriate template with rules array
  }

  /**
   * Updates or creates rules message
   */
  async updateRulesChannel(
    request: UpdateRulesChannelRequest
  ): Promise<RulesChannel> {
    // Creates/updates Discord message
    // Persists configuration
  }

  /**
   * Adds individual rule
   */
  async addRule(
    guildId: string,
    channelId: string,
    rule: Omit<Rule, 'id' | 'order'>,
    updatedBy: string
  ): Promise<RulesChannel | null> {
    // Adds rule with auto-ordering
    // Syncs Discord message
  }

  /**
   * Removes individual rule
   */
  async removeRule(
    guildId: string,
    channelId: string,
    ruleId: string,
    updatedBy: string
  ): Promise<RulesChannel | null> {
    // Removes rule and reorders
    // Syncs Discord message
  }
}
```

**Key Features**:
- Structured rule management with categories and severity
- Automatic rule ordering and numbering
- Template system for default rules
- Rich Discord embed formatting
- Individual rule CRUD operations
- Message synchronization

**Integration**:
- Uses Discord.js Client for message management
- Persists data via RulesChannelRepository
- Integrates with server setup for default rules

### 9. ReminderService (`src/application/services/reminder-service.ts`)

Manages scheduled reminders with natural language processing.

```typescript
export class ReminderService {
  constructor(
    private reminderRepository: ReminderRepository,
    private caseRepository: CaseRepository,
    private staffRepository: StaffRepository,
    private discordClient: Client
  ) {}

  /**
   * Creates reminder with NLP parsing
   */
  async createReminder(
    userId: string,
    request: ReminderCreateRequest
  ): Promise<ReminderOperationResult> {
    // Parse natural language date
    const dueDate = this.parseNaturalDate(request.when);
    
    // Validate future date
    // Check for conflicts
    // Create reminder entity
    // Schedule execution
    // Return confirmation
  }

  /**
   * Processes due reminders
   */
  async processDueReminders(): Promise<void> {
    const due = await this.reminderRepository.findDue();
    
    for (const reminder of due) {
      try {
        await this.executeReminder(reminder);
      } catch (error) {
        await this.handleReminderFailure(reminder, error);
      }
    }
  }

  /**
   * Executes individual reminder
   */
  private async executeReminder(reminder: Reminder): Promise<void> {
    // Get target channel
    const channel = await this.getTargetChannel(reminder);
    
    // Build reminder message
    const message = this.buildReminderMessage(reminder);
    
    // Send reminder
    await channel.send(message);
    
    // Update status
    if (reminder.recurring) {
      await this.scheduleNextOccurrence(reminder);
    } else {
      await this.markCompleted(reminder);
    }
  }

  /**
   * Natural language date parsing
   */
  private parseNaturalDate(input: string): Date {
    // "tomorrow at 3pm"
    // "next Monday"
    // "in 2 hours"
    // "December 25th at noon"
    // Complex NLP parsing logic
  }
}
```

**Key Workflows**:
- **Creation**: Parse → Validate → Create → Schedule
- **Execution**: Find Due → Send → Update → Reschedule
- **Management**: List → Snooze → Cancel → Complete

### 10. PermissionService (`src/application/services/permission-service.ts`)

Manages role-based access control with action permissions.

```typescript
export class PermissionService {
  constructor(
    private guildConfigRepository: GuildConfigRepository
  ) {}

  /**
   * Checks action-based permission
   */
  async hasActionPermission(
    context: PermissionContext,
    action: PermissionAction
  ): Promise<boolean> {
    // Check guild owner bypass
    if (context.isGuildOwner) return true;
    
    // Get guild configuration
    const config = await this.guildConfigRepository.findByGuildId(
      context.guildId
    );
    
    // Check admin bypass
    if (this.isAdmin(context, config)) return true;
    
    // Check specific action permission
    return this.hasSpecificPermission(context, action, config);
  }

  /**
   * Complex permission checking with inheritance
   */
  private hasSpecificPermission(
    context: PermissionContext,
    action: PermissionAction,
    config: GuildConfig
  ): boolean {
    const allowedRoles = config.permissions[action] || [];
    
    // Check direct role match
    const hasDirectPermission = context.userRoles.some(
      role => allowedRoles.includes(role)
    );
    
    // Check inherited permissions
    const hasInheritedPermission = this.checkInheritance(
      context.userRoles,
      action,
      config
    );
    
    return hasDirectPermission || hasInheritedPermission;
  }

  /**
   * Permission inheritance logic
   */
  private checkInheritance(
    userRoles: string[],
    action: PermissionAction,
    config: GuildConfig
  ): boolean {
    // Admin inherits all permissions
    // Senior-staff inherits case, lawyer permissions
    // Lead-attorney inherits lawyer permissions
    // Complex inheritance tree
  }
}
```

**Key Workflows**:
- **Check**: Context → Guild Owner → Admin → Specific → Inherited
- **Management**: Update → Validate → Audit → Apply
- **Query**: List → Filter → Format → Return

### 9. AuditLogService (`src/application/services/audit-log-service.ts`)

Provides comprehensive audit trail with search and analysis.

```typescript
export class AuditLogService {
  constructor(
    private auditLogRepository: AuditLogRepository,
    private alertService: AlertService
  ) {}

  /**
   * Logs action with severity assessment
   */
  async logAction(
    action: AuditAction,
    context: AuditContext
  ): Promise<void> {
    // Assess severity
    const severity = this.assessSeverity(action, context);
    
    // Create audit entry
    const entry = new AuditLog({
      guildId: context.guildId,
      action,
      actorId: context.actorId,
      targetId: context.targetId,
      details: context.details,
      severity,
      timestamp: new Date(),
      correlationId: context.correlationId
    });
    
    // Persist entry
    await this.auditLogRepository.add(entry);
    
    // Alert if high severity
    if (severity >= AuditSeverity.HIGH) {
      await this.alertService.sendSecurityAlert(entry);
    }
  }

  /**
   * Searches audit logs with filters
   */
  async searchAuditLogs(
    context: PermissionContext,
    filters: AuditSearchFilters
  ): Promise<PaginatedResult<AuditLog>> {
    // Validate search permissions
    // Build query from filters
    // Execute search
    // Format results
    // Return paginated data
  }

  /**
   * Generates audit report
   */
  async generateAuditReport(
    context: PermissionContext,
    dateRange: DateRange
  ): Promise<AuditReport> {
    const logs = await this.auditLogRepository.findByDateRange(
      context.guildId,
      dateRange
    );
    
    return {
      summary: this.generateSummary(logs),
      actionBreakdown: this.getActionBreakdown(logs),
      userActivity: this.getUserActivity(logs),
      securityEvents: this.getSecurityEvents(logs),
      trends: this.analyzeTrends(logs)
    };
  }
}
```

**Key Workflows**:
- **Logging**: Create → Assess → Persist → Alert
- **Search**: Validate → Query → Filter → Paginate
- **Reporting**: Query → Analyze → Format → Deliver

## Validation Services

### UnifiedValidationService (`src/application/validation/unified-validation-service.ts`)

Centralized validation with strategy pattern.

```typescript
export class UnifiedValidationService {
  private strategies: ValidationStrategy[] = [];

  /**
   * Registers validation strategy
   */
  registerStrategy(strategy: ValidationStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Validates using applicable strategies
   */
  async validate(
    context: ValidationContext
  ): Promise<ValidationResult> {
    // Find applicable strategies
    const applicable = this.strategies.filter(
      s => s.canHandle(context)
    );
    
    // Run validations in parallel
    const results = await Promise.all(
      applicable.map(s => s.validate(context))
    );
    
    // Merge results
    return this.mergeResults(results);
  }

  /**
   * Context factory method
   */
  static createContext(params: {
    permissionContext: PermissionContext;
    entityType: string;
    operation: string;
    data: any;
    metadata?: any;
  }): ValidationContext {
    return new ValidationContext(params);
  }
}
```

### BusinessRuleValidationStrategy (`src/application/validation/strategies/business-rule-validation-strategy.ts`)

Validates business rules like role limits and case limits.

```typescript
export class BusinessRuleValidationStrategy implements ValidationStrategy {
  readonly name = 'BusinessRuleValidation';

  constructor(
    private staffRepository: StaffRepository,
    private caseRepository: CaseRepository,
    private guildConfigRepository: GuildConfigRepository,
    private permissionService: PermissionService
  ) {}

  canHandle(context: ValidationContext): boolean {
    const supportedTypes = ['staff', 'case', 'role'];
    const supportedOps = ['hire', 'promote', 'create', 'assign'];
    return supportedTypes.includes(context.entityType) &&
           supportedOps.includes(context.operation);
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    switch (context.operation) {
      case 'validateRoleLimit':
        return this.validateRoleLimit(context);
      case 'validateClientLimit':
        return this.validateClientCaseLimit(context);
      default:
        return ValidationResultHelper.success();
    }
  }

  private async validateRoleLimit(
    context: ValidationContext
  ): Promise<ValidationResult> {
    const role = context.data.role;
    const currentCount = await this.getCurrentRoleCount(
      context.permissionContext.guildId,
      role
    );
    const maxCount = RoleUtils.getRoleMaxCount(role);
    
    if (currentCount >= maxCount) {
      // Check bypass eligibility
      const canBypass = context.permissionContext.isGuildOwner ||
        await this.permissionService.isAdmin(context.permissionContext);
      
      return {
        valid: false,
        issues: [{
          severity: ValidationSeverity.ERROR,
          code: 'ROLE_LIMIT_EXCEEDED',
          message: `Maximum limit of ${maxCount} reached`,
          field: 'role',
          context: { currentCount, maxCount }
        }],
        bypassAvailable: canBypass,
        bypassType: canBypass ? 'guild-owner' : undefined
      };
    }
    
    return ValidationResultHelper.success();
  }
}
```

## Error Handling

### Custom Error Types (`src/domain/errors/`)

```typescript
export class BusinessRuleError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: any
  ) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

export class ValidationError extends Error {
  constructor(
    public validationResult: ValidationResult,
    message: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends Error {
  constructor(
    public code: string,
    message: string,
    public requiredPermission: string,
    public context?: any
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}
```

### Error Context Service (`src/application/services/error-context-service.ts`)

```typescript
export class ErrorContextService {
  private operations: Map<string, OperationContext> = new Map();

  /**
   * Creates operation context
   */
  createContext(operation: string, metadata: any): string {
    const id = generateId();
    this.operations.set(id, {
      operation,
      metadata,
      startTime: Date.now(),
      breadcrumbs: []
    });
    return id;
  }

  /**
   * Adds breadcrumb to context
   */
  addBreadcrumb(contextId: string, breadcrumb: Breadcrumb): void {
    const context = this.operations.get(contextId);
    if (context) {
      context.breadcrumbs.push(breadcrumb);
    }
  }

  /**
   * Completes operation context
   */
  completeOperation(contextId: string): void {
    const context = this.operations.get(contextId);
    if (context) {
      context.endTime = Date.now();
      context.duration = context.endTime - context.startTime;
      // Store for analysis
      this.operations.delete(contextId);
    }
  }
}
```

## Transaction Management

### Transaction Patterns

```typescript
export class TransactionalService {
  /**
   * Executes operation with transaction
   */
  async executeWithTransaction<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const session = await startSession();
    
    try {
      session.startTransaction();
      
      const result = await operation();
      
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Complex multi-step transaction
   */
  async complexWorkflow(request: ComplexRequest): Promise<void> {
    await this.executeWithTransaction(async () => {
      // Step 1: Update entity A
      await this.repositoryA.update(request.entityA);
      
      // Step 2: Create entity B
      await this.repositoryB.create(request.entityB);
      
      // Step 3: Update entity C
      await this.repositoryC.update(request.entityC);
      
      // All succeed or all fail
    });
  }
}
```

## Service Integration Patterns

### Service Composition

```typescript
export class ComplexWorkflowService {
  constructor(
    private staffService: StaffService,
    private caseService: CaseService,
    private notificationService: NotificationService
  ) {}

  /**
   * Complex workflow combining multiple services
   */
  async onboardNewClient(
    context: PermissionContext,
    request: ClientOnboardingRequest
  ): Promise<OnboardingResult> {
    // 1. Create client case
    const caseResult = await this.caseService.createCase(
      context,
      {
        clientId: request.clientId,
        clientUsername: request.clientUsername,
        title: 'Initial Consultation',
        description: request.consultationDetails,
        priority: CasePriority.MEDIUM
      }
    );

    // 2. Assign lawyer
    await this.caseService.assignLawyer(
      context,
      caseResult.case._id,
      request.assignedLawyerId
    );

    // 3. Send notifications
    await this.notificationService.sendBulk([
      {
        type: 'case_created',
        recipientId: request.clientId,
        data: caseResult.case
      },
      {
        type: 'case_assigned',
        recipientId: request.assignedLawyerId,
        data: caseResult.case
      }
    ]);

    return {
      success: true,
      caseId: caseResult.case._id,
      channelId: caseResult.case.channelId
    };
  }
}
```

### Event-Driven Patterns

```typescript
export class EventDrivenService {
  constructor(
    private eventBus: EventBus
  ) {}

  /**
   * Publishes domain events
   */
  async handleStaffPromotion(
    staff: Staff,
    newRole: StaffRole
  ): Promise<void> {
    // Update staff
    staff.role = newRole;
    await this.staffRepository.update(staff);

    // Publish event
    await this.eventBus.publish(
      new StaffPromotedEvent({
        staffId: staff._id,
        previousRole: staff.role,
        newRole: newRole,
        promotedAt: new Date()
      })
    );
  }
}

// Event handlers in other services
export class ChannelPermissionUpdateHandler {
  @EventHandler(StaffPromotedEvent)
  async handleStaffPromoted(event: StaffPromotedEvent): Promise<void> {
    // Update channel permissions based on new role
    await this.updateChannelPermissions(
      event.staffId,
      event.newRole
    );
  }
}
```

## Performance Optimization

### Caching Strategies

```typescript
export class CachedService {
  private cache: Map<string, CacheEntry> = new Map();
  
  /**
   * Gets data with cache
   */
  async getData(key: string): Promise<any> {
    // Check cache
    const cached = this.cache.get(key);
    if (cached && !this.isExpired(cached)) {
      return cached.data;
    }
    
    // Load from repository
    const data = await this.repository.findById(key);
    
    // Update cache
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: 300000 // 5 minutes
    });
    
    return data;
  }

  /**
   * Invalidates cache entries
   */
  invalidate(pattern: string): void {
    for (const [key] of this.cache) {
      if (key.match(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### Batch Processing

```typescript
export class BatchProcessingService {
  /**
   * Processes items in batches
   */
  async processBatch<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      // Rate limiting
      await this.delay(100);
    }
    
    return results;
  }
}
```

## Testing Strategies

### Service Testing

```typescript
describe('StaffService', () => {
  let staffService: StaffService;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockAuditRepo: jest.Mocked<AuditLogRepository>;
  
  beforeEach(() => {
    mockStaffRepo = createMock<StaffRepository>();
    mockAuditRepo = createMock<AuditLogRepository>();
    
    staffService = new StaffService(
      mockStaffRepo,
      mockAuditRepo,
      mockPermissionService,
      mockValidationService
    );
  });
  
  describe('hireStaff', () => {
    it('should hire staff with valid permissions', async () => {
      // Arrange
      mockPermissionService.hasSeniorStaffPermission.mockResolvedValue(true);
      mockValidationService.validate.mockResolvedValue({ valid: true });
      mockStaffRepo.add.mockResolvedValue(mockStaff);
      
      // Act
      const result = await staffService.hireStaff(context, request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockAuditRepo.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.STAFF_HIRED
        })
      );
    });
  });
});
```

### Integration Testing

```typescript
describe('Staff Management Integration', () => {
  it('should handle complete hiring workflow', async () => {
    // Real repositories with test database
    const staffRepo = new StaffRepository();
    const auditRepo = new AuditLogRepository();
    
    const staffService = new StaffService(
      staffRepo,
      auditRepo,
      permissionService,
      validationService
    );
    
    // Execute complete workflow
    const result = await staffService.hireStaff(context, {
      userId: 'test-user',
      role: StaffRole.PARALEGAL,
      robloxUsername: 'TestUser123'
    });
    
    // Verify all side effects
    expect(result.success).toBe(true);
    
    const savedStaff = await staffRepo.findByUserId(
      context.guildId,
      'test-user'
    );
    expect(savedStaff).toBeDefined();
    
    const auditLogs = await auditRepo.findByAction(
      context.guildId,
      AuditAction.STAFF_HIRED
    );
    expect(auditLogs).toHaveLength(1);
  });
});
```

## Service Documentation

### Service Interfaces

```typescript
export interface StaffOperationResult {
  success: boolean;
  staff?: Staff;
  error?: string;
  validationErrors?: ValidationIssue[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface OperationResult {
  success: boolean;
  error?: string;
  data?: any;
}
```

### DTOs (Data Transfer Objects)

```typescript
export interface StaffHireRequest {
  guildId: string;
  userId: string;
  robloxUsername: string;
  role: StaffRole;
  hiredBy: string;
  reason?: string;
}

export interface CaseCreateRequest {
  guildId: string;
  clientId: string;
  clientUsername: string;
  title: string;
  description: string;
  priority: CasePriority;
}

export interface ApplicationSubmitRequest {
  jobId: string;
  applicantId: string;
  robloxUsername: string;
  answers: ApplicationAnswer[];
}
```

## Conclusion

The Application Layer provides a robust orchestration layer that coordinates domain objects, enforces workflows, manages transactions, and integrates with external services while keeping the domain layer pure. It implements all use cases as service methods with consistent patterns for validation, error handling, and audit logging.