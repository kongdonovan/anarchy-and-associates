# UnifiedRoleService Architecture Design

## Overview
The UnifiedRoleService consolidates 5 existing role-related services into a comprehensive role management solution following DDD principles and Clean Architecture patterns.

## Services Being Consolidated
1. **StaffService** - Staff lifecycle management (hire/fire/promote/demote)
2. **RoleTrackingService** - Discord role change tracking and event handling
3. **DiscordRoleSyncService** - Discord-database role synchronization
4. **RoleSynchronizationEnhancementService** - Conflict detection and resolution
5. **RoleChangeCascadeService** - Cascading effects and side-effect management

## Architecture Principles

### 1. Single Responsibility with Clear Domains
The unified service maintains separation of concerns through distinct internal domains:
- **Staff Lifecycle Management** - Hiring, firing, promotion, demotion workflows
- **Discord Integration** - Real-time role change tracking via guildMemberUpdate events
- **Synchronization** - Bidirectional sync between Discord roles and MongoDB staff records
- **Business Rules** - 2-role maximum enforcement, hierarchy validation, conflict resolution
- **Channel Permissions** - Automatic permission updates based on role changes

### 2. Event-Driven Architecture
- Discord event handlers trigger internal workflows
- Internal events for workflow coordination (hire → sync → cascade)
- Audit trail for all role operations
- Error recovery and rollback mechanisms

### 3. Strategy Pattern for Conflict Resolution
- Multiple conflict resolution strategies: automatic, manual, precedence-based
- Configurable conflict handling per guild
- Audit logging for all conflict resolutions

## Core Interfaces

```typescript
interface IUnifiedRoleService {
  // Staff Lifecycle Operations
  hireStaff(context: PermissionContext, request: StaffHireRequest): Promise<Staff>;
  fireStaff(context: PermissionContext, request: StaffTerminationRequest): Promise<void>;
  promoteStaff(context: PermissionContext, request: StaffPromotionRequest): Promise<Staff>;
  demoteStaff(context: PermissionContext, request: StaffDemotionRequest): Promise<Staff>;
  
  // Discord Integration
  handleDiscordRoleChange(oldMember: GuildMember, newMember: GuildMember): Promise<void>;
  syncStaffRole(guildId: string, userId: string, targetRole: StaffRole): Promise<void>;
  
  // Synchronization Operations
  syncAllStaffRoles(guildId: string): Promise<RoleSyncResult>;
  validateRoleAssignment(guildId: string, userId: string, roles: StaffRole[]): Promise<RoleValidationResult>;
  
  // Conflict Resolution
  detectRoleConflicts(guildId: string): Promise<RoleConflict[]>;
  resolveConflict(guildId: string, conflict: RoleConflict, strategy: ConflictResolutionStrategy): Promise<ConflictResolutionResult>;
}

interface IRoleEventHandler {
  onRoleAdded(event: RoleChangeEvent): Promise<void>;
  onRoleRemoved(event: RoleChangeEvent): Promise<void>;
  onMultipleRolesChanged(event: BulkRoleChangeEvent): Promise<void>;
}

interface IRoleSynchronizer {
  syncToDiscord(staff: Staff): Promise<void>;
  syncFromDiscord(member: GuildMember): Promise<void>;
  createMissingRoles(guild: Guild): Promise<void>;
}

interface IConflictResolver {
  detectConflicts(members: GuildMember[]): Promise<RoleConflict[]>;
  resolveConflict(conflict: RoleConflict, strategy: ConflictResolutionStrategy): Promise<void>;
}

interface ICascadeManager {
  handleRoleChange(event: RoleChangeEvent): Promise<void>;
  updateChannelPermissions(userId: string, oldRoles: StaffRole[], newRoles: StaffRole[]): Promise<void>;
  updateCaseAssignments(userId: string, newRole: StaffRole): Promise<void>;
}
```

## Internal Components

### 1. StaffLifecycleManager
- Handles hire/fire/promote/demote workflows
- Validates business rules (role limits, hierarchy)
- Integrates with existing validation services
- Maintains audit trail

### 2. DiscordEventProcessor
- Listens to guildMemberUpdate events
- Processes role additions/removals
- Triggers appropriate workflows
- Handles Discord reconnection logic

### 3. BidirectionalSynchronizer
- Keeps Discord roles and database in sync
- Handles bulk synchronization operations
- Race condition protection
- Rollback mechanisms for failed syncs

### 4. ConflictDetectionEngine
- Monitors for 2-role violations
- Detects hierarchy conflicts
- Precedence rule enforcement
- Automatic conflict resolution where possible

### 5. CascadeEffectManager
- Updates channel permissions
- Manages case assignments
- Handles lawyer/lead attorney permission cascades
- Notifies affected parties

### 6. BusinessRuleEnforcer
- 2-role maximum validation
- Role hierarchy constraints
- Capacity limits per role
- Permission-based restrictions

## Data Flow Architecture

```
Discord Event → DiscordEventProcessor → BusinessRuleEnforcer → StaffLifecycleManager
                                      ↓
CascadeEffectManager ← BidirectionalSynchronizer ← ConflictDetectionEngine
                                      ↓
                                 Audit Logging
```

## Error Handling Strategy

### 1. Transactional Operations
- All role changes are transactional
- Rollback mechanisms for partial failures
- Eventual consistency patterns for Discord API issues

### 2. Retry Logic
- Exponential backoff for Discord API calls
- Circuit breaker pattern for external dependencies
- Dead letter queue for failed operations

### 3. Graceful Degradation
- Read-only mode during Discord outages
- Local cache for temporary role state
- Manual resolution workflows for edge cases

## Performance Optimizations

### 1. Caching Strategy
- In-memory cache for active role states
- Redis cache for cross-instance synchronization
- TTL-based cache invalidation

### 2. Batch Operations
- Bulk role synchronization
- Batched Discord API calls
- Aggregated audit log entries

### 3. Event Debouncing
- Debounce rapid role changes
- Batch processing of bulk operations
- Rate limiting for API calls

## Security Considerations

### 1. Permission Validation
- Validate all role operations against permission context
- Guild owner bypass mechanisms
- Admin override capabilities

### 2. Audit Trail
- Complete audit log for all operations
- Immutable audit records
- Compliance with data retention policies

### 3. Input Validation
- Sanitize all Discord inputs
- Validate role hierarchy constraints
- Prevent privilege escalation

## Integration Points

### 1. Existing Services
- **UnifiedValidationService** - For business rule validation
- **PermissionService** - For authorization checks
- **AuditLogRepository** - For audit trail
- **ChannelPermissionManager** - For channel updates

### 2. Discord.js Integration
- guildMemberUpdate event handling
- Role manager integration
- Guild member caching
- Permission overwrite management

### 3. Database Integration
- StaffRepository for staff records
- GuildConfigRepository for guild settings
- Transactional operations support

## Migration Strategy

### Phase 1: Create Unified Interface
- Implement IUnifiedRoleService interface
- Maintain backward compatibility
- Gradual service consolidation

### Phase 2: Internal Consolidation
- Merge overlapping functionality
- Optimize data flows
- Implement new conflict resolution

### Phase 3: Service Replacement
- Update command handlers
- Replace service dependencies
- Remove legacy services

### Phase 4: Testing and Validation
- Comprehensive integration testing
- Performance benchmarking
- Production rollout validation

## Testing Strategy

### 1. Unit Tests
- Individual component testing
- Mock Discord API interactions
- Business rule validation

### 2. Integration Tests
- End-to-end workflows
- Database transaction testing
- Event processing validation

### 3. Performance Tests
- Load testing for bulk operations
- Concurrent operation handling
- Memory usage optimization

### 4. Edge Case Tests
- Network failure scenarios
- Partial failure recovery
- Conflict resolution edge cases

This architecture provides a solid foundation for consolidating all role-related functionality while maintaining the existing system's reliability and expanding its capabilities for conflict resolution and advanced synchronization.