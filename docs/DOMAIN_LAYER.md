# Domain Layer Documentation

## Overview

The Domain Layer represents the core business logic and entities of the Anarchy & Associates Discord bot. This layer is completely independent of external concerns like databases, Discord API, or web frameworks. It contains the pure business rules and domain models that define what the system does.

## Architecture Principles

### Domain-Driven Design (DDD)
- **Entities**: Objects with unique identity that persist over time
- **Value Objects**: Immutable objects defined by their attributes
- **Aggregates**: Clusters of entities and value objects with defined boundaries
- **Domain Services**: Operations that don't naturally fit within entities

### Key Characteristics
- No external dependencies (no Discord.js, no MongoDB)
- Pure TypeScript/JavaScript
- Immutable where possible
- Rich domain models with behavior

## Core Entities

### 1. Staff Entity (`src/domain/entities/staff.ts`)

The Staff entity represents legal firm employees with role hierarchy and employment history.

```typescript
export interface Staff extends Base {
  userId: string;           // Discord user ID
  guildId: string;         // Discord guild ID
  robloxUsername: string;  // Roblox username for external integration
  role: StaffRole;         // Current role in hierarchy
  hiredAt: Date;          // Employment start date
  hiredBy: string;        // Discord ID of hiring manager
  promotionHistory: PromotionRecord[];  // Complete promotion/demotion history
  status: 'active' | 'terminated';      // Employment status
  terminatedAt?: Date;     // Termination date if applicable
  terminatedBy?: string;   // Discord ID of terminating manager
  terminationReason?: string;  // Reason for termination
}
```

**Business Rules**:
- Each staff member must have a unique Discord user ID per guild
- Roblox usernames must be unique within a guild
- Role changes are tracked in promotion history
- Terminated staff cannot be rehired without special permissions

### 2. StaffRole Entity (`src/domain/entities/staff-role.ts`)

Defines the hierarchical role structure with strict limits and permissions.

```typescript
export enum StaffRole {
  MANAGING_PARTNER = 'Managing Partner',
  SENIOR_PARTNER = 'Senior Partner',
  JUNIOR_PARTNER = 'Junior Partner',
  SENIOR_ASSOCIATE = 'Senior Associate',
  JUNIOR_ASSOCIATE = 'Junior Associate',
  PARALEGAL = 'Paralegal'
}

export class RoleUtils {
  private static readonly ROLE_HIERARCHY: Map<StaffRole, number> = new Map([
    [StaffRole.MANAGING_PARTNER, 6],
    [StaffRole.SENIOR_PARTNER, 5],
    [StaffRole.JUNIOR_PARTNER, 4],
    [StaffRole.SENIOR_ASSOCIATE, 3],
    [StaffRole.JUNIOR_ASSOCIATE, 2],
    [StaffRole.PARALEGAL, 1]
  ]);

  private static readonly ROLE_LIMITS: Map<StaffRole, number> = new Map([
    [StaffRole.MANAGING_PARTNER, 1],
    [StaffRole.SENIOR_PARTNER, 3],
    [StaffRole.JUNIOR_PARTNER, 5],
    [StaffRole.SENIOR_ASSOCIATE, 10],
    [StaffRole.JUNIOR_ASSOCIATE, 10],
    [StaffRole.PARALEGAL, 10]
  ]);
}
```

**Business Rules**:
- Strict role limits enforced (e.g., only 1 Managing Partner)
- Hierarchical promotion/demotion paths
- Higher roles inherit permissions from lower roles
- Role changes require appropriate permissions

### 3. Case Entity (`src/domain/entities/case.ts`)

Represents legal cases with client management and lawyer assignment.

```typescript
export interface Case extends Base {
  guildId: string;
  caseNumber: string;      // Format: YYYY-NNNN-ClientUsername
  clientId: string;        // Discord user ID of client
  clientUsername: string;  // Client's Discord username
  title: string;           // Case title/description
  description: string;     // Detailed case description
  status: CaseStatus;      // Current case status
  priority: CasePriority;  // Case priority level
  channelId?: string;      // Discord channel ID for case
  assignedLawyerIds: string[];  // Array of assigned lawyer Discord IDs
  leadAttorneyId?: string;      // Primary attorney Discord ID
  notes: CaseNote[];       // Internal and client-visible notes
  documents: CaseDocument[];    // Attached documents
  acceptedBy?: string;     // Lawyer who accepted the case
  acceptedAt?: Date;       // When case was accepted
  declinedBy?: string;     // Lawyer who declined (if applicable)
  declinedAt?: Date;       // When case was declined
  declineReason?: string;  // Reason for declining
  closedBy?: string;       // Who closed the case
  closedAt?: Date;         // When case was closed
  outcome?: string;        // Case outcome/resolution
}

export enum CaseStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress', 
  CLOSED = 'closed'
}

export enum CasePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}
```

**Business Rules**:
- Case numbers are sequential per year per guild
- Clients limited to 5 active cases simultaneously
- Only qualified staff can be lead attorneys
- Cases require Discord channel creation
- Closed cases are archived, not deleted

### 4. Retainer Entity (`src/domain/entities/retainer.ts`)

Legal retainer agreements with digital signature workflow.

```typescript
export interface Retainer extends Base {
  guildId: string;
  clientId: string;         // Discord user ID
  clientUsername: string;   // Discord username
  robloxUsername?: string;  // Optional Roblox username
  amount: number;           // Retainer fee amount
  currency: string;         // Currency code (e.g., 'USD')
  description: string;      // Service description
  terms: string;            // Legal terms and conditions
  status: RetainerStatus;   // Current agreement status
  createdBy: string;        // Staff member who created
  signedAt?: Date;          // When client signed
  signatureMessageId?: string;  // Discord message ID of signature
  cancelledAt?: Date;       // Cancellation date
  cancelledBy?: string;     // Who cancelled
  cancellationReason?: string;  // Reason for cancellation
  expiresAt?: Date;         // Expiration date
}

export enum RetainerStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}
```

**Business Rules**:
- Retainers require explicit client consent via Discord interaction
- Only one active retainer per client
- Expired retainers automatically transition status
- Cancellation requires reason and authorization

### 5. Job Entity (`src/domain/entities/job.ts`)

Job postings for recruitment with application workflow.

```typescript
export interface Job extends Base {
  guildId: string;
  title: string;            // Job title
  role: StaffRole;          // Target role for position
  description: string;      // Detailed job description
  requirements: string[];   // List of requirements
  postedBy: string;         // Staff member who posted
  status: JobStatus;        // Current posting status
  customQuestions?: JobQuestion[];  // Custom application questions
  applicationChannelId?: string;    // Discord channel for applications
  applicationMessageId?: string;    // Discord message ID
  closedAt?: Date;          // When posting closed
  closedBy?: string;        // Who closed the posting
  totalApplications: number;  // Application count
}

export interface JobQuestion {
  id: string;
  question: string;         // Question text
  required: boolean;        // Whether answer required
  maxLength?: number;       // Maximum answer length
  order: number;            // Display order
}

export enum JobStatus {
  OPEN = 'open',
  CLOSED = 'closed'
}
```

**Business Rules**:
- Jobs can only be posted for roles with available slots
- Custom questions limited to 10 per job
- Applications tracked separately with validation
- Closed jobs preserved for historical records

### 6. Application Entity (`src/domain/entities/application.ts`)

Job applications with review workflow.

```typescript
export interface Application extends Base {
  guildId: string;
  jobId: string;            // Related job posting
  applicantId: string;      // Discord user ID
  applicantUsername: string;  // Discord username
  robloxUsername: string;   // Required Roblox username
  answers: ApplicationAnswer[];  // Responses to questions
  status: ApplicationStatus;  // Current application status
  submittedAt: Date;        // Submission timestamp
  reviewedBy?: string;      // Reviewing staff member
  reviewedAt?: Date;        // Review timestamp
  reviewNotes?: string;     // Internal review notes
  interviewScheduled?: Date;  // Interview date/time
  offerExtended?: boolean;  // Whether offer made
  offerAccepted?: boolean;  // Whether offer accepted
}

export interface ApplicationAnswer {
  questionId: string;
  question: string;         // Question text (denormalized)
  answer: string;           // Applicant's response
}

export enum ApplicationStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn'
}
```

**Business Rules**:
- One application per user per job
- All required questions must be answered
- Status transitions follow workflow rules
- Applications cannot be deleted, only withdrawn

### 7. Feedback Entity (`src/domain/entities/feedback.ts`)

Client feedback for service quality tracking.

```typescript
export interface Feedback extends Base {
  guildId: string;
  caseId: string;           // Related case
  clientId: string;         // Client Discord ID
  staffId: string;          // Staff member being reviewed
  rating: number;           // 1-5 star rating
  comment?: string;         // Optional text feedback
  serviceType: string;      // Type of service provided
  anonymous: boolean;       // Whether feedback anonymous
  followUpRequested: boolean;  // Client wants follow-up
  respondedBy?: string;     // Staff who responded
  respondedAt?: Date;       // Response timestamp
  response?: string;        // Staff response text
}
```

**Business Rules**:
- One feedback per case per client
- Ratings must be 1-5 inclusive
- Anonymous feedback hides client identity
- Follow-up requests tracked for quality assurance

### 8. InformationChannel Entity (`src/domain/entities/information-channel.ts`)

Represents bot-managed information messages in Discord channels.

```typescript
export interface InformationChannel extends BaseEntity {
  guildId: string;
  channelId: string;
  messageId?: string;      // Discord message ID (if exists)
  title: string;
  content: string;
  color?: number;          // Embed color (hex)
  thumbnailUrl?: string;
  imageUrl?: string;
  footer?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  lastUpdatedBy: string;   // Discord user ID
  lastUpdatedAt: Date;
}
```

**Business Rules**:
- One information message per channel
- Message content is persisted in database
- Supports rich embed formatting
- Automatic message recreation if deleted
- Permission-based management

### 9. RulesChannel Entity (`src/domain/entities/rules-channel.ts`)

Bot-maintained rules messages with structured rule management.

```typescript
export interface Rule {
  id: string;
  title: string;
  description: string;
  category?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  order: number;
}

export interface RulesChannel extends BaseEntity {
  guildId: string;
  channelId: string;
  messageId?: string;        // Discord message ID
  title: string;             // Rules message title
  content: string;           // Introduction/description
  rules: Rule[];             // Array of rules
  color?: number;            // Embed color
  showNumbers?: boolean;     // Show rule numbers
  additionalFields?: Array<{ // Additional embed fields
    name: string;
    value: string;
    inline?: boolean;
  }>;
  lastUpdatedBy: string;     // User who last updated
  lastUpdatedAt: Date;       // Last update timestamp
}
```

**Business Rules**:
- One rules message per channel
- Rules are ordered and can be categorized
- Supports severity levels for rules
- Rich embed formatting with Discord.js
- Individual rule management (add/remove)

### 10. Reminder Entity (`src/domain/entities/reminder.ts`)

Scheduled reminders with natural language processing.

```typescript
export interface Reminder extends Base {
  guildId: string;
  userId: string;           // Reminder owner
  title: string;            // Reminder title
  description?: string;     // Detailed description
  dueDate: Date;            // When to trigger
  recurring?: ReminderRecurrence;  // Recurrence pattern
  relatedCaseId?: string;   // Associated case
  channelId?: string;       // Where to send reminder
  status: ReminderStatus;   // Current status
  lastTriggered?: Date;     // Last execution time
  nextTrigger?: Date;       // Next scheduled time
  completedAt?: Date;       // Completion timestamp
  completedBy?: string;     // Who marked complete
  snoozedUntil?: Date;      // Snooze timestamp
  failureCount: number;     // Delivery failure count
}

export interface ReminderRecurrence {
  pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;         // Every N days/weeks/etc
  endDate?: Date;           // When recurrence ends
  daysOfWeek?: number[];    // For weekly: 0=Sun, 6=Sat
  dayOfMonth?: number;      // For monthly: 1-31
}

export enum ReminderStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  SNOOZED = 'snoozed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}
```

**Business Rules**:
- Reminders execute within 5 minutes of due time
- Failed reminders retry up to 3 times
- Recurring reminders generate next instance automatically
- Case-related reminders cancelled when case closes

### 9. AuditLog Entity (`src/domain/entities/audit-log.ts`)

Comprehensive audit trail for compliance and security.

```typescript
export interface AuditLog extends Base {
  guildId: string;
  action: AuditAction;      // Type of action performed
  actorId: string;          // Who performed action
  targetId?: string;        // Target user/entity
  targetType?: string;      // Type of target
  details: AuditDetails;    // Detailed action information
  ipAddress?: string;       // Actor's IP if available
  userAgent?: string;       // Client information
  timestamp: Date;          // When action occurred
  severity: AuditSeverity;  // Importance level
  correlationId?: string;   // Link related actions
}

export interface AuditDetails {
  before?: any;             // State before change
  after?: any;              // State after change
  reason?: string;          // Why action taken
  metadata?: Record<string, any>;  // Additional context
}

export enum AuditAction {
  // Staff actions
  STAFF_HIRED = 'STAFF_HIRED',
  STAFF_FIRED = 'STAFF_FIRED',
  STAFF_PROMOTED = 'STAFF_PROMOTED',
  STAFF_DEMOTED = 'STAFF_DEMOTED',
  
  // Case actions
  CASE_CREATED = 'CASE_CREATED',
  CASE_ASSIGNED = 'CASE_ASSIGNED',
  CASE_CLOSED = 'CASE_CLOSED',
  
  // System actions
  CONFIG_CHANGED = 'CONFIG_CHANGED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  
  // Security actions
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  ROLE_LIMIT_BYPASS = 'ROLE_LIMIT_BYPASS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

**Business Rules**:
- All significant actions must be logged
- Audit logs are immutable (no updates/deletes)
- High/critical severity triggers alerts
- Logs retained for compliance period (7 years)

### 10. GuildConfig Entity (`src/domain/entities/guild-config.ts`)

Per-guild configuration and settings.

```typescript
export interface GuildConfig extends Base {
  guildId: string;
  
  // Channel configurations
  feedbackChannelId?: string;      // Feedback submission channel
  retainerChannelId?: string;      // Retainer agreements channel
  caseReviewCategoryId?: string;   // Case channels category
  caseArchiveCategoryId?: string;  // Archived cases category
  modlogChannelId?: string;        // Moderation log channel
  applicationChannelId?: string;   // Job applications channel
  defaultInformationChannelId?: string; // Default channel for information messages
  defaultRulesChannelId?: string;  // Default channel for rules messages
  
  // Role configurations
  clientRoleId?: string;           // Auto-assigned client role
  
  // Permission configurations
  permissions: PermissionConfig;    // Role-based permissions
  adminRoles: string[];            // Discord roles with admin
  adminUsers: string[];            // Discord users with admin
  
  // Feature toggles
  features: FeatureFlags;          // Enabled/disabled features
  
  // Business rules
  maxActiveCasesPerClient: number;  // Case limit (default: 5)
  retainerExpirationDays: number;   // Retainer validity period
  caseInactivityDays: number;       // Auto-close inactive cases
  
  // Integration settings
  robloxGroupId?: string;          // Roblox group integration
  webhookUrl?: string;             // External webhook endpoint
}

export interface PermissionConfig {
  admin: string[];          // Admin permission roles
  'senior-staff': string[]; // Senior staff roles
  case: string[];           // Case management roles
  config: string[];         // Configuration roles
  lawyer: string[];         // Lawyer roles
  'lead-attorney': string[]; // Lead attorney roles
  repair: string[];         // System repair roles
}

export interface FeatureFlags {
  robloxIntegration: boolean;
  autoArchiveCases: boolean;
  clientSelfService: boolean;
  advancedAnalytics: boolean;
  aiAssistance: boolean;
}
```

**Business Rules**:
- Guild config created automatically on first bot interaction
- Permission changes logged to audit trail
- Feature flags allow gradual rollout
- Business rule overrides require authorization

### 11. CaseCounter Entity (`src/domain/entities/case.ts`)

Sequential case numbering system.

```typescript
export interface CaseCounter extends Base {
  guildId: string;
  year: number;             // Current year
  count: number;            // Current count for year
}
```

**Business Rules**:
- Counters reset annually
- Atomic increment to prevent duplicates
- Format: YYYY-NNNN-ClientUsername
- Historical counters preserved

### 12. Base Entity (`src/domain/entities/base.ts`)

Common fields for all entities.

```typescript
export interface Base {
  _id?: ObjectId;           // MongoDB ObjectId
  createdAt?: Date;         // Creation timestamp
  updatedAt?: Date;         // Last update timestamp
}
```

**Business Rules**:
- All entities extend Base
- Timestamps managed automatically
- ObjectId assigned by persistence layer

## Domain Services

### Role Hierarchy Service

Manages staff role transitions and validations.

```typescript
class RoleHierarchyService {
  canPromote(currentRole: StaffRole, targetRole: StaffRole): boolean {
    const currentLevel = RoleUtils.getRoleLevel(currentRole);
    const targetLevel = RoleUtils.getRoleLevel(targetRole);
    return targetLevel === currentLevel + 1;
  }
  
  canDemote(currentRole: StaffRole, targetRole: StaffRole): boolean {
    const currentLevel = RoleUtils.getRoleLevel(currentRole);
    const targetLevel = RoleUtils.getRoleLevel(targetRole);
    return targetLevel === currentLevel - 1;
  }
  
  getAvailablePromotions(currentRole: StaffRole): StaffRole[] {
    // Returns valid promotion targets
  }
  
  getAvailableDemotions(currentRole: StaffRole): StaffRole[] {
    // Returns valid demotion targets
  }
}
```

### Case Numbering Service

Generates sequential case numbers.

```typescript
class CaseNumberingService {
  generateCaseNumber(year: number, count: number, username: string): string {
    const paddedCount = count.toString().padStart(4, '0');
    return `${year}-${paddedCount}-${username}`;
  }
  
  parseCaseNumber(caseNumber: string): CaseNumberComponents | null {
    const match = caseNumber.match(/^(\d{4})-(\d{4})-(.+)$/);
    if (!match) return null;
    
    return {
      year: parseInt(match[1]),
      count: parseInt(match[2]),
      username: match[3]
    };
  }
}
```

## Value Objects

### PromotionRecord

Immutable record of role changes.

```typescript
export interface PromotionRecord {
  fromRole: StaffRole;
  toRole: StaffRole;
  promotedBy: string;       // Discord ID of promoter
  promotedAt: Date;         // When promotion occurred
  reason: string;           // Reason for change
}
```

### CaseNote

Immutable case notation.

```typescript
export interface CaseNote {
  id: string;
  authorId: string;         // Note author Discord ID
  content: string;          // Note content
  createdAt: Date;          // When created
  isInternal: boolean;      // Internal vs client-visible
  editedAt?: Date;          // Last edit timestamp
  editedBy?: string;        // Editor Discord ID
}
```

### CaseDocument

Immutable document reference.

```typescript
export interface CaseDocument {
  id: string;
  name: string;             // Document name
  url: string;              // Discord attachment URL
  uploadedBy: string;       // Uploader Discord ID
  uploadedAt: Date;         // Upload timestamp
  size: number;             // File size in bytes
  mimeType: string;         // File MIME type
}
```

## Domain Events

### Staff Events
- StaffHired
- StaffFired
- StaffPromoted
- StaffDemoted
- StaffSuspended
- StaffReinstated

### Case Events
- CaseCreated
- CaseAssigned
- CaseAccepted
- CaseDeclined
- CaseClosed
- CaseArchived
- LeadAttorneyAssigned
- LawyerAdded
- LawyerRemoved

### System Events
- RoleLimitExceeded
- PermissionDenied
- ConfigurationChanged
- AuditLogCreated

## Business Rules Summary

### Staff Management
1. **Role Limits**: Strict enforcement with bypass for guild owners
2. **Promotion Path**: Sequential progression through hierarchy
3. **Termination**: Preserves history, prevents accidental rehire
4. **Roblox Integration**: Username validation and uniqueness

### Case Management
1. **Client Limits**: Maximum 5 active cases per client
2. **Sequential Numbering**: Year-based with automatic reset
3. **Assignment Rules**: Only qualified staff can be assigned
4. **Archival Policy**: Closed cases archived, not deleted

### Permission System
1. **Hierarchical**: Higher roles inherit lower permissions
2. **Action-Based**: Specific permissions for actions
3. **Guild-Specific**: Permissions configured per guild
4. **Audit Trail**: All permission changes logged

### Data Integrity
1. **Immutability**: Audit logs and historical records
2. **Soft Deletes**: Termination/cancellation vs deletion
3. **Validation**: Business rules enforced at domain level
4. **Consistency**: Transactions for multi-step operations

## Domain Invariants

### Staff Invariants
- A guild can have exactly one Managing Partner
- Staff Discord IDs are unique per guild
- Roblox usernames are unique per guild
- Terminated staff cannot hold active roles

### Case Invariants
- Case numbers are unique and sequential
- Closed cases cannot be modified
- Lead attorney must be an assigned lawyer
- Client must exist for case creation

### System Invariants
- Audit logs are append-only
- Configuration changes require authorization
- Permission escalation requires higher permission
- All timestamps in UTC

## Anti-Corruption Layer

The domain layer is protected from external concerns through:

1. **No Framework Dependencies**: Pure TypeScript interfaces and classes
2. **No Database Concerns**: No MongoDB-specific code
3. **No Discord API**: No Discord.js dependencies
4. **No External Services**: No HTTP clients or external APIs

## Testing Strategy

### Unit Tests
- Pure domain logic testing
- Business rule validation
- Entity behavior verification
- Value object immutability

### Property-Based Tests
- Invariant verification
- State transition validation
- Business rule consistency

### Example Test
```typescript
describe('StaffRole', () => {
  it('should enforce Managing Partner limit', () => {
    const limit = RoleUtils.getRoleMaxCount(StaffRole.MANAGING_PARTNER);
    expect(limit).toBe(1);
  });
  
  it('should validate promotion path', () => {
    const canPromote = RoleUtils.canPromoteTo(
      StaffRole.JUNIOR_ASSOCIATE,
      StaffRole.SENIOR_ASSOCIATE
    );
    expect(canPromote).toBe(true);
  });
});
```

## Future Considerations

### Potential Enhancements
1. **Event Sourcing**: Full audit trail as event stream
2. **CQRS**: Separate read/write models
3. **Domain Events**: Pub/sub for cross-aggregate communication
4. **Saga Pattern**: Complex multi-step workflows

### Scalability Considerations
1. **Aggregate Boundaries**: Ensure proper boundaries
2. **Eventual Consistency**: Between aggregates
3. **Domain Service Extraction**: Complex logic isolation
4. **Performance Optimization**: Lazy loading patterns

## Conclusion

The Domain Layer provides a robust foundation for the Anarchy & Associates Discord bot, encapsulating all business logic and rules independent of technical concerns. This separation ensures maintainability, testability, and flexibility for future changes.